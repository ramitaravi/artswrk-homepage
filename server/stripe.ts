/**
 * Artswrk Stripe helper
 * Wraps the Stripe SDK with a singleton client and helper functions for
 * creating checkout sessions (one-time and subscription).
 */

import Stripe from "stripe";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { STRIPE_PRODUCTS, getStripeMode } from "./stripe-products";
import { assertProductionStripeMode, canReuseCheckoutUrl } from "../shared/stripeCheckoutMode";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  assertProductionStripeMode(getStripeMode(ENV.stripeSecretKey), process.env.NODE_ENV);
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

/**
 * True when a stored Checkout URL was created with the key this server is
 * using now. Checkout sessions are per-mode: a cs_test_ session opened with a
 * live key tells the customer "your card was declined, your request was in
 * test mode". That is exactly what a studio saw, because development runs
 * against the live database with a test key, so approving an invoice locally
 * wrote a test-mode URL onto a real booking. A stored URL is therefore never
 * trusted on its own — it has to match the current mode.
 */
export function checkoutUrlMatchesMode(url: string | null | undefined): boolean {
  return canReuseCheckoutUrl(url, getStripeMode(ENV.stripeSecretKey));
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
/**
 * Create a Checkout Session, surviving a stored customer id from the other
 * Stripe mode.
 *
 * Stripe customer ids are mode-scoped. 931 client rows carry a
 * clientStripeCustomerId imported from the live/Bubble account, so passing one
 * under a test key fails the whole request:
 *
 *   No such customer: 'cus_NXhubY5rVowCjD'; a similar object exists in live
 *   mode, but a test mode key was used to make this request.
 *
 * That made the upgrade flow impossible to exercise in test mode for any
 * pre-existing client — and it would break the same way in production if the
 * key were ever rotated across modes. The customer id is an optimisation (it
 * prefills the card on file); the checkout works without it. So: try with it,
 * and if Stripe says it does not exist here, drop it and fall back to the
 * email. Costs nothing when the id is valid, which is the normal case.
 */
async function createSessionTolerantOfMode(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  email?: string,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(params);
  } catch (err: any) {
    const missingCustomer = err?.code === "resource_missing" && err?.param === "customer";
    if (!missingCustomer || !params.customer) throw err;

    console.warn(
      `[Stripe] Customer ${params.customer} does not exist in this mode — ` +
      `falling back to customer_email. (Mode-scoped id, likely imported from live.)`
    );
    const { customer, ...rest } = params;
    return stripe.checkout.sessions.create({
      ...rest,
      ...(email ? { customer_email: email } : {}),
    });
  }
}

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

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
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

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
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

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an artist PRO subscription.
 * Uses the existing Stripe product/price IDs.
 */
export async function createArtistProCheckoutSession(
  opts: CreateCheckoutOptions & { returnPath?: string }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { ARTIST_PRO } = await import("./stripe-products").then(m => ({ ARTIST_PRO: m.STRIPE_PRODUCTS.ARTIST_PRO }));

  // Annual-only as of 2026-08-28 — the $10.99/mo plan is discontinued for
  // new signups. Existing monthly subscribers are grandfathered and
  // untouched (ARTIST_PRO.legacyMonthly still exists for admin reporting,
  // but no new checkout should ever reference it).
  const priceId = ARTIST_PRO.annual.priceId;

  const successPath = opts.returnPath ?? "/app";
  const separator = successPath.includes("?") ? "&" : "?";

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: ARTIST_PRO.annual.trialPeriodDays
      ? { trial_period_days: ARTIST_PRO.annual.trialPeriodDays }
      : undefined,
    success_url: `${opts.origin}${successPath}${separator}plan=pro&session_id={CHECKOUT_SESSION_ID}`,
    // Back where they started, not a settings page they never asked for.
    cancel_url: `${opts.origin}${successPath}${separator}cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "artist_pro_subscription",
      interval: "year",
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an artist Basic subscription.
 */
export async function createArtistBasicCheckoutSession(
  opts: CreateCheckoutOptions & { returnPath?: string }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { ARTIST_BASIC } = await import("./stripe-products").then(m => ({ ARTIST_BASIC: m.STRIPE_PRODUCTS.ARTIST_BASIC }));

  // Annual-only — Basic has only ever had one real price offered on Bubble
  // ($30/yr); ARTIST_BASIC.legacyMonthly exists only for admin reporting on
  // old grandfathered accounts, never for a new checkout.
  const priceId = ARTIST_BASIC.annual.priceId;

  const successPath = opts.returnPath ?? "/app";
  const separator = successPath.includes("?") ? "&" : "?";

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${opts.origin}${successPath}${separator}plan=basic&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}${successPath}${separator}cancelled=1`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "artist_basic_subscription",
      interval: "year",
    },
  };

  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for an enterprise on-demand job unlock ($150).
 */
export async function createEnterpriseJobUnlockCheckoutSession(
  opts: CreateCheckoutOptions & { jobId: number; jobTitle?: string }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const { STRIPE_PRODUCTS } = await import("./stripe-products");
  const product = STRIPE_PRODUCTS.ENTERPRISE_ON_DEMAND;

  // Use static price ID if available (preferred — ties to existing Stripe product);
  // fall back to price_data for local/test environments without the env var set.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItem: any = product.priceId
    ? { price: product.priceId, quantity: 1 }
    : {
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: {
            name: opts.jobTitle ? `View Candidates — ${opts.jobTitle}` : product.name,
            description: product.description,
          },
        },
        quantity: 1,
      };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [lineItem],
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

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
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

  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
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

/**
 * Create a Stripe Checkout Session for a client to unlock a single job ($40, on-demand).
 */
export async function createClientJobUnlockCheckoutSession(
  opts: CreateCheckoutOptions & { jobId: number; jobTitle?: string }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const plan = STRIPE_PRODUCTS.CLIENT_JOB_UNLOCK;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItem: any = plan.priceId
    ? { price: plan.priceId, quantity: 1 }
    : {
        price_data: {
          currency: plan.currency,
          unit_amount: plan.amount,
          product_data: {
            name: plan.name,
            description: opts.jobTitle
              ? `One-time unlock for: ${opts.jobTitle}`
              : plan.description,
          },
        },
        quantity: 1,
      };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [lineItem],
    success_url: `${opts.origin}/app/jobs/${opts.jobId}?unlock_success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/app/jobs/${opts.jobId}`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      job_id: opts.jobId.toString(),
      customer_email: opts.email ?? "",
      type: "client_job_unlock",
    },
  };
  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }
  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Checkout Session for Artswrk Premium client subscription.
 * Monthly: $65/mo  |  Annual: $650/yr
 */
export async function createClientSubscriptionCheckoutSession(
  opts: CreateCheckoutOptions & { jobId?: number; interval?: "month" | "year"; returnPath?: string }
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const interval = opts.interval ?? "month";
  const isAnnual = interval === "year";
  // Where they came from wins. Failing that, the job they were unlocking; then
  // the jobs list. Before returnPath existed, EVERY client upgrade landed on
  // /app/jobs — so subscribing from Benefits, Browse Artists or My Plan bounced
  // you somewhere unrelated and you had to navigate back to the thing you had
  // just paid to unlock. The artist flows already took a returnPath.
  const returnJobPath = opts.returnPath ?? (opts.jobId ? `/app/jobs/${opts.jobId}` : "/app/jobs");
  const separator = returnJobPath.includes("?") ? "&" : "?";
  const plan = STRIPE_PRODUCTS.CLIENT_PREMIUM;
  const tier = isAnnual ? plan.annual : plan.monthly;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItem: any = tier.priceId
    ? { price: tier.priceId, quantity: 1 }
    : {
        price_data: {
          currency: plan.currency,
          unit_amount: tier.amount,
          recurring: { interval },
          product_data: {
            name: plan.name,
            description: isAnnual
              ? `${plan.description} — Annual plan`
              : `${plan.description} — Monthly plan`,
          },
        },
        quantity: 1,
      };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [lineItem],
    success_url: `${opts.origin}${returnJobPath}${separator}subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}${returnJobPath}`,
    allow_promotion_codes: true,
    client_reference_id: opts.userId?.toString(),
    metadata: {
      user_id: opts.userId?.toString() ?? "",
      customer_email: opts.email ?? "",
      type: "client_subscription",
      interval,
    },
  };
  if (opts.stripeCustomerId) {
    sessionParams.customer = opts.stripeCustomerId;
  } else if (opts.email) {
    sessionParams.customer_email = opts.email;
  }
  const session = await createSessionTolerantOfMode(stripe, sessionParams, opts.email ?? undefined);
  return { url: session.url!, sessionId: session.id };
}

// ── Stripe Connect onboarding (artist payout linking) ───────────────────────
// Express accounts + Account Links — the flow Stripe actually recommends now.
// Replaced the old "Standard" OAuth flow (connect.stripe.com/oauth/authorize)
// on 2026-08-31 after Stripe auto-restricted it as a security measure; that
// restriction can be lifted from the dashboard, but Standard OAuth is also
// the more fragile of the two long-term, so this switches off it entirely
// rather than just waiting out future restrictions.
//
// No `code` exchange here — we create the account ourselves and already know
// its ID, so the `state` param only needs to carry the artist's user ID
// through the redirect (still a short-lived signed JWT, same trust model as
// before: stateless, CSRF-safe, no DB/session lookup needed on return).

function connectStateSecret(): Uint8Array {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function signConnectState(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("60m")
    .sign(connectStateSecret());
}

/** Verifies + decodes the `state` param from a Connect return/refresh redirect. Throws if invalid/expired. */
export async function verifyStripeConnectState(state: string): Promise<{ userId: number }> {
  const { payload } = await jwtVerify(state, connectStateSecret(), { algorithms: ["HS256"] });
  const userId = payload.userId;
  if (typeof userId !== "number") throw new Error("Invalid state payload");
  return { userId };
}

/** Creates a new Express connected account for an artist. Call once per artist — reuse the ID after. */
export async function createArtistExpressAccount(email: string): Promise<string> {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    email,
    business_type: "individual",
    // Stripe requires platform approval to request `transfers` without
    // `card_payments` — confirmed live (2026-08-31), this platform isn't
    // approved for transfers-only. Request both; card_payments goes unused
    // since payments always run through the platform account, not the
    // artist's, but Stripe won't create the account without it.
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  });
  return account.id;
}

/**
 * Builds the onboarding (or resume-onboarding) link for an artist's Express
 * account, and the matching signed state for the return/refresh redirects.
 */
export async function createConnectOnboardingUrl(
  userId: number,
  accountId: string,
  origin: string
): Promise<string> {
  const stripe = getStripe();
  const state = await signConnectState(userId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${origin}/stripe-connect/callback?state=${encodeURIComponent(state)}`,
    refresh_url: `${origin}/stripe-connect/refresh?state=${encodeURIComponent(state)}`,
  });
  return link.url;
}

/**
 * Whether an artist's connected account can actually be paid.
 *
 * Creating the Express account is not the same as finishing onboarding. Until
 * Stripe has what it needs (identity, bank details), the account exists but
 * has no `transfers` capability, and any destination charge is rejected with:
 *
 *   "The account referenced in the 'destination' parameter is missing the
 *    required capabilities: transfers or legacy_payments are required"
 *
 * We only checked that an account id EXISTED, so an artist could submit an
 * invoice and the studio hit that raw Stripe error at the moment they tried to
 * pay — Brittany at Fancy Feet, on Sara Pagliaro's invoice, 2026-10-19. The
 * studio could do nothing about it and the message named nobody.
 */
export async function artistPayoutReadiness(accountId: string): Promise<{
  ready: boolean;
  reason?: string;
}> {
  try {
    const account = await getStripe().accounts.retrieve(accountId);
    const transfers = (account as any)?.capabilities?.transfers;
    if (transfers === "active") return { ready: true };
    if (transfers === "pending") {
      return { ready: false, reason: "Stripe is still reviewing their payout account." };
    }
    return { ready: false, reason: "They haven't finished setting up their Stripe payout account." };
  } catch (err) {
    // Never block a payment because this lookup failed — Stripe itself is the
    // final authority, and it will reject the charge if the account is unusable.
    console.error("[artistPayoutReadiness] lookup failed:", err instanceof Error ? err.message : err);
    return { ready: true };
  }
}

/**
 * Turn Stripe's destination-capability rejection into something the person
 * reading it can act on. Returns null for any other error.
 */
export function payoutCapabilityMessage(err: unknown, artistName: string): string | null {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (!/required capabilities|legacy_payments|capabilities: transfers/i.test(message)) return null;
  return `${artistName} hasn't finished setting up their Stripe payout account, so this payment can't go through yet. `
    + `They need to complete it from Settings → Manage Payouts. Nothing has been charged.`;
}

/* ------------------------------------------------------------------ *
 * Admin finance dashboard readers
 *
 * These read directly from Stripe rather than our `payments` table,
 * because that table has never been written to. Stripe is the only
 * record of what actually moved. Everything here is read-only.
 *
 * NOTE: these return live data only when STRIPE_SECRET_KEY is a live
 * key. Under a test key they return real Stripe objects from the test
 * environment, which will be empty or fake — `mode` tells the caller
 * which world the numbers came from so the UI can label them.
 * ------------------------------------------------------------------ */

export type StripeMode = "live" | "test" | "unconfigured";

export function stripeMode(): StripeMode {
  const key = ENV.stripeSecretKey;
  if (!key) return "unconfigured";
  return key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
}

export interface StripeActivityRow {
  id: string;
  /** charge, payment, payout, transfer, refund, application_fee, … */
  type: string;
  /** Gross amount in cents, signed as Stripe reports it */
  amountCents: number;
  /** Stripe's fee on this transaction, in cents */
  feeCents: number;
  /** amount - fee, in cents */
  netCents: number;
  currency: string;
  status: string;
  description: string | null;
  created: string;
  /** Present on payouts: when it is expected to land */
  arrivalDate: string | null;
}

export interface StripeActivity {
  mode: StripeMode;
  rows: StripeActivityRow[];
  /** Cursor for the next page, or null when the list is exhausted */
  nextCursor: string | null;
  /** Current Stripe balance, in cents, by currency */
  balance: { availableCents: number; pendingCents: number; currency: string }[];
  summary: {
    grossCents: number;
    feesCents: number;
    netCents: number;
    payoutsCents: number;
    chargeCount: number;
    payoutCount: number;
    refundCents: number;
  };
  /** Set when Stripe could not be reached; rows will be empty */
  error: string | null;
}

/** Stripe balance-transaction types that represent money coming in. */
const INBOUND_TYPES = new Set(["charge", "payment"]);

/**
 * Read recent Stripe balance transactions — every movement of money,
 * including charges, refunds, Connect transfers out to artists, our
 * application fees, and payouts to the Artswrk bank account.
 */
export async function getStripeActivity(opts: {
  limit?: number;
  startingAfter?: string;
  /** Unix seconds; only transactions created at or after this */
  createdAfter?: number;
  /** Narrow to one balance-transaction type, e.g. "payout" */
  type?: string;
} = {}): Promise<StripeActivity> {
  const mode = stripeMode();
  const empty: StripeActivity = {
    mode,
    rows: [],
    nextCursor: null,
    balance: [],
    summary: {
      grossCents: 0, feesCents: 0, netCents: 0, payoutsCents: 0,
      chargeCount: 0, payoutCount: 0, refundCents: 0,
    },
    error: null,
  };
  if (mode === "unconfigured") {
    return { ...empty, error: "STRIPE_SECRET_KEY is not configured on this server." };
  }

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  try {
    const stripe = getStripe();
    const [txns, balance] = await Promise.all([
      stripe.balanceTransactions.list({
        limit,
        ...(opts.startingAfter ? { starting_after: opts.startingAfter } : {}),
        ...(opts.createdAfter ? { created: { gte: opts.createdAfter } } : {}),
        ...(opts.type ? { type: opts.type as any } : {}),
        expand: ["data.source"],
      }),
      stripe.balance.retrieve(),
    ]);

    const rows: StripeActivityRow[] = txns.data.map((t) => {
      const source = t.source && typeof t.source === "object" ? (t.source as any) : null;
      return {
        id: t.id,
        type: t.type,
        amountCents: t.amount,
        feeCents: t.fee,
        netCents: t.net,
        currency: (t.currency ?? "usd").toUpperCase(),
        status: t.status,
        description: t.description ?? source?.description ?? null,
        created: new Date(t.created * 1000).toISOString(),
        arrivalDate: source?.arrival_date
          ? new Date(source.arrival_date * 1000).toISOString()
          : null,
      };
    });

    const summary = rows.reduce((acc, r) => {
      if (INBOUND_TYPES.has(r.type)) {
        acc.grossCents += r.amountCents;
        acc.feesCents += r.feeCents;
        acc.netCents += r.netCents;
        acc.chargeCount += 1;
      } else if (r.type === "payout") {
        // Payouts are reported negative; show them as a positive total paid out.
        acc.payoutsCents += Math.abs(r.amountCents);
        acc.payoutCount += 1;
      } else if (r.type === "refund" || r.type === "payment_refund") {
        acc.refundCents += Math.abs(r.amountCents);
      }
      return acc;
    }, { ...empty.summary });

    return {
      mode,
      rows,
      nextCursor: txns.has_more && rows.length > 0 ? rows[rows.length - 1].id : null,
      balance: balance.available.map((a, i) => ({
        availableCents: a.amount,
        pendingCents: balance.pending[i]?.amount ?? 0,
        currency: (a.currency ?? "usd").toUpperCase(),
      })),
      summary,
      error: null,
    };
  } catch (err: any) {
    return { ...empty, error: err?.message ?? "Could not reach Stripe." };
  }
}

export interface StripeSubscriptionRow {
  id: string;
  customerId: string | null;
  customerEmail: string | null;
  status: string;
  productName: string | null;
  /** Recurring amount in cents */
  amountCents: number;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  created: string;
}

/**
 * Read subscriptions straight from Stripe. This is the only trustworthy
 * answer to "who is actually paying us" — our own `artswrkPro` flag and
 * `planTier` column disagree with each other and with Stripe.
 */
export async function getStripeSubscriptions(opts: {
  limit?: number;
  startingAfter?: string;
  /** "all" includes canceled/past_due; defaults to active only */
  status?: "active" | "all" | "past_due" | "canceled" | "trialing";
} = {}): Promise<{
  mode: StripeMode;
  rows: StripeSubscriptionRow[];
  nextCursor: string | null;
  mrrCents: number;
  byStatus: Record<string, number>;
  byProduct: Record<string, { count: number; mrrCents: number }>;
  error: string | null;
}> {
  const mode = stripeMode();
  const empty = {
    mode, rows: [] as StripeSubscriptionRow[], nextCursor: null as string | null,
    mrrCents: 0, byStatus: {} as Record<string, number>,
    byProduct: {} as Record<string, { count: number; mrrCents: number }>,
    error: null as string | null,
  };
  if (mode === "unconfigured") {
    return { ...empty, error: "STRIPE_SECRET_KEY is not configured on this server." };
  }

  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 100);
  try {
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({
      limit,
      status: opts.status ?? "active",
      ...(opts.startingAfter ? { starting_after: opts.startingAfter } : {}),
      expand: ["data.customer", "data.items.data.price.product"],
    });

    const byStatus: Record<string, number> = {};
    const byProduct: Record<string, { count: number; mrrCents: number }> = {};
    let mrrCents = 0;

    const rows: StripeSubscriptionRow[] = subs.data.map((s) => {
      const item = s.items?.data?.[0];
      const price = item?.price;
      const product = price?.product && typeof price.product === "object"
        ? (price.product as any)
        : null;
      const customer = s.customer && typeof s.customer === "object"
        ? (s.customer as any)
        : null;

      const unit = price?.unit_amount ?? 0;
      const qty = item?.quantity ?? 1;
      const interval = price?.recurring?.interval ?? null;
      const intervalCount = price?.recurring?.interval_count ?? 1;
      const gross = unit * qty;
      // Normalise everything to a monthly figure so MRR is comparable.
      const monthly = interval === "year" ? Math.round(gross / (12 * intervalCount))
        : interval === "week" ? Math.round((gross * 52) / (12 * intervalCount))
        : interval === "day" ? Math.round((gross * 365) / (12 * intervalCount))
        : Math.round(gross / intervalCount);

      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      const label = product?.name ?? price?.nickname ?? "Unnamed plan";
      if (!byProduct[label]) byProduct[label] = { count: 0, mrrCents: 0 };
      byProduct[label].count += 1;

      if (s.status === "active" || s.status === "trialing") {
        mrrCents += monthly;
        byProduct[label].mrrCents += monthly;
      }

      const periodEnd = (s as any).current_period_end
        ?? item?.current_period_end
        ?? null;

      return {
        id: s.id,
        customerId: customer?.id ?? (typeof s.customer === "string" ? s.customer : null),
        customerEmail: customer?.email ?? null,
        status: s.status,
        productName: product?.name ?? price?.nickname ?? null,
        amountCents: gross,
        interval: intervalCount > 1 && interval ? `${intervalCount} ${interval}s` : interval,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
        created: new Date(s.created * 1000).toISOString(),
      };
    });

    return {
      mode, rows,
      nextCursor: subs.has_more && rows.length > 0 ? rows[rows.length - 1].id : null,
      mrrCents, byStatus, byProduct, error: null,
    };
  } catch (err: any) {
    return { ...empty, error: err?.message ?? "Could not reach Stripe." };
  }
}
