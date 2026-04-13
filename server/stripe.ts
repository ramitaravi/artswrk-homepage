/**
 * Artswrk Stripe helper
 * Wraps the Stripe SDK with a singleton client and helper functions for
 * creating checkout sessions (one-time and subscription).
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";
import { STRIPE_PRODUCTS } from "./stripe-products";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

export interface CreateCheckoutOptions {
  /** User's email — used to prefill Stripe checkout */
  email?: string;
  /** Internal DB user id — stored in metadata for webhook reconciliation */
  userId?: number;
  /** Internal DB job id — stored in metadata so webhook can activate the job */
  jobId?: number;
  /** Origin URL for success/cancel redirect */
  origin: string;
  /** Existing Stripe customer ID (to enable saved card) */
  stripeCustomerId?: string | null;
}

/**
 * Create a Stripe Checkout Session for a one-time $30 job post.
 */
export async function createJobPostCheckoutSession(
  opts: CreateCheckoutOptions
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const product = STRIPE_PRODUCTS.ONE_TIME_POST;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      // Save the payment method for future use
      setup_future_usage: "on_session",
    },
    success_url: `${opts.origin}/post-job/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/post-job?cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      job_id: opts.jobId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "job_post",
    },
  };

  // Prefill customer info
  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for a monthly PRO subscription.
 */
export async function createSubscriptionCheckoutSession(
  opts: CreateCheckoutOptions
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const product = STRIPE_PRODUCTS.SUBSCRIPTION;

  // Create or retrieve a recurring price for the subscription
  // We use price_data with recurring for simplicity (no pre-created product needed)
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          recurring: { interval: product.interval },
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${opts.origin}/post-job/success?session_id={CHECKOUT_SESSION_ID}&plan=pro`,
    cancel_url: `${opts.origin}/post-job?cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      job_id: opts.jobId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "subscription",
    },
  };

  // Prefill customer info
  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}
