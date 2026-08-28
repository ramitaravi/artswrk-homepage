/**
 * Artswrk Stripe Products
 * Centralised product/price definitions for job posting payments.
 *
 * ONE_TIME_POST  – $30 single job post
 * SUBSCRIPTION   – Monthly PRO subscription (Subscribe & Save)
 * BOOST          – Dynamic pricing: dailyBudget × durationDays
 */

// Auto-detects test vs. live mode from the configured secret key so the same
// code works in both — dev/local always has a test key, production has live.
// Falls back to the live ID if the matching test env var isn't set, so this
// is safe to deploy even before test products exist.
const IS_TEST_MODE = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
function envOrLive(testEnvVar: string, liveValue: string): string {
  if (!IS_TEST_MODE) return liveValue;
  return process.env[testEnvVar] || liveValue;
}

export const STRIPE_PRODUCTS = {
  /** One-time $30 job post fee */
  ONE_TIME_POST: {
    name: "Artswrk Job Post",
    description: "Post a single job to 5,000+ artists in the Artswrk network.",
    amount: 3000, // cents
    currency: "usd",
    mode: "payment" as const,
  },
  /** Monthly PRO subscription — Subscribe & Save */
  SUBSCRIPTION: {
    name: "Artswrk PRO Subscription",
    description: "Unlimited job posts + PRO features. Cancel anytime.",
    amount: 2900, // cents per month
    currency: "usd",
    mode: "subscription" as const,
    interval: "month" as const,
  },
  /**
   * Job Boost — dynamic pricing based on daily budget × duration days.
   * The actual amount is calculated at checkout time.
   */
  BOOST: {
    name: "Artswrk Job Boost",
    description: "Boost your job to the top of search results for maximum visibility.",
    currency: "usd",
    mode: "payment" as const,
  },
  /**
   * Artist Basic — annual-only unlock. $30/yr, unchanged in amount; the live
   * price ID below was given fresh by Ramita on 2026-08-28 as part of the
   * pricing rebuild (differs from the previously hardcoded fallback — trust
   * this value, it's the current source of truth from Stripe).
   * Verified via API against the DEV/test key on 2026-08-28: $30/yr, active. ✓
   * LIVE value NOT independently verified — no live-mode key available here;
   * double-check against the Stripe live dashboard before this ships.
   */
  ARTIST_BASIC: {
    productId: envOrLive("STRIPE_TEST_ARTIST_BASIC_PRODUCT_ID", "prod_Qcyd0J11o6fNHz"),
    name: "Artswrk Basic",
    description: "Apply to unlimited Artswrk jobs.",
    currency: "usd",
    mode: "subscription" as const,
    annual: {
      priceId: envOrLive("STRIPE_TEST_ARTIST_BASIC_ANNUAL_PRICE_ID", "price_1TW3qOA91H1fWNkK1nxKUvgR"),
      interval: "year" as const,
    },
    /** Not offered at checkout anymore — kept only so admin reporting
     * (admin.subscriptions) can still see existing grandfathered monthly
     * subscribers. Never reference this for a new checkout. */
    legacyMonthly: {
      priceId: envOrLive("STRIPE_TEST_ARTIST_BASIC_MONTHLY_PRICE_ID", "price_1Plig7A91H1fWNkKnH5qb40M"),
      interval: "month" as const,
    },
  },
  /**
   * Artist PRO — annual-only unlock, $110/yr. The $10.99/mo plan is
   * discontinued for new signups as of 2026-08-28 — existing monthly
   * subscribers are grandfathered (their Stripe subscription is untouched;
   * no code path forces a migration), they just won't see a monthly option
   * if they ever come back to subscribe again after canceling.
   * Verified via API against the DEV/test key on 2026-08-28: $110/yr, active. ✓
   * LIVE value matches what was already hardcoded here before today — unchanged.
   */
  ARTIST_PRO: {
    productId: envOrLive("STRIPE_TEST_ARTIST_PRO_PRODUCT_ID", "prod_OvKXdVHLUpHLCn"),
    name: "Artswrk PRO",
    description: "PRO jobs ($500+ bookings), direct client messaging, priority placement, and partner discounts.",
    currency: "usd",
    mode: "subscription" as const,
    annual: {
      priceId: envOrLive("STRIPE_TEST_ARTIST_PRO_ANNUAL_PRICE_ID", "price_1O7Ts6A91H1fWNkKVlYhqdAi"),
      paymentLinkId: "plink_1RJFokA91H1fWNkKYbrlxLUH",
      interval: "year" as const,
      /** Free trial length in days. 0/undefined = no trial. Set here so both
       * checkout creation and the "your trial ends soon" reminder email read
       * the same source of truth. */
      trialPeriodDays: 7,
    },
    /** Not offered at checkout anymore — kept only so admin reporting
     * (admin.subscriptions) can still see existing grandfathered monthly
     * subscribers. Never reference this for a new checkout. */
    legacyMonthly: {
      priceId: envOrLive("STRIPE_TEST_ARTIST_PRO_MONTHLY_PRICE_ID", "price_1O7U0HA91H1fWNkKa9wA0v6X"),
      paymentLinkId: "plink_1OKZtSA91H1fWNkKgr12Dkow",
      interval: "month" as const,
    },
  },
  /**
   * Client on-demand job unlock — $40/job, up from $30. Previously this had
   * NO real Stripe Price object at all — every purchase minted a fresh
   * one-off product via inline price_data. Now uses a real, trackable price.
   * Verified via API against the DEV/test key on 2026-08-28: $40 one-time, active. ✓
   */
  CLIENT_JOB_UNLOCK: {
    productId: undefined as string | undefined,
    priceId: envOrLive("STRIPE_TEST_CLIENT_JOB_UNLOCK_PRICE_ID", "price_1U9Xp0A91H1fWNkK8maYo0vu"),
    name: "Artswrk Job Unlock",
    description: "Unlock all applicants for this job — no recurring charge.",
    amount: 4000, // $40 in cents (price_data fallback only — priceId above is what's actually used)
    currency: "usd",
    mode: "payment" as const,
  },
  /**
   * Client Premium subscription — $65/mo or $650/yr, up from $50/$500.
   * Previously this had NO real Stripe Price object either — same
   * price_data-every-time pattern as the job unlock above. Now uses real,
   * trackable prices.
   * Verified via API against the DEV/test key on 2026-08-28: $65/mo and
   * $650/yr, both active. ✓
   */
  CLIENT_PREMIUM: {
    productId: undefined as string | undefined,
    name: "Artswrk Premium",
    description: "Unlimited applicant unlocks for all your jobs.",
    currency: "usd",
    mode: "subscription" as const,
    monthly: {
      priceId: envOrLive("STRIPE_TEST_CLIENT_PREMIUM_MONTHLY_PRICE_ID", "price_1U9XllA91H1fWNkKpfoRcNHt"),
      amount: 6500, // $65/mo in cents (price_data fallback only)
      interval: "month" as const,
    },
    annual: {
      priceId: envOrLive("STRIPE_TEST_CLIENT_PREMIUM_ANNUAL_PRICE_ID", "price_1U9XmUA91H1fWNkKWASXTggj"),
      amount: 65000, // $650/yr in cents (price_data fallback only)
      interval: "year" as const,
    },
  },
  /**
   * Enterprise On-Demand — $100 per job to unlock candidate list.
   * Product: prod_TxJ7FkYDtKrFS1
   * Price ID: price_1SzOVLA91H1fWNkK5rX69GBU (set via ENTERPRISE_JOB_UNLOCK_PRICE_ID env var)
   */
  ENTERPRISE_ON_DEMAND: {
    productId: envOrLive("STRIPE_TEST_ENTERPRISE_ON_DEMAND_PRODUCT_ID", "prod_TxJ7FkYDtKrFS1"),
    paymentLinkId: "plink_1SzOVjA91H1fWNkKiqwN8q1j",
    priceId: envOrLive("STRIPE_TEST_ENTERPRISE_ON_DEMAND_PRICE_ID", process.env.ENTERPRISE_JOB_UNLOCK_PRICE_ID ?? ""),
    name: "Artswrk Enterprise — View Candidates",
    description: "Unlock candidate list for one PRO job posting.",
    amount: 10000, // $100 in cents (fallback if priceId not set)
    currency: "usd",
    mode: "payment" as const,
  },
  /**
   * Enterprise Subscription — LIST price $500/mo or $5,000/yr as of
   * 2026-08-28 (up from $250/$2,500). The 50%-off "OG" discount is applied
   * via a Stripe Promotion Code at checkout (allow_promotion_codes), not a
   * separate lower price — existing customers' subscriptions stay on the OLD
   * $250/$2,500 price object untouched, so this change costs them nothing.
   * Product: prod_Tmmk8mzn4uw8G8
   *
   * ⚠️ KNOWN GAP, confirmed via the Stripe API on 2026-08-28: the existing
   * TEST-mode prices (env STRIPE_TEST_ENTERPRISE_SUB_MONTHLY_PRICE_ID /
   * _ANNUAL_PRICE_ID) are still $250/mo and $2,500/yr — the OLD amounts.
   * No test-mode $500/$5,000 prices exist yet. Until new test prices are
   * created and those env vars updated, local/dev checkout for this tier
   * will test the OLD pricing even though live now points at the new
   * amounts. Do not treat dev testing of this tier as validating live.
   */
  ENTERPRISE_SUBSCRIPTION: {
    productId: envOrLive("STRIPE_TEST_ENTERPRISE_SUBSCRIPTION_PRODUCT_ID", "prod_Tmmk8mzn4uw8G8"),
    name: "Artswrk Enterprise Subscription",
    description: "Unlimited PRO job postings and candidate access.",
    currency: "usd",
    mode: "subscription" as const,
    monthly: {
      priceId: envOrLive("STRIPE_TEST_ENTERPRISE_SUB_MONTHLY_PRICE_ID", "price_1SpDBOA91H1fWNkKcTd35SHv"),
      amount: 50000, // $500 in cents (price_data fallback only)
      interval: "month" as const,
    },
    annual: {
      priceId: envOrLive("STRIPE_TEST_ENTERPRISE_SUB_ANNUAL_PRICE_ID", "price_1SpDB0A91H1fWNkKIZKyxi6P"),
      amount: 500000, // $5,000 in cents (price_data fallback only)
      interval: "year" as const,
    },
  },
} as const;

/**
 * Calculate the total boost cost in cents.
 * dailyBudget is in dollars, durationDays is number of days.
 */
export function calcBoostTotal(dailyBudget: number, durationDays: number): number {
  return Math.round(dailyBudget * durationDays * 100); // convert to cents
}

/**
 * Estimate expected views based on daily budget and duration.
 * Rough model: $1/day ≈ 15–25 views/day.
 */
export function estimateViews(dailyBudget: number, durationDays: number): { min: number; max: number } {
  const perDayMin = Math.round(dailyBudget * 15);
  const perDayMax = Math.round(dailyBudget * 25);
  return { min: perDayMin * durationDays, max: perDayMax * durationDays };
}

/**
 * Estimate expected applicants based on daily budget and duration.
 * Rough model: $1/day ≈ 0.5–1 applicant total.
 */
export function estimateApplicants(dailyBudget: number, durationDays: number): { min: number; max: number } {
  const totalMin = Math.max(1, Math.round(dailyBudget * durationDays * 0.5));
  const totalMax = Math.max(2, Math.round(dailyBudget * durationDays * 1.0));
  return { min: totalMin, max: totalMax };
}

/**
 * Determine performance tier and featured placement eligibility.
 */
export function getPerformanceTier(dailyBudget: number): {
  tier: "Low" | "Moderate" | "High" | "Premium";
  color: string;
  message: string;
  featuredPlacements: boolean;
  progressPct: number;
} {
  if (dailyBudget < 10) {
    return {
      tier: "Low",
      color: "#9ca3af",
      message: "Increase to $15+ for better reach.",
      featuredPlacements: false,
      progressPct: 15,
    };
  } else if (dailyBudget < 25) {
    return {
      tier: "Moderate",
      color: "#F25722",
      message: "Your budget is moderate. Increase to $25+ to be competitive.",
      featuredPlacements: false,
      progressPct: 40,
    };
  } else if (dailyBudget < 50) {
    return {
      tier: "High",
      color: "#16a34a",
      message: "Great reach! You'll appear near the top of results.",
      featuredPlacements: true,
      progressPct: 70,
    };
  } else {
    return {
      tier: "Premium",
      color: "#7c3aed",
      message: "Maximum visibility — featured placement guaranteed.",
      featuredPlacements: true,
      progressPct: 100,
    };
  }
}
