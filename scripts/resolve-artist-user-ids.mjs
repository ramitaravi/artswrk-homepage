/**
 * Resolve artist user IDs for premium_job_interested_artists records
 * by looking up artist emails in the Bubble user API and matching to local users.
 * 
 * Usage: node scripts/resolve-artist-user-ids.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const BASE = "https://artswrk.com/version-live/api/1.1/obj";
const CSV_PATH = "/home/ubuntu/upload/export_All-Interested-Artists-modified_2026-04-14_06-19-07.csv";
const CONCURRENCY = 3;

const db = await mysql.createConnection(process.env.DATABASE_URL);

function esc(val) {
  if (val === null || val === undefined || val === "") return "NULL";
  return db.escape(val);
}

async function bubbleFetch(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { 
        headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
        signal: AbortSignal.timeout(15000)
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

// Parse CSV to get unique artist emails
console.log("Parsing CSV for unique artist emails...");
const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
const premiumRows = rows.filter(r => r["premiumjob"]?.trim());
const uniqueEmails = [...new Set(premiumRows.map(r => r["artist"]?.trim()?.toLowerCase()).filter(Boolean))];
console.log(`  → ${uniqueEmails.length} unique artist emails`);

// Load existing users by email
console.log("\nLoading existing users from DB...");
const [existingUsers] = await db.query("SELECT id, email, bubbleId FROM users WHERE email IS NOT NULL");
const emailToUserId = new Map();
const bubbleToUserId = new Map();
for (const u of existingUsers) {
  if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
  if (u.bubbleId) bubbleToUserId.set(u.bubbleId, u.id);
}
console.log(`  → ${emailToUserId.size} users with email, ${bubbleToUserId.size} with bubbleId`);

// Find emails not yet matched
const unmatchedEmails = uniqueEmails.filter(e => !emailToUserId.has(e));
console.log(`  → ${unmatchedEmails.length} emails need Bubble lookup`);

// Look up unmatched emails in Bubble user API
console.log("\nLooking up unmatched artists in Bubble...");
let resolved = 0;
let notFound = 0;

async function processBatch(items, fn, concurrency) {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
    if ((i + concurrency) % 80 === 0) {
      process.stdout.write(`  Processed ${Math.min(i + concurrency, items.length)}/${items.length}...\n`);
    }
  }
}

await processBatch(unmatchedEmails, async (email) => {
  // Search Bubble for user by email
  const constraints = encodeURIComponent(JSON.stringify([
    { key: "email", constraint_type: "equals", value: email }
  ]));
  const data = await bubbleFetch(`${BASE}/user?limit=1&constraints=${constraints}`);
  if (!data) return;
  
  const user = data?.response?.results?.[0];
  if (!user) { notFound++; return; }
  
  const bubbleId = user._id;
  const firstName = user["First Name"] || "";
  const lastName = user["Last Name"] || "";
  const profilePicture = user["Profile Photo"] || null;
  const city = user["City"] || "";
  const state = user["State"] || "";
  const location = [city, state].filter(Boolean).join(", ") || null;
  const bio = user["Bio"] || null;
  const artistDisciplines = user["Discipline"] ? JSON.stringify(user["Discipline"]) : null;
  
  // Check if user already exists by bubbleId
  if (bubbleId && bubbleToUserId.has(bubbleId)) {
    // Update email on existing user
    const localId = bubbleToUserId.get(bubbleId);
    await db.query(`UPDATE users SET email = ${esc(email)} WHERE id = ${localId} AND (email IS NULL OR email = '')`);
    emailToUserId.set(email, localId);
    resolved++;
    return;
  }
  
  // openId must be unique and non-null — use bubbleId as a stand-in
  const openId = bubbleId || `bubble_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  // Upsert user
  await db.query(`
    INSERT INTO users (openId, bubbleId, email, firstName, lastName, profilePicture, location, bio, artistDisciplines, role, createdAt)
    VALUES (${esc(openId)}, ${esc(bubbleId)}, ${esc(email)}, ${esc(firstName)}, ${esc(lastName)}, ${esc(profilePicture)}, ${esc(location)}, ${esc(bio)}, ${esc(artistDisciplines)}, 'user', NOW())
    ON DUPLICATE KEY UPDATE
      email = IF(email IS NULL OR email = '', VALUES(email), email),
      firstName = IF(firstName = '' OR firstName IS NULL, VALUES(firstName), firstName),
      lastName = IF(lastName = '' OR lastName IS NULL, VALUES(lastName), lastName),
      profilePicture = IF(profilePicture IS NULL, VALUES(profilePicture), profilePicture),
      location = IF(location IS NULL, VALUES(location), location),
      bio = IF(bio IS NULL, VALUES(bio), bio),
      artistDisciplines = IF(artistDisciplines IS NULL, VALUES(artistDisciplines), artistDisciplines)
  `);
  
  const [[newUser]] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (newUser) {
    emailToUserId.set(email, newUser.id);
    if (bubbleId) bubbleToUserId.set(bubbleId, newUser.id);
    resolved++;
  }
}, CONCURRENCY);

console.log(`  → ${resolved} resolved, ${notFound} not found in Bubble`);

// Now update premium_job_interested_artists with resolved user IDs
console.log("\nUpdating premium_job_interested_artists with resolved user IDs...");
let updated = 0;
let stillMissing = 0;

for (const row of premiumRows) {
  const bubbleInterestedArtistId = row["unique id"]?.trim();
  if (!bubbleInterestedArtistId) continue;
  
  const artistEmail = row["artist"]?.trim()?.toLowerCase();
  const artistLocalId = artistEmail ? (emailToUserId.get(artistEmail) ?? null) : null;
  
  if (!artistLocalId) { stillMissing++; continue; }
  
  await db.query(`
    UPDATE premium_job_interested_artists 
    SET artistUserId = ${artistLocalId}
    WHERE bubbleInterestedArtistId = ${esc(bubbleInterestedArtistId)} AND (artistUserId IS NULL)
  `);
  updated++;
}

console.log(`  → ${updated} records updated with user IDs, ${stillMissing} still missing`);

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

// REVEL check
const [[revelJob]] = await db.query(`SELECT id, company FROM premium_jobs WHERE company LIKE '%REVEL%' OR company LIKE '%Revel%' LIMIT 1`);
if (revelJob) {
  const [revelArtists] = await db.query(`
    SELECT pjia.rate, pjia.message, u.firstName, u.lastName, u.email, u.location
    FROM premium_job_interested_artists pjia
    LEFT JOIN users u ON u.id = pjia.artistUserId
    WHERE pjia.premiumJobId = ?
    ORDER BY pjia.id
  `, [revelJob.id]);
  console.log(`\nREVEL "${revelJob.company}" — ${revelArtists.length} interested artists:`);
  for (const a of revelArtists) {
    const name = `${a.firstName || '?'} ${a.lastName || '?'}`.trim();
    console.log(`  - ${name} (${a.email || 'no email'}) | ${a.location || ''} | rate: ${a.rate || 'none'}`);
  }
}

await db.end();
console.log("\nDone!");
