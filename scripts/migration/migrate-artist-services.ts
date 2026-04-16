/**
 * Migration: Artist Services
 * Pulls all 6,099 records from Bubble's "ArtistService" type and inserts
 * into the `artist_service_categories` table.
 *
 * Each ArtistService record in Bubble is a mapping of:
 *   artist → service type → artist type (with an email opt-in flag)
 *
 * What it does:
 *  - Resolves service type ID → service name using MASTER_SERVICE_TYPES
 *  - Resolves artist type ID → type name using MASTER_ARTIST_TYPES
 *  - Stores bubbleArtistId for FK resolution after users are migrated
 *  - Safe to re-run (skips existing bubbleIds)
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-artist-services.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { artistServiceCategories } from "../../drizzle/schema";
import { fetchAllRecords } from "./bubble-client";
import { MASTER_ARTIST_TYPES, MASTER_SERVICE_TYPES } from "../../drizzle/seeds/reference_data";

interface BubbleArtistService {
  _id: string;
  User?: string;
  "Master Artist Type"?: string;
  "Master Service Type"?: string;
  "Email Opt-In"?: boolean;
  "Created Date"?: string;
  "Modified Date"?: string;
}

// Build quick lookups: bubbleId → name
const artistTypeById = Object.fromEntries(
  MASTER_ARTIST_TYPES.map((t) => [t.bubbleId, t.name])
);
const serviceTypeById = Object.fromEntries(
  MASTER_SERVICE_TYPES.map((s) => [s.bubbleId, s.name])
);

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  console.log("Fetching ArtistService records from Bubble...");
  const records = await fetchAllRecords<BubbleArtistService>(
    "ArtistService",
    (fetched, total) => process.stdout.write(`\r  Fetched ${fetched} / ${total}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    const serviceName = record["Master Service Type"]
      ? (serviceTypeById[record["Master Service Type"]] ?? `Unknown Service (${record["Master Service Type"]})`)
      : "Unknown Service";

    try {
      await db.insert(artistServiceCategories).ignore().values({
        bubbleId: record._id,
        artistUserId: 0, // placeholder — resolved after users are migrated
        // Store bubble IDs as JSON in subServices temporarily for reference
        name: serviceName,
        jobEmailEnabled: record["Email Opt-In"] ?? true,
        listOnProfile: true,
        subServices: null,
        subServiceSettings: JSON.stringify({
          bubbleArtistId: record.User ?? null,
          bubbleArtistTypeId: record["Master Artist Type"] ?? null,
          bubbleServiceTypeId: record["Master Service Type"] ?? null,
          artistTypeName: record["Master Artist Type"]
            ? (artistTypeById[record["Master Artist Type"]] ?? null)
            : null,
        }),
        bubbleCreatedAt: record["Created Date"] ? new Date(record["Created Date"]) : null,
        bubbleModifiedAt: record["Modified Date"] ? new Date(record["Modified Date"]) : null,
      });
      inserted++;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        skipped++;
      } else {
        console.error(`\nError on record ${record._id}:`, e.message);
        errors++;
      }
    }

    if ((inserted + skipped + errors) % 500 === 0) {
      process.stdout.write(`\r  Processed ${inserted + skipped + errors} / ${records.length}`);
    }
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Skipped  : ${skipped} (already exist)`);
  console.log(`Errors   : ${errors}`);

  await connection.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
