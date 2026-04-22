/**
 * Artswrk Stripe Products
 * Centralised product/price definitions for job posting payments.
 *
 * ONE_TIME_POST  – $30 single job post
 * SUBSCRIPTION   – Monthly PRO subscription (Subscribe & Save)
 * BOOST          – Dynamic pricing: dailyBudget × durationDays
 */

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
   * Artist Basic subscription — uses existing Stripe product/prices.
   * Monthly: price_1Plig7A91H1fWNkKnH5qb40M
   * Annual:  price_1PligSA91H1fWNkK56t3L1lZ
   */
  ARTIST_BASIC: {
    productId: "prod_Qcyd0J11o6fNHz",
    name: "Artswrk Basic",
    description: "Apply to all marketplace jobs and build your artist profile.",
    currency: "usd",
    mode: "subscription" as const,
    monthly: {
      priceId: "price_1Plig7A91H1fWNkKnH5qb40M",
      interval: "month" as const,
    },
    annual: {
      priceId: "price_1PligSA91H1fWNkK56t3L1lZ",
      interval: "year" as const,
    },
  },
  /**
   * Artist PRO subscription — uses existing Stripe product/prices.
   * Monthly: price_1O7U0HA91H1fWNkKa9wA0v6X ($X/mo)
   * Annual:  price_1O7Ts6A91H1fWNkKVlYhqdAi ($X/yr)
   */
  ARTIST_PRO: {
    productId: "prod_OvKXdVHLUpHLCn",
    name: "Artswrk PRO",
    description: "PRO jobs, priority placement, profile boost, and advanced analytics.",
    currency: "usd",
    mode: "subscription" as const,
    monthly: {
      priceId: "price_1O7U0HA91H1fWNkKa9wA0v6X",
      paymentLinkId: "plink_1OKZtSA91H1fWNkKgr12Dkow",
      interval: "month" as const,
    },
    annual: {
      priceId: "price_1O7Ts6A91H1fWNkKVlYhqdAi",
      paymentLinkId: "plink_1RJFokA91H1fWNkKYbrlxLUH",
      interval: "year" as const,
    },
  },
  /**
   * Enterprise On-Demand — $100 per job to unlock candidate list.
   * Product: prod_TxJ7FkYDtKrFS1
   * Uses price_data at checkout (no recurring price ID needed).
   */
  ENTERPRISE_ON_DEMAND: {
    productId: "prod_TxJ7FkYDtKrFS1",
    paymentLinkId: "plink_1SzOVjA91H1fWNkKiqwN8q1j",
    name: "Artswrk Enterprise — View Candidates",
    description: "Unlock candidate list for one PRO job posting.",
    amount: 10000, // $100 in cents
    currency: "usd",
    mode: "payment" as const,
  },
  /**
   * Enterprise Subscription — $250/mo or $2500/yr (50% off $500/$5000).
   * Product: prod_Tmmk8mzn4uw8G8
   * Price IDs must be created in the Stripe dashboard for this product.
   * Monthly: create a $250/month recurring price → set ENTERPRISE_SUB_MONTHLY_PRICE_ID
   * Annual:  create a $2500/year  recurring price → set ENTERPRISE_SUB_ANNUAL_PRICE_ID
   */
  ENTERPRISE_SUBSCRIPTION: {
    productId: "prod_Tmmk8mzn4uw8G8",
    name: "Artswrk Enterprise Subscription",
    description: "Unlimited PRO job postings and candidate access.",
    currency: "usd",
    mode: "subscription" as const,
    monthly: {
      // TODO: replace with real price ID from Stripe dashboard ($250/mo)
      priceId: process.env.ENTERPRISE_SUB_MONTHLY_PRICE_ID ?? "",
      amount: 25000, // $250 in cents (fallback for price_data)
      interval: "month" as const,
    },
    annual: {
      // TODO: replace with real price ID from Stripe dashboard ($2500/yr)
      priceId: process.env.ENTERPRISE_SUB_ANNUAL_PRICE_ID ?? "",
      amount: 250000, // $2500 in cents (fallback for price_data)
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
