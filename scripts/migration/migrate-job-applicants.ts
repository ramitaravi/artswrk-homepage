/**
 * Migration: Job Applicants (Regular Jobs)
 * Pulls all 9,712 records from Bubble's "interested artists" type → `interested_artists` table.
 *
 * NOTE: This is NOT the same as migrate-interested-artists.ts which handles
 * InterestedArtists (premium job applications → premium_job_interested_artists).
 * This type contains applicants to regular marketplace jobs (Requests).
 *
 * Bubble fields:
 *   _id, artist, client, request, service, status_interestedartists,
 *   converted?, is hourly rate?, artist hourly rate, client hourly rate,
 *   Created Date, Modified Date
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-job-applicants.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleInterestedArtist {
  _id: string;
  "artist"?: string;                    // Bubble user ID of the artist
  "client"?: string;                    // Bubble user ID of the client
  "request"?: string;                   // Bubble Request (job) ID
  "service"?: string;                   // Bubble service ID
  "status_interestedartists"?: string;  // "Interested" | "Confirmed" | "Declined"
  "converted?"?: boolean;
  "is hourly rate?"?: boolean;
  "artist hourly rate"?: number;
  "client hourly rate"?: number;
  "artist flat rate"?: number;
  "client flat rate"?: number;
  "total hours"?: number;
  "Start Date"?: string;
  "End Date"?: string;
  "resume link"?: string;
  "message"?: string;
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

  // Build bubbleId → jobId lookup
  const [jobRows] = await conn.execute(
    "SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToJobId: Record<string, number> = {};
  for (const j of jobRows) bubbleToJobId[j.bubbleId] = j.id;
  console.log(`Loaded ${Object.keys(bubbleToJobId).length} job mappings`);

  console.log("Fetching interested artists from Bubble...");
  const records = await fetchAllRecords<BubbleInterestedArtist>(
    "interested artists",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const artistUserId = r["artist"] ? (bubbleToUserId[r["artist"]] ?? null) : null;
    const clientUserId = r["client"] ? (bubbleToUserId[r["client"]] ?? null) : null;
    const jobId        = r["request"] ? (bubbleToJobId[r["request"]] ?? null) : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO interested_artists (
           bubbleId, jobId, bubbleRequestId,
           artistUserId, bubbleArtistId,
           clientUserId, bubbleClientId,
           bubbleServiceId,
           status, converted,
           isHourlyRate, artistHourlyRate, clientHourlyRate,
           artistFlatRate, clientFlatRate, totalHours,
           startDate, endDate,
           resumeLink, message,
           bubbleCreatedAt, bubbleModifiedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           jobId=VALUES(jobId),
           artistUserId=VALUES(artistUserId),
           clientUserId=VALUES(clientUserId),
           status=VALUES(status),
           converted=VALUES(converted),
           isHourlyRate=VALUES(isHourlyRate),
           artistHourlyRate=VALUES(artistHourlyRate),
           clientHourlyRate=VALUES(clientHourlyRate),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          jobId,
          r["request"] ?? null,
          artistUserId,
          r["artist"] ?? null,
          clientUserId,
          r["client"] ?? null,
          r["service"] ?? null,
          r["status_interestedartists"] ?? null,
          r["converted?"] ? 1 : 0,
          r["is hourly rate?"] ? 1 : 0,
          r["artist hourly rate"] ?? null,
          r["client hourly rate"] ?? null,
          r["artist flat rate"] ?? null,
          r["client flat rate"] ?? null,
          r["total hours"] ?? null,
          r["Start Date"] ? new Date(r["Start Date"]) : null,
          r["End Date"] ? new Date(r["End Date"]) : null,
          r["resume link"] ?? null,
          r["message"] ?? null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on ${r._id}:`, e.message);
      errors++;
    }

    if ((inserted + updated + errors) % 500 === 0)
      process.stdout.write(`\r  Processed ${inserted + updated + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
