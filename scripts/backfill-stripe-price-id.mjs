/**
 * One-off backfill: populate stripePriceId for existing subscribers by
 * looking up each stored stripeSubscriptionId directly against Stripe.
 *
 * MUST be run with a LIVE Stripe secret key (sk_live_...) in STRIPE_SECRET_KEY —
 * the real subscription IDs in this table were created via live checkout and
 * are invisible to a test-mode key (Stripe strictly separates test/live data).
 *
 * Safe to re-run: only ever writes stripePriceId, skips rows that already
 * have one, and never touches any other field.
 */
import mysql from "mysql2/promise";
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const secretKey = process.env.STRIPE_SECRET_KEY || "";
if (!secretKey.startsWith("sk_live_")) {
  console.error(`Refusing to run: STRIPE_SECRET_KEY is not a live key (got prefix "${secretKey.slice(0, 8)}"). Re-run this with the live key in the environment.`);
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  `SELECT id, stripeSubscriptionId FROM users WHERE stripeSubscriptionId IS NOT NULL AND stripeSubscriptionId != '' AND stripePriceId IS NULL`
);

console.log(`Backfilling stripePriceId for ${rows.length} subscribers...\n`);

let updated = 0, skipped = 0, errors = 0;
for (const row of rows) {
  try {
    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    const priceId = sub.items?.data?.[0]?.price?.id;
    if (!priceId) {
      console.log(`  - user ${row.id} (${row.stripeSubscriptionId}): no price on subscription, skipping`);
      skipped++;
      continue;
    }
    await conn.execute(`UPDATE users SET stripePriceId = ? WHERE id = ?`, [priceId, row.id]);
    console.log(`  ✓ user ${row.id}: ${priceId}`);
    updated++;
  } catch (err) {
    console.error(`  ✗ user ${row.id} (${row.stripeSubscriptionId}): ${err.message}`);
    errors++;
  }
  // Gentle pacing — Stripe's default rate limit is generous, but no need to hammer it.
  await new Promise((r) => setTimeout(r, 100));
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped (no price), ${errors} errors`);
await conn.end();
