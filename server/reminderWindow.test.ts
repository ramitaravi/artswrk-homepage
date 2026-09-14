/**
 * Reminders go out on the Eastern day of the booking only. These pin the day
 * bounds the SQL uses; scripts/verify-reminder-window-2026-09-14.mjs runs the
 * SQL itself against sample rows in the database.
 */
import { describe, it, expect } from "vitest";
import { reminderWindow, easternDateString, completionReminderDueSql } from "./reminderWindow";

describe("reminderWindow", () => {
  it("uses the Eastern date, not the UTC date, late in the evening", () => {
    // 9:30 PM EDT on Tue Sep 15 is already Wed Sep 16 in UTC.
    const w = reminderWindow(new Date("2026-09-16T01:30:00Z"));
    expect(w.today).toBe("2026-09-15");
    expect(w.dayStart).toBe("2026-09-15 04:00:00");
    expect(w.dayEnd).toBe("2026-09-16 04:00:00");
  });

  it("covers an afternoon in daylight time and adds the 10-minute lead", () => {
    const w = reminderWindow(new Date("2026-09-15T21:06:00Z")); // 5:06 PM EDT
    expect(w.today).toBe("2026-09-15");
    expect(w.now).toBe("2026-09-15 21:06:00");
    expect(w.leadUntil).toBe("2026-09-15 21:16:00");
  });

  it("uses standard time in winter", () => {
    const w = reminderWindow(new Date("2027-01-12T22:00:00Z")); // 5:00 PM EST
    expect(w.today).toBe("2027-01-12");
    expect(w.dayStart).toBe("2027-01-12 05:00:00");
    expect(w.dayEnd).toBe("2027-01-13 05:00:00");
  });

  it("is 25 hours long on the day clocks fall back", () => {
    const w = reminderWindow(new Date("2026-11-01T15:00:00Z"));
    expect(w.dayStart).toBe("2026-11-01 04:00:00");
    expect(w.dayEnd).toBe("2026-11-02 05:00:00");
  });

  it("just after Eastern midnight, yesterday is already out of the window", () => {
    const w = reminderWindow(new Date("2026-09-16T04:05:00Z")); // 12:05 AM EDT Wed
    expect(w.today).toBe("2026-09-16");
    expect(w.dayStart).toBe("2026-09-16 04:00:00");
  });

  it("formats Eastern dates", () => {
    expect(easternDateString(new Date("2026-09-15T03:59:00Z"))).toBe("2026-09-14");
    expect(easternDateString(new Date("2026-09-15T04:00:00Z"))).toBe("2026-09-15");
  });

  it("puts every bound into the one-time reminder condition", () => {
    const w = reminderWindow(new Date("2026-09-15T21:06:00Z"));
    const sql = completionReminderDueSql(w);
    expect(sql).toContain(">= '2026-09-15 04:00:00'");
    expect(sql).toContain("< '2026-09-16 04:00:00'");
    expect(sql).toContain("<= '2026-09-15 21:16:00'");
    expect(sql).toContain("DATE(b.startDate) = '2026-09-15'");
    expect(sql).not.toContain("NOW()");
  });
});
