/**
 * DRY RUN — shows exactly which artist would receive which email, and sends
 * nothing unless you have explicitly switched sending on.
 *
 *   npx tsx scripts/dry-run-job-alerts.mjs
 *   npx tsx scripts/dry-run-job-alerts.mjs --last-minute <jobId>
 *
 * Safe by default: JOB_ALERTS_ENABLED must be exactly "true" before any send
 * API is called. Without it the worker matches, assembles and reports, then
 * stops. It also leaves the queue untouched, so a dry run can be repeated.
 */
import "dotenv/config";

const { runDigest, isDigestHour } = await import("../server/jobAlerts/digest.ts");
const { maybeSendLastMinute } = await import("../server/jobAlerts/lastMinute.ts");
const { describeMode, loadSendPolicy, ALLOWLIST, isSafeTestAddress } =
  await import("../server/jobAlerts/safety.ts");
const policy = await loadSendPolicy();
const SENDING_ENABLED = policy.enabled;

const bar = "═".repeat(74);
console.log(`\n${bar}\n  ${describeMode(policy)}\n${bar}\n`);

const lmIndex = process.argv.indexOf("--last-minute");
if (lmIndex !== -1) {
  const jobId = Number(process.argv[lmIndex + 1]);
  if (!Number.isFinite(jobId)) { console.error("Pass a numeric job id."); process.exit(1); }
  const r = await maybeSendLastMinute(jobId);
  console.log(`job ${r.jobId}: ${r.eligible ? "ELIGIBLE" : `not eligible — ${r.reason}`}`);
  if (r.eligible) {
    console.log(`  matched ${r.matched} artists · would send ${r.plan.filter(p=>p.willSend).length} · capped ${r.capped}`);
    for (const p of r.plan.slice(0, 40)) {
      console.log(`    ${p.willSend ? "SEND →" : "skip  "} ${p.email}${p.reason ? `  (${p.reason})` : ""}${isSafeTestAddress(p.email) ? "  [safe test address]" : ""}`);
    }
  }
  process.exit(0);
}

console.log(`digest hour in New York right now? ${isDigestHour() ? "yes (13:00)" : "no — the scheduled run would exit immediately"}\n`);

// --job <id,id> forces specific jobs through the matcher regardless of their
// queue status, and leaves that status untouched. Every pre-launch job is
// quarantined, so without this a dry run has nothing to work with.
const jobIdx = process.argv.indexOf("--job");
const proIdx = process.argv.indexOf("--pro-job");
const ids = (i) => i === -1 ? undefined : String(process.argv[i + 1] ?? "").split(",").map(Number).filter(Number.isFinite);
const simulateJobIds = ids(jobIdx);
const simulateProJobIds = ids(proIdx);
if (simulateJobIds?.length || simulateProJobIds?.length) {
  console.log(`SIMULATING jobs=[${simulateJobIds ?? ""}] proJobs=[${simulateProJobIds ?? ""}] — queue status will NOT change\n`);
}

const r = await runDigest({ simulateJobIds, simulateProJobIds });
console.log(`pending jobs: ${r.pendingJobs} regular, ${r.pendingProJobs} PRO`);
console.log(`artists who would receive a digest: ${r.recipients}`);
console.log(`actually sent: ${r.sent}   held back: ${r.skipped}\n`);

if (!r.plan.length) {
  console.log("Nobody matched. With every pre-launch job quarantined as 'suppressed',");
  console.log("this is expected until a new job is posted — that is the intended state.\n");
} else {
  const real = r.plan.filter((p) => !isSafeTestAddress(p.email)).length;
  console.log(`${"RECIPIENT".padEnd(38)} ${"PRO".padEnd(4)} ${"JOBS".padEnd(5)} ${"+PRO".padEnd(5)} SUBJECT`);
  console.log("─".repeat(110));
  for (const p of r.plan.slice(0, 60)) {
    const tag = isSafeTestAddress(p.email) ? "" : "  ← real artist";
    console.log(
      `${p.email.slice(0,36).padEnd(38)} ${(p.isPro ? "yes" : "no").padEnd(4)} ` +
      `${String(p.targeted).padEnd(5)} ${String(p.ridealong).padEnd(5)} ${p.subject}${tag}`
    );
  }
  if (r.plan.length > 60) console.log(`  … and ${r.plan.length - 60} more`);
  console.log(`\n${real} of ${r.plan.length} are REAL ARTIST addresses.`);
  if (real && !SENDING_ENABLED) console.log("None were emailed — sending is off.");
  if (real && SENDING_ENABLED && !ALLOWLIST.length) console.log("\n*** WARNING: sending is ON with no allowlist. These went out. ***");
}
console.log();

// The db pool keeps the event loop alive; nothing here needs to linger.
process.exit(0);
