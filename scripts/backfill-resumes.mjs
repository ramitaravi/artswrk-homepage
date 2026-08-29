/**
 * One-off backfill: insert resolved resumes from the Bubble resume-URL
 * export into artist_resumes — the real table the app reads from for the
 * resume picker on the job application page (users.resumes/resumeFiles are
 * both effectively dead, confirmed earlier this session).
 *
 * Matches artists by bubbleId, skips any (artistUserId, fileUrl) pair that
 * already exists so re-running never creates duplicates and never touches
 * the 209 rows that were already correctly migrated.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import { parse } from "csv-parse/sync";
dotenv.config();

const raw = fs.readFileSync("/Users/ramitaravi/Downloads/Artswrk Clients - Clean Pull Aug 28 - bubble_resumes_resolved.csv", "utf-8");
const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [userRows] = await conn.execute(`SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL`);
const idByBubbleId = new Map(userRows.map((u) => [u.bubbleId, u.id]));

const [existingRows] = await conn.execute(`SELECT artistUserId, fileUrl FROM artist_resumes`);
const existingKeys = new Set(existingRows.map((r) => `${r.artistUserId}|${r.fileUrl}`));

let inserted = 0, skippedNoUser = 0, skippedDup = 0;
const noUserSamples = [];

for (const r of rows) {
  const artistUserId = idByBubbleId.get(r.bubbleId);
  if (!artistUserId) {
    skippedNoUser++;
    if (noUserSamples.length < 5) noUserSamples.push(r.email);
    continue;
  }

  for (let i = 1; i <= 3; i++) {
    const title = (r[`resume_title_${i}`] || "").trim();
    const url = (r[`resume_url_${i}`] || "").trim();
    if (!url) continue;

    const key = `${artistUserId}|${url}`;
    if (existingKeys.has(key)) {
      skippedDup++;
      continue;
    }

    // bubbleId has a UNIQUE constraint on this table — synthesize a stable,
    // traceable one per resume slot rather than relying on NULL semantics.
    const syntheticBubbleId = `${r.bubbleId}_resume_${i}`;
    await conn.execute(
      `INSERT INTO artist_resumes (bubbleId, artistUserId, bubbleArtistId, title, fileUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [syntheticBubbleId, artistUserId, r.bubbleId, title || "Resume", url]
    );
    existingKeys.add(key);
    inserted++;
  }
}

console.log(`Inserted: ${inserted}`);
console.log(`Skipped (already existed): ${skippedDup}`);
console.log(`Skipped (no matching user by bubbleId): ${skippedNoUser}`);
if (noUserSamples.length) console.log("  sample unmatched emails:", noUserSamples);

await conn.end();
