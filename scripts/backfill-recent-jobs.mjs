/**
 * One-off backfill: sync jobs modified in the last 3 hours.
 * This catches any jobs that were missed due to the status-filter bug.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || "12172ddf5b3c42d8a4936d57afe0f029";
const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchAllPages(type, constraints = []) {
  const results = [];
  let cursor = 0;
  while (true) {
    const params = new URLSearchParams({ limit: "100", cursor: String(cursor) });
    if (constraints.length) params.set("constraints", JSON.stringify(constraints));
    const url = `${BUBBLE_API_BASE}/${type}?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` } });
    const data = await res.json();
    const page = data.response;
    results.push(...(page.results ?? []));
    process.stdout.write(`\r  [${type}] fetched ${results.length}, remaining ${page.remaining ?? 0}   `);
    if (!page.remaining || page.remaining <= 0) break;
    cursor += 100;
  }
  console.log();
  return results;
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [userRows] = await conn.execute("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
const userMap = new Map(userRows.map((r) => [r.bubbleId, r.id]));

// Fetch jobs modified in the last 3 hours
const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
console.log(`Fetching jobs modified since: ${since}`);
const records = await fetchAllPages("Request", [
  { key: "Modified Date", constraint_type: "greater than", value: since },
]);

let upserted = 0, errors = 0;
for (const r of records) {
  const clientUserId = r["Created By"] ? (userMap.get(r["Created By"]) ?? null) : null;
  const loc = r.Location ?? {};
  const startDate = safeDate(r["Start date"] ?? r["start date"]);
  const endDate = safeDate(r["End date"] ?? r["end date"]);
  const bubbleCreatedAt = safeDate(r["Created Date"]);
  const bubbleModifiedAt = safeDate(r["Modified Date"]);
  const requestStatus = r["Request Status"] ?? r["Request status"] ?? null;

  try {
    await conn.execute(
      `INSERT INTO jobs (
        bubbleId, clientUserId, bubbleClientId, bubbleClientCompanyId,
        description, slug, requestStatus, status,
        dateType, startDate, endDate,
        locationAddress, locationLat, locationLng,
        isHourly, openRate, artistHourlyRate, clientHourlyRate,
        ages, direct, sentToNetwork, transportation, converted,
        clientEmail, bubbleCreatedAt, bubbleModifiedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        requestStatus = VALUES(requestStatus),
        status = VALUES(status),
        description = VALUES(description),
        startDate = VALUES(startDate),
        endDate = VALUES(endDate),
        locationAddress = VALUES(locationAddress),
        locationLat = VALUES(locationLat),
        locationLng = VALUES(locationLng),
        bubbleModifiedAt = VALUES(bubbleModifiedAt)`,
      [
        r._id, clientUserId,
        r["Created By"] ?? null,
        r["Client-Company"] ?? r["client company"] ?? null,
        r.Description ?? r.description ?? null,
        r.Slug ?? r.slug ?? null,
        requestStatus, requestStatus,
        r["Date type"] ?? r["date type"] ?? r["DateType"] ?? null,
        startDate, endDate,
        loc.address ?? null,
        loc.lat != null ? String(loc.lat) : null,
        loc.lng != null ? String(loc.lng) : null,
        r["is hourly?"] || r["Is Hourly?"] ? 1 : 0,
        r["open rate?"] || r["Open Rate?"] ? 1 : 0,
        r["Artist Hourly Rate"] ?? r["artist hourly rate"] ?? null,
        r["Client Hourly Rate"] ?? r["client hourly rate"] ?? null,
        r.Ages ?? r.ages ?? null,
        r["direct?"] || r["Direct?"] ? 1 : 0,
        r["sent to network?"] || r["Sent to Network?"] ? 1 : 0,
        r["transportation?"] || r["Transportation?"] || r["tranportation?"] ? 1 : 0,
        r["converted?"] || r["Converted?"] ? 1 : 0,
        r["client email"] ?? r["Client Email"] ?? null,
        bubbleCreatedAt, bubbleModifiedAt,
      ]
    );
    console.log(`  ✓ ${r._id} | ${requestStatus}`);
    upserted++;
  } catch (err) {
    console.error(`  ✗ ${r._id}: ${err.message}`);
    errors++;
  }
}

console.log(`\nDone: ${upserted} upserted, ${errors} errors`);
await conn.end();
