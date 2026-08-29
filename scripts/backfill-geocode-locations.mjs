/**
 * One-time geocode backfill for historical rows that only have a text
 * address — no lat/lng, city, or state on file. Needed for radius search to
 * find anything predating the Google Places rollout.
 *
 * BLOCKED until drizzle/0050_loving_may_parker.sql is applied — every
 * table below needs its new locationLat/locationCity/locationState/
 * locationPlaceId columns to exist first. Running this before then will
 * fail outright (columns don't exist).
 *
 * Run with `npx tsx scripts/backfill-geocode-locations.mjs` — it does a
 * dynamic import of server/location.ts (real .ts, not compiled), which
 * plain `node` can't resolve.
 *
 * Resumable by design: only selects rows WHERE the new lat column IS NULL
 * AND the text address IS NOT NULL, excluding anything already logged as a
 * failure (see below) directly in the SQL — so a re-run (after a crash, a
 * rate limit, or just stopping it) picks up exactly where it left off,
 * without ever getting stuck re-fetching the same already-failed page.
 *
 * Rate-limited: geocoding runs through the Forge proxy (server/location.ts
 * -> geocodeLocation), since the browser Places key is referrer-restricted
 * and rejected on the server-side REST Geocoding API. Thousands of rows
 * across 4 tables, so this paces itself rather than firing all at once.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
// Must run before the dynamic import below — server/location.ts reads
// ENV at module-load time, so DATABASE_URL/keys need to already be in
// process.env before that import executes. Easy to break by reordering.
dotenv.config();

// Failures are tracked here, NOT by writing a sentinel into locationLat/Lng —
// '0,0' is a real, finite coordinate (Gulf of Guinea), so anything downstream
// that checks "does this row have real coordinates" via Number.isFinite would
// wrongly treat a failed geocode as a genuine location. A separate log keeps
// the resumability logic (skip what we've already tried) without ever
// putting a fake value in a real data column.
const FAILED_LOG_PATH = new URL("./_geocode_backfill_failed.json", import.meta.url);
function loadFailedIds() {
  try {
    return new Set(JSON.parse(fs.readFileSync(FAILED_LOG_PATH, "utf-8")));
  } catch {
    return new Set();
  }
}
function saveFailedIds(set) {
  fs.writeFileSync(FAILED_LOG_PATH, JSON.stringify([...set]));
}

// Import the real geocoder so this uses the exact same resolution logic
// (and Forge-proxy fallback) as the live save paths — no reimplementation.
const { geocodeLocation } = await import("../server/location.ts");

const DELAY_MS = 250; // ~4 req/s — comfortably under typical Geocoding API limits
const BATCH_SIZE = 50;

const TABLES = [
  { table: "users", addressCol: "location", idCol: "id", hasCountry: true },
  { table: "jobs", addressCol: "locationAddress", idCol: "id", hasCountry: false },
  { table: "premium_jobs", addressCol: "location", idCol: "id", hasCountry: false },
  { table: "client_companies", addressCol: "locationAddress", idCol: "id", hasCountry: false },
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const failedIds = loadFailedIds(); // keys are "table:id"

for (const { table, addressCol, idCol, hasCountry } of TABLES) {
  console.log(`\n=== ${table} ===`);

  const [[{ total }]] = await conn.execute(
    `SELECT COUNT(*) AS total FROM ${table} WHERE locationLat IS NULL AND ${addressCol} IS NOT NULL AND ${addressCol} != ''`
  );
  const failedForTable = [...failedIds]
    .filter((k) => k.startsWith(`${table}:`))
    .map((k) => Number(k.split(":")[1]));
  console.log(`${total} rows need geocoding (${failedForTable.length} already logged as failed, excluded from the query below so the window always advances)`);

  let processed = 0, geocoded = 0, failed = 0;

  while (true) {
    // Excluding failures in SQL (not by filtering the JS result) is the
    // whole fix: a row whose geocode failed keeps locationLat NULL forever,
    // so without this NOT IN, the same already-failed rows would keep
    // filling every page and the loop would stop the moment 50+ rows in a
    // table had failed — even with thousands of untried rows still sitting
    // past that point. ORDER BY makes the window deterministic across
    // iterations; without it LIMIT's ordering isn't guaranteed stable.
    const notIn = failedForTable.length
      ? `AND ${idCol} NOT IN (${failedForTable.map(() => "?").join(",")})`
      : "";
    const [rows] = await conn.execute(
      `SELECT ${idCol} AS id, ${addressCol} AS address FROM ${table}
       WHERE locationLat IS NULL AND ${addressCol} IS NOT NULL AND ${addressCol} != '' ${notIn}
       ORDER BY ${idCol}
       LIMIT ${BATCH_SIZE}`,
      failedForTable
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      const result = await geocodeLocation(row.address);
      if (result && result.lat != null && result.lng != null) {
        const cols = {
          locationLat: String(result.lat),
          locationLng: String(result.lng),
          locationCity: result.city ?? null,
          // Short code, not the long name — filters compare against short codes.
          locationState: result.stateCode ?? result.state ?? null,
          locationPlaceId: result.placeId ?? null,
        };
        if (hasCountry) cols.locationCountry = result.countryCode ?? result.country ?? null;

        const setClause = Object.keys(cols).map((c) => `${c} = ?`).join(", ");
        await conn.execute(`UPDATE ${table} SET ${setClause} WHERE ${idCol} = ?`, [...Object.values(cols), row.id]);
        geocoded++;
      } else {
        failedIds.add(`${table}:${row.id}`);
        saveFailedIds(failedIds);
        // Also push into this run's exclusion list — without this, the very
        // next page's query wouldn't know about a failure from a few rows
        // ago and would fetch it right back into the window.
        failedForTable.push(row.id);
        failed++;
      }
      processed++;
      if (processed % 10 === 0) process.stdout.write(`\r  ${processed} processed (${geocoded} geocoded, ${failed} no match)`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n  Done: ${geocoded} geocoded, ${failed} no match, ${processed} processed this run`);
}

await conn.end();
