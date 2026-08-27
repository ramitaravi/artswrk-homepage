import { describe, expect, it } from "vitest";
import { bookingDollarsToCents } from "./db";

describe("admin overview Bubble reconciliation", () => {
  it("converts Bubble dollar values to the cents-based dashboard contract", () => {
    expect(bookingDollarsToCents(989481.38)).toBe(98948138);
    expect(bookingDollarsToCents("55188.444715")).toBe(5518844);
    expect(bookingDollarsToCents(null)).toBe(0);
  });
});
