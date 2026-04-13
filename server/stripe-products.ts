/**
 * Artswrk Stripe Products
 * Centralised product/price definitions for job posting payments.
 *
 * ONE_TIME_POST  – $30 single job post
 * SUBSCRIPTION   – Monthly PRO subscription (Subscribe & Save)
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
} as const;
