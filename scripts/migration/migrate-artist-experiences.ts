/**
 * Migration: Artist Experiences
 * Pulls all 1,256 records from Bubble's "ArtistExperience" type and inserts
 * into the `artist_experiences` table.
 *
 * What it does:
 *  - Resolves style IDs → style names using the DANCE_STYLES lookup map
 *  - Resolves artist type ID → type name using MASTER_ARTIST_TYPES
 *  - Stores bubbleArtistId for FK resolution after users are migrated
 *  - Safe to re-run (skips existing bubbleIds)
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-artist-experiences.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { artistExperiences } from "../../drizzle/schema";
import { fetchAllRecords } from "./bubble-client";
import { DANCE_STYLES, MASTER_ARTIST_TYPES } from "../../drizzle/seeds/reference_data";

interface BubbleArtistExperience {
  _id: string;
  User?: string;
  "Artist Type"?: string;
  "Years of Experience "?: string; // note: Bubble field has a trailing space
  "Age Groups"?: string[];
  Styles?: string[];
  "LINK NEW"?: string;
  "Resume Title"?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
}

// Build a quick lookup: bubbleId → name
const artistTypeById = Object.fromEntries(
  MASTER_ARTIST_TYPES.map((t) => [t.bubbleId, t.name])
);

function resolveStyleNames(styleIds: string[]): string[] {
  return styleIds.map((id) => DANCE_STYLES[id] ?? id); // fall back to ID if unknown
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  console.log("Fetching ArtistExperience records from Bubble...");
  const records = await fetchAllRecords<BubbleArtistExperience>(
    "ArtistExperience",
    (fetched, total) => process.stdout.write(`\r  Fetched ${fetched} / ${total}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    const styleIds = record.Styles ?? [];
    const styleNames = resolveStyleNames(styleIds);
    const artistTypeName = record["Artist Type"]
      ? (artistTypeById[record["Artist Type"]] ?? null)
      : null;

    try {
      await db.insert(artistExperiences).ignore().values({
        bubbleId: record._id,
        bubbleArtistId: record.User ?? null,
        artistUserId: null, // resolved after users are migrated
        artistType: artistTypeName,
        bubbleArtistTypeId: record["Artist Type"] ?? null,
        yearsOfExperience: record["Years of Experience "] ?? null,
        ageGroups: record["Age Groups"]?.length
          ? JSON.stringify(record["Age Groups"])
          : null,
        styles: styleNames.length ? JSON.stringify(styleNames) : null,
        bubbleStyleIds: styleIds.length ? JSON.stringify(styleIds) : null,
        legacyResumeLink: record["LINK NEW"] ?? null,
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

    if ((inserted + skipped + errors) % 100 === 0) {
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
