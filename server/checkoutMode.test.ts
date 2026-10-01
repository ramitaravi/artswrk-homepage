/**
 * A stored Checkout URL is only reusable if this server could have created it.
 *
 * Development runs against the live database with a test Stripe key, so
 * approving an invoice locally wrote a cs_test_ URL onto a real booking. The
 * studio clicked Pay Now days later and Stripe told them their card was
 * declined because the request was in test mode.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const loadWithKey = async (key: string) => {
  vi.resetModules();
  process.env.STRIPE_SECRET_KEY = key;
  return (await import("./stripe")).checkoutUrlMatchesMode;
};

afterEach(() => { vi.resetModules(); });

describe("checkoutUrlMatchesMode", () => {
  it("refuses a test session when the server is live", async () => {
    const matches = await loadWithKey("sk_live_example");
    expect(matches("https://checkout.stripe.com/c/pay/cs_test_a1b2c3")).toBe(false);
    expect(matches("https://checkout.stripe.com/c/pay/cs_live_a1b2c3")).toBe(true);
  });

  it("refuses a live session when the server is in test mode", async () => {
    const matches = await loadWithKey("sk_test_example");
    expect(matches("https://checkout.stripe.com/c/pay/cs_live_a1b2c3")).toBe(false);
    expect(matches("https://checkout.stripe.com/c/pay/cs_test_a1b2c3")).toBe(true);
  });

  it("refuses anything this app did not create, and empty values", async () => {
    const matches = await loadWithKey("sk_live_example");
    // Bubble-era payment links live in this column on migrated bookings.
    expect(matches("https://buy.stripe.com/old_bubble_link")).toBe(false);
    expect(matches(null)).toBe(false);
    expect(matches(undefined)).toBe(false);
    expect(matches("")).toBe(false);
  });
});
