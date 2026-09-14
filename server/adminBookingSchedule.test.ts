/**
 * Weekly class bookings: one week per class day, with the "Complete Your
 * Booking" reminder on each class day at an Eastern wall-clock time.
 */
import { describe, it, expect } from "vitest";
import { easternDateTimeToUtc, utcDateString } from "../shared/adminBookingSchedule";
import { computeAdminPeriods } from "./db";

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
