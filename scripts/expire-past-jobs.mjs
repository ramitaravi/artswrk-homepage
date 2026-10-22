/**
 * Clear the backlog of jobs left Active after their date.
 *
 * The same rules the cron uses (server/expireJobs.ts): a real start date, a
 * day's grace, Active only, and never a job with confirmed bookings on it.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [rows] = await c.query(`
  SELECT j.id, j.title, DATE(j.startDate) d
  FROM jobs j
  WHERE j.requestStatus = 'Active'
    AND j.startDate IS NOT NULL
    AND j.startDate < NOW() - INTERVAL 1 DAY
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.jobId = j.id AND b.deleted = 0
        AND b.bookingStatus IN ('Confirmed', 'Pay Now'))
  ORDER BY j.startDate`);

const [[withBookings]] = await c.query(`
  SELECT COUNT(*) n FROM jobs j
  WHERE j.requestStatus = 'Active' AND j.startDate IS NOT NULL
    AND j.startDate < NOW() - INTERVAL 1 DAY
    AND EXISTS (SELECT 1 FROM bookings b WHERE b.jobId = j.id AND b.deleted = 0
                AND b.bookingStatus IN ('Confirmed','Pay Now'))`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${rows.length} past-dated Active jobs to archive`);
console.log(`  ${withBookings.n} left alone — they have confirmed bookings on them\n`);
for (const j of rows.slice(0, 5)) console.log(`    #${j.id} ${String(j.d).slice(4,15)}  "${(j.title ?? "(untitled)").slice(0, 44)}"`);
if (rows.length > 5) console.log(`    … and ${rows.length - 5} more`);

if (WRITE && rows.length) {
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    await c.query(`UPDATE jobs SET requestStatus='Archived', updatedAt=NOW() WHERE id IN (${batch.map(() => "?").join(",")})`, batch);
  }
  const [[left]] = await c.query(`
    SELECT COUNT(*) n FROM jobs WHERE requestStatus='Active' AND startDate IS NOT NULL AND startDate < NOW() - INTERVAL 1 DAY`);
  console.log(`\n✓ archived ${ids.length} — ${left.n} past-dated Active jobs remain (those with bookings)`);
} else if (!WRITE) {
  console.log(`\nNothing written — re-run with --write.`);
}
await c.end();
