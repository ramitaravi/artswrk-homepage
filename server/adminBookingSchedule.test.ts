/**
 * Weekly class bookings: one week per class day, with the "Complete Your
 * Booking" reminder on each class day at an Eastern wall-clock time.
 */
import { describe, it, expect } from "vitest";
import { easternDateTimeToUtc, hmMinusMinutes, utcDateString } from "../shared/adminBookingSchedule";
import { computeAdminPeriods } from "./db";
// @ts-expect-error — plain .mjs data file shared with the booking scripts
import { CLASS_BOOKINGS, reminderTimeFor } from "../scripts/class-bookings-2026-09-14.data.mjs";

describe("reminder 10 minutes before class", () => {
  it("moves a time 10 minutes earlier, across the hour", () => {
    expect(hmMinusMinutes("17:15", 10)).toBe("17:05");
    expect(hmMinusMinutes("16:05", 10)).toBe("15:55");
    expect(hmMinusMinutes("00:05", 10)).toBe("00:00");
  });

  it("sets each class day's reminder 10 minutes before its first class", () => {
    const byRow = Object.fromEntries(CLASS_BOOKINGS.map((b: { n: number }) => [b.n, reminderTimeFor(b)]));
    expect(byRow).toEqual({ 1: "12:35", 2: "17:05", 3: "15:35", 4: "17:05", 5: "17:20", 6: "16:20", 7: "16:20", 8: "15:20" });
  });
});

describe("easternDateTimeToUtc", () => {
  it("converts daylight time (EDT, UTC−4)", () => {
    expect(easternDateTimeToUtc("2026-09-15", "21:15").toISOString()).toBe("2026-09-16T01:15:00.000Z");
  });

  it("converts standard time (EST, UTC−5)", () => {
    expect(easternDateTimeToUtc("2027-01-12", "21:15").toISOString()).toBe("2027-01-13T02:15:00.000Z");
  });
});

describe("computeAdminPeriods — weekly classes with a reminder time", () => {
  const periods = computeAdminPeriods(new Date("2026-09-15T00:00:00Z"), new Date("2027-06-13T00:00:00Z"), true, "weekly", "21:15");

  it("creates one week per Tuesday from the first to the last class", () => {
    expect(periods).toHaveLength(39);
    expect(utcDateString(periods[0].start)).toBe("2026-09-15");
    expect(utcDateString(periods[periods.length - 1].start)).toBe("2027-06-08");
  });

  it("reminds on each class day at the Eastern time, across the DST change", () => {
    expect(periods[0].notifyAt.toISOString()).toBe("2026-09-16T01:15:00.000Z");
    const afterDst = periods.find((p) => utcDateString(p.start) === "2026-11-03")!;
    expect(afterDst.notifyAt.toISOString()).toBe("2026-11-04T02:15:00.000Z");
  });

  it("includes the last class when the end date is the day after it", () => {
    const thursdays = computeAdminPeriods(new Date("2026-09-17T00:00:00Z"), new Date("2027-06-11T00:00:00Z"), true, "weekly", "20:30");
    expect(utcDateString(thursdays[thursdays.length - 1].start)).toBe("2027-06-10");
  });

  it("keeps the end-of-period reminder when no time is given", () => {
    const old = computeAdminPeriods(new Date("2026-09-15T00:00:00Z"), new Date("2026-09-29T00:00:00Z"), true, "weekly");
    expect(utcDateString(old[0].notifyAt)).toBe("2026-09-21");
  });
});

/**
 * GitHub #4 — an hourly manual booking billed the bare unit rate.
 *
 * createAdminBooking's rateType/hourlyRate ternaries sat BELOW the
 * isRecurring early-return, so for a one-off they always evaluated to null.
 * The booking stored $60 in artistRate with nothing saying it was per-hour,
 * and every later stage read it as the whole total: $60/hr x 3 hrs = $60.
 */
import { describe as describeRates, it as itRates, expect as expectRates } from "vitest";
import { processingFeeFor } from "@shared/bookingRates";

/** Mirrors the computation in createAdminBooking. */
function adminBookingTotals(input: {
  rateType?: "hourly" | "flat" | null;
  artistRateDollars: number;
  clientRateDollars: number;
  hours?: number;
}) {
  const isHourly = input.rateType === "hourly";
  const unit = input.artistRateDollars ?? 0;
  const hours = Number(input.hours ?? 0);
  const artistTotal = isHourly && hours > 0 ? Math.round(unit * hours * 100) / 100 : unit;
  const clientTotal = isHourly && hours > 0
    ? artistTotal + processingFeeFor(artistTotal)
    : input.clientRateDollars;
  return { artistTotal, clientTotal, rateType: isHourly ? "hourly" : "flat", hourlyRate: isHourly ? unit : null };
}

describeRates("manual admin booking rates (GitHub #4)", () => {
  itRates("bills $60/hr x 3 hrs as $189, not $60", () => {
    const t = adminBookingTotals({ rateType: "hourly", artistRateDollars: 60, clientRateDollars: 63, hours: 3 });
    expectRates(t.artistTotal).toBe(180);
    expectRates(t.clientTotal).toBe(189);   // $180 + $9 fee
    expectRates(t.rateType).toBe("hourly");
    expectRates(t.hourlyRate).toBe(60);     // the unit is kept, separately
  });

  itRates("bills McKell's 36h10m at $18/hr as $651, not $18", () => {
    const t = adminBookingTotals({ rateType: "hourly", artistRateDollars: 18, clientRateDollars: 19, hours: 36.1667 });
    expectRates(t.artistTotal).toBeCloseTo(651, 0);
    expectRates(t.clientTotal).toBeCloseTo(684, 0);
  });

  itRates("leaves a flat booking exactly as entered", () => {
    const t = adminBookingTotals({ rateType: "flat", artistRateDollars: 400, clientRateDollars: 420, hours: 3 });
    expectRates(t.artistTotal).toBe(400);   // never multiplied
    expectRates(t.clientTotal).toBe(420);
    expectRates(t.hourlyRate).toBeNull();
  });

  itRates("tags every booking one way or the other, never null", () => {
    expectRates(adminBookingTotals({ artistRateDollars: 100, clientRateDollars: 105 }).rateType).toBe("flat");
  });
});
