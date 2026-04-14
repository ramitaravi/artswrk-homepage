/**
 * Seed script: Bubble interestedartists (premium jobs) → premium_job_interested_artists
 * 
 * Fetches all interestedartists records that have a premiumjob field,
 * resolves artist user IDs, and upserts into premium_job_interested_artists
 * with message, rate, resumeLink, and status.
 * 
 * Usage: node scripts/seed-premium-interested-artists.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const BASE = "https://artswrk.com/version-live/api/1.1/obj";
const CONCURRENCY = 8;

const db = await mysql.createConnection(process.env.DATABASE_URL);

function esc(val) {
  if (val === null || val === undefined) return "NULL";
  return db.escape(val);
}

async function bubbleFetch(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Fetch all interestedartists records and filter client-side for premium ones
async function fetchAllPremiumInterestedArtists() {
  const all = [];
  let cursor = 0;
  let remaining = 1;
  let page = 0;
  let premiumCount = 0;

  while (remaining > 0) {
    // No constraint filter - Bubble doesn't support filtering by premiumjob server-side
    const url = `${BASE}/interestedartists?limit=100&cursor=${cursor}`;
    
    const data = await bubbleFetch(url);
    const resp = data.response;
    const results = resp.results || [];
    
    // Filter client-side: only keep records with a premiumjob field
    const premiumOnes = results.filter(r => r.premiumjob);
    all.push(...premiumOnes);
    premiumCount += premiumOnes.length;
    
    remaining = resp.remaining || 0;
    cursor += results.length;
    page++;
    
    if (page % 10 === 0) {
      process.stdout.write(`  Page ${page}: scanned ${cursor} records, found ${premiumCount} premium ones, ${remaining} remaining\n`);
    }
    
    if (results.length === 0) break;
    await new Promise(r => setTimeout(r, 80)); // small delay
  }
  return all;
}

// Fetch user by bubble ID with caching
const userCache = new Map();
async function fetchUser(bubbleUserId) {
  if (userCache.has(bubbleUserId)) return userCache.get(bubbleUserId);
  try {
    const data = await bubbleFetch(`${BASE}/user/${bubbleUserId}`);
    const user = data.response || null;
    userCache.set(bubbleUserId, user);
    return user;
  } catch {
    userCache.set(bubbleUserId, null);
    return null;
  }
}

// Process in parallel batches
async function processBatch(items, fn, concurrency) {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
    if ((i + concurrency) % 50 === 0) {
      process.stdout.write(`  Processed ${Math.min(i + concurrency, items.length)}/${items.length}...\n`);
    }
  }
}

// Build lookup maps from DB
console.log("Loading DB lookup maps...");
const [premiumJobRows] = await db.query("SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL");
const bubbleToPremiumJobId = new Map();
for (const row of premiumJobRows) bubbleToPremiumJobId.set(row.bubbleId, row.id);
console.log(`  → ${bubbleToPremiumJobId.size} premium jobs loaded`);

const [userRows] = await db.query("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
const bubbleToUserId = new Map();
for (const row of userRows) bubbleToUserId.set(row.bubbleId, row.id);
console.log(`  → ${bubbleToUserId.size} users loaded`);

// Step 1: Fetch all interested artists with premiumjob
console.log("\nFetching all interestedartists with premiumjob from Bubble...");
const records = await fetchAllPremiumInterestedArtists();
console.log(`  → ${records.length} records fetched total`);

if (records.length === 0) {
  console.log("No records found. Exiting.");
  await db.end();
  process.exit(0);
}

// Step 2: Resolve artist user IDs for artists not already in DB
const unknownArtistIds = new Set();
for (const rec of records) {
  if (rec.artist && !bubbleToUserId.has(rec.artist)) {
    unknownArtistIds.add(rec.artist);
  }
}
console.log(`\nResolving ${unknownArtistIds.size} unknown artist profiles from Bubble...`);

let resolved = 0;
const unknownList = [...unknownArtistIds];
await processBatch(unknownList, async (bubbleId) => {
  const user = await fetchUser(bubbleId);
  if (!user) return;
  
  const firstName = user["First Name"] || "";
  const lastName = user["Last Name"] || "";
  const email = user?.authentication?.email?.email || user?.email || "";
  const profilePicture = user["Profile Photo"] || null;
  const city = user["City"] || "";
  const state = user["State"] || "";
  const location = [city, state].filter(Boolean).join(", ") || null;
  const bio = user["Bio"] || null;
  const artistDisciplines = user["Discipline"] ? JSON.stringify(user["Discipline"]) : null;
  
  if (!email && !firstName) return;
  
  // Upsert user
  await db.query(`
    INSERT INTO users (bubbleId, email, firstName, lastName, profilePicture, location, bio, artistDisciplines, role, createdAt)
    VALUES (${esc(bubbleId)}, ${esc(email)}, ${esc(firstName)}, ${esc(lastName)}, ${esc(profilePicture)}, ${esc(location)}, ${esc(bio)}, ${esc(artistDisciplines)}, 'user', NOW())
    ON DUPLICATE KEY UPDATE
      firstName = IF(firstName = '' OR firstName IS NULL, VALUES(firstName), firstName),
      lastName = IF(lastName = '' OR lastName IS NULL, VALUES(lastName), lastName),
      profilePicture = IF(profilePicture IS NULL, VALUES(profilePicture), profilePicture),
      location = IF(location IS NULL, VALUES(location), location),
      bio = IF(bio IS NULL, VALUES(bio), bio),
      artistDisciplines = IF(artistDisciplines IS NULL, VALUES(artistDisciplines), artistDisciplines)
  `);
  
  // Get the new user ID
  const [[newUser]] = await db.query("SELECT id FROM users WHERE bubbleId = ? LIMIT 1", [bubbleId]);
  if (newUser) {
    bubbleToUserId.set(bubbleId, newUser.id);
    resolved++;
  }
}, CONCURRENCY);

console.log(`  → ${resolved} new artist profiles seeded`);

// Step 3: Upsert all interested artist records
console.log(`\nUpserting ${records.length} interested artist records...`);
let inserted = 0;
let updated = 0;
let skipped = 0;

for (const rec of records) {
  const bubblePremiumJobId = rec.premiumjob;
  const premiumJobLocalId = bubbleToPremiumJobId.get(bubblePremiumJobId);
  
  if (!premiumJobLocalId) {
    skipped++;
    continue;
  }
  
  const bubbleArtistId = rec.artist || null;
  const artistLocalId = bubbleArtistId ? (bubbleToUserId.get(bubbleArtistId) ?? null) : null;
  const bubbleInterestedArtistId = rec._id;
  const message = rec.message || null;
  const rate = rec["premium job rate"] || null;
  const resumeLink = rec.link || null;
  const status = rec.status_interestedartists || "Interested";
  
  // Check if already exists by bubbleInterestedArtistId
  const [[existing]] = await db.query(
    `SELECT id FROM premium_job_interested_artists WHERE bubbleInterestedArtistId = ${esc(bubbleInterestedArtistId)} LIMIT 1`
  );
  
  if (existing) {
    await db.query(`
      UPDATE premium_job_interested_artists SET
        artistUserId = ${artistLocalId ?? "NULL"},
        bubbleArtistId = ${esc(bubbleArtistId)},
        message = ${esc(message)},
        rate = ${esc(rate)},
        resumeLink = ${esc(resumeLink)},
        status = ${esc(status)}
      WHERE id = ${existing.id}
    `);
    updated++;
  } else {
    await db.query(`
      INSERT INTO premium_job_interested_artists
        (premiumJobId, bubblePremiumJobId, artistUserId, bubbleArtistId, bubbleInterestedArtistId, message, rate, resumeLink, status)
      VALUES
        (${premiumJobLocalId}, ${esc(bubblePremiumJobId)}, ${artistLocalId ?? "NULL"}, ${esc(bubbleArtistId)}, ${esc(bubbleInterestedArtistId)}, ${esc(message)}, ${esc(rate)}, ${esc(resumeLink)}, ${esc(status)})
    `);
    inserted++;
  }
}

console.log(`  → ${inserted} inserted, ${updated} updated, ${skipped} skipped (no matching premium job)`);

// Summary
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
const [[revelJob]] = await db.query(`SELECT id FROM premium_jobs WHERE company LIKE '%REVEL%' OR company LIKE '%Revel%' LIMIT 1`);
if (revelJob) {
  const [[revelCount]] = await db.query(`SELECT COUNT(*) as c FROM premium_job_interested_artists WHERE premiumJobId = ?`, [revelJob.id]);
  console.log(`\nREVEL job (id=${revelJob.id}): ${revelCount.c} interested artists`);
}

await db.end();
console.log("\nDone!");
