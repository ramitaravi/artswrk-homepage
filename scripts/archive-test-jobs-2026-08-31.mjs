/**
 * Archives the QA/test jobs that were sitting at the top of the public /jobs
 * page on launch day.
 *
 *   node scripts/archive-test-jobs-2026-08-31.mjs [--dry-run]
 *
 * Archive, not delete: each of these has real applicants attached, and hard
 * deleting would orphan those interested_artists rows. Setting requestStatus
 * to "Archived" (the canonical value in shared/jobStatus.ts) takes them off
 * every public listing while leaving the application history intact.
 *
 * Deliberately NOT included: job #2370001 "Acro Instructor". Its description
 * reads like a genuine posting ("extreme beginners ages 1-5 in Queens"), so it
 * needs a human decision rather than a pattern match.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DRY = process.argv.includes("--dry-run");

const TARGETS = [
  { id: 2430001, why: 'title is "TESING POST JOB"' },
  { id: 2400001, why: 'description says "AUG 26 QA TEST- safe to delete"' },
  { id: 2280001, why: 'description says "QA TEST - safe to delete"' },
  { id: 2490001, why: "the Ballet Substitute Teacher job posted while testing job alerts" },
];

const c = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await c.query(
  `SELECT id, title, requestStatus, networkStatus,
          (SELECT COUNT(*) FROM interested_artists ia WHERE ia.jobId = jobs.id) apps
   FROM jobs WHERE id IN (${TARGETS.map((t) => t.id).join(",")})`
);
const byId = new Map(rows.map((r) => [r.id, r]));

console.log(`${DRY ? "[dry run] " : ""}archiving ${TARGETS.length} test jobs\n`);
for (const t of TARGETS) {
  const r = byId.get(t.id);
  if (!r) { console.log(`  · #${t.id} not found — skipping`); continue; }
  console.log(`  #${r.id}  ${JSON.stringify(r.title)}`);
  console.log(`     ${t.why}`);
  console.log(`     status ${r.requestStatus} → Archived   (${r.apps} applicant${r.apps === 1 ? "" : "s"} preserved)`);
  if (!DRY) {
    // networkStatus too: a job sitting as 'pending' would still be picked up
    // by the first digest run whenever job alerts are switched on.
    await c.query(
      `UPDATE jobs SET requestStatus = 'Archived', networkStatus = 'suppressed' WHERE id = ?`,
      [r.id]
    );
  }
}

if (!DRY) {
  const [after] = await c.query(
    `SELECT id, title FROM jobs WHERE requestStatus = 'Active' AND (direct IS NULL OR direct = 0)
     ORDER BY COALESCE(bubbleCreatedAt, createdAt) DESC LIMIT 5`
  );
  console.log(`\nTop of /jobs now:`);
  for (const j of after) console.log(`  #${j.id}  ${j.title ?? "(no title)"}`);
}
await c.end();
