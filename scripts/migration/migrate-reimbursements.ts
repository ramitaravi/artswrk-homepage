/**
 * Migration: Reimbursements
 * Pulls all records from Bubble's "reimbursement" type → `reimbursements` table.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-reimbursements.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleReimbursement {
  _id: string;
  "Booking"?: string;
  "Artist"?: string;
  "Value"?: number;
  "Note"?: string;
  "File"?: string;
  "Expense Date"?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → bookingId lookup
  const [bookingRows] = await conn.execute(
    "SELECT id, bubbleId FROM bookings WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToBookingId: Record<string, number> = {};
  for (const b of bookingRows) bubbleToBookingId[b.bubbleId] = b.id;
  console.log(`Loaded ${Object.keys(bubbleToBookingId).length} booking mappings`);

  // Build bubbleId → userId lookup
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching reimbursements from Bubble...");
  const records = await fetchAllRecords<BubbleReimbursement>(
    "reimbursement",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} reimbursements`);

  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const bubbleBookingId = r["Booking"] ?? null;
    const bubbleArtistId = r["Artist"] ?? null;
    const bookingId = bubbleBookingId ? (bubbleToBookingId[bubbleBookingId] ?? null) : null;
    const artistUserId = bubbleArtistId ? (bubbleToUserId[bubbleArtistId] ?? null) : null;

    if (!bookingId) {
      skipped++;
      continue;
    }

    const value = r["Value"] ?? null;
    const note = r["Note"] ?? null;
    const fileUrl = r["File"] ?? null;
    const expenseDate = r["Expense Date"] ? new Date(r["Expense Date"]) : null;
    const createdAt = r["Created Date"] ? new Date(r["Created Date"]) : null;
    const modifiedAt = r["Modified Date"] ? new Date(r["Modified Date"]) : null;

    try {
      const [res] = await conn.execute(
        `INSERT INTO reimbursements
          (bubbleId, bookingId, bubbleBookingId, artistUserId, bubbleArtistId,
           value, note, fileUrl, expenseDate, bubbleCreatedAt, bubbleModifiedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           bookingId=VALUES(bookingId), artistUserId=VALUES(artistUserId),
           value=VALUES(value), note=VALUES(note), fileUrl=VALUES(fileUrl),
           expenseDate=VALUES(expenseDate), bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [r._id, bookingId, bubbleBookingId, artistUserId, bubbleArtistId,
         value, note, fileUrl, expenseDate, createdAt, modifiedAt]
      ) as any[];

      if (res.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on ${r._id}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone. inserted=${inserted} updated=${updated} skipped=${skipped} errors=${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
