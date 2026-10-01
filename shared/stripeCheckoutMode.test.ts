import { describe, expect, it } from "vitest";
import { assertProductionStripeMode, canReuseCheckoutUrl, checkoutUrlMode } from "./stripeCheckoutMode";

const testUrl = "https://checkout.stripe.com/c/pay/cs_test_abcdef#fragment";
const liveUrl = "https://checkout.stripe.com/c/pay/cs_live_ghijkl#fragment";

describe("mode-scoped Stripe Checkout links", () => {
  it("detects real Stripe test and live Checkout session URLs", () => {
    expect(checkoutUrlMode(testUrl)).toBe("test");
    expect(checkoutUrlMode(liveUrl)).toBe("live");
    expect(checkoutUrlMode("https://evil.example/c/pay/cs_live_abcdef")).toBe("unknown");
    expect(checkoutUrlMode("not a URL")).toBe("unknown");
  });

  it("reuses only a Checkout link belonging to the active Stripe mode", () => {
    expect(canReuseCheckoutUrl(testUrl, "test")).toBe(true);
    expect(canReuseCheckoutUrl(testUrl, "live")).toBe(false);
    expect(canReuseCheckoutUrl(liveUrl, "live")).toBe(true);
    expect(canReuseCheckoutUrl(liveUrl, "test")).toBe(false);
    expect(canReuseCheckoutUrl(liveUrl, "unknown")).toBe(false);
  });

  it("blocks production payments in test or unknown mode without affecting local test-mode development", () => {
    expect(() => assertProductionStripeMode("test", "production")).toThrow(/live Stripe configuration/);
    expect(() => assertProductionStripeMode("unknown", "production")).toThrow(/live Stripe configuration/);
    expect(() => assertProductionStripeMode("test", "development")).not.toThrow();
    expect(() => assertProductionStripeMode("live", "production")).not.toThrow();
  });
});
