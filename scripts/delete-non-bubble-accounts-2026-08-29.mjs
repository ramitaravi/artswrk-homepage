/**
 * Removes every user NOT currently live in Bubble, except id 781383
 * (Sabrina Breslin — has a real Stripe customer ID but her bubbleId no
 * longer exists in live Bubble; held out for manual review rather than
 * deleted blind).
 *
 * Verified before running: 0 of these 650 have an active stored
 * stripeSubscriptionId, 648/651 are artist_free, all created Apr-Jun 2026
 * (the original migration window, not ongoing organic signups).
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const HOLD_OUT = [781383];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  `SELECT id FROM users WHERE (bubbleSourcePresent = 0 OR bubbleSourcePresent IS NULL) AND id NOT IN (${HOLD_OUT.join(",")})`
);
const ids = rows.map((r) => r.id);
console.log(`Deleting ${ids.length} native/non-Bubble accounts (holding out ${HOLD_OUT.join(",")}).\n`);

async function del(label, sql, params) {
  const [res] = await conn.execute(sql, params);
  if (res.affectedRows > 0) console.log(`  ${label}: ${res.affectedRows}`);
}

const BATCH = 200;
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const ph = batch.map(() => "?").join(",");

  await del("reimbursements", `DELETE FROM reimbursements WHERE bookingId IN (SELECT id FROM bookings WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph}))`, [...batch, ...batch]);
  await del("booking_periods", `DELETE FROM booking_periods WHERE bookingId IN (SELECT id FROM bookings WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph}))`, [...batch, ...batch]);
  await del("messages", `DELETE FROM messages WHERE conversationId IN (SELECT id FROM conversations WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph}))`, [...batch, ...batch]);
  await del("bookings", `DELETE FROM bookings WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph})`, [...batch, ...batch]);
  await del("conversations", `DELETE FROM conversations WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph})`, [...batch, ...batch]);
  await del("interested_artists (by artist)", `DELETE FROM interested_artists WHERE artistUserId IN (${ph})`, batch);
  await del("interested_artists (by job)", `DELETE FROM interested_artists WHERE jobId IN (SELECT id FROM jobs WHERE clientUserId IN (${ph}))`, batch);
  await del("premium_job_interested_artists (by artist)", `DELETE FROM premium_job_interested_artists WHERE artistUserId IN (${ph})`, batch);
  await del("premium_job_interested_artists (by job)", `DELETE FROM premium_job_interested_artists WHERE premiumJobId IN (SELECT id FROM premium_jobs WHERE createdByUserId IN (${ph}))`, batch);
  await del("premium_jobs", `DELETE FROM premium_jobs WHERE createdByUserId IN (${ph})`, batch);
  await del("jobs", `DELETE FROM jobs WHERE clientUserId IN (${ph})`, batch);
  await del("client_companies", `DELETE FROM client_companies WHERE ownerUserId IN (${ph})`, batch);
  await del("saved_artists", `DELETE FROM saved_artists WHERE clientUserId IN (${ph}) OR artistUserId IN (${ph})`, [...batch, ...batch]);
  await del("artist_resumes", `DELETE FROM artist_resumes WHERE artistUserId IN (${ph})`, batch);
  await del("enterprise_job_unlocks", `DELETE FROM enterprise_job_unlocks WHERE clientUserId IN (${ph})`, batch);
  await del("client_job_unlocks", `DELETE FROM client_job_unlocks WHERE clientUserId IN (${ph})`, batch);
  await del("payments", `DELETE FROM payments WHERE clientUserId IN (${ph})`, batch);
  await del("referrals", `DELETE FROM referrals WHERE referrerUserId IN (${ph}) OR invitedUserId IN (${ph})`, [...batch, ...batch]);
  await del("users", `DELETE FROM users WHERE id IN (${ph})`, batch);

  console.log(`  ...batch ${Math.floor(i / BATCH) + 1} done (${Math.min(i + BATCH, ids.length)}/${ids.length})`);
}

const [[final]] = await conn.execute(`SELECT COUNT(*) n FROM users`);
console.log(`\nDone. Total users remaining: ${final.n}`);
await conn.end();
