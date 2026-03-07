/**
 * Seed script: Pull all "interested artists" records for Nick's account from
 * Bubble and insert them into the local interested_artists table.
 *
 * Run with: node scripts/seed-interested-artists.mjs
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import urllib from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-test/api/1.1/obj";
const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const NICK_BUBBLE_ID = "1659533883431x527826980339748400";

// ─── Bubble fetch helper ──────────────────────────────────────────────────────
async function fetchBubble(dataType, constraints = [], cursor = 0, limit = 100) {
  const params = new URLSearchParams({
    limit: String(limit),
    cursor: String(cursor),
  });
  if (constraints.length > 0) {
    params.set("constraints", JSON.stringify(constraints));
  }
  const url = `${BUBBLE_API_BASE}/${encodeURIComponent(dataType)}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Bubble API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchAllBubble(dataType, constraints = []) {
  const all = [];
  let cursor = 0;
  while (true) {
    const data = await fetchBubble(dataType, constraints, cursor);
    const results = data?.response?.results ?? [];
    all.push(...results);
    const remaining = data?.response?.remaining ?? 0;
    console.log(`  Fetched ${results.length}, total: ${all.length}, remaining: ${remaining}`);
    if (remaining === 0) break;
    cursor += results.length;
    await new Promise((r) => setTimeout(r, 200));
  }
  return all;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    // 1. Look up Nick's local user ID
    const [userRows] = await db.execute(
      "SELECT id FROM users WHERE bubbleId = ?",
      [NICK_BUBBLE_ID]
    );
    const nickLocalId = userRows[0]?.id;
    if (!nickLocalId) {
      console.error("Nick's user record not found in local DB. Run seed-bubble-user.mjs first.");
      process.exit(1);
    }
    console.log(`Nick's local user ID: ${nickLocalId}`);

    // 2. Fetch all interested artists for Nick from Bubble
    console.log("\nFetching interested artists from Bubble...");
    const records = await fetchAllBubble("interested artists", [
      { key: "client", constraint_type: "equals", value: NICK_BUBBLE_ID },
    ]);
    console.log(`\nTotal records fetched: ${records.length}`);

    // 3. Build a map of Bubble job IDs → local job IDs
    console.log("\nBuilding Bubble→local job ID map...");
    const [jobRows] = await db.execute(
      "SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL"
    );
    const jobMap = new Map(jobRows.map((r) => [r.bubbleId, r.id]));
    console.log(`  Found ${jobMap.size} local jobs to cross-reference`);

    // 4. Insert/upsert records
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const rec of records) {
      const bubbleId = rec._id;
      const bubbleRequestId = rec.request ?? null;
      const jobId = bubbleRequestId ? (jobMap.get(bubbleRequestId) ?? null) : null;

      const row = {
        bubbleId,
        jobId,
        bubbleRequestId,
        artistUserId: null, // artists not yet migrated
        bubbleArtistId: rec.artist ?? null,
        clientUserId: nickLocalId,
        bubbleClientId: rec.client ?? null,
        bubbleServiceId: rec.service ?? null,
        bubbleBookingId: rec.booking ?? null,
        status: rec.status_interestedartists ?? null,
        converted: rec["converted?"] ? 1 : 0,
        isHourlyRate: rec["is hourly rate?"] ? 1 : 0,
        artistHourlyRate: rec["artist hourly rate"] ?? null,
        clientHourlyRate: rec["client hourly rate"] ?? null,
        artistFlatRate: rec["artist flat rate"] ?? null,
        clientFlatRate: rec["client flat rate"] ?? null,
        totalHours: rec["total hours"] ?? null,
        startDate: rec["start date"] ? new Date(rec["start date"]) : null,
        endDate: rec["end date"] ? new Date(rec["end date"]) : null,
        resumeLink: rec.link ?? null,
        message: rec.message ?? null,
        bubbleCreatedAt: rec["Created Date"] ? new Date(rec["Created Date"]) : null,
        bubbleModifiedAt: rec["Modified Date"] ? new Date(rec["Modified Date"]) : null,
      };

      // Check if record already exists
      const [existing] = await db.execute(
        "SELECT id FROM interested_artists WHERE bubbleId = ?",
        [bubbleId]
      );

      if (existing.length > 0) {
        await db.execute(
          `UPDATE interested_artists SET
            jobId=?, bubbleRequestId=?, artistUserId=?, bubbleArtistId=?,
            clientUserId=?, bubbleClientId=?, bubbleServiceId=?, bubbleBookingId=?,
            status=?, converted=?, isHourlyRate=?, artistHourlyRate=?,
            clientHourlyRate=?, artistFlatRate=?, clientFlatRate=?, totalHours=?,
            startDate=?, endDate=?, resumeLink=?, message=?,
            bubbleCreatedAt=?, bubbleModifiedAt=?
          WHERE bubbleId=?`,
          [
            row.jobId, row.bubbleRequestId, row.artistUserId, row.bubbleArtistId,
            row.clientUserId, row.bubbleClientId, row.bubbleServiceId, row.bubbleBookingId,
            row.status, row.converted, row.isHourlyRate, row.artistHourlyRate,
            row.clientHourlyRate, row.artistFlatRate, row.clientFlatRate, row.totalHours,
            row.startDate, row.endDate, row.resumeLink, row.message,
            row.bubbleCreatedAt, row.bubbleModifiedAt,
            bubbleId,
          ]
        );
        updated++;
      } else {
        await db.execute(
          `INSERT INTO interested_artists (
            bubbleId, jobId, bubbleRequestId, artistUserId, bubbleArtistId,
            clientUserId, bubbleClientId, bubbleServiceId, bubbleBookingId,
            status, converted, isHourlyRate, artistHourlyRate,
            clientHourlyRate, artistFlatRate, clientFlatRate, totalHours,
            startDate, endDate, resumeLink, message,
            bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            row.bubbleId, row.jobId, row.bubbleRequestId, row.artistUserId, row.bubbleArtistId,
            row.clientUserId, row.bubbleClientId, row.bubbleServiceId, row.bubbleBookingId,
            row.status, row.converted, row.isHourlyRate, row.artistHourlyRate,
            row.clientHourlyRate, row.artistFlatRate, row.clientFlatRate, row.totalHours,
            row.startDate, row.endDate, row.resumeLink, row.message,
            row.bubbleCreatedAt, row.bubbleModifiedAt,
          ]
        );
        inserted++;
      }
    }

    console.log(`\n✅ Done!`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Updated:  ${updated}`);
    console.log(`  Skipped:  ${skipped}`);

    // 5. Summary stats
    const [stats] = await db.execute(
      "SELECT status, COUNT(*) as count FROM interested_artists WHERE clientUserId = ? GROUP BY status",
      [nickLocalId]
    );
    console.log("\nStatus breakdown in DB:");
    for (const row of stats) {
      console.log(`  ${row.status}: ${row.count}`);
    }

    // Job linkage stats
    const [linked] = await db.execute(
      "SELECT COUNT(*) as count FROM interested_artists WHERE clientUserId = ? AND jobId IS NOT NULL",
      [nickLocalId]
    );
    const [total] = await db.execute(
      "SELECT COUNT(*) as count FROM interested_artists WHERE clientUserId = ?",
      [nickLocalId]
    );
    console.log(`\nJob linkage: ${linked[0].count}/${total[0].count} records linked to local jobs`);

  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
