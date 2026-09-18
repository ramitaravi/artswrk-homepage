/**
 * Ramita's spec, 2026-09-17: every booking is an hourly rate x hours, or a flat
 * rate. One rate, no artist/client conversion. The artist receives their full
 * rate plus reimbursements; the studio pays that plus a 5% processing fee.
 *
 * The worked examples are the real bookings that exposed the bug.
 */
import { describe, it, expect } from "vitest";
import { bookingMoney } from "./bookingRates";

describe("bookingMoney — hourly", () => {
  it("McKell's Thursday: $55/hr x 4.75 hrs", () => {
    const m = bookingMoney({ rateType: "hourly", hourlyRate: 55, hours: 4.75 });
    expect(m.base).toBe(261.25);
    expect(m.artistTotal).toBe(261.25);
    expect(m.processingFee).toBe(13); // 5% of 261.25, to whole dollars
    expect(m.clientTotal).toBe(274.25);
  });

  it("Kaylee's Sep 14: $50/hr x 4 hrs + $75 expenses — the invoice that went wrong", () => {
    const m = bookingMoney({ rateType: "hourly", hourlyRate: 50, hours: 4 }, { reimbursements: 75 });
    expect(m.base).toBe(200);
    expect(m.artistTotal).toBe(275);
    expect(m.processingFee).toBe(14);
    expect(m.clientTotal).toBe(289);
    // The bug billed $131: the rate was treated as the whole day's pay.
    expect(m.clientTotal).not.toBe(131);
  });

  it("uses the hours the artist actually entered, not the scheduled ones", () => {
    const rates = { rateType: "hourly" as const, hourlyRate: 80, hours: 3 };
    expect(bookingMoney(rates).artistTotal).toBe(240);
    expect(bookingMoney(rates, { hoursOverride: 2 }).artistTotal).toBe(160);
    expect(bookingMoney(rates, { hoursOverride: 4.5 }).artistTotal).toBe(360);
  });

  it("charges the studio the same rate as the artist, plus the fee", () => {
    const m = bookingMoney({ rateType: "hourly", hourlyRate: 45, hours: 5.75 });
    expect(m.artistTotal).toBe(258.75);
    expect(m.clientTotal).toBe(258.75 + 13);
  });

  it("never multiplies reimbursements by hours", () => {
    const m = bookingMoney({ rateType: "hourly", hourlyRate: 50, hours: 4 }, { reimbursements: 20 });
    expect(m.artistTotal).toBe(220);
  });
});

describe("bookingMoney — flat", () => {
  it("pays the flat rate and never multiplies by hours", () => {
    const m = bookingMoney({ rateType: "flat", flatRate: 425, hours: 22.5 });
    expect(m.artistTotal).toBe(425);
    expect(m.clientTotal).toBe(425 + 21);
    expect(m.hours).toBe(0);
  });

  it("Kaylee's top-up booking: flat $150 + 5% = $158", () => {
    const m = bookingMoney({ rateType: "flat", flatRate: 150 });
    expect(m.artistTotal).toBe(150);
    expect(m.clientTotal).toBe(158);
  });

  it("adds reimbursements to both sides, with the fee on the studio's", () => {
    const m = bookingMoney({ rateType: "flat", flatRate: 150 }, { reimbursements: 20 });
    expect(m.artistTotal).toBe(170);
    expect(m.processingFee).toBe(9); // 5% of 170
    expect(m.clientTotal).toBe(179);
  });
});

describe("bookingMoney — legacy Bubble rows with no rate type", () => {
  it("treats the stored rate as a total, and keeps the old studio total", () => {
    const m = bookingMoney({ legacyArtistTotal: 225, legacyClientTotal: 236, hours: 3 });
    expect(m.rateType).toBe("flat");
    expect(m.artistTotal).toBe(225);       // never 225 x 3
    expect(m.clientTotal).toBe(236 + 12);  // the old converted rate is preserved
  });

  it("reads as hourly when an hourly rate is present without a type", () => {
    const m = bookingMoney({ hourlyRate: 45, hours: 5.75 });
    expect(m.rateType).toBe("hourly");
    expect(m.artistTotal).toBe(258.75);
  });

  it("falls back to the artist total when no studio total was stored", () => {
    const m = bookingMoney({ legacyArtistTotal: 100 });
    expect(m.artistTotal).toBe(100);
    expect(m.clientTotal).toBe(105);
  });
});
