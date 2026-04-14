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
