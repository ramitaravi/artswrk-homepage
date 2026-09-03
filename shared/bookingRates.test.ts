/**
 * Locks in the two rules that keep getting broken around booking money.
 * Every case here is a real shape from production data.
 */
import { describe, it, expect } from "vitest";
import { isHourlyBooking, resolveBookingBaseAmount, resolveInvoiceTotals, processingFeeFor, PROCESSING_FEE_RATE } from "./bookingRates";

describe("hourly vs flat is read, never inferred", () => {
  it("a flat booking that also records hours is NOT hourly", () => {
    // 365 real bookings look exactly like this. Inferring from `hours` here is
    // what charged a $3,600 flat booking as $734,400.
    expect(isHourlyBooking({ isHourlyRate: 0, storedHours: 204 })).toBe(false);
  });

  it("an hourly booking is hourly regardless of hours being absent", () => {
    expect(isHourlyBooking({ isHourlyRate: 1, storedHours: null })).toBe(true);
  });

  it("treats a missing flag as flat rather than guessing from hours", () => {
    expect(isHourlyBooking({ storedHours: 12 })).toBe(false);
  });
});

describe("stored rates are TOTALS and must never be multiplied", () => {
  it("flat booking with many hours charges the stored total", () => {
    // booking 64720: flat, 204 hrs, stored total $3,600.
    const amount = resolveBookingBaseAmount(
      { isHourlyRate: 0, storedTotal: 3600, storedHours: 204 },
      204
    );
    expect(amount).toBe(3600);
    expect(amount).not.toBe(3600 * 204);
  });

  it("hourly booking with unchanged hours charges the stored total, not total x hours", () => {
    // booking 30669: $50/hr x 5 hrs, stored as 250.
    const amount = resolveBookingBaseAmount(
      { isHourlyRate: 1, storedTotal: 250, unitHourlyRate: 50, storedHours: 5 },
      5
    );
    expect(amount).toBe(250);
    expect(amount).not.toBe(250 * 5);
  });

  it("recomputes from the PER-HOUR rate when the studio changes hours", () => {
    const amount = resolveBookingBaseAmount(
      { isHourlyRate: 1, storedTotal: 250, unitHourlyRate: 50, storedHours: 5 },
      7
    );
    expect(amount).toBe(350); // 50 x 7 — not 250 x 7
  });

  it("does NOT reprice a flat booking when hours change", () => {
    const amount = resolveBookingBaseAmount(
      { isHourlyRate: 0, storedTotal: 190, storedHours: 1.5 },
      4
    );
    expect(amount).toBe(190);
  });

  it("falls back to the stored total when no per-hour rate is on file", () => {
    const amount = resolveBookingBaseAmount(
      { isHourlyRate: 1, storedTotal: 250, unitHourlyRate: null, storedHours: 5 },
      9
    );
    expect(amount).toBe(250);
  });
});

describe("invoice totals", () => {
  it("adds reimbursements and the processing fee to the base", () => {
    const t = resolveInvoiceTotals(
      { isHourlyRate: 1, storedTotal: 100, unitHourlyRate: 50, storedHours: 2 },
      { adjustedHours: 2, reimbursements: 15, feeRate: 0.05 }
    );
    expect(t.baseAmount).toBe(100);
    expect(t.reimbursements).toBe(15);
    expect(t.processingFee).toBe(6); // 5% of 115
    expect(t.total).toBe(121);
    expect(t.total).toBe(t.baseAmount + t.reimbursements + t.processingFee);
  });

  it("charges no fee when the fee rate is zero (legacy bookings)", () => {
    const t = resolveInvoiceTotals(
      { isHourlyRate: 0, storedTotal: 100, storedHours: 2 },
      { reimbursements: 15, feeRate: 0 }
    );
    expect(t.processingFee).toBe(0);
    expect(t.total).toBe(115);
  });
});

describe("processing fee", () => {
  it("is 5%, the rate quoted to studios", () => {
    expect(PROCESSING_FEE_RATE).toBe(0.05);
  });

  it("matches what a studio is told they'll pay", () => {
    // Rosemary's two real applicants on job 2880001.
    expect(processingFeeFor(300)).toBe(15);   // pays $315
    expect(processingFeeFor(800)).toBe(40);   // pays $840
  });

  it("adds the fee on top rather than deducting it from the artist", () => {
    const t = resolveInvoiceTotals(
      { isHourlyRate: 0, storedTotal: 300 },
      { reimbursements: 0 },
    );
    expect(t.baseAmount).toBe(300);      // artist receives 100%
    expect(t.processingFee).toBe(15);
    expect(t.total).toBe(315);           // client pays base + fee
  });

  it("charges the fee on reimbursements too", () => {
    const t = resolveInvoiceTotals(
      { isHourlyRate: 0, storedTotal: 300 },
      { reimbursements: 100 },
    );
    expect(t.processingFee).toBe(20);    // 5% of 400
    expect(t.total).toBe(420);
  });
});
