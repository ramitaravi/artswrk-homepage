/**
 * Archives every job that did NOT come from Bubble.
 *
 *   node scripts/archive-nonbubble-test-jobs-2026-08-31.mjs [--dry-run]
 *
 * Ramita's rule on launch day: nothing genuine has ever been posted through
 * the new site, so `bubbleId IS NULL` identifies test data exactly. Confirmed
 * against the posters — every one is ramita@artswrk.com, ramitaravi.94@gmail.com,
 * nick-test@artswrk.com, or a single April "Pending Payment" row from a client
 * address that never went live.
 *
 * Archived, not deleted: several carry real applicants, and deleting would
 * orphan those interested_artists rows. networkStatus goes to 'suppressed' at
 * the same time so none can be swept into the first job-alert digest.
 *
 * One-off. Once real jobs start arriving through the new site this rule stops
 * being true, so do not re-run it later.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DRY = process.argv.includes("--dry-run");
const c = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await c.query(`
  SELECT j.id, j.title, j.requestStatus, u.email AS poster,
         (SELECT COUNT(*) FROM interested_artists ia WHERE ia.jobId = j.id) apps
  FROM jobs j LEFT JOIN users u ON u.id = j.clientUserId
  WHERE j.bubbleId IS NULL AND j.requestStatus <> 'Archived'
  ORDER BY j.id DESC`);

if (!rows.length) { console.log("Nothing left to archive."); await c.end(); process.exit(0); }

console.log(`${DRY ? "[dry run] " : ""}${rows.length} non-Bubble jobs to archive\n`);
let apps = 0;
for (const r of rows) {
  apps += r.apps;
  console.log(`  #${String(r.id).padEnd(9)} ${String(r.title ?? "(no title)").slice(0,32).padEnd(34)} ${String(r.requestStatus).padEnd(17)} ${r.poster ?? "—"}`);
}
console.log(`\n  ${apps} applicant record(s) preserved`);

if (!DRY) {
  const [res] = await c.query(
    `UPDATE jobs SET requestStatus = 'Archived', networkStatus = 'suppressed'
     WHERE bubbleId IS NULL AND requestStatus <> 'Archived'`
  );
  console.log(`\n  updated ${res.affectedRows} rows`);

  const [left] = await c.query(
    `SELECT COUNT(*) n FROM jobs WHERE bubbleId IS NULL AND requestStatus <> 'Archived'`);
  const [queue] = await c.query(`SELECT COUNT(*) n FROM jobs WHERE networkStatus = 'pending'`);
  const [top] = await c.query(
    `SELECT id, title FROM jobs WHERE requestStatus = 'Active' AND (direct IS NULL OR direct = 0)
     ORDER BY COALESCE(bubbleCreatedAt, createdAt) DESC LIMIT 5`);
  console.log(`  non-Bubble jobs still live: ${left[0].n}`);
  console.log(`  jobs in the alert queue: ${queue[0].n}`);
  console.log(`\n  Top of /jobs now:`);
  for (const j of top) console.log(`    #${j.id}  ${j.title ?? "(no title)"}`);
}
await c.end();
