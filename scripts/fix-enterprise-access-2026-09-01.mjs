/**
 * Restores enterprise access that didn't survive the Bubble migration.
 *
 *  1. Marks the enterprise accounts that hold real subscriptions as
 *     enterprise_subscription. Their subscriptions are billed outside Stripe
 *     (intercompany/manual), so nothing in Bubble or Stripe identifies them —
 *     the list is supplied by Ramita/Nick, per company, and every account on
 *     that company's domain is included.
 *  2. Records the REVEL premium-job unlocks that were paid via intercompany
 *     form rather than Stripe Checkout, so no unlock row was ever written.
 *
 * Idempotent: re-running changes nothing once applied.
 * Usage: node scripts/fix-enterprise-access-2026-09-01.mjs [--dry-run]
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");

/** Confirmed subscribers, by company. Matched on email domain. */
const SUBSCRIBER_DOMAINS = [
  "journeycompetition.com",
  "elevationontour.com",
  "thunderstruckdance.com",
  "onstageamerica.com",
];

/** Paid by intercompany form — on-demand plan, but these jobs are unlocked. */
const MANUAL_UNLOCK_COMPANY = "REVEL Dance Convention";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── 1. Subscriber tiers ────────────────────────────────────────────────────
const domainClause = SUBSCRIBER_DOMAINS.map(() => "email LIKE ?").join(" OR ");
const [candidates] = await conn.query(
  `SELECT id, email, planTier, enterprise FROM users WHERE (${domainClause}) ORDER BY email`,
  SUBSCRIBER_DOMAINS.map((d) => `%@${d}`)
);

console.log("=== Subscriber tier ===");
let tierChanges = 0;
for (const u of candidates) {
  if (u.planTier === "enterprise_subscription") {
    console.log(`  = ${u.email} already enterprise_subscription`);
    continue;
  }
  console.log(`  → ${u.email}: ${u.planTier} → enterprise_subscription`);
  if (!DRY_RUN) {
    // enterprise flag matters too: several gates check it before planTier.
    await conn.query(
      `UPDATE users
       SET planTier = 'enterprise_subscription', enterprisePlan = 'subscriber', enterprise = 1
       WHERE id = ?`,
      [u.id]
    );
  }
  tierChanges++;
}
if (!candidates.length) console.log("  (no accounts matched — check the domain list)");

// ── 2. REVEL manual unlocks ────────────────────────────────────────────────
console.log(`\n=== Manual unlocks — ${MANUAL_UNLOCK_COMPANY} ===`);
const [revelJobs] = await conn.query(
  `SELECT id, serviceType, status, createdByUserId FROM premium_jobs WHERE company = ? ORDER BY id`,
  [MANUAL_UNLOCK_COMPANY]
);

let unlockChanges = 0;
for (const job of revelJobs) {
  if (!job.createdByUserId) {
    console.log(`  ! job ${job.id} (${job.serviceType}) has no owner — skipped`);
    continue;
  }
  const [existing] = await conn.query(
    `SELECT id FROM enterprise_job_unlocks WHERE clientUserId = ? AND jobId = ? LIMIT 1`,
    [job.createdByUserId, job.id]
  );
  if (existing.length) {
    console.log(`  = job ${job.id} (${job.serviceType}) already unlocked`);
    continue;
  }
  console.log(`  → job ${job.id} (${job.serviceType}) [${job.status}] → unlocked for user ${job.createdByUserId}`);
  if (!DRY_RUN) {
    // amountCents 0 records that this was NOT a Stripe payment, so revenue
    // reporting doesn't count it as $100 collected here.
    await conn.query(
      `INSERT INTO enterprise_job_unlocks (clientUserId, jobId, stripeSessionId, amountCents, createdAt)
       VALUES (?, ?, 'manual_intercompany_2026-09-01', 0, NOW())`,
      [job.createdByUserId, job.id]
    );
  }
  unlockChanges++;
}

console.log(
  `\n${DRY_RUN ? "[dry run] would apply" : "Applied"}: ${tierChanges} tier change(s), ${unlockChanges} unlock(s).`
);
await conn.end();
