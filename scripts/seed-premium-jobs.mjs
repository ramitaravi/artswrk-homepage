/**
 * Seed script: Bubble premium_jobs → MySQL premium_jobs + premium_job_interested_artists
 * Uses db.query() with string-escaped SQL to avoid mysql2 field type 245 (JSON) issue.
 * Usage: node scripts/seed-premium-jobs.mjs
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const REVEL_BUBBLE_ID = "1772121421134x418341755101401700"; // taylor@dancerevel.com

const db = await mysql.createConnection(process.env.DATABASE_URL);

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace("T", " ");
}

function esc(val) {
  if (val === null || val === undefined) return "NULL";
  const s = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${s}'`;
}

async function bubbleFetchAll(table) {
  const results = [];
  let cursor = 0;
  while (true) {
    const url = `${BUBBLE_BASE}/${table}?limit=100&cursor=${cursor}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_KEY}` } });
    const json = await res.json();
    const batch = json?.response?.results ?? [];
    results.push(...batch);
    if ((json?.response?.remaining ?? 0) === 0 || batch.length === 0) break;
    cursor += 100;
  }
  return results;
}

// Step 1: Fetch all premium jobs
console.log("Fetching all premium jobs from Bubble live...");
const premiumJobs = await bubbleFetchAll("premium_jobs");
console.log(`  → ${premiumJobs.length} premium jobs fetched`);

// Step 2: Build Bubble → local user ID map
console.log("Building Bubble → local user ID map...");
const [userRows] = await db.query("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
const bubbleToLocalUser = new Map();
for (const row of userRows) bubbleToLocalUser.set(row.bubbleId, row.id);
console.log(`  → ${bubbleToLocalUser.size} users in map`);
console.log(`  → REVEL local user ID: ${bubbleToLocalUser.get(REVEL_BUBBLE_ID) ?? "not found"}`);

// Step 3: Upsert all premium jobs
console.log("Upserting premium jobs...");
const jobInterestedMap = new Map();
const allInterestedBubbleIds = new Set();

for (const job of premiumJobs) {
  const bubbleId = job._id;
  const createdById = job["Created By"] ?? null;
  const createdByLocalId = bubbleToLocalUser.get(createdById) ?? null;
  const interestedArtists = job.interested_artists ?? [];
  jobInterestedMap.set(bubbleId, interestedArtists);
  for (const aid of interestedArtists) allInterestedBubbleIds.add(aid);

  const logoRaw = job.logo ?? null;
  const logo = logoRaw ? (logoRaw.startsWith("//") ? `https:${logoRaw}` : logoRaw) : null;

  await db.query(`INSERT INTO premium_jobs (
    bubbleId, company, logo, createdByUserId, bubbleCreatedById, bubbleClientCompanyId,
    serviceType, category, description, budget, location, tag, slug,
    applyDirect, applyEmail, applyLink, workFromAnywhere, featured, status,
    bubbleCreatedAt, bubbleModifiedAt
  ) VALUES (
    ${esc(bubbleId)}, ${esc(job.Company)}, ${esc(logo)},
    ${createdByLocalId ?? "NULL"}, ${esc(createdById)}, ${esc(job["Client-Company"])},
    ${esc(job["Service Type"])}, ${esc(job.Category)}, ${esc(job.Description)},
    ${esc(job.Budget)}, ${esc(job.Location)}, ${esc(job.Tag)}, ${esc(job.Slug)},
    ${job["Apply Direct?"] ? 1 : 0}, ${esc(job.email)}, ${esc(job.link)},
    ${job["Work From Anywhere?"] ? 1 : 0}, ${job.featured ? 1 : 0}, ${esc(job.Status ?? "Active")},
    ${job["Created Date"] ? esc(parseDate(job["Created Date"])) : "NULL"},
    ${job["Modified Date"] ? esc(parseDate(job["Modified Date"])) : "NULL"}
  ) ON DUPLICATE KEY UPDATE
    company=VALUES(company), logo=VALUES(logo),
    createdByUserId=VALUES(createdByUserId), bubbleCreatedById=VALUES(bubbleCreatedById),
    bubbleClientCompanyId=VALUES(bubbleClientCompanyId),
    serviceType=VALUES(serviceType), category=VALUES(category),
    description=VALUES(description), budget=VALUES(budget),
    location=VALUES(location), tag=VALUES(tag), slug=VALUES(slug),
    applyDirect=VALUES(applyDirect), applyEmail=VALUES(applyEmail),
    applyLink=VALUES(applyLink), workFromAnywhere=VALUES(workFromAnywhere),
    featured=VALUES(featured), status=VALUES(status),
    bubbleCreatedAt=VALUES(bubbleCreatedAt), bubbleModifiedAt=VALUES(bubbleModifiedAt)`);
}
console.log(`  → ${premiumJobs.length} premium jobs upserted`);

// Step 4: Fetch unknown artists from Bubble
const unknownBubbleIds = [...allInterestedBubbleIds].filter(id => !bubbleToLocalUser.has(id));
console.log(`  → ${allInterestedBubbleIds.size} total interested artist refs, ${unknownBubbleIds.length} unknown`);

if (unknownBubbleIds.length > 0) {
  let fetched = 0;
  for (let i = 0; i < unknownBubbleIds.length; i++) {
    const bubbleArtistId = unknownBubbleIds[i];
    try {
      const res = await fetch(`${BUBBLE_BASE}/user/${bubbleArtistId}`, {
        headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
      });
      const json = await res.json();
      const u = json?.response;
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
    } catch (_) {}
    if ((i + 1) % 20 === 0) process.stdout.write(`\r  → Processed ${i + 1}/${unknownBubbleIds.length} artists...`);
  }
  console.log(`\n  → ${fetched} new artist users upserted`);
}

// Step 5: Upsert interested artists join table
console.log("Upserting premium_job_interested_artists...");
const [premiumJobRows] = await db.query("SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL");
const bubbleToPremiumJobId = new Map();
for (const row of premiumJobRows) bubbleToPremiumJobId.set(row.bubbleId, row.id);

let interestedInserted = 0, interestedSkipped = 0;
for (const [bubbleJobId, artistBubbleIds] of jobInterestedMap.entries()) {
  const premiumJobLocalId = bubbleToPremiumJobId.get(bubbleJobId);
  if (!premiumJobLocalId) continue;
  for (const bubbleArtistId of artistBubbleIds) {
    const artistLocalId = bubbleToLocalUser.get(bubbleArtistId) ?? null;
    const [existing] = await db.query(
      `SELECT id FROM premium_job_interested_artists WHERE premiumJobId = ${premiumJobLocalId} AND bubbleArtistId = ${esc(bubbleArtistId)}`
    );
    if (existing.length > 0) { interestedSkipped++; continue; }
    await db.query(`INSERT INTO premium_job_interested_artists
      (premiumJobId, bubblePremiumJobId, artistUserId, bubbleArtistId)
      VALUES (${premiumJobLocalId}, ${esc(bubbleJobId)}, ${artistLocalId ?? "NULL"}, ${esc(bubbleArtistId)})`);
    interestedInserted++;
  }
}
console.log(`  → ${interestedInserted} inserted, ${interestedSkipped} skipped`);

// Step 6: Summary
const [pjCount] = await db.query("SELECT COUNT(*) as c FROM premium_jobs");
const [pjiaCount] = await db.query("SELECT COUNT(*) as c FROM premium_job_interested_artists");
const [revelJobs] = await db.query(`SELECT COUNT(*) as c FROM premium_jobs WHERE bubbleCreatedById = ${esc(REVEL_BUBBLE_ID)}`);
const [revelInterested] = await db.query(`SELECT COUNT(*) as c FROM premium_job_interested_artists pjia
  JOIN premium_jobs pj ON pjia.premiumJobId = pj.id WHERE pj.bubbleCreatedById = ${esc(REVEL_BUBBLE_ID)}`);

console.log("\n── Summary ──────────────────────────────────────────────");
console.log(`  premium_jobs total:                    ${pjCount[0].c}`);
console.log(`  premium_job_interested_artists total:  ${pjiaCount[0].c}`);
console.log(`  REVEL jobs:                            ${revelJobs[0].c}`);
console.log(`  REVEL interested artists:              ${revelInterested[0].c}`);

await db.end();
console.log("\nDone!");
