/**
 * Queues nine live Ensemble Schools jobs for the next job-alert digest.
 *
 * Every job that predates the alert system was marked suppressed at cutover so
 * that switching alerts on didn't send artists months of backlog. That was
 * right, but it also held back jobs that are still hiring: these nine start in
 * early October, carry a service type and a location so they match and render
 * properly, and have never been shown to a single artist.
 *
 * Only queues a job that is still Active, still suppressed, starts in the
 * future and has a title — anything else is left alone and reported.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const IDS = [1683655, 1683656, 1683657, 2193758, 2193759, 2193760, 2343852, 2343853, 2343854];
const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [rows] = await c.query(`
  SELECT j.id, j.title, DATE(j.startDate) AS starts, j.requestStatus, j.networkStatus,
         j.masterServiceTypeId IS NOT NULL AS hasServiceType,
         j.locationLat IS NOT NULL AS hasLocation,
         u.email AS client
  FROM jobs j LEFT JOIN users u ON u.id = j.clientUserId
  WHERE j.id IN (${IDS.join(",")}) ORDER BY j.startDate, j.id
`);

const eligible = [];
console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
for (const r of rows) {
  const problems = [];
  if (r.requestStatus !== "Active") problems.push(`status is ${r.requestStatus}`);
  if (r.networkStatus !== "suppressed") problems.push(`already ${r.networkStatus ?? "unqueued"}`);
  if (!r.title) problems.push("no title");
  if (!r.hasServiceType) problems.push("no service type — would match nobody");
  if (!r.hasLocation) problems.push("no location");
  if (new Date(r.starts) < new Date(new Date().toDateString())) problems.push("start date has passed");

  if (problems.length) {
    console.log(`  ✗ ${r.id}  ${r.title ?? "(no title)"} — skipped: ${problems.join(", ")}`);
  } else {
    eligible.push(r);
    console.log(`  ✓ ${r.id}  ${r.title}  starts ${r.starts}  (${r.client})`);
  }
}

if (WRITE && eligible.length) {
  const [res] = await c.query(
    `UPDATE jobs SET networkStatus = 'pending', updatedAt = NOW() WHERE id IN (${eligible.map((r) => r.id).join(",")})`);
  console.log(`\n✓ queued ${res.affectedRows} job(s) — they go out in the next 1pm ET digest`);
} else if (!WRITE) {
  console.log(`\nWould queue ${eligible.length} job(s) for the next 1pm ET digest. Nothing written — re-run with --write.`);
}

await c.end();
