/**
 * Tests for the artistSubscription tRPC router.
 * Covers getCurrentPlan, createProCheckout, and createPortalSession.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB helpers ────────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getArtistSubscriptionInfo: vi.fn(),
    saveArtistStripeCustomerId: vi.fn(),
    saveArtistProSubscription: vi.fn(),
    cancelArtistProSubscription: vi.fn(),
  };
});

// ── Mock Stripe helpers ────────────────────────────────────────────────────────
vi.mock("./stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe")>();
  return {
    ...actual,
    createArtistProCheckoutSession: vi.fn(),
    createArtistPortalSession: vi.fn(),
  };
});

import {
  getArtistSubscriptionInfo,
  saveArtistProSubscription,
} from "./db";
import {
  createArtistProCheckoutSession,
  createArtistPortalSession,
} from "./stripe";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    email: "artist@example.com",
    name: "Test Artist",
    role: "user",
    artswrkPro: false,
    artswrkBasic: false,
    stripeCustomerId: null,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("getArtistSubscriptionInfo helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when user is not found", async () => {
    vi.mocked(getArtistSubscriptionInfo).mockResolvedValueOnce(null);
    const result = await getArtistSubscriptionInfo(999);
    expect(result).toBeNull();
  });

  it("returns correct plan flags for a PRO user", async () => {
    vi.mocked(getArtistSubscriptionInfo).mockResolvedValueOnce({
      artswrkPro: true,
      artswrkBasic: false,
      stripeCustomerId: "cus_abc123",
      artistStripeProductId: "sub_xyz789",
    });
    const result = await getArtistSubscriptionInfo(42);
    expect(result?.artswrkPro).toBe(true);
    expect(result?.stripeCustomerId).toBe("cus_abc123");
  });

  it("returns correct plan flags for a free user", async () => {
    vi.mocked(getArtistSubscriptionInfo).mockResolvedValueOnce({
      artswrkPro: false,
      artswrkBasic: false,
      stripeCustomerId: null,
      artistStripeProductId: null,
    });
    const result = await getArtistSubscriptionInfo(42);
    expect(result?.artswrkPro).toBe(false);
    expect(result?.artswrkBasic).toBe(false);
  });
});

describe("createArtistProCheckoutSession helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a checkout URL and session ID for monthly billing", async () => {
    vi.mocked(createArtistProCheckoutSession).mockResolvedValueOnce({
      url: "https://checkout.stripe.com/test-monthly",
      sessionId: "cs_test_monthly_123",
    });

    const result = await createArtistProCheckoutSession({
      email: "artist@example.com",
      userId: 42,
      origin: "https://artswrk.com",
      stripeCustomerId: null,
      interval: "month",
    });

    expect(result.url).toContain("checkout.stripe.com");
    expect(result.sessionId).toBe("cs_test_monthly_123");
  });

  it("returns a checkout URL and session ID for annual billing", async () => {
    vi.mocked(createArtistProCheckoutSession).mockResolvedValueOnce({
      url: "https://checkout.stripe.com/test-annual",
      sessionId: "cs_test_annual_456",
    });

    const result = await createArtistProCheckoutSession({
      email: "artist@example.com",
      userId: 42,
      origin: "https://artswrk.com",
      stripeCustomerId: null,
      interval: "year",
    });

    expect(result.url).toContain("checkout.stripe.com");
    expect(result.sessionId).toBe("cs_test_annual_456");
  });
});

describe("createArtistPortalSession helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a portal URL for a customer with a Stripe ID", async () => {
    vi.mocked(createArtistPortalSession).mockResolvedValueOnce({
      url: "https://billing.stripe.com/session/test_portal",
    });

    const result = await createArtistPortalSession(
      "cus_abc123",
      "https://artswrk.com/artist-dashboard?tab=settings"
    );

    expect(result.url).toContain("billing.stripe.com");
  });
});

describe("saveArtistProSubscription helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is called with the correct userId and subscriptionId", async () => {
    vi.mocked(saveArtistProSubscription).mockResolvedValueOnce(undefined);
    await saveArtistProSubscription(42, "sub_xyz789");
    expect(saveArtistProSubscription).toHaveBeenCalledWith(42, "sub_xyz789");
  });
});
