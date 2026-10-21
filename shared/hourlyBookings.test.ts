/**
 * The hourly-booking rule, pinned against the three live rows that disagree.
 *
 * `rateType = 'hourly'` means the base is hourlyRate x hours. It does NOT mean
 * artistRate is a unit rate: an admin booking copies the unit rate into both
 * columns, while a confirmed applicant stores the whole total in artistRate.
 * Reading the wrong column turned $195 into $633.75 in one direction and $651
 * into $18 in the other — both of them amounts charged to a studio's card.
 */
import { describe, it, expect } from "vitest";
import { isHourlyRateBooking, maxInvoiceHours, formatHours, bookingMoney, bookingRateLabel } from "./bookingRates";

// Verified against production on 2026-10-08.
const MCKELL_ADMIN = {            // 36h10m of studio admin, no applicant record
  id: 1350001, rateType: "hourly", hourlyRate: 18, artistRate: 18,
  hours: 36.166666666666664, isAdminBooking: 1, isRecurring: 0, recurringSeriesId: null,
};
const CONFIRMED_APPLICANT = {     // artistRate holds the TOTAL, 60 x 3.25
  id: 1320001, rateType: "hourly", hourlyRate: 60, artistRate: 195,
  hours: 3.25, isAdminBooking: 0, isRecurring: 0, recurringSeriesId: null,
};
const CLASS_DATE = {              // one date of a weekly class
  id: 1200081, rateType: "hourly", hourlyRate: 55, artistRate: 55,
  hours: 4.75, isAdminBooking: 1, isRecurring: 0, recurringSeriesId: 1200079,
};
const FLAT = { id: 999, rateType: "flat", hourlyRate: null, artistRate: 3600, hours: 8 };

describe("isHourlyRateBooking", () => {
  it("catches an hourly admin booking with no series behind it", () => {
    expect(isHourlyRateBooking(MCKELL_ADMIN as any)).toBe(true);
  });

  it("catches class dates and confirmed hourly applicants", () => {
    expect(isHourlyRateBooking(CLASS_DATE as any)).toBe(true);
    expect(isHourlyRateBooking(CONFIRMED_APPLICANT as any)).toBe(true);
  });

  it("leaves flat and legacy bookings alone", () => {
    expect(isHourlyRateBooking(FLAT as any)).toBe(false);
    expect(isHourlyRateBooking({ artistRate: 250, hours: 5 } as any)).toBe(false);
    expect(isHourlyRateBooking(null)).toBe(false);
  });
});

describe("what each live booking is worth", () => {
  const base = (b: any, hoursOverride?: number) =>
    bookingMoney({ rateType: b.rateType as any, hourlyRate: b.hourlyRate, hours: b.hours },
      hoursOverride != null ? { hoursOverride } : {}).base;

  it("McKell's 36h10m of admin at $18/hr is $651, not $18", () => {
    expect(base(MCKELL_ADMIN)).toBeCloseTo(651, 2);
  });

  it("a confirmed applicant's total is unchanged — $195, not $633.75", () => {
    expect(base(CONFIRMED_APPLICANT)).toBeCloseTo(195, 2);
    expect(CONFIRMED_APPLICANT.artistRate * CONFIRMED_APPLICANT.hours).toBeCloseTo(633.75, 2);
  });

  it("a class date is still rate x hours", () => {
    expect(base(CLASS_DATE)).toBeCloseTo(261.25, 2);
  });

  it("follows the studio when they adjust the hours", () => {
    expect(base(CONFIRMED_APPLICANT, 4)).toBeCloseTo(240, 2);
  });
});

describe("maxInvoiceHours", () => {
  it("lets an admin booking bill a whole period of work", () => {
    // A flat 24 left McKell's Submit button permanently disabled.
    expect(MCKELL_ADMIN.hours).toBeLessThan(maxInvoiceHours(MCKELL_ADMIN as any));
  });

  it("still catches a typo on a single class date", () => {
    expect(maxInvoiceHours(CLASS_DATE as any)).toBe(24);
  });
});

describe("formatHours", () => {
  it("writes 36h10m the way a person would", () => {
    expect(formatHours(36.166666666666664)).toBe("36.17");
  });

  it("leaves clean numbers clean", () => {
    expect(formatHours(4)).toBe("4");
    expect(formatHours(4.75)).toBe("4.75");
    expect(formatHours(null)).toBe("");
  });
});

/**
 * What the studio is actually charged, end to end.
 *
 * The processing fee is rounded to WHOLE DOLLARS, which is easy to forget when
 * quoting a total: $261.25 x 5% is $13.06 and the studio was charged $13.00
 * (bookings 1200079 and 1200080, both paid).
 */
describe("the studio's side of McKell's admin invoice", () => {
  const money = (hours: number) =>
    bookingMoney({ rateType: "hourly", hourlyRate: 18, hours }, {});

  it("charges $684 for 36h10m at $18/hr", () => {
    const m = money(36.166666666666664);
    expect(m.base).toBeCloseTo(651, 2);
    expect(m.artistTotal).toBeCloseTo(651, 2);   // McKell receives her full rate
    expect(m.processingFee).toBe(33);            // whole dollars, not $32.55
    expect(m.clientTotal).toBeCloseTo(684, 2);
  });

  it("reproduces the two class dates the studio has already paid", () => {
    const paid = bookingMoney({ rateType: "hourly", hourlyRate: 55, hours: 4.75 }, {});
    expect(paid.clientTotal).toBeCloseTo(274.25, 2);  // matches booking 1200079
    const shorter = bookingMoney({ rateType: "hourly", hourlyRate: 55, hours: 3 }, {});
    expect(shorter.clientTotal).toBeCloseTo(173, 2);  // matches booking 1200041
  });

  it("submitting the rounded 36.17 costs the studio the same $684", () => {
    // The display rounds; the fee rounds harder, so the six cents never shows.
    expect(money(36.17).clientTotal).toBeCloseTo(684.06, 2);
    expect(money(36.17).processingFee).toBe(33);
  });
});

describe("bookingRateLabel", () => {
  // Camia Green, Inspirations PAC, 2026-09-22. She pitched $85/hr for a
  // 5-hour sub. Stored correctly; displayed as "$425/hr".
  const CAMIA = {
    rateType: "hourly", hourlyRate: 85, flatRate: null,
    artistRate: 425, clientRate: 446, hours: 5,
    isAdminBooking: 0, isRecurring: 0, recurringSeriesId: null,
  };

  it("shows Camia's unit rate, never her total, as the per-hour figure", () => {
    const label = bookingRateLabel(CAMIA as any, { side: "artist" });
    expect(label).toContain("$85.00/hr");
    expect(label).not.toContain("$425.00/hr");
    expect(label).toContain("$425.00 total");
  });

  it("adds the processing fee on the studio's side only", () => {
    expect(bookingRateLabel(CAMIA as any, { side: "client" })).toContain("$446.00 total");
    expect(bookingRateLabel(CAMIA as any, { side: "artist" })).toContain("$425.00 total");
  });

  it("never prints /hr for a flat booking", () => {
    const flat = { rateType: "flat", artistRate: 3600, clientRate: 3780, hours: 8 };
    expect(bookingRateLabel(flat as any)).toBe("$3600.00 total");
    expect(bookingRateLabel(flat as any)).not.toContain("/hr");
  });

  it("handles a legacy row whose unit rate lives in artistRate", () => {
    const weekly = { artistRate: 55, hours: 4, isAdminBooking: 1, isRecurring: 1, hourlyRate: null };
    expect(bookingRateLabel(weekly as any, { side: "artist" })).toBe("$55.00/hr · $220.00 total");
  });

  it("says nothing rather than something wrong", () => {
    expect(bookingRateLabel(null)).toBe("");
    expect(bookingRateLabel({ rateType: "flat" } as any)).toBe("");
  });
});
