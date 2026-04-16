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
import { activateJob, saveClientStripeCustomerId, saveClientSubscriptionId, getJobById, getUserById, saveArtistStripeCustomerId, saveArtistProSubscription, cancelArtistProSubscription, saveArtistBasicSubscription, recordEnterpriseJobUnlock, saveEnterpriseStripeCustomerId, saveEnterpriseSubscription, cancelEnterpriseSubscription } from "../db";
import { sendJobPostedEmail } from "../email";
import { handleBubbleWebhook } from "../bubbleWebhook";

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
        const session = event.data.object as any;
        const jobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
        const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;

        if (jobId) {
          await activateJob(jobId);
          console.log(`[Webhook] Activated job ${jobId}`);

          // Send "Your job has been posted!" email
          try {
            const job = await getJobById(jobId);
            const poster = userId ? await getUserById(userId) : null;
            if (job && poster?.email) {
              const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
              await sendJobPostedEmail({
                to: poster.email,
                firstName: poster.firstName || poster.name?.split(" ")[0] || "there",
                service: job.masterServiceTypeId || "Dance Teacher",
                artistType: "Dancer",
                date: job.startDate
                  ? new Date(job.startDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "Flexible / TBD",
                location: job.locationAddress || "Location TBD",
                description: job.description || "",
                jobLink: `${appUrl}/jobs/${jobId}`,
              });
            }
          } catch (emailErr: any) {
            console.error("[Webhook] Email send failed:", emailErr.message);
          }
        }

        if (userId && session.customer) {
          await saveClientStripeCustomerId(userId, session.customer);
        }

        const eventType = session.metadata?.type;

        if (userId && session.subscription) {
          // Check if this is an artist PRO subscription or a client subscription
          if (eventType === "artist_pro_subscription") {
            await saveArtistProSubscription(userId, session.subscription);
            if (session.customer) await saveArtistStripeCustomerId(userId, session.customer);
            console.log(`[Webhook] Activated artist PRO for user ${userId}`);
          } else if (eventType === "artist_basic_subscription") {
            await saveArtistBasicSubscription(userId, session.subscription);
            if (session.customer) await saveArtistStripeCustomerId(userId, session.customer);
            console.log(`[Webhook] Activated artist Basic for user ${userId}`);
          } else if (eventType === "enterprise_subscription") {
            await saveEnterpriseSubscription(userId, session.subscription);
            if (session.customer) await saveEnterpriseStripeCustomerId(userId, session.customer);
            console.log(`[Webhook] Activated enterprise subscription for user ${userId}`);
          } else {
            await saveClientSubscriptionId(userId, session.subscription);
          }
          if (session.customer && !["artist_pro_subscription", "artist_basic_subscription", "enterprise_subscription"].includes(eventType)) {
            await saveClientStripeCustomerId(userId, session.customer);
          }
        } else if (userId && session.customer && !session.subscription) {
          if (eventType === "enterprise_job_unlock") {
            // Record the job unlock
            const unlockJobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
            if (unlockJobId) {
              await recordEnterpriseJobUnlock({
                clientUserId: userId,
                jobId: unlockJobId,
                stripeSessionId: session.id,
                stripePaymentIntentId: session.payment_intent ?? null,
                amountCents: session.amount_total ?? 10000,
              });
              await saveEnterpriseStripeCustomerId(userId, session.customer);
              console.log(`[Webhook] Unlocked enterprise job ${unlockJobId} for user ${userId}`);
            }
          } else {
            // One-time payment — save customer ID for client
            await saveClientStripeCustomerId(userId, session.customer);
          }
        }
      }

      // Handle subscription cancellation / expiry (Basic, PRO, or Enterprise)
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        if (customerId) {
          const { getDb } = await import("../db");
          const db = await getDb();
          if (db) {
            const { users } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const { STRIPE_PRODUCTS } = await import("../stripe-products");
            const productId = subscription.items?.data?.[0]?.price?.product;
            if (productId === STRIPE_PRODUCTS.ARTIST_PRO.productId) {
              await db.update(users).set({ artswrkPro: false, artistStripeProductId: null }).where(eq(users.stripeCustomerId, customerId));
              console.log(`[Webhook] Cancelled artist PRO for Stripe customer ${customerId}`);
            } else if (productId === STRIPE_PRODUCTS.ARTIST_BASIC.productId) {
              await db.update(users).set({ artswrkBasic: false, artistStripeProductId: null }).where(eq(users.stripeCustomerId, customerId));
              console.log(`[Webhook] Cancelled artist Basic for Stripe customer ${customerId}`);
            } else if (productId === STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.productId) {
              await db.update(users).set({ enterpriseStripeSubscriptionId: null }).where(eq(users.enterpriseStripeCustomerId, customerId));
              console.log(`[Webhook] Cancelled enterprise subscription for customer ${customerId}`);
            }
          }
        }
      }

      // Handle artist subscription updates (e.g. reactivation)
      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const isActive = subscription.status === "active" || subscription.status === "trialing";
        if (customerId) {
          const { getDb } = await import("../db");
          const db = await getDb();
          if (db) {
            const { users } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            // Only update if this is an artist PRO subscription (check product ID)
            const productId = subscription.items?.data?.[0]?.price?.product;
            const { STRIPE_PRODUCTS } = await import("../stripe-products");
            if (productId === STRIPE_PRODUCTS.ARTIST_PRO.productId) {
              await db.update(users).set({ artswrkPro: isActive }).where(eq(users.stripeCustomerId, customerId));
              console.log(`[Webhook] Updated artist PRO status to ${isActive} for customer ${customerId}`);
            } else if (productId === STRIPE_PRODUCTS.ARTIST_BASIC.productId) {
              await db.update(users).set({ artswrkBasic: isActive }).where(eq(users.stripeCustomerId, customerId));
              console.log(`[Webhook] Updated artist Basic status to ${isActive} for customer ${customerId}`);
            }
          }
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

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
