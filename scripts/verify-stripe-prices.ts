/**
 * Does every upgrade button on the site resolve to a real, active Stripe
 * price? Read-only: retrieves each price, creates nothing.
 */
import dotenv from "dotenv";
dotenv.config();
import Stripe from "stripe";

// Dynamic import, deliberately: stripe-products resolves test-vs-live price ids
// at module-eval time from STRIPE_SECRET_KEY, and a static import is hoisted
// ABOVE dotenv.config() — which silently yields the live ids under a test key.
const { STRIPE_PRODUCTS, getStripeMode } = await import("../server/stripe-products");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" as any });
const P: any = STRIPE_PRODUCTS;

const CHECKS: [string, string | undefined][] = [
  ["artist → PRO annual      (Unlock PRO · Choose PRO · PRO jobs · Browse Companies · Jobs banner)", P.ARTIST_PRO?.annual?.priceId],
  ["artist → Basic annual    (Get Basic · Choose Basic · JobDetail unlock)",                         P.ARTIST_BASIC?.annual?.priceId],
  ["client → Premium monthly (default for every client upgrade)",                                   P.CLIENT_PREMIUM?.monthly?.priceId],
  ["client → Premium annual  (My Plan $650/yr)",                                                    P.CLIENT_PREMIUM?.annual?.priceId],
];

async function main() {
  console.log(`Stripe mode: ${getStripeMode()}\n`);
  let bad = 0;
  for (const [label, priceId] of CHECKS) {
    if (!priceId) { console.log(`✗ ${label}\n    NO PRICE ID CONFIGURED`); bad++; continue; }
    try {
      const p = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const amount = p.unit_amount != null ? `$${(p.unit_amount / 100).toFixed(2)}` : "(price_data)";
      const every = p.recurring ? `/${p.recurring.interval}` : " one-time";
      const prod: any = p.product;
      const ok = p.active && prod?.active;
      if (!ok) bad++;
      console.log(`${ok ? "✓" : "✗"} ${label}\n    ${priceId}  ${amount}${every}  ${prod?.name ?? ""}${ok ? "" : "  ← INACTIVE"}`);
    } catch (e: any) {
      console.log(`✗ ${label}\n    ${priceId}  ${e.message}`);
      bad++;
    }
  }
  console.log(bad === 0 ? "\nAll upgrade paths resolve to live, active prices." : `\n${bad} BROKEN.`);
}
await main();
