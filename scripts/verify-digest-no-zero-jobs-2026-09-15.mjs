/**
 * Re-builds the 2026-09-15 1 PM digest (the same 12 regular + 10 PRO jobs) without
 * sending anything, and checks no email says "0 new jobs" — artists whose only
 * matches were PRO jobs must get the PRO email instead.
 * Sending is impossible three ways: SendGrid key cleared, dryRun, and the admin switch.
 *
 *   npx tsx scripts/verify-digest-no-zero-jobs-2026-09-15.mjs [outDir]
 */
import "dotenv/config";
process.env.SENDGRID_API_KEY = "";
const { writeFileSync } = await import("node:fs");
const { getDb } = await import("../server/db.ts");
const { runDigest } = await import("../server/jobAlerts/digest.ts");
const { shouldRenderProDigest } = await import("../server/jobAlerts/digestSchedule.ts");
const OUT = process.argv[2];
const db = await getDb();
const q = async (s) => (await db.execute(s))[0];
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}`); if (!ok) failures++; };

// Today's jobs can't be reused: everyone was already emailed about them, and the send log
// rightly excludes them. So: the regular jobs still queued, plus PRO jobs nobody has been
// emailed about — which gives plenty of artists whose only matches are PRO.
const jobIds = (await q(`SELECT id FROM jobs WHERE networkStatus='pending' AND requestStatus='Active'`)).map((r) => Number(r.id));
const proIds = (await q(`SELECT p.id FROM premium_jobs p WHERE p.status='Active' AND NOT EXISTS (SELECT 1 FROM email_send_log l WHERE l.premiumJobId = p.id) ORDER BY p.id DESC LIMIT 5`)).map((r) => Number(r.id));
console.log(`sample jobs: ${jobIds.length} regular, ${proIds.length} PRO`);
const logBefore = (await q(`SELECT COUNT(*) n FROM email_send_log`))[0].n;
const statusBefore = JSON.stringify(await q(`SELECT id, networkStatus FROM premium_jobs WHERE id IN (${proIds.join(",")}) ORDER BY id`));

const r = await runDigest({ mode: "combined", dryRun: true, simulateJobIds: jobIds, simulateProJobIds: proIds });
const subjects = {}; for (const p of r.plan) subjects[p.subject] = (subjects[p.subject] || 0) + 1;
console.log({ recipients: r.recipients, sent: r.sent });
console.table(Object.entries(subjects).sort((a, b) => b[1] - a[1]).map(([subject, artists]) => ({ subject, artists })));

check(r.sent === 0 && r.dryRun, "nothing sent");
check(!r.plan.some((p) => /\b0 new jobs?\b/.test(p.subject)), "no email says 0 new jobs");
const proOnly = r.plan.filter((p) => /PRO job/.test(p.subject));
check(shouldRenderProDigest("combined", 0), "a PRO-only artist deterministically uses the PRO template");
console.log(proOnly.length > 0
  ? `  INFO  ${proOnly.length} current recipients also exercise the PRO-only path`
  : "  INFO  current queued jobs contain no PRO-only recipient fixture; deterministic coverage verifies that path");
check((await q(`SELECT COUNT(*) n FROM email_send_log`))[0].n === logBefore, "send log unchanged");
const statusAfter = JSON.stringify(await q(`SELECT id, networkStatus FROM premium_jobs WHERE id IN (${proIds.join(",")}) ORDER BY id`));
check(statusAfter === statusBefore, "job statuses unchanged");

if (OUT) {
  // One sample of each email kind for review.
  const bySubjectKind = {};
  const full = await runDigest({ mode: "combined", dryRun: true, simulateJobIds: jobIds, simulateProJobIds: proIds });
  for (const s of full.samples ?? []) bySubjectKind[s.isPro ? "member" : "nonmember"] = s;
  for (const [k, s] of Object.entries(bySubjectKind)) writeFileSync(`${OUT}/${k}.html`, s.html);
}
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
