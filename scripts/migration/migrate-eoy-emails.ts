/**
 * Migration: End of Year Email Snapshots
 * Pulls all 144 records from Bubble's "end_of_year_email" type → `eoy_email_snapshots` table.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-eoy-emails.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleEoyEmail {
  _id: string;
  "Artist"?: string;            // Bubble user ID of the artist
  "Name"?: string;
  "Email"?: string;
  "Bookings 2023"?: number;
  "Earnings 2023"?: number;
  "Reimbursements 2023"?: number;
  "Bookings 2024"?: number;
  "Earnings 2024"?: number;
  "Created Date"?: string;
  "Modified Date"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching end-of-year email snapshots from Bubble...");
  const records = await fetchAllRecords<BubbleEoyEmail>(
    "end_of_year_email",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const artistUserId = r["Artist"] ? (bubbleToUserId[r["Artist"]] ?? null) : null;

    try {
      await conn.execute(
        `INSERT IGNORE INTO eoy_email_snapshots
           (bubbleId, artistUserId, bubbleArtistId, name, email,
            bookings2023, earnings2023, reimbursements2023,
            bookings2024, earnings2024,
            bubbleCreatedAt, bubbleModifiedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r._id,
          artistUserId,
          r["Artist"] ?? null,
          r["Name"] ?? null,
          r["Email"]?.trim() ?? null,
          r["Bookings 2023"] ?? null,
          r["Earnings 2023"] ?? null,
          r["Reimbursements 2023"] ?? null,
          r["Bookings 2024"] ?? null,
          r["Earnings 2024"] ?? null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      );
      inserted++;
      console.log(`  ✓ ${r["Name"] ?? r._id}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { skipped++; }
      else { errors++; console.error(`\nError on ${r._id}:`, e.message); }
    }
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
