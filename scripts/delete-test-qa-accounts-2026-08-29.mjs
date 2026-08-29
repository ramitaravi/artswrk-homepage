import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const ids = fs.readFileSync("/tmp/remove_ids.txt", "utf-8").trim().split("\n").map(Number).filter(Boolean);
console.log(`Deleting ${ids.length} test/QA accounts and everything attached to them.\n`);

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const ph = ids.map(() => "?").join(",");

async function del(label, sql, params) {
  const [res] = await conn.execute(sql, params);
  console.log(`  ${label}: ${res.affectedRows}`);
  return res.affectedRows;
}

// Collect booking IDs tied to these users BEFORE deleting bookings, so their
// children (booking_periods, reimbursements) can be cleaned up too.
const [bookingRows] = await conn.execute(
  `SELECT id FROM bookings WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph})`,
  [...ids, ...ids]
);
const bookingIds = bookingRows.map((r) => r.id);
const bph = bookingIds.length ? bookingIds.map(() => "?").join(",") : "NULL";

// Collect conversation IDs tied to these users, for messages cleanup.
const [convoRows] = await conn.execute(
  `SELECT id FROM conversations WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph})`,
  [...ids, ...ids]
);
const convoIds = convoRows.map((r) => r.id);
const cph = convoIds.length ? convoIds.map(() => "?").join(",") : "NULL";

console.log("Deleting children first:");
if (bookingIds.length) {
  await del("reimbursements (by bookingId)", `DELETE FROM reimbursements WHERE bookingId IN (${bph})`, bookingIds);
  await del("booking_periods", `DELETE FROM booking_periods WHERE bookingId IN (${bph})`, bookingIds);
}
if (convoIds.length) {
  await del("messages", `DELETE FROM messages WHERE conversationId IN (${cph})`, convoIds);
}
await del("bookings", `DELETE FROM bookings WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph})`, [...ids, ...ids]);
await del("conversations", `DELETE FROM conversations WHERE artistUserId IN (${ph}) OR clientUserId IN (${ph})`, [...ids, ...ids]);
await del("interested_artists", `DELETE FROM interested_artists WHERE artistUserId IN (${ph})`, ids);
await del("premium_job_interested_artists", `DELETE FROM premium_job_interested_artists WHERE artistUserId IN (${ph})`, ids);

// premium_jobs created by these users — clean up their interested-artist rows first too.
const [premiumJobRows] = await conn.execute(`SELECT id FROM premium_jobs WHERE createdByUserId IN (${ph})`, ids);
const premiumJobIds = premiumJobRows.map((r) => r.id);
if (premiumJobIds.length) {
  const pph = premiumJobIds.map(() => "?").join(",");
  await del("premium_job_interested_artists (by premiumJobId)", `DELETE FROM premium_job_interested_artists WHERE premiumJobId IN (${pph})`, premiumJobIds);
}
await del("premium_jobs", `DELETE FROM premium_jobs WHERE createdByUserId IN (${ph})`, ids);

// Regular jobs posted by these users — clean up their interested-artist rows first.
const [jobRows] = await conn.execute(`SELECT id FROM jobs WHERE clientUserId IN (${ph})`, ids);
const jobIds = jobRows.map((r) => r.id);
if (jobIds.length) {
  const jph = jobIds.map(() => "?").join(",");
  await del("interested_artists (by jobId)", `DELETE FROM interested_artists WHERE jobId IN (${jph})`, jobIds);
}
await del("jobs", `DELETE FROM jobs WHERE clientUserId IN (${ph})`, ids);

await del("client_companies", `DELETE FROM client_companies WHERE ownerUserId IN (${ph})`, ids);
await del("saved_artists (as client)", `DELETE FROM saved_artists WHERE clientUserId IN (${ph})`, ids);
await del("saved_artists (as artist)", `DELETE FROM saved_artists WHERE artistUserId IN (${ph})`, ids);
await del("artist_resumes", `DELETE FROM artist_resumes WHERE artistUserId IN (${ph})`, ids);
await del("enterprise_job_unlocks", `DELETE FROM enterprise_job_unlocks WHERE clientUserId IN (${ph})`, ids);
await del("client_job_unlocks", `DELETE FROM client_job_unlocks WHERE clientUserId IN (${ph})`, ids);
await del("payments", `DELETE FROM payments WHERE clientUserId IN (${ph})`, ids);
await del("referrals (as referrer)", `DELETE FROM referrals WHERE referrerUserId IN (${ph})`, ids);
await del("referrals (as invited)", `DELETE FROM referrals WHERE invitedUserId IN (${ph})`, ids);

console.log("\nDeleting the 56 user rows themselves:");
const usersDeleted = await del("users", `DELETE FROM users WHERE id IN (${ph})`, ids);

console.log(`\nDone. ${usersDeleted} user accounts removed.`);
await conn.end();
