/**
 * Migration: Reviews
 * Pulls all 1,110 records from Bubble's "Reviews" type → `artist_reviews` table.
 *
 * Bubble fields:
 *   _id, Artist, Client, Booking, Rating, Review, Created Date, Modified Date
 *
 * Notes:
 *  - "Review" text is sparse — only ~2% of records have review text, most are ratings-only.
 *  - reviewerName/reviewerStudio/reviewerAvatar are resolved from the Client user record.
 *  - artistUserId is resolved from the Artist user record.
 *  - bookingId is resolved from the Booking record.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-reviews.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleReview {
  _id: string;
  "Artist"?: string;        // Bubble user ID of the artist being reviewed
  "Client"?: string;        // Bubble user ID of the reviewer (hirer)
  "Booking"?: string;       // Bubble booking ID
  "Rating"?: number;        // 1–5
  "Review"?: string;        // Optional text review
  "Created Date"?: string;
  "Modified Date"?: string;
  "Created By"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup
  const [userRows] = await conn.execute(
    `SELECT id, bubbleId, firstName, lastName, name, clientCompanyName, profilePicture
     FROM users WHERE bubbleId IS NOT NULL`
  ) as any[];

  const bubbleToUserId: Record<string, number> = {};
  const bubbleToUserName: Record<string, string | null> = {};
  const bubbleToUserStudio: Record<string, string | null> = {};
  const bubbleToUserAvatar: Record<string, string | null> = {};

  for (const u of userRows) {
    bubbleToUserId[u.bubbleId] = u.id;
    // Best display name: Full Name → First+Last → fallback null
    bubbleToUserName[u.bubbleId] = u.name
      || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : null)
      || u.firstName
      || null;
    bubbleToUserStudio[u.bubbleId] = u.clientCompanyName ?? null;
    bubbleToUserAvatar[u.bubbleId] = u.profilePicture ?? null;
  }
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  // Build bubbleId → bookingId lookup
  const [bookingRows] = await conn.execute(
    "SELECT id, bubbleId FROM bookings WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToBookingId: Record<string, number> = {};
  for (const b of bookingRows) bubbleToBookingId[b.bubbleId] = b.id;
  console.log(`Loaded ${Object.keys(bubbleToBookingId).length} booking mappings`);

  console.log("Fetching reviews from Bubble...");
  const records = await fetchAllRecords<BubbleReview>(
    "Reviews",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} reviews`);

  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const artistBubbleId = r["Artist"] ?? null;
    const clientBubbleId = r["Client"] ?? r["Created By"] ?? null;

    const artistUserId = artistBubbleId ? (bubbleToUserId[artistBubbleId] ?? null) : null;
    const clientUserId = clientBubbleId ? (bubbleToUserId[clientBubbleId] ?? null) : null;
    const bookingId    = r["Booking"]   ? (bubbleToBookingId[r["Booking"]] ?? null) : null;

    if (!artistUserId) {
      // Can't attach review to an unknown artist
      skipped++;
      continue;
    }

    const reviewerName   = clientBubbleId ? (bubbleToUserName[clientBubbleId] ?? null)   : null;
    const reviewerStudio = clientBubbleId ? (bubbleToUserStudio[clientBubbleId] ?? null)  : null;
    const reviewerAvatar = clientBubbleId ? (bubbleToUserAvatar[clientBubbleId] ?? null)  : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO artist_reviews (
           bubbleId,
           artistUserId, bubbleArtistId,
           clientUserId, bubbleClientId,
           bookingId, bubbleBookingId,
           reviewerName, reviewerStudio, reviewerAvatar,
           rating, body, reviewDate,
           bubbleCreatedAt, bubbleModifiedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           artistUserId=VALUES(artistUserId),
           clientUserId=VALUES(clientUserId),
           bookingId=VALUES(bookingId),
           reviewerName=VALUES(reviewerName),
           reviewerStudio=VALUES(reviewerStudio),
           reviewerAvatar=VALUES(reviewerAvatar),
           rating=VALUES(rating),
           body=VALUES(body),
           reviewDate=VALUES(reviewDate),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          artistUserId,
          artistBubbleId,
          clientUserId,
          clientBubbleId,
          bookingId,
          r["Booking"] ?? null,
          reviewerName,
          reviewerStudio,
          reviewerAvatar,
          r["Rating"] ?? 5,
          r["Review"] ?? null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on review ${r._id}:`, e.message);
      errors++;
    }
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Skipped  : ${skipped} (artist not found in DB)`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
