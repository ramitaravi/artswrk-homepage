/**
 * Generates real Stripe Checkout links, in TEST MODE ONLY, for a given client
 * user — so the subscribe buttons on Settings > My Plan can be exercised
 * end to end without hunting for them in the UI.
 *
 * It calls createClientSubscriptionCheckoutSession, the same function the
 * Subscribe buttons call, so what you click is what a client would get:
 * same price, same metadata, same success_url.
 *
 *   npx tsx scripts/create-test-checkout-links.ts <email> [returnPath]
 *
 * Refuses to run against a live key. A live session here would be a real
 * payment page for a real card.
 */
import dotenv from "dotenv";
dotenv.config();

// Dynamic imports throughout: stripe-products resolves test-vs-live price ids
// at module-eval time from STRIPE_SECRET_KEY, and a static import is hoisted
// above dotenv.config().
const { getStripeMode } = await import("../server/stripe-products");
const { createClientSubscriptionCheckoutSession } = await import("../server/stripe");
const { getUserByEmail } = await import("../server/db");

const email = process.argv[2];
const returnPath = process.argv[3] ?? "/app/settings?section=subscription";

if (!email) {
  console.error("Usage: npx tsx scripts/create-test-checkout-links.ts <email> [returnPath]");
  process.exit(1);
}

const mode = getStripeMode();
if (mode !== "test") {
  console.error(`REFUSING: Stripe is in "${mode}" mode. This script only runs against a test key.`);
  process.exit(1);
}

const user = await getUserByEmail(email);
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

console.log(`Stripe mode : test`);
console.log(`User        : ${user.email} (id ${user.id}, planTier ${(user as any).planTier})`);
console.log(`Returns to  : ${returnPath}\n`);

for (const interval of ["month", "year"] as const) {
  const { url } = await createClientSubscriptionCheckoutSession({
    userId: user.id,
    email: user.email ?? undefined,
    stripeCustomerId: (user as any).clientStripeCustomerId ?? undefined,
    origin: process.env.APP_URL || "http://localhost:3000",
    interval,
    returnPath,
  } as any);
  console.log(`${interval === "month" ? "$65/month" : "$650/year "}  ${url}`);
}

console.log(`\nTest card 4242 4242 4242 4242 · any future expiry · any CVC.`);
console.log(`Completing one sets planTier="client_premium" on this REAL user row,`);
console.log(`backed by a test-mode subscription. Revert with:`);
console.log(`  UPDATE users SET planTier='client_on_demand', clientPremium=0,`);
console.log(`         clientSubscriptionId=NULL, stripeSubscriptionId=NULL WHERE id=${user.id};`);
process.exit(0);
