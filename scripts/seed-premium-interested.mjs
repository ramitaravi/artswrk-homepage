/**
 * Seed script (part 2): Fetch interested artists for premium_jobs in parallel batches.
 * premium_jobs are already seeded. This script:
 *   1. Fetches all 185 premium jobs from Bubble to get interested_artists arrays
 *   2. Finds which artist Bubble IDs aren't in our DB yet
 *   3. Fetches them in parallel batches of 15
 *   4. Upserts them into users table
 *   5. Inserts premium_job_interested_artists join records
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const REVEL_BUBBLE_ID = "1772121421134x418341755101401700";
const CONCURRENCY = 15;

const db = await mysql.createConnection(process.env.DATABASE_URL);

function esc(val) {
  if (val === null || val === undefined) return "NULL";
  const s = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${s}'`;
}

// Fetch all premium jobs from Bubble
console.log("Fetching premium jobs from Bubble...");
const allJobs = [];
for (let cursor = 0; ; cursor += 100) {
  const r = await fetch(`${BUBBLE_BASE}/premium_jobs?limit=100&cursor=${cursor}`, {
    headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
  });
  const json = await r.json();
  const batch = json?.response?.results ?? [];
  allJobs.push(...batch);
  if ((json?.response?.remaining ?? 0) === 0 || batch.length === 0) break;
}
console.log(`  → ${allJobs.length} premium jobs`);

// Build job → interested artists map
const jobInterestedMap = new Map();
const allInterestedBubbleIds = new Set();
for (const job of allJobs) {
  const ids = job.interested_artists ?? [];
  jobInterestedMap.set(job._id, ids);
  for (const id of ids) allInterestedBubbleIds.add(id);
}
console.log(`  → ${allInterestedBubbleIds.size} unique interested artist Bubble IDs`);

// Build local user map
const [userRows] = await db.query("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
const bubbleToLocalUser = new Map();
for (const row of userRows) bubbleToLocalUser.set(row.bubbleId, row.id);
console.log(`  → ${bubbleToLocalUser.size} users already in DB`);

// Find unknown artists
const unknownIds = [...allInterestedBubbleIds].filter(id => !bubbleToLocalUser.has(id));
console.log(`  → ${unknownIds.length} artists to fetch from Bubble`);

// Fetch in parallel batches
async function fetchArtist(bubbleArtistId) {
  try {
    const res = await fetch(`${BUBBLE_BASE}/user/${bubbleArtistId}`, {
      headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
    });
    const json = await res.json();
    return { bubbleArtistId, user: json?.response ?? null };
  } catch {
    return { bubbleArtistId, user: null };
  }
}

let fetched = 0;
for (let i = 0; i < unknownIds.length; i += CONCURRENCY) {
  const batch = unknownIds.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(fetchArtist));

  for (const { bubbleArtistId, user: u } of results) {
    if (!u) continue;
    const openId = `bubble_${bubbleArtistId}`;
    const email = u.email ?? u.Email ?? null;
    const firstName = u["First Name"] ?? u.firstName ?? null;
    const lastName = u["Last Name"] ?? u.lastName ?? null;
    const name = firstName && lastName ? `${firstName} ${lastName}` : firstName ?? lastName ?? email ?? openId;

    await db.query(`INSERT INTO users (openId, bubbleId, email, firstName, lastName, name,
        profilePicture, userRole, slug, location, artswrkPro, loginMethod)
      VALUES (${esc(openId)}, ${esc(bubbleArtistId)}, ${esc(email)},
        ${esc(firstName)}, ${esc(lastName)}, ${esc(name)},
        ${esc(u["Profile Picture"] ?? null)}, 'Artist',
        ${esc(u.Slug ?? u.slug ?? null)}, ${esc(u.Location ?? u.location ?? null)},
        ${u["Artswrk PRO?"] ? 1 : 0}, 'bubble')
      ON DUPLICATE KEY UPDATE
        email=COALESCE(VALUES(email), email),
        firstName=COALESCE(VALUES(firstName), firstName),
        lastName=COALESCE(VALUES(lastName), lastName),
        name=COALESCE(VALUES(name), name),
        profilePicture=COALESCE(VALUES(profilePicture), profilePicture),
        userRole=COALESCE(VALUES(userRole), userRole),
        slug=COALESCE(VALUES(slug), slug),
        location=COALESCE(VALUES(location), location)`);

    const [rows] = await db.query(`SELECT id FROM users WHERE bubbleId = ${esc(bubbleArtistId)}`);
    if (rows.length > 0) { bubbleToLocalUser.set(bubbleArtistId, rows[0].id); fetched++; }
  }

  process.stdout.write(`\r  → Fetched ${Math.min(i + CONCURRENCY, unknownIds.length)}/${unknownIds.length} artists...`);
}
console.log(`\n  → ${fetched} new artist users upserted`);

// Get premium_jobs local IDs
const [premiumJobRows] = await db.query("SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL");
const bubbleToPremiumJobId = new Map();
for (const row of premiumJobRows) bubbleToPremiumJobId.set(row.bubbleId, row.id);

// Upsert join table
console.log("Inserting premium_job_interested_artists...");
let inserted = 0, skipped = 0;

for (const [bubbleJobId, artistBubbleIds] of jobInterestedMap.entries()) {
  const premiumJobLocalId = bubbleToPremiumJobId.get(bubbleJobId);
  if (!premiumJobLocalId || artistBubbleIds.length === 0) continue;

  for (const bubbleArtistId of artistBubbleIds) {
    const artistLocalId = bubbleToLocalUser.get(bubbleArtistId) ?? null;
    const [existing] = await db.query(
      `SELECT id FROM premium_job_interested_artists WHERE premiumJobId = ${premiumJobLocalId} AND bubbleArtistId = ${esc(bubbleArtistId)}`
    );
    if (existing.length > 0) { skipped++; continue; }
    await db.query(`INSERT INTO premium_job_interested_artists
      (premiumJobId, bubblePremiumJobId, artistUserId, bubbleArtistId)
      VALUES (${premiumJobLocalId}, ${esc(bubbleJobId)}, ${artistLocalId ?? "NULL"}, ${esc(bubbleArtistId)})`);
    inserted++;
  }
}
console.log(`  → ${inserted} inserted, ${skipped} skipped`);

// Summary
const [pjCount] = await db.query("SELECT COUNT(*) as c FROM premium_jobs");
const [pjiaCount] = await db.query("SELECT COUNT(*) as c FROM premium_job_interested_artists");
const [uCount] = await db.query("SELECT COUNT(*) as c FROM users");
const [revelJobs] = await db.query(`SELECT COUNT(*) as c FROM premium_jobs WHERE bubbleCreatedById = ${esc(REVEL_BUBBLE_ID)}`);
const [revelInterested] = await db.query(`SELECT COUNT(*) as c FROM premium_job_interested_artists pjia
  JOIN premium_jobs pj ON pjia.premiumJobId = pj.id WHERE pj.bubbleCreatedById = ${esc(REVEL_BUBBLE_ID)}`);

console.log("\n── Final Summary ────────────────────────────────────────");
console.log(`  users total:                           ${uCount[0].c}`);
console.log(`  premium_jobs total:                    ${pjCount[0].c}`);
console.log(`  premium_job_interested_artists total:  ${pjiaCount[0].c}`);
console.log(`  REVEL jobs:                            ${revelJobs[0].c}`);
console.log(`  REVEL interested artists:              ${revelInterested[0].c}`);

await db.end();
console.log("\nDone!");
