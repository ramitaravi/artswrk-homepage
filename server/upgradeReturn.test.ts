/**
 * Where does Stripe send someone back to after they upgrade?
 *
 * Every client Premium checkout used to return to /app/jobs no matter where it
 * started — so subscribing from Benefits, Browse Artists or My Plan dropped you
 * on an unrelated page and you had to find your way back to the thing you had
 * just paid to unlock. These pin the round trip down.
 *
 * The success_url must also carry session_id, which is what
 * CheckoutSessionVerifier reads on landing to apply the plan change straight
 * away rather than waiting on the webhook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ENV captures STRIPE_SECRET_KEY at module load, and imports are hoisted above
// any assignment here — so the key has to be mocked, not assigned. It isn't
// what's under test: the URLs handed to Stripe are.
vi.mock("./_core/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ...actual, ENV: { ...actual.ENV, stripeSecretKey: "sk_test_dummy_for_url_assertions" } };
});

const created: any[] = [];
vi.mock("stripe", () => ({
  default: class {
    checkout = {
      sessions: {
        create: async (params: any) => {
          created.push(params);
          return { id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" };
        },
      },
    };
  },
}));

import {
  createClientSubscriptionCheckoutSession,
  createArtistProCheckoutSession,
  createArtistBasicCheckoutSession,
} from "./stripe";

const ORIGIN = "https://app.artswrk.com";
const last = () => created[created.length - 1];

beforeEach(() => { created.length = 0; });

describe("client Premium checkout return trip", () => {
  it("returns to the page the upgrade started from", async () => {
    await createClientSubscriptionCheckoutSession({
      userId: 1, origin: ORIGIN, returnPath: "/app/benefits",
    } as any);
    expect(last().success_url).toContain("/app/benefits");
    expect(last().cancel_url).toContain("/app/benefits");
  });

  it("carries session_id so the plan unlocks without waiting on the webhook", async () => {
    await createClientSubscriptionCheckoutSession({
      userId: 1, origin: ORIGIN, returnPath: "/app/benefits",
    } as any);
    expect(last().success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("keeps the query string valid when the return path already has one", async () => {
    await createClientSubscriptionCheckoutSession({
      userId: 1, origin: ORIGIN, returnPath: "/app/artists?tab=my",
    } as any);
    // One "?", the rest joined with "&" — two "?" and the params are lost.
    expect(last().success_url.split("?").length - 1).toBe(1);
    expect(last().success_url).toContain("tab=my&subscribed=1");
  });

  it("still falls back to the job being unlocked, then the jobs list", async () => {
    await createClientSubscriptionCheckoutSession({ userId: 1, origin: ORIGIN, jobId: 42 } as any);
    expect(last().success_url).toContain("/app/jobs/42");
    await createClientSubscriptionCheckoutSession({ userId: 1, origin: ORIGIN } as any);
    expect(last().success_url).toContain("/app/jobs?");
  });

  it("marks the session as a client subscription so the webhook sets client_premium", async () => {
    await createClientSubscriptionCheckoutSession({ userId: 7, origin: ORIGIN } as any);
    expect(last().metadata.type).toBe("client_subscription");
    expect(last().metadata.user_id).toBe("7");
    expect(last().mode).toBe("subscription");
  });
});

describe("artist checkout return trip", () => {
  it("returns PRO buyers to the job they were unlocking", async () => {
    await createArtistProCheckoutSession({
      userId: 2, origin: ORIGIN, returnPath: "/jobs/lead-dance-teacher-1234",
    } as any);
    expect(last().success_url).toContain("/jobs/lead-dance-teacher-1234");
    expect(last().success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("sends a cancelled artist back where they started, not to settings", async () => {
    await createArtistProCheckoutSession({
      userId: 2, origin: ORIGIN, returnPath: "/app/companies",
    } as any);
    expect(last().cancel_url).toContain("/app/companies");
    expect(last().cancel_url).not.toContain("/app/settings");
  });

  it("tags PRO and Basic distinctly, so the webhook sets the right tier", async () => {
    await createArtistProCheckoutSession({ userId: 3, origin: ORIGIN } as any);
    expect(last().metadata.type).toBe("artist_pro_subscription");
    await createArtistBasicCheckoutSession({ userId: 3, origin: ORIGIN } as any);
    expect(last().metadata.type).toBe("artist_basic_subscription");
  });
});
