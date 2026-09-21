/**
 * Weekly class bookings list one row per class date for artists. The dates are
 * stored as UTC midnight (01:00 after the clocks change), so the class day must
 * come out the same in every timezone.
 */
import { describe, it, expect } from "vitest";
import { artistBookingTasks, expandWeeklyBookingRows, periodClassDay, periodRowStatus, toPeriodRows } from "./weeklyBookings";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("periodClassDay", () => {
  it("reads the stored UTC date, not the viewer's local one", () => {
    expect(ymd(periodClassDay({ periodStart: "2026-09-15T00:00:00.000Z" }))).toBe("2026-09-15");
  });

  it("keeps the same date after the clocks change (stored at 01:00)", () => {
    expect(ymd(periodClassDay({ periodStart: "2026-10-27T01:00:00.000Z" }))).toBe("2026-10-27");
  });
});

describe("periodRowStatus", () => {
  const now = new Date(2026, 8, 21, 15); // Mon Sep 21 2026, 3pm local
  const past = new Date(2026, 8, 15, 12);
  const today = new Date(2026, 8, 21, 12);
  const future = new Date(2026, 8, 29, 12);

  it("asks for hours once the server opens the week", () => {
    expect(periodRowStatus({ status: "open" }, future, now)).toEqual({ status: "Submit Hours", due: true });
  });

  it("asks for hours once class day arrives, even if the week wasn't opened", () => {
    expect(periodRowStatus({ status: "upcoming" }, past, now)).toEqual({ status: "Submit Hours", due: true });
    expect(periodRowStatus({ status: "upcoming" }, today, now)).toEqual({ status: "Submit Hours", due: true });
  });

  it("shows a future class as Confirmed", () => {
    expect(periodRowStatus({ status: "upcoming" }, future, now)).toEqual({ status: "Confirmed", due: false });
  });

  it("maps submitted, paid and skipped weeks", () => {
    expect(periodRowStatus({ status: "artist_submitted" }, past, now)).toEqual({ status: "Pay Now", due: false });
    expect(periodRowStatus({ status: "client_paid" }, past, now)).toEqual({ status: "Paid", due: false });
    expect(periodRowStatus({ status: "skipped" }, past, now)).toEqual({ status: "No class", due: false });
  });
});

describe("toPeriodRows", () => {
  const now = new Date(2026, 8, 21, 15);
  const parent = { id: 1140003, clientCompanyName: "Fancy Feet Dance Studio", clientPhoto: "logo.png", artistRate: 55, hours: 4.75, paymentMethod: "artswrk" };
  const week = (n: number, start: string, status = "upcoming", extra: any = {}) =>
    ({ id: 9000 + n, periodNumber: n, periodStart: start, status, actualHours: null, artistSubmittedAt: null, ...extra });
  const admin = {
    id: 1140003, hourlyRate: 55, artistRate: 55, hours: 4.75,
    periods: [
      week(1, "2026-09-17T00:00:00.000Z", "open"),
      week(2, "2026-09-24T00:00:00.000Z"),
      week(3, "2026-10-01T00:00:00.000Z"),
      week(10, "2026-11-19T01:00:00.000Z"),   // months out — still listed
    ],
  };

  it("makes one row for every week of the booking, however far out", () => {
    const rows = toPeriodRows(parent, admin, now);
    expect(rows.map((r) => ymd(r.startDate))).toEqual(["2026-09-17", "2026-09-24", "2026-10-01", "2026-11-19"]);
  });

  it("gives every row a unique key but keeps the parent booking id", () => {
    const rows = toPeriodRows(parent, admin, now);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(rows.every((r) => r.id === 1140003)).toBe(true);
  });

  it("carries the studio and the hourly rate, and labels what to do", () => {
    const [first, second] = toPeriodRows(parent, admin, now);
    expect(first).toMatchObject({ clientCompanyName: "Fancy Feet Dance Studio", clientPhoto: "logo.png", artistRate: 55, hours: 4.75, bookingStatus: "Submit Hours", periodDue: true });
    expect(second).toMatchObject({ bookingStatus: "Confirmed", periodDue: false });
  });

  it("uses the hours actually submitted once a week is invoiced", () => {
    const submitted = { ...admin, periods: [week(1, "2026-09-17T00:00:00.000Z", "artist_submitted", { actualHours: 5, artistSubmittedAt: "2026-09-18T10:00:00.000Z" })] };
    const [row] = toPeriodRows(parent, submitted, now);
    expect(row).toMatchObject({ hours: 5, bookingStatus: "Pay Now", periodSubmittedAt: "2026-09-18T10:00:00.000Z", artswrkInvoiceSubmittedAt: null });
  });

  it("marks a paid week as paid", () => {
    const paid = { ...admin, periods: [week(1, "2026-09-17T00:00:00.000Z", "client_paid")] };
    expect(toPeriodRows(parent, paid, now)[0]).toMatchObject({ bookingStatus: "Paid", paymentStatus: "Paid" });
  });

  it("handles a booking with no periods", () => {
    expect(toPeriodRows(parent, { ...admin, periods: [] }, now)).toEqual([]);
  });
});

describe("expandWeeklyBookingRows", () => {
  const now = new Date(2026, 8, 21, 15);

  it("expands recurring admin bookings but leaves one-time admin bookings whole", () => {
    const weeklyParent = { id: 10, artistRate: 55, hours: 4 };
    const oneTimeParent = { id: 20, artistRate: 150, hours: 3 };
    const rows = expandWeeklyBookingRows(
      [weeklyParent, oneTimeParent],
      [
        {
          id: 10,
          isRecurring: true,
          hourlyRate: 55,
          hours: 4,
          periods: [{ id: 101, periodStart: "2026-09-17T00:00:00.000Z", status: "open" }],
        },
        {
          id: 20,
          isRecurring: false,
          artistRate: 150,
          periods: [{ id: 201, periodStart: "2026-09-18T00:00:00.000Z", status: "open" }],
        },
      ],
      now,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 10, key: "period-101", isRecurring: true });
    expect(rows[1]).toBe(oneTimeParent);
    expect(rows[1].period).toBeUndefined();
  });
});

describe("artistBookingTasks", () => {
  const now = new Date(2026, 8, 21, 15); // Mon Sep 21 2026
  const weekly = toPeriodRows({ id: 1140003, clientCompanyName: "Fancy Feet Dance Studio" }, {
    id: 1140003, hourlyRate: 55, hours: 4.75,
    periods: [
      { id: 1, periodStart: "2026-09-10T00:00:00.000Z", status: "open" },
      { id: 2, periodStart: "2026-09-17T00:00:00.000Z", status: "upcoming" },      // taught, not yet opened
      { id: 3, periodStart: "2026-09-24T00:00:00.000Z", status: "upcoming" },      // future
      { id: 5, periodStart: "2026-09-03T00:00:00.000Z", status: "artist_submitted" },
    ],
  }, now);

  it("counts every week waiting on hours, oldest first", () => {
    expect(artistBookingTasks(weekly).hoursDue.map((r) => r.period.id)).toEqual([1, 2]);
  });

  it("never counts future, submitted or one-off bookings", () => {
    const oneOff = { id: 10, startDate: "2026-10-05T00:00:00.000Z", bookingStatus: "Confirmed" };
    const ids = artistBookingTasks([...weekly, oneOff]).hoursDue.map((r) => r.period?.id ?? r.id);
    expect(ids).toEqual([1, 2]);
  });
});
