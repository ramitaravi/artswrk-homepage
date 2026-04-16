/**
 * Migration: Client-to-Artist Rate Conversions
 * Pulls all records from Bubble's "ClientToArtistRateConversion" type → `rate_conversions`
 * table with conversionType="client_to_artist".
 *
 * Run AFTER migrate-rate-conversions.ts (which loads the artist_to_client direction).
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-client-to-artist-rate-conversions.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleClientToArtistConversion {
  _id: string;
  "Artist Rate"?: number;
  "Client Rate"?: number;
  "hourly?"?: boolean;
  "Created Date"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log("Fetching client-to-artist rate conversions from Bubble...");
  const records = await fetchAllRecords<BubbleClientToArtistConversion>(
    "ClientToArtistRateConversion",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const r of records) {
    try {
      await conn.execute(
        `INSERT IGNORE INTO rate_conversions
           (bubbleId, conversionType, artistRate, clientRate, isHourly, bubbleCreatedAt)
         VALUES (?, 'client_to_artist', ?, ?, ?, ?)`,
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
      if (e.code === "ER_DUP_ENTRY") { skipped++; }
      else { errors++; console.error(`\nError on ${r._id}:`, e.message); }
    }

    if ((inserted + skipped + errors) % 200 === 0)
      process.stdout.write(`\r  Processed ${inserted + skipped + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
