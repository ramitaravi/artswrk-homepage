import Stripe from "stripe";
import { ENV } from "../server/_core/env";
import { getStripeMode, STRIPE_PRODUCTS } from "../server/stripe-products";

type PriceCheck = {
  label: string;
  priceId: string;
  expectedAmount: number;
  expectedInterval?: "month" | "year";
  allowDynamicFallback?: boolean;
};

const mode = getStripeMode(ENV.stripeSecretKey);

const checks: PriceCheck[] = [
  {
    label: "Artist Basic annual",
    priceId: STRIPE_PRODUCTS.ARTIST_BASIC.annual.priceId,
    expectedAmount: 3000,
    expectedInterval: "year",
  },
  {
    label: "Artist PRO annual",
    priceId: STRIPE_PRODUCTS.ARTIST_PRO.annual.priceId,
    expectedAmount: 11000,
    expectedInterval: "year",
  },
  {
    label: "Client job unlock",
    priceId: STRIPE_PRODUCTS.CLIENT_JOB_UNLOCK.priceId,
    expectedAmount: 4000,
  },
  {
    label: "Client Premium monthly",
    priceId: STRIPE_PRODUCTS.CLIENT_PREMIUM.monthly.priceId,
    expectedAmount: 6500,
    expectedInterval: "month",
  },
  {
    label: "Client Premium annual",
    priceId: STRIPE_PRODUCTS.CLIENT_PREMIUM.annual.priceId,
    expectedAmount: 65000,
    expectedInterval: "year",
  },
  {
    label: "Enterprise job unlock",
    priceId: STRIPE_PRODUCTS.ENTERPRISE_ON_DEMAND.priceId,
    expectedAmount: 10000,
  },
  {
    label: "Enterprise subscription monthly",
    priceId: STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.monthly.priceId,
    expectedAmount: 50000,
    expectedInterval: "month",
    allowDynamicFallback: true,
  },
  {
    label: "Enterprise subscription annual",
    priceId: STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.annual.priceId,
    expectedAmount: 500000,
    expectedInterval: "year",
    allowDynamicFallback: true,
  },
];

async function main() {
  if (!ENV.stripeSecretKey || mode === "unknown") {
    throw new Error("STRIPE_SECRET_KEY is missing or has an unsupported format");
  }

  const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-03-25.dahlia" });
  const account = await stripe.accounts.retrieve();
  const expectedLivemode = mode === "live";
  const results: Array<Record<string, unknown>> = [];
  let hasFailure = false;

  for (const check of checks) {
    if (!check.priceId) {
      const ok = check.allowDynamicFallback === true;
      results.push({
        label: check.label,
        status: ok ? "dynamic_price_data" : "missing_price",
        expectedAmount: check.expectedAmount,
        expectedInterval: check.expectedInterval ?? "one_time",
        ok,
      });
      if (!ok) hasFailure = true;
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(check.priceId);
      const interval = price.recurring?.interval ?? "one_time";
      const ok = price.active
        && price.livemode === expectedLivemode
        && price.unit_amount === check.expectedAmount
        && interval === (check.expectedInterval ?? "one_time");
      results.push({
        label: check.label,
        status: "retrieved",
        active: price.active,
        livemode: price.livemode,
        amount: price.unit_amount,
        interval,
        ok,
      });
      if (!ok) hasFailure = true;
    } catch (error) {
      results.push({
        label: check.label,
        status: "unavailable",
        message: error instanceof Error ? error.message : "Unknown Stripe error",
        ok: false,
      });
      hasFailure = true;
    }
  }

  const publishableMode = process.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")
    ? "live"
    : process.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
      ? "test"
      : "missing_or_unknown";

  const checkoutPaymentsReady = !hasFailure
    && publishableMode === mode
    && ENV.stripeWebhookSecret.startsWith("whsec_");
  const connectOnboardingReady = ENV.stripeConnectClientId.startsWith("ca_");
  const summary = {
    mode,
    account: {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
    environment: {
      publishableMode,
      publishableMatchesSecret: publishableMode === mode,
      webhookSecretPresent: ENV.stripeWebhookSecret.startsWith("whsec_"),
      connectClientIdPresent: ENV.stripeConnectClientId.startsWith("ca_"),
    },
    prices: results,
    checkoutPaymentsReady,
    connectOnboardingReady,
    ok: checkoutPaymentsReady && connectOnboardingReady,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
