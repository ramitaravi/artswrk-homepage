import { describe, it, expect } from "vitest";
import { isStillHiring } from "./stillHiring";

const now = new Date("2026-09-21T18:00:00.000Z");

describe("isStillHiring", () => {
  it("keeps any job that hasn't started yet, or has no start date", () => {
    expect(isStillHiring({ dateType: "Single Date", startDate: "2026-09-25T20:00:00.000Z" }, now)).toBe(true);
    expect(isStillHiring({ dateType: "Single Date", startDate: null }, now)).toBe(true);
  });

  it("drops a one-off job whose date has passed", () => {
    expect(isStillHiring({ dateType: "Single Date", startDate: "2026-09-03T20:00:00.000Z" }, now)).toBe(false);
    expect(isStillHiring({ dateType: null, startDate: "2026-09-10T00:00:00.000Z" }, now)).toBe(false);
  });

  it("keeps a weekly job after its first class — it's still hiring for the season", () => {
    // Renner Dance: weekly from Sep 8, season runs to spring.
    expect(isStillHiring({ dateType: "Weekly", startDate: "2026-09-08T00:00:00.000Z", endDate: "2027-05-30T00:00:00.000Z" }, now)).toBe(true);
    expect(isStillHiring({ dateType: "Weekly", startDate: "2026-09-14T00:00:00.000Z", endDate: null }, now)).toBe(true);
  });

  it("treats Ongoing, Flexible and Recurring jobs the same way", () => {
    for (const dateType of ["Ongoing", "Dates Flexible", "Recurring"]) {
      expect(isStillHiring({ dateType, startDate: "2026-09-01T00:00:00.000Z" }, now)).toBe(true);
    }
  });

  it("drops a weekly job once its season has ended", () => {
    expect(isStillHiring({ dateType: "Weekly", startDate: "2026-01-05T00:00:00.000Z", endDate: "2026-06-01T00:00:00.000Z" }, now)).toBe(false);
  });

  it("ignores an end date that's before the start (Norwalk's 'May 2026')", () => {
    expect(isStillHiring({ dateType: "Weekly", startDate: "2026-09-16T20:15:00.000Z", endDate: "2026-05-26T20:15:00.000Z" }, now)).toBe(true);
  });

  it("keeps a multi-date job while its last date is ahead", () => {
    expect(isStillHiring({ dateType: "Multiple Dates", startDate: "2026-09-14T00:00:00.000Z", endDate: "2026-10-05T00:00:00.000Z" }, now)).toBe(true);
    expect(isStillHiring({ dateType: "Multiple Dates", startDate: "2026-09-01T00:00:00.000Z", endDate: "2026-09-10T00:00:00.000Z" }, now)).toBe(false);
    expect(isStillHiring({ dateType: "Multiple Dates", startDate: "2026-09-14T00:00:00.000Z", endDate: null }, now)).toBe(false);
  });
});
