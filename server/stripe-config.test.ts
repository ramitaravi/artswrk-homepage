import { describe, expect, it } from "vitest";
import {
  getStripeMode,
  selectStripeModeValue,
  STRIPE_PRODUCTS,
  STRIPE_TEST_FALLBACKS,
} from "./stripe-products";

describe("Stripe environment mode selection", () => {
  it("detects standard and restricted test/live secret formats without exposing the key", () => {
    expect(getStripeMode("sk_test_example")).toBe("test");
    expect(getStripeMode("rk_test_example")).toBe("test");
    expect(getStripeMode("sk_live_example")).toBe("live");
    expect(getStripeMode("rk_live_example")).toBe("live");
    expect(getStripeMode("")).toBe("unknown");
  });

  it("never selects a live price ID when a test secret is configured", () => {
    expect(selectStripeModeValue({
      secret: "sk_test_example",
      testFallback: "price_test_fallback",
      liveValue: "price_live_value",
    })).toBe("price_test_fallback");
  });

  it("prefers an explicit test override over the verified fallback", () => {
    expect(selectStripeModeValue({
      secret: "sk_test_example",
      testOverride: "price_test_override",
      testFallback: "price_test_fallback",
      liveValue: "price_live_value",
    })).toBe("price_test_override");
  });

  it("uses the live value for a live secret and preserves intentional empty test fallbacks", () => {
    expect(selectStripeModeValue({
      secret: "sk_live_example",
      testFallback: "price_test_fallback",
      liveValue: "price_live_value",
    })).toBe("price_live_value");
    expect(selectStripeModeValue({
      secret: "sk_test_example",
      testFallback: "",
      liveValue: "price_live_value",
    })).toBe("");
  });

  it("includes verified test fallbacks for every static checkout price", () => {
    expect(STRIPE_TEST_FALLBACKS.ARTIST_BASIC_ANNUAL).toMatch(/^price_/);
    expect(STRIPE_TEST_FALLBACKS.ARTIST_PRO_ANNUAL).toMatch(/^price_/);
    expect(STRIPE_TEST_FALLBACKS.CLIENT_JOB_UNLOCK).toMatch(/^price_/);
    expect(STRIPE_TEST_FALLBACKS.CLIENT_PREMIUM_MONTHLY).toMatch(/^price_/);
    expect(STRIPE_TEST_FALLBACKS.CLIENT_PREMIUM_ANNUAL).toMatch(/^price_/);
    expect(STRIPE_TEST_FALLBACKS.ENTERPRISE_ON_DEMAND).toMatch(/^price_/);
  });

  it("wires the configured test environment to test-mode prices, never live fallbacks", () => {
    if (getStripeMode() !== "test") return;
    expect(STRIPE_PRODUCTS.ARTIST_BASIC.annual.priceId).toBe(STRIPE_TEST_FALLBACKS.ARTIST_BASIC_ANNUAL);
    expect(STRIPE_PRODUCTS.ARTIST_PRO.annual.priceId).toBe(STRIPE_TEST_FALLBACKS.ARTIST_PRO_ANNUAL);
    expect(STRIPE_PRODUCTS.CLIENT_JOB_UNLOCK.priceId).toBe(STRIPE_TEST_FALLBACKS.CLIENT_JOB_UNLOCK);
    expect(STRIPE_PRODUCTS.CLIENT_PREMIUM.monthly.priceId).toBe(STRIPE_TEST_FALLBACKS.CLIENT_PREMIUM_MONTHLY);
    expect(STRIPE_PRODUCTS.CLIENT_PREMIUM.annual.priceId).toBe(STRIPE_TEST_FALLBACKS.CLIENT_PREMIUM_ANNUAL);
    expect(STRIPE_PRODUCTS.ENTERPRISE_ON_DEMAND.priceId).toBe(STRIPE_TEST_FALLBACKS.ENTERPRISE_ON_DEMAND);
    expect(STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.monthly.priceId).toBe("");
    expect(STRIPE_PRODUCTS.ENTERPRISE_SUBSCRIPTION.annual.priceId).toBe("");
  });
});
