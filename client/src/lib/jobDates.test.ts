/**
 * Job start/end values are real instants (the form converts the hirer's local
 * time to UTC; Bubble did too). Times show in the viewer's zone; a date picked
 * with no time shows as that date only, in every zone.
 */
import { describe, it, expect } from "vitest";
import { formatJobCardDate, formatJobDateLong, formatWeeklySchedule } from "./jobDates";

const NY = { timeZone: "America/New_York" };
const LA = { timeZone: "America/Los_Angeles" };

describe("formatWeeklySchedule", () => {
  it("reads as a weekly class in the studio's local time (job 3120001: 4:45 PM, stored 20:45Z)", () => {
    expect(formatWeeklySchedule({ startDate: "2026-09-23T20:45:00.000Z", endDate: "2027-06-23T22:15:00.000Z" }, NY))
      .toBe("Weekly · Wednesdays · 4:45–6:15 PM · Sep 23 – Jun 23");
  });

  it("shows a date-only weekly job with no time, on the day picked", () => {
    const job = { startDate: "2026-09-21T00:00:00.000Z", endDate: "2027-05-26T00:00:00.000Z" };
    expect(formatWeeklySchedule(job, NY)).toBe("Weekly · Mondays · Sep 21 – May 26");
    expect(formatWeeklySchedule(job, LA)).toBe("Weekly · Mondays · Sep 21 – May 26");
  });

  it("treats Eastern midnight as date-only too (not '4:00–4:00 AM')", () => {
    expect(formatWeeklySchedule({ startDate: "2026-09-21T04:00:00.000Z", endDate: "2027-06-13T04:00:00.000Z" }, NY))
      .toBe("Weekly · Mondays · Sep 21 – Jun 13");
  });

  it("spells out both meridiems when a class crosses noon", () => {
    expect(formatWeeklySchedule({ startDate: "2026-09-19T15:30:00.000Z", endDate: "2027-05-29T17:00:00.000Z" }, NY))
      .toBe("Weekly · Saturdays · 11:30 AM–1:00 PM · Sep 19 – May 29");
  });

  it("drops an end that isn't after the first class", () => {
    // Norwalk: "May 26, 2026", before a Sep 2026 start.
    expect(formatWeeklySchedule({ startDate: "2026-09-16T16:15:00.000Z", endDate: "2026-05-26T20:15:00.000Z" }, NY))
      .toBe("Weekly · Wednesdays · 12:15–4:15 PM · from Sep 16");
    // Ends the same day it starts.
    expect(formatWeeklySchedule({ startDate: "2026-09-17T00:00:00.000Z", endDate: "2026-09-17T00:00:00.000Z" }, NY))
      .toBe("Weekly · Thursdays · from Sep 17");
  });

  it("copes with missing dates", () => {
    expect(formatWeeklySchedule({}, NY)).toBe("Weekly");
    expect(formatWeeklySchedule({ startDate: "2026-09-16T00:00:00.000Z" }, NY)).toBe("Weekly · Wednesdays · from Sep 16");
  });
});

describe("formatJobCardDate", () => {
  it("shows a Bubble 11:30 AM class as 11:30 AM, not 4:30 PM", () => {
    expect(formatJobCardDate({ startDate: "2026-12-19T16:30:00.000Z" }, NY)).toBe("Sat, 12/19/26, 11:30 AM");
  });

  it("shows the time in the viewer's zone", () => {
    expect(formatJobCardDate({ startDate: "2026-09-17T20:00:00.000Z" }, NY)).toBe("Thu, 9/17/26, 4:00 PM");
    expect(formatJobCardDate({ startDate: "2026-09-17T20:00:00.000Z" }, LA)).toBe("Thu, 9/17/26, 1:00 PM");
  });

  it("shows a date-only job without a fake 8:00 PM, in any zone", () => {
    expect(formatJobCardDate({ dateType: "Single Date", startDate: "2026-09-22T00:00:00.000Z" }, NY)).toBe("Tue, 9/22/26");
    expect(formatJobCardDate({ dateType: "Single Date", startDate: "2026-09-22T00:00:00.000Z" }, LA)).toBe("Tue, 9/22/26");
  });

  it("shows a same-day time range and a multi-day range", () => {
    expect(formatJobCardDate({ startDate: "2026-10-03T13:00:00.000Z", endDate: "2026-10-03T16:00:00.000Z" }, NY))
      .toBe("Sat, 10/3/26, 9:00 AM–12:00 PM");
    expect(formatJobCardDate({ startDate: "2026-10-03T13:00:00.000Z", endDate: "2026-10-05T21:00:00.000Z" }, NY))
      .toBe("Sat, 10/3/26 – Mon, 10/5/26");
  });

  it("uses the weekly schedule and plain labels", () => {
    expect(formatJobCardDate({ dateType: "Weekly", startDate: "2026-09-23T20:45:00.000Z", endDate: "2027-06-23T22:15:00.000Z" }, NY))
      .toBe("Weekly · Wednesdays · 4:45–6:15 PM · Sep 23 – Jun 23");
    expect(formatJobCardDate({ dateType: "Ongoing" })).toBe("Ongoing");
    expect(formatJobCardDate({ dateType: "Dates Flexible" })).toBe("Flexible");
  });
});

describe("formatJobDateLong", () => {
  it("shows the local time for a timed job and no time for a date-only one", () => {
    expect(formatJobDateLong("2026-09-17T20:00:00.000Z", NY)).toBe("Thursday, September 17, 2026 at 4:00 PM");
    expect(formatJobDateLong("2026-09-22T00:00:00.000Z", LA)).toBe("Tuesday, September 22, 2026");
    expect(formatJobDateLong(null)).toBe("Flexible");
  });
});
