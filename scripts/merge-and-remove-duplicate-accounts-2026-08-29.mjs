/**
 * For every bubbleId with more than 1 row: pick a KEEP row (prefer
 * bubbleSourcePresent=1, then a real email, then most recently updated),
 * merge any real data from the other rows onto it (profile fields where
 * KEEP is empty; subscription fields specifically taken from whichever
 * row actually has a real stripeSubscriptionId, even if that's not the
 * row otherwise chosen as KEEP), then delete the extra rows and
 * everything attached to them.
 *
 * One-off, run once against the live DB. Kept as a record, not meant to
 * be re-run — the group membership is a snapshot of duplicates that (after
 * this runs) will no longer exist.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const PROFILE_FIELDS = [
  "firstName", "lastName", "name", "profilePicture", "phoneNumber", "bio", "pronouns",
  "artistDisciplines", "artistServices", "masterServiceType", "masterArtistTypes", "masterStyles",
  "artistExperiences", "location", "portfolio", "website", "instagram", "tiktok", "youtube",
  "videos", "mediaPhotos", "resumeFiles", "tagline", "credits", "workTypes",
  "clientCompanyName", "hiringCategory", "businessType", "businessOrIndividual",
  "artistStripeAccountId", "artistStripeAccountType", "artistStripeReturnCode", "artistStripeDateCreated",
  "stripeProductId", "source", "artistBusinessName", "artistTransportationAccommodation",
];
const SUBSCRIPTION_FIELDS = [
  "planTier", "stripeCustomerId", "stripeSubscriptionId", "stripePriceId",
  "artswrkPro", "artswrkBasic", "clientPremium", "enterprise", "enterprisePlan",
  "enterpriseStripeCustomerId", "enterpriseStripeSubscriptionId", "enterpriseSubInterval",
  "clientStripeCustomerId", "clientStripeCardId", "clientSubscriptionId", "artistStripeProductId",
];

const [dupGroups] = await conn.execute(`
  SELECT bubbleId, COUNT(*) n FROM users
  WHERE bubbleId IS NOT NULL AND bubbleId != ''
  GROUP BY bubbleId HAVING COUNT(*) > 1
`);
console.log(`Processing ${dupGroups.length} duplicate groups...\n`);

let mergedFieldCount = 0, subscriptionMerges = 0, groupsProcessed = 0, rowsRemoved = 0;
const log = [];

for (const g of dupGroups) {
  const [members] = await conn.execute(`SELECT * FROM users WHERE bubbleId = ?`, [g.bubbleId]);

  const sorted = [...members].sort((a, b) => {
    if (!!b.bubbleSourcePresent !== !!a.bubbleSourcePresent) return (b.bubbleSourcePresent ? 1 : 0) - (a.bubbleSourcePresent ? 1 : 0);
    const aEmail = a.email ? 1 : 0, bEmail = b.email ? 1 : 0;
    if (bEmail !== aEmail) return bEmail - aEmail;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  const keep = sorted[0];
  const removeRows = sorted.slice(1);

  const updates = {};

  // Fill gaps on the kept row from any duplicate that has real data.
  for (const field of PROFILE_FIELDS) {
    if (keep[field] !== null && keep[field] !== "" && keep[field] !== undefined) continue;
    for (const r of removeRows) {
      const val = r[field];
      if (val !== null && val !== "" && val !== undefined) {
        updates[field] = val;
        mergedFieldCount++;
        break;
      }
    }
  }

  // Subscription fields: if the KEEP row has no real subscription but a
  // duplicate does, pull the whole subscription bundle from that duplicate
  // rather than merging field-by-field (avoids mixing IDs from two
  // different Stripe customers).
  if (!keep.stripeSubscriptionId) {
    const subRow = removeRows.find((r) => r.stripeSubscriptionId);
    if (subRow) {
      for (const field of SUBSCRIPTION_FIELDS) {
        if (subRow[field] !== null && subRow[field] !== "" && subRow[field] !== undefined) {
          updates[field] = subRow[field];
        }
      }
      subscriptionMerges++;
    }
  }

  if (Object.keys(updates).length > 0) {
    const setClause = Object.keys(updates).map((f) => `\`${f}\` = ?`).join(", ");
    await conn.execute(`UPDATE users SET ${setClause} WHERE id = ?`, [...Object.values(updates), keep.id]);
  }

  // Cascade-delete each removed row's attached data, then the row itself.
  for (const r of removeRows) {
    const id = r.id;
    await conn.execute(`DELETE FROM reimbursements WHERE bookingId IN (SELECT id FROM bookings WHERE artistUserId = ? OR clientUserId = ?)`, [id, id]);
    await conn.execute(`DELETE FROM booking_periods WHERE bookingId IN (SELECT id FROM bookings WHERE artistUserId = ? OR clientUserId = ?)`, [id, id]);
    await conn.execute(`DELETE FROM messages WHERE conversationId IN (SELECT id FROM conversations WHERE artistUserId = ? OR clientUserId = ?)`, [id, id]);
    await conn.execute(`DELETE FROM bookings WHERE artistUserId = ? OR clientUserId = ?`, [id, id]);
    await conn.execute(`DELETE FROM conversations WHERE artistUserId = ? OR clientUserId = ?`, [id, id]);
    await conn.execute(`DELETE FROM interested_artists WHERE artistUserId = ? OR jobId IN (SELECT id FROM jobs WHERE clientUserId = ?)`, [id, id]);
    await conn.execute(`DELETE FROM premium_job_interested_artists WHERE artistUserId = ? OR premiumJobId IN (SELECT id FROM premium_jobs WHERE createdByUserId = ?)`, [id, id]);
    await conn.execute(`DELETE FROM premium_jobs WHERE createdByUserId = ?`, [id]);
    await conn.execute(`DELETE FROM jobs WHERE clientUserId = ?`, [id]);
    await conn.execute(`DELETE FROM client_companies WHERE ownerUserId = ?`, [id]);
    await conn.execute(`DELETE FROM saved_artists WHERE clientUserId = ? OR artistUserId = ?`, [id, id]);
    await conn.execute(`DELETE FROM artist_resumes WHERE artistUserId = ?`, [id]);
    await conn.execute(`DELETE FROM enterprise_job_unlocks WHERE clientUserId = ?`, [id]);
    await conn.execute(`DELETE FROM client_job_unlocks WHERE clientUserId = ?`, [id]);
    await conn.execute(`DELETE FROM payments WHERE clientUserId = ?`, [id]);
    await conn.execute(`DELETE FROM referrals WHERE referrerUserId = ? OR invitedUserId = ?`, [id, id]);
    await conn.execute(`DELETE FROM users WHERE id = ?`, [id]);
    rowsRemoved++;
    log.push({ bubbleId: g.bubbleId, keptId: keep.id, keptEmail: keep.email, removedId: id, removedEmail: r.email });
  }

  groupsProcessed++;
  if (groupsProcessed % 100 === 0) process.stdout.write(`\r${groupsProcessed} / ${dupGroups.length} groups processed`);
}

console.log(`\n\nDone.`);
console.log(`Groups processed: ${groupsProcessed}`);
console.log(`Rows removed: ${rowsRemoved}`);
console.log(`Profile fields backfilled onto a kept row: ${mergedFieldCount}`);
console.log(`Subscription bundles pulled from a duplicate onto the kept row: ${subscriptionMerges}`);

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const cols = ["bubbleId", "keptId", "keptEmail", "removedId", "removedEmail"];
const lines = [cols.join(",")];
for (const r of log) lines.push(cols.map((c) => csvEscape(r[c])).join(","));
fs.writeFileSync("/Users/ramitaravi/Downloads/artswrk_duplicate_merge_log.csv", lines.join("\n"));
console.log(`\nWrote artswrk_duplicate_merge_log.csv (${log.length} rows) — a record of exactly which row was kept and which was removed per group.`);

await conn.end();
