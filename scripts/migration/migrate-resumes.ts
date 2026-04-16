/**
 * migrate-resumes.ts
 * Imports all Resume records from Bubble into the artist_resumes table.
 *
 * Bubble fields:
 *   _id        → bubbleId
 *   Title      → title
 *   Link       → fileUrl  (normalise // → https://)
 *   User       → bubbleArtistId  (resolved to artistUserId via users table)
 *   Created Date → bubbleCreatedAt
 *   Modified Date → bubbleModifiedAt
 *
 * Usage:
 *   BUBBLE_API_TOKEN=xxx DATABASE_URL=yyy npx tsx scripts/migration/migrate-resumes.ts
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN!;
const DATABASE_URL = process.env.DATABASE_URL!;
const BASE_URL = "https://artswrk.com/api/1.1/obj/resume";
const PAGE_SIZE = 100;

if (!BUBBLE_TOKEN || !DATABASE_URL) {
  console.error("Missing BUBBLE_API_TOKEN or DATABASE_URL");
  process.exit(1);
}

function normaliseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

async function fetchPage(cursor: number): Promise<any[]> {
  const res = await fetch(`${BASE_URL}?limit=${PAGE_SIZE}&cursor=${cursor}`, {
    headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Bubble API error: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  return data.response?.results ?? [];
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("[migrate-resumes] Connected to DB");

  let cursor = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  while (true) {
    const records = await fetchPage(cursor);
    if (records.length === 0) break;
    console.log(`[migrate-resumes] Processing cursor=${cursor}, batch=${records.length}`);

    for (const r of records) {
      try {
        const bubbleId = r._id;
        const title = r.Title || null;
        const fileUrl = normaliseUrl(r.Link);
        const bubbleArtistId = r.User || null;
        const bubbleCreatedAt = r["Created Date"] ? new Date(r["Created Date"]) : null;
        const bubbleModifiedAt = r["Modified Date"] ? new Date(r["Modified Date"]) : null;

        if (!fileUrl) { skipped++; continue; }

        // Resolve artistUserId from bubbleArtistId
        let artistUserId: number | null = null;
        if (bubbleArtistId) {
          const [userRows]: any = await conn.execute(
            "SELECT id FROM users WHERE bubbleId = ? LIMIT 1",
            [bubbleArtistId]
          );
          if (userRows.length > 0) artistUserId = userRows[0].id;
        }

        if (!artistUserId) {
          // Can't link without a user — still insert with null userId for now
          skipped++;
          continue;
        }

        // Upsert by bubbleId
        const [existing]: any = await conn.execute(
          "SELECT id FROM artist_resumes WHERE bubbleId = ? LIMIT 1",
          [bubbleId]
        );

        if (existing.length > 0) {
          await conn.execute(
            `UPDATE artist_resumes SET title=?, fileUrl=?, artistUserId=?, bubbleArtistId=?,
             bubbleModifiedAt=?, updatedAt=NOW() WHERE bubbleId=?`,
            [title, fileUrl, artistUserId, bubbleArtistId, bubbleModifiedAt, bubbleId]
          );
          updated++;
        } else {
          await conn.execute(
            `INSERT INTO artist_resumes
               (bubbleId, artistUserId, bubbleArtistId, title, fileUrl, bubbleCreatedAt, bubbleModifiedAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [bubbleId, artistUserId, bubbleArtistId, title, fileUrl, bubbleCreatedAt, bubbleModifiedAt]
          );
          inserted++;
        }
      } catch (err: any) {
        console.error(`[migrate-resumes] Error on record ${r._id}:`, err.message);
        errors++;
      }
    }

    cursor += records.length;
    if (records.length < PAGE_SIZE) break;
  }

  await conn.end();
  console.log(`\n[migrate-resumes] Done!`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Updated  : ${updated}`);
  console.log(`  Skipped  : ${skipped} (no fileUrl or unresolved user)`);
  console.log(`  Errors   : ${errors}`);
}

main().catch((err) => {
  console.error("[migrate-resumes] Fatal:", err);
  process.exit(1);
});
