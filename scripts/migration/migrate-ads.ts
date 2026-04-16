/**
 * Migration: Ads
 * Pulls all records from Bubble's "ads" type and inserts into the local `ads` table.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-ads.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ads } from "../../drizzle/schema";
import { fetchAllRecords } from "./bubble-client";

interface BubbleAd {
  _id: string;
  Name?: string;
  link?: string;
  image?: string;
  "start date"?: string;
  "end date"?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  console.log("Fetching ads from Bubble...");
  const bubbleAds = await fetchAllRecords<BubbleAd>("ads", (fetched, total) => {
    process.stdout.write(`\r  ${fetched} / ${total}`);
  });
  console.log(`\nFetched ${bubbleAds.length} ads`);

  if (bubbleAds.length === 0) {
    console.log("Nothing to insert.");
    await connection.end();
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const ad of bubbleAds) {
    try {
      await db.insert(ads).ignore().values({
        bubbleId: ad._id,
        name: ad.Name ?? null,
        link: ad.link ?? null,
        imageUrl: ad.image ?? null,
        startDate: ad["start date"] ? new Date(ad["start date"]) : null,
        endDate: ad["end date"] ? new Date(ad["end date"]) : null,
        bubbleCreatedAt: ad["Created Date"] ? new Date(ad["Created Date"]) : null,
        bubbleModifiedAt: ad["Modified Date"] ? new Date(ad["Modified Date"]) : null,
      });
      inserted++;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
  await connection.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
