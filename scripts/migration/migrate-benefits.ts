/**
 * Migration: Benefits (Partner Perks)
 * Pulls all 27 records from Bubble's "Benefits" type.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-benefits.ts
 */

import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleBenefit {
  _id: string;
  "Company Name"?: string;
  "Slug"?: string;
  "Logo"?: string;
  "URL"?: string;
  "Business Description"?: string;
  "Discount Offering"?: string;
  "How to Redeem"?: string;
  "Contact Name"?: string;
  "Contact Email"?: string;
  "Artists or Clients"?: string[];
  "Business Type"?: string[];
  "Artist Type"?: string[];
  "Benefits Category"?: string[];
  "Created Date"?: string;
  "Modified Date"?: string;
}

function fixImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log("Fetching benefits from Bubble...");
  const records = await fetchAllRecords<BubbleBenefit>(
    "Benefits",
    (fetched, total) => process.stdout.write(`\r  Fetched ${fetched} / ${total}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const r of records) {
    try {
      await conn.execute(
        `INSERT IGNORE INTO benefits
          (bubbleId, companyName, slug, logoUrl, url, businessDescription,
           discountOffering, howToRedeem, contactName, contactEmail,
           audienceTypes, businessTypes, artistTypes, categories,
           bubbleCreatedAt, bubbleModifiedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r._id,
          r["Company Name"] ?? null,
          r["Slug"] ?? null,
          fixImageUrl(r["Logo"]),
          r["URL"] ?? null,
          r["Business Description"] ?? null,
          r["Discount Offering"] ?? null,
          r["How to Redeem"] ?? null,
          r["Contact Name"] ?? null,
          r["Contact Email"]?.trim() ?? null,
          r["Artists or Clients"]?.length ? JSON.stringify(r["Artists or Clients"]) : null,
          r["Business Type"]?.length ? JSON.stringify(r["Business Type"]) : null,
          r["Artist Type"]?.length ? JSON.stringify(r["Artist Type"]) : null,
          r["Benefits Category"]?.length ? JSON.stringify(r["Benefits Category"]) : null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      );
      inserted++;
      console.log(`  ✓ ${r["Company Name"]}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { skipped++; } else { errors++; console.error(`Error on ${r["Company Name"]}:`, e.message); }
    }
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
