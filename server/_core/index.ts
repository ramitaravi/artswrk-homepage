import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getStripe } from "../stripe";
import { ENV } from "./env";
import { applyCheckoutSessionCompleted } from "../checkoutEffects";
import { handleBubbleWebhook } from "../bubbleWebhook";
import { handleScheduledBubbleSync } from "../scheduledSync";
import { handleSendGridWebhook } from "../jobAlerts/webhook";
import { handleScheduledJobAlerts, handleScheduledBrevoSync } from "../jobAlerts/scheduled";
import { handleUnsubscribeGet, handleUnsubscribePost } from "../jobAlerts/unsubscribe";
import { registerStorageProxy } from "./storageProxy";
import { registerLegacyRedirects } from "../redirects";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Revoke paid access for whichever product line a Stripe customer ID belongs
 * to. A customer ID can only ever match one of these three columns (artists,
 * clients, and enterprise accounts each get their own Stripe customer), so
 * checking all three and only writing the one that matches is safe.
 */
async function revokeByCustomerId(customerId: string, productId: string | undefined, reason: "deleted" | "payment_failed") {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  const { users } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { STRIPE_PRODUCTS } = await import("../stripe-products");

  if (productId === STRIPE_PRODUCTS.ARTIST_PRO.productId) {
    const res = await db.update(users).set({
      artswrkPro: false, artistStripeProductId: null,
      planTier: "artist_free", stripeSubscriptionId: null, stripePriceId: null,
    }).where(eq(users.stripeCustomerId, customerId));
    if ((res as any).affectedRows) console.log(`[Webhook] Revoked artist PRO (${reason}) for customer ${customerId}`);
    return;
  }
  if (productId === STRIPE_PRODUCTS.ARTIST_BASIC.productId) {
    const res = await db.update(users).set({
      artswrkBasic: false, artistStripeProductId: null,
      planTier: "artist_free", stripeSubscriptionId: null, stripePriceId: null,
    }).where(eq(users.stripeCustomerId, customerId));
    if ((res as any).affectedRows) console.log(`[Webhook] Revoked artist Basic (${reason}) for customer ${customerId}`);
    return;
  }
  if (productId === STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.productId) {
    // Note: `enterprise` itself is left alone — it's an account-type flag
    // (this account is a competition/enterprise client), not a live payment
    // status. enterprisePlan is cleared too so the account doesn't sit in a
    // misleading "subscriber" state with no subscription — access checks
    // (isClientJobUnlocked, canClientMessageArtist, premiumJobs.getJobApplicants)
    // all require enterpriseStripeSubscriptionId to be actually set, so this
    // was already safe even before this line existed.
    const res = await db.update(users).set({
      enterpriseStripeSubscriptionId: null, enterprisePlan: null,
      planTier: "enterprise_on_demand", stripeSubscriptionId: null, stripePriceId: null,
    }).where(eq(users.enterpriseStripeCustomerId, customerId));
    if ((res as any).affectedRows) console.log(`[Webhook] Revoked enterprise subscription (${reason}) for customer ${customerId}`);
    return;
  }
  // Client Premium has no other subscription type sharing clientStripeCustomerId,
  // so no product-ID check is needed — just match on the customer ID directly.
  // This also covers the legacy checkout path, which mints a fresh one-off
  // Stripe product per purchase and so can never be matched by product ID.
  const clientRes = await db.update(users).set({
    clientPremium: false, clientSubscriptionId: null,
    planTier: "client_on_demand", stripeSubscriptionId: null, stripePriceId: null,
  }).where(eq(users.clientStripeCustomerId, customerId));
  if ((clientRes as any).affectedRows) console.log(`[Webhook] Revoked client Premium (${reason}) for customer ${customerId}`);
}

/** Mirror of revokeByCustomerId for status *changes* (reactivation, etc.) rather than a hard cancel. */
async function updateByCustomerId(customerId: string, productId: string | undefined, isActive: boolean) {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  const { users } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { STRIPE_PRODUCTS } = await import("../stripe-products");

  if (productId === STRIPE_PRODUCTS.ARTIST_PRO.productId) {
    await db.update(users).set({
      artswrkPro: isActive,
      planTier: isActive ? "artist_pro" : "artist_free",
    }).where(eq(users.stripeCustomerId, customerId));
    console.log(`[Webhook] Updated artist PRO status to ${isActive} for customer ${customerId}`);
    return;
  }
  if (productId === STRIPE_PRODUCTS.ARTIST_BASIC.productId) {
    await db.update(users).set({
      artswrkBasic: isActive,
      planTier: isActive ? "artist_basic" : "artist_free",
    }).where(eq(users.stripeCustomerId, customerId));
    console.log(`[Webhook] Updated artist Basic status to ${isActive} for customer ${customerId}`);
    return;
  }
  if (productId === STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.productId) {
    // Only touch enterprisePlan — never clear enterpriseStripeSubscriptionId
    // here (that would defeat the point of this being the non-destructive
    // "status changed" mirror rather than the hard-revoke path above).
    await db.update(users).set({
      enterprisePlan: isActive ? "subscriber" : null,
      planTier: isActive ? "enterprise_subscription" : "enterprise_on_demand",
    }).where(eq(users.enterpriseStripeCustomerId, customerId));
    console.log(`[Webhook] Updated enterprise subscriber status to ${isActive} for customer ${customerId}`);
    return;
  }
  // Client Premium: no product-ID disambiguation needed (see revokeByCustomerId).
  const clientRes = await db.update(users).set({
    clientPremium: isActive,
    planTier: isActive ? "client_premium" : "client_on_demand",
  }).where(eq(users.clientStripeCustomerId, customerId));
  if ((clientRes as any).affectedRows) console.log(`[Webhook] Updated client Premium status to ${isActive} for customer ${customerId}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Stripe webhook — MUST be before express.json() ────────────────────────
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event: any;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        ENV.stripeWebhookSecret
      );
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle test events
    if (event.id?.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    console.log(`[Webhook] Event: ${event.type} | ${event.id}`);

    try {
      if (event.type === "checkout.session.completed") {
        await applyCheckoutSessionCompleted(event.data.object);
      }

      // Handle subscription cancellation / expiry (Basic, PRO, Enterprise, or client Premium)
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        if (customerId) {
          await revokeByCustomerId(customerId, subscription.items?.data?.[0]?.price?.product, "deleted");
        }
      }

      // Handle subscription status changes (reactivation, or past_due while Stripe retries)
      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        // Only "canceled"/"unpaid"/"incomplete_expired" mean access should actually
        // come off here — "past_due" still has Stripe retrying the card, and
        // cutting access on every retry attempt is too aggressive. The real
        // final-failure cutoff is handled below via invoice.payment_failed.
        const isActive = !["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
        if (customerId) {
          await updateByCustomerId(customerId, subscription.items?.data?.[0]?.price?.product, isActive);
        }
      }

      // Final payment failure on a renewal (Stripe sets next_payment_attempt to
      // null once it's done retrying) — this is the real "they stopped paying"
      // signal, not the first missed charge.
      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;
        const isFinalFailure = invoice.next_payment_attempt === null;
        if (customerId && isFinalFailure) {
          const productId = invoice.lines?.data?.[0]?.price?.product;
          await revokeByCustomerId(customerId, productId, "payment_failed");
        }
      }
    } catch (err: any) {
      console.error("[Webhook] Processing error:", err.message);
    }

    res.json({ received: true });
  });

  // ── Bubble webhook — receives real-time sync events from Bubble Backend Workflows ──
  // Must be registered BEFORE the global express.json() middleware
  app.post("/api/webhooks/bubble", express.json({ limit: "1mb" }), handleBubbleWebhook);

  // ── Scheduled Bubble sync — triggered by Manus Heartbeat cron ─────────────
  app.post("/api/scheduled/bubble-sync", express.json({ limit: "1mb" }), handleScheduledBubbleSync);

  // ── Job alerts ────────────────────────────────────────────────────────────
  // SendGrid delivery events -> email_suppressions (bounces, spam reports,
  // unsubscribes). Read before every send, so a one-click unsubscribe applies
  // to the next batch rather than the next nightly sync.
  app.post("/api/webhooks/sendgrid", express.json({ limit: "2mb" }), handleSendGridWebhook);
  // Hourly cron; exits immediately unless it is the 1 PM hour in New York.
  app.post("/api/scheduled/job-alerts", express.json({ limit: "1mb" }), handleScheduledJobAlerts);
  // One-click unsubscribe. Deliberately NOT behind auth — someone who wants out
  // shouldn't have to remember a password, and a sign-in wall in front of an
  // unsubscribe link is how bulk senders collect spam complaints. The signed
  // token in the URL is what proves the link came from us.
  app.post("/api/scheduled/brevo-suppressions", express.json({ limit: "1mb" }), handleScheduledBrevoSync);
  app.get("/unsubscribe", handleUnsubscribeGet);
  app.post("/unsubscribe", express.urlencoded({ extended: true }), handleUnsubscribePost);

  // ── Stripe Connect OAuth callback — artist just approved payout linking ──
  app.get("/stripe-connect/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as { code?: string; state?: string; error?: string };

    if (oauthError || !code || !state) {
      res.redirect("/app/settings?stripe_connect=cancelled");
      return;
    }

    try {
      const { verifyStripeConnectState, exchangeStripeConnectCode } = await import("../stripe");
      const { saveArtistStripeConnectAccount, getUserById } = await import("../db");
      const { userId } = await verifyStripeConnectState(state);
      const accountId = await exchangeStripeConnectCode(code);
      await saveArtistStripeConnectAccount(userId, accountId);

      // Internal ops alert — awaited (not fire-and-forget) so it can't be
      // orphaned by a server restart the way the admin welcome email was.
      // Failure here must never block the artist's own success redirect.
      try {
        const { sendStripeConnectAlertEmail } = await import("../email");
        const artist = await getUserById(userId);
        if (artist) {
          await sendStripeConnectAlertEmail({
            artistName: artist.name || artist.firstName || "An artist",
            artistEmail: artist.email,
            accountId,
          });
        }
      } catch (notifyErr) {
        console.error("[StripeConnect] Ops alert email failed (non-fatal):", notifyErr);
      }

      res.redirect("/app/settings?stripe_connect=success");
    } catch (err: any) {
      console.error("[StripeConnect] Callback failed:", err.message);
      res.redirect("/app/settings?stripe_connect=error");
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ── Legacy Bubble redirects — after the API routes, before the SPA ───────
  // These are 301s for old URLs still live in Google's index and in already-sent
  // email. Must sit ahead of the Vite/static catch-all, which answers everything.
  registerLegacyRedirects(app);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
