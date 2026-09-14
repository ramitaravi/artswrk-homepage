/**
 * Dry-runs the PRO-only (Tue Sep 15) and regular-jobs-only (Wed Sep 16) digests.
 * Sends nothing: SendGrid is disabled for this process AND runDigest runs with dryRun.
 * Checks that no job status or send log changed. Exits 1 on any failure.
 *
 *   npx tsx scripts/verify-digest-schedule-2026-09-15.mjs [outDir]
 */
import "dotenv/config";
process.env.SENDGRID_API_KEY = ""; // nothing can be sent from this process
const { writeFileSync } = await import("node:fs");
const { getDb } = await import("../server/db.ts");
const { runDigest } = await import("../server/jobAlerts/digest.ts");
const { digestModeFor } = await import("../server/jobAlerts/digestSchedule.ts");
const OUT = process.argv[2];
const db = await getDb();
const q = async (s) => (await db.execute(s))[0];
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}`); if (!ok) failures++; };

const snapshot = async () => (await q(`SELECT
  (SELECT COUNT(*) FROM jobs WHERE networkStatus='pending') jobsPending,
  (SELECT COUNT(*) FROM premium_jobs WHERE networkStatus='pending') proPending,
  (SELECT COUNT(*) FROM email_send_log) sendLog`))[0];
const before = await snapshot();

const SCHEDULE = JSON.stringify({ "2026-09-15": "pro", "2026-09-16": "jobs" });
console.log("Schedule:");
check(digestModeFor(SCHEDULE, "2026-09-15") === "pro", "Tue Sep 15 → PRO only");
check(digestModeFor(SCHEDULE, "2026-09-16") === "jobs", "Wed Sep 16 → regular jobs only");
check(digestModeFor(SCHEDULE, "2026-09-17") === "combined", "Thu Sep 17 → back to normal");

const summarize = (r) => {
  const subjects = {};
  for (const p of r.plan) subjects[p.subject] = (subjects[p.subject] || 0) + 1;
  return { recipients: r.recipients, proMembers: r.plan.filter((p) => p.isPro).length, regularJobs: r.pendingJobs, proJobs: r.pendingProJobs,
    wouldSend: r.plan.filter((p) => p.willSend).length, topSubjects: Object.entries(subjects).sort((a, b) => b[1] - a[1]).slice(0, 4) };
};

console.log("\nTue — PRO only:");
const pro = await runDigest({ mode: "pro", dryRun: true });
const ps = summarize(pro); console.log(ps);
check(pro.dryRun && pro.sent === 0, "nothing sent");
check(pro.pendingJobs === 0, "no regular jobs loaded");
check(pro.pendingProJobs > 0, `${pro.pendingProJobs} PRO jobs included`);
check(pro.plan.every((p) => /PRO job/.test(p.subject)), "every email is a PRO email");

console.log("\nWed — regular jobs only:");
const jobs = await runDigest({ mode: "jobs", dryRun: true });
const js = summarize(jobs); console.log(js);
check(jobs.dryRun && jobs.sent === 0, "nothing sent");
check(jobs.pendingProJobs === 0, "no PRO jobs loaded");
check(jobs.plan.every((p) => /new jobs? near you/.test(p.subject)), "every email is a regular jobs email");

const dropWed = await q(`SELECT id, title, DATE_FORMAT(startDate,'%Y-%m-%d %H:%i') start FROM jobs
  WHERE networkStatus='pending' AND requestStatus='Active' AND startDate > NOW() AND startDate <= '2026-09-16 17:00:00'`);
console.log("\nRegular jobs that start before Wed 1 PM, so Wednesday's email will skip them:"); console.table(dropWed);

const after = await snapshot();
check(JSON.stringify(before) === JSON.stringify(after), `database unchanged ${JSON.stringify(after)}`);

if (OUT) {
  for (const [name, r] of [["pro", pro], ["jobs", jobs]]) for (const s of r.samples ?? []) writeFileSync(`${OUT}/${name}-${s.isPro ? "member" : "nonmember"}.html`, s.html);
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ pro: ps, jobs: js, dropWed, samples: { pro: (pro.samples ?? []).map((s) => ({ isPro: s.isPro, subject: s.subject })), jobs: (jobs.samples ?? []).map((s) => ({ isPro: s.isPro, subject: s.subject })) } }, null, 1));
}
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
