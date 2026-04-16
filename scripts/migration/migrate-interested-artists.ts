/**
 * Migration: Interested Artists (Premium Job Applications)
 * Pulls all 9,712 records from Bubble's "InterestedArtists" type →
 * `premium_job_interested_artists` table.
 *
 * These are applications to PREMIUM jobs (enterprise postings), NOT regular job requests.
 * Each record links an artist to a premium_job record.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-interested-artists.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleInterestedArtist {
  _id: string;
  "artist"?: string;                    // Bubble user ID of the artist
  "premiumjob"?: string;                // Bubble premium job record ID
  "premium job rate"?: string;          // Rate the artist quoted (free text)
  "status_interestedartists"?: string;  // Status string
  "link"?: string;                      // Resume/portfolio link
  "message"?: string;                   // Application message
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

  // Build bubble premium job ID → DB id lookup
  const [jobRows] = await conn.execute(
    "SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToPremiumJobId: Record<string, number> = {};
  for (const j of jobRows) bubbleToPremiumJobId[j.bubbleId] = j.id;
  console.log(`Loaded ${Object.keys(bubbleToPremiumJobId).length} premium job mappings`);

  console.log("Fetching interested artists from Bubble...");
  const records = await fetchAllRecords<BubbleInterestedArtist>(
    "InterestedArtists",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const artistUserId = r["artist"] ? (bubbleToUserId[r["artist"]] ?? null) : null;
    const premiumJobId = r["premiumjob"] ? (bubbleToPremiumJobId[r["premiumjob"]] ?? null) : null;

    // Skip records with no premium job reference — can't insert (NOT NULL FK)
    if (!premiumJobId) {
      skipped++;
      continue;
    }

    try {
      await conn.execute(
        `INSERT IGNORE INTO premium_job_interested_artists
           (bubbleInterestedArtistId, premiumJobId, bubblePremiumJobId,
            artistUserId, bubbleArtistId,
            rate, status, resumeLink, message, createdAt)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          r._id,
          premiumJobId,
          r["premiumjob"] ?? null,
          artistUserId,
          r["artist"] ?? null,
          r["premium job rate"] ?? null,
          r["status_interestedartists"] ?? null,
          r["link"] ?? null,
          r["message"] ?? null,
          r["Created Date"] ? new Date(r["Created Date"]) : new Date(),
        ]
      );
      inserted++;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { skipped++; }
      else { errors++; console.error(`\nError on ${r._id}:`, e.message); }
    }

    if ((inserted + skipped + errors) % 500 === 0)
      process.stdout.write(`\r  Processed ${inserted + skipped + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Skipped  : ${skipped}  (no matching premium job or duplicate)`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
