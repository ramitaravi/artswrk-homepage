/**
 * Puts a client account back on Artswrk On-Demand after a test-mode checkout.
 *
 * The test Stripe key points at the production database, so completing a test
 * subscription really does flip planTier to client_premium on the live row.
 * This undoes exactly that, and nothing else.
 *
 *   node scripts/reset-test-subscription.mjs <email>            # show state
 *   node scripts/reset-test-subscription.mjs <email> --confirm  # revert it
 *
 * Prints the row before and after. Without --confirm it only reads.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const email = process.argv[2];
const confirm = process.argv.includes("--confirm");

if (!email) {
  console.error("Usage: node scripts/reset-test-subscription.mjs <email> [--confirm]");
  process.exit(1);
}

const FIELDS = `id, email, planTier, clientPremium, clientSubscriptionId,
                stripeSubscriptionId, stripePriceId`;

const c = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await c.execute(
    `SELECT ${FIELDS} FROM users WHERE email = ?`, [email]);

  if (rows.length === 0) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }
  if (rows.length > 1) {
    // Several "Nick Silverio" rows exist; don't guess which account to touch.
    console.error(`${rows.length} users share that email — resolve by id instead.`);
    console.table(rows);
    process.exit(1);
  }

  const before = rows[0];
  console.log("Before:"); console.table([before]);

  if (before.planTier !== "client_premium" && !before.clientSubscriptionId) {
    console.log("Already on On-Demand with no subscription attached — nothing to undo.");
    process.exit(0);
  }

  if (!confirm) {
    console.log("\nRe-run with --confirm to revert this row to client_on_demand.");
    process.exit(0);
  }

  // clientStripeCustomerId is deliberately left alone: it's the customer
  // record, not the subscription, and clearing it would orphan their live
  // billing history.
  await c.execute(
    `UPDATE users
        SET planTier = 'client_on_demand', clientPremium = 0,
            clientSubscriptionId = NULL, stripeSubscriptionId = NULL,
            stripePriceId = NULL
      WHERE id = ?`, [before.id]);

  const [after] = await c.execute(`SELECT ${FIELDS} FROM users WHERE id = ?`, [before.id]);
  console.log("\nAfter:"); console.table(after);
  console.log("\nThe test subscription still exists in Stripe — cancel it there too if you want it gone.");
} finally {
  await c.end();
}
