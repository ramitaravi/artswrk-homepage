/**
 * The studio is shown exactly what their card will be charged.
 *
 * Every payment bug this week came from the same shape of mistake: money
 * worked out in two places that then disagreed. The invoice page multiplied
 * artistRate by the hours, but artistRate is a TOTAL — Michael Charles's
 * 4 hours at $50/hr stores $200, so the page offered "Pay $840.00 now" for a
 * booking the server charges $210 for.
 *
 * These cases run the SAME function the charge is built from
 * (resolveInvoiceTotals, used by invoice.approve), with real bookings from the
 * live database, so a preview can never again quote a different number from
 * the charge.
 */
import { describe, expect, it } from "vitest";
import { resolveInvoiceTotals } from "./bookingRates";

describe("what the studio is shown is what they pay", () => {
  it("Michael Charles · Fancy Feet · 4 hrs at $50/hr — $210, never $840", () => {
    // booking 1230001 as it is stored: the rate is the total, not per hour.
    const totals = resolveInvoiceTotals(
      { isHourlyRate: 1, storedTotal: 200, unitHourlyRate: null, storedHours: 4 },
      { adjustedHours: 4, reimbursements: 0 },
    );
    expect(totals.baseAmount).toBe(200);
    expect(totals.processingFee).toBe(10);
    expect(totals.total).toBe(210);
  });

  it("recomputes from the unit rate only when the studio changes the hours", () => {
    const basis = { isHourlyRate: 1, storedTotal: 200, unitHourlyRate: 50, storedHours: 4 };
    // Unchanged: the agreed total stands, whatever the unit rate implies.
    expect(resolveInvoiceTotals(basis, { adjustedHours: 4 }).baseAmount).toBe(200);
    // The artist actually taught 5: $50 × 5.
    expect(resolveInvoiceTotals(basis, { adjustedHours: 5 }).baseAmount).toBe(250);
    expect(resolveInvoiceTotals(basis, { adjustedHours: 5 }).total).toBe(263);
  });

  it("a flat booking that happens to record hours is never multiplied", () => {
    // 365 live bookings are flat-rate with hours recorded. Treating "has hours"
    // as "hourly" would have billed those studios several times over.
    const totals = resolveInvoiceTotals(
      { isHourlyRate: 0, storedTotal: 450, unitHourlyRate: null, storedHours: 9 },
      { adjustedHours: 9 },
    );
    expect(totals.baseAmount).toBe(450);
    expect(totals.total).toBe(473);
  });

  it("reimbursements are charged, and the fee covers them too", () => {
    // Marlon's weekly class: 3 hrs at $80 plus $36 of travel.
    const totals = resolveInvoiceTotals(
      { isHourlyRate: 1, storedTotal: 240, unitHourlyRate: 80, storedHours: 3 },
      { adjustedHours: 3, reimbursements: 36 },
    );
    expect(totals.baseAmount).toBe(240);
    expect(totals.reimbursements).toBe(36);
    expect(totals.total).toBe(290);
  });
});
