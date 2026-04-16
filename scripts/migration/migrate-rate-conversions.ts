/**
 * Migration: Artist-to-Client Rate Conversions
 * Pulls all 1,986 records from Bubble's "ArtistToClientRateConversion" type.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-rate-conversions.ts
 */

import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleRateConversion {
  _id: string;
  "Artist Rate"?: number;
  "Client Rate"?: number;
  "hourly?"?: boolean;
  "Created Date"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log("Fetching rate conversions from Bubble...");
  const records = await fetchAllRecords<BubbleRateConversion>(
    "ArtistToClientRateConversion",
    (fetched, total) => process.stdout.write(`\r  Fetched ${fetched} / ${total}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const r of records) {
    try {
      await conn.execute(
        `INSERT IGNORE INTO rate_conversions (bubbleId, artistRate, clientRate, isHourly, bubbleCreatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [
          r._id,
          r["Artist Rate"] ?? null,
          r["Client Rate"] ?? null,
          r["hourly?"] ? 1 : 0,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
        ]
      );
      inserted++;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { skipped++; } else { errors++; console.error(e.message); }
    }
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
