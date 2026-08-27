import { describe, expect, it } from "vitest";
import { paymentInteger, paymentText } from "../scripts/sync-payments-once";

describe("payment reconciliation helpers", () => {
  it("preserves Bubble cent values as integers", () => {
    expect(paymentInteger("1250")).toBe(1250);
    expect(paymentInteger(42.6)).toBe(43);
    expect(paymentInteger("bad")).toBeNull();
  });

  it("bounds Stripe and source identifiers", () => {
    expect(paymentText("  ch_123  ", 128)).toBe("ch_123");
    expect(paymentText("abcdef", 4)).toBe("abcd");
    expect(paymentText(null, 4)).toBeNull();
  });
});
