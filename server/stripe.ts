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

/**
 * Create a Stripe Checkout Session for a job boost (dynamic pricing).
 */
export async function createBoostCheckoutSession(
  opts: CreateCheckoutOptions & {
    dailyBudget: number;
    durationDays: number;
    totalAmountCents: number;
  }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const product = STRIPE_PRODUCTS.BOOST;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: product.currency,
          unit_amount: opts.totalAmountCents,
          product_data: {
            name: product.name,
            description: `$${opts.dailyBudget}/day × ${opts.durationDays} days — ${product.description}`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      setup_future_usage: "on_session",
    },
    success_url: `${opts.origin}/post-job/success?session_id={CHECKOUT_SESSION_ID}&boosted=1`,
    cancel_url: `${opts.origin}/post-job?cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      job_id: opts.jobId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "boost",
      daily_budget: opts.dailyBudget.toString(),
      duration_days: opts.durationDays.toString(),
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an artist PRO subscription.
 * Uses the existing Stripe product/price IDs.
 */
export async function createArtistProCheckoutSession(
  opts: CreateCheckoutOptions & { interval: "month" | "year" }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { ARTIST_PRO } = await import("./stripe-products").then(m => ({ ARTIST_PRO: m.STRIPE_PRODUCTS.ARTIST_PRO }));

  const priceId = opts.interval === "year"
    ? ARTIST_PRO.annual.priceId
    : ARTIST_PRO.monthly.priceId;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${opts.origin}/app?plan=pro&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/app/settings?cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "artist_pro_subscription",
      interval: opts.interval,
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an artist Basic subscription.
 */
export async function createArtistBasicCheckoutSession(
  opts: CreateCheckoutOptions & { interval: "month" | "year" }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { ARTIST_BASIC } = await import("./stripe-products").then(m => ({ ARTIST_BASIC: m.STRIPE_PRODUCTS.ARTIST_BASIC }));

  const priceId = opts.interval === "year"
    ? ARTIST_BASIC.annual.priceId
    : ARTIST_BASIC.monthly.priceId;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${opts.origin}/app?plan=basic&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/app/settings?cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "artist_basic_subscription",
      interval: opts.interval,
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an enterprise on-demand job unlock ($100).
 */
export async function createEnterpriseJobUnlockCheckoutSession(
  opts: CreateCheckoutOptions & { jobId: number; jobTitle?: string }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { STRIPE_PRODUCTS } = await import("./stripe-products");
  const product = STRIPE_PRODUCTS.ENTERPRISE_ON_DEMAND;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: {
            name: opts.jobTitle ? `View Candidates — ${opts.jobTitle}` : product.name,
            description: product.description,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: { setup_future_usage: "on_session" },
    success_url: `${opts.origin}/enterprise?unlock_job=${opts.jobId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/enterprise`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      job_id: opts.jobId.toString(),
      customer_email: opts.email ?? "",
      type: "enterprise_job_unlock",
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an enterprise subscription ($250/mo or $2500/yr).
 */
export async function createEnterpriseSubscriptionCheckoutSession(
  opts: CreateCheckoutOptions & { interval: "month" | "year" }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { STRIPE_PRODUCTS } = await import("./stripe-products");
  const plan = STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION;
  const tier = opts.interval === "year" ? plan.annual : plan.monthly;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItem: any = tier.priceId
    ? { price: tier.priceId, quantity: 1 }
    : {
        price_data: {
          currency: plan.currency,
          unit_amount: tier.amount,
          recurring: { interval: opts.interval },
          product: plan.productId,
        },
        quantity: 1,
      };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [lineItem],
    success_url: `${opts.origin}/enterprise?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/enterprise`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "enterprise_subscription",
      interval: opts.interval,
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Customer Portal session so an artist can manage their subscription.
 */
export async function createArtistPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}
