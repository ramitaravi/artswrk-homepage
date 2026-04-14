/**
 * Seed script: CSV export → premium_job_interested_artists
 * 
 * Uses the Bubble CSV export to seed all 1,346 interested artist records
 * for premium jobs. Artist email is used to look up local user IDs.
 * 
 * Usage: node scripts/seed-premium-interested-artists-csv.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const CSV_PATH = "/home/ubuntu/upload/export_All-Interested-Artists-modified_2026-04-14_06-19-07.csv";

const db = await mysql.createConnection(process.env.DATABASE_URL);

function esc(val) {
  if (val === null || val === undefined || val === "") return "NULL";
  return db.escape(val);
}

// Parse CSV
console.log("Parsing CSV...");
const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
const premiumRows = rows.filter(r => r["premiumjob"]?.trim());
console.log(`  → ${premiumRows.length} premium interested artist rows found`);

// Build lookup maps from DB
console.log("\nLoading DB lookup maps...");
const [premiumJobRows] = await db.query("SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL");
const bubbleToPremiumJobId = new Map();
for (const row of premiumJobRows) bubbleToPremiumJobId.set(row.bubbleId, row.id);
console.log(`  → ${bubbleToPremiumJobId.size} premium jobs`);

// Load users by email AND by bubbleId
const [userRows] = await db.query("SELECT id, email, bubbleId FROM users WHERE email IS NOT NULL OR bubbleId IS NOT NULL");
const emailToUserId = new Map();
const bubbleToUserId = new Map();
for (const row of userRows) {
  if (row.email) emailToUserId.set(row.email.toLowerCase(), row.id);
  if (row.bubbleId) bubbleToUserId.set(row.bubbleId, row.id);
}
console.log(`  → ${emailToUserId.size} users by email, ${bubbleToUserId.size} by bubbleId`);

// Process each row
console.log("\nUpserting records...");
let inserted = 0;
let updated = 0;
let skipped = 0;
let noJob = 0;
let noUser = 0;

for (const row of premiumRows) {
  const bubblePremiumJobId = row["premiumjob"]?.trim();
  const premiumJobLocalId = bubbleToPremiumJobId.get(bubblePremiumJobId);
  
  if (!premiumJobLocalId) {
    noJob++;
    continue;
  }
  
  const artistEmail = row["artist"]?.trim()?.toLowerCase();
  const bubbleInterestedArtistId = row["unique id"]?.trim() || null;
  const message = row["message"]?.trim() || null;
  const rate = row["premium job rate"]?.trim() || null;
  const resumeLink = row["link"]?.trim() || null;
  const status = row["status_interestedartists"]?.trim() || "Interested";
  
  // Look up artist by email
  const artistLocalId = artistEmail ? (emailToUserId.get(artistEmail) ?? null) : null;
  if (!artistLocalId) noUser++;
  
  // Check if already exists by bubbleInterestedArtistId
  if (bubbleInterestedArtistId) {
    const [[existing]] = await db.query(
      `SELECT id FROM premium_job_interested_artists WHERE bubbleInterestedArtistId = ${esc(bubbleInterestedArtistId)} LIMIT 1`
    );
    
    if (existing) {
      await db.query(`
        UPDATE premium_job_interested_artists SET
          artistUserId = ${artistLocalId ?? "NULL"},
          message = ${esc(message)},
          rate = ${esc(rate)},
          resumeLink = ${esc(resumeLink)},
          status = ${esc(status)}
        WHERE id = ${existing.id}
      `);
      updated++;
      continue;
    }
  }
  
  // Insert new record
  await db.query(`
    INSERT INTO premium_job_interested_artists
      (premiumJobId, bubblePremiumJobId, artistUserId, bubbleInterestedArtistId, message, rate, resumeLink, status)
    VALUES
      (${premiumJobLocalId}, ${esc(bubblePremiumJobId)}, ${artistLocalId ?? "NULL"}, ${esc(bubbleInterestedArtistId)}, ${esc(message)}, ${esc(rate)}, ${esc(resumeLink)}, ${esc(status)})
  `);
  inserted++;
}

console.log(`\n  → ${inserted} inserted, ${updated} updated, ${noJob} skipped (no matching job), ${noUser} without user ID match`);

// Final summary
const [[summary]] = await db.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(artistUserId) as withUserId,
    COUNT(message) as withMessage,
    COUNT(rate) as withRate,
    COUNT(resumeLink) as withResumeLink
  FROM premium_job_interested_artists
`);
console.log("\n=== Final Summary ===");
console.log(`Total records:    ${summary.total}`);
console.log(`With user ID:     ${summary.withUserId}`);
console.log(`With message:     ${summary.withMessage}`);
console.log(`With rate:        ${summary.withRate}`);
console.log(`With resume link: ${summary.withResumeLink}`);

// REVEL-specific check
const [[revelJob]] = await db.query(`SELECT id, company FROM premium_jobs WHERE company LIKE '%REVEL%' OR company LIKE '%Revel%' LIMIT 1`);
if (revelJob) {
  const [revelArtists] = await db.query(`
    SELECT pjia.*, u.firstName, u.lastName, u.email 
    FROM premium_job_interested_artists pjia
    LEFT JOIN users u ON u.id = pjia.artistUserId
    WHERE pjia.premiumJobId = ?
  `, [revelJob.id]);
  console.log(`\nREVEL job "${revelJob.company}" (id=${revelJob.id}): ${revelArtists.length} interested artists`);
  for (const a of revelArtists) {
    console.log(`  - ${a.firstName || '?'} ${a.lastName || '?'} | rate: ${a.rate || 'none'} | msg: ${(a.message || '').slice(0,60)}`);
  }
}

await db.end();
console.log("\nDone!");
