/**
 * Weekly class bookings list one row per class date for artists. The dates are
 * stored as UTC midnight (01:00 after the clocks change), so the class day must
 * come out the same in every timezone.
 */
import { describe, it, expect } from "vitest";
import { artistBookingTasks, artistBookingTotal, expandWeeklyBookingRows, groupClientBookings, isSeasonRow, needsArtistAction, periodClassDay, periodRowStatus, sortArtistBookings, toClientDateCards, toPeriodRows } from "./weeklyBookings";

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
    expect(artistBookingTasks(weekly, now).hoursDue.map((r) => r.period.id)).toEqual([1, 2]);
  });

  it("never counts future or already-submitted work", () => {
    const future = { id: 10, startDate: "2026-10-05T00:00:00.000Z", bookingStatus: "Confirmed" };
    const ids = artistBookingTasks([...weekly, future], now).hoursDue.map((r) => r.period?.id ?? r.id);
    expect(ids).toEqual([1, 2]);
  });

  // McKell's 36h10m of studio admin: an ordinary booking, worked, uncompleted.
  // It has no billing period, so the old periodDue check never saw it and the
  // artist's dashboard said "you're all caught up" while she was owed $651.
  it("counts a plain booking that has been worked but not completed", () => {
    const admin = { id: 1350001, startDate: "2026-09-18T00:00:00.000Z", bookingStatus: "Confirmed" };
    const ids = artistBookingTasks([...weekly, admin], now).hoursDue.map((r) => r.period?.id ?? r.id);
    expect(ids).toEqual([1, 2, 1350001]);
  });

  it("drops a booking the moment its invoice is sent", () => {
    // An artist-raised invoice is created in the past and submitted instantly;
    // without this it reappeared as "Complete Booking" the second it was sent.
    const justInvoiced = {
      id: 30, startDate: "2026-09-18T00:00:00.000Z", bookingStatus: "Confirmed",
      artswrkInvoiceSubmittedAt: "2026-09-19T12:00:00.000Z",
    };
    expect(artistBookingTasks([justInvoiced], now).hoursDue).toEqual([]);
  });

  it("puts a declined invoice back on the artist's list", () => {
    // invoice.decline clears the submission and resets the status, which is
    // exactly the shape this reads — so a sent-back invoice becomes a task
    // again with nothing else to wire up.
    const sentBack = {
      id: 31, startDate: "2026-09-18T00:00:00.000Z", bookingStatus: "Confirmed",
      artswrkInvoiceSubmittedAt: null, invoicePaymentToken: null, invoiceTotalCents: null,
    };
    expect(artistBookingTasks([sentBack], now).hoursDue.map((r: any) => r.id)).toEqual([31]);
  });

  it("leaves completed, paid and cancelled bookings alone", () => {
    const settled = [
      { id: 20, startDate: "2026-09-01T00:00:00.000Z", bookingStatus: "Completed" },
      { id: 21, startDate: "2026-09-02T00:00:00.000Z", bookingStatus: "Cancelled" },
      { id: 22, startDate: "2026-09-03T00:00:00.000Z", bookingStatus: "Pay Now" },
    ];
    expect(artistBookingTasks(settled, now).hoursDue).toEqual([]);
  });
});

describe("toClientDateCards", () => {
  const season = {
    id: 1140006,
    isRecurring: true,
    hours: 3,
    clientRate: 80,
    periods: [
      { id: 1, periodStart: "2026-09-14T00:00:00.000Z", status: "artist_submitted", actualHours: 3, invoiceTotalCents: 29000, invoicePaymentToken: "tok1" },
      { id: 2, periodStart: "2026-09-21T00:00:00.000Z", status: "client_paid", actualHours: 3, invoiceTotalCents: 29000 },
      { id: 3, periodStart: "2026-09-28T00:00:00.000Z", status: "upcoming", actualHours: null },
      { id: 4, periodStart: "2026-10-05T00:00:00.000Z", status: "skipped", actualHours: null },
    ],
  };

  it("gives the studio one card per class date, not the season", () => {
    const cards = toClientDateCards([season]);
    expect(cards).toHaveLength(3);               // the skipped week is dropped
    expect(cards.every((c) => c.periods.length === 0)).toBe(true);
  });

  it("puts each date's own status and invoice on its card", () => {
    // Fixed "now" — a date's status depends on whether its class has happened.
    const [first, second, third] = toClientDateCards([season], new Date("2026-09-25T12:00:00Z"));
    expect(first.bookingStatus).toBe("Pay Now");
    expect(first.invoicePaymentToken).toBe("tok1");
    expect(second.bookingStatus).toBe("Completed");
    expect(second.paymentStatus).toBe("Paid");
    expect(third.bookingStatus).toBe("Confirmed");
    expect(third.hours).toBe(3);                 // falls back to scheduled hours
  });

  it("dates read as the class day, never the day before", () => {
    const [first] = toClientDateCards([season]);
    expect(ymd(new Date(first.startDate))).toBe("2026-09-14");
  });

  it("says who a passed class is waiting on, rather than 'Confirmed'", () => {
    // Sep 28 has happened and no hours are in: the studio is waiting on the teacher.
    const [, , third] = toClientDateCards([season], new Date("2026-09-30T12:00:00Z"));
    expect(third.bookingStatus).toBe("Awaiting Invoice");
  });

  it("does not duplicate one-off admin bookings already returned by myBookings", () => {
    const oneOff = { id: 5, isRecurring: false, periods: [] };
    expect(toClientDateCards([oneOff])).toEqual([]);
  });
});

describe("groupClientBookings", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const rows = [
    { id: 1, bookingStatus: "Completed", startDate: "2022-01-18T12:00:00Z" },       // ancient history
    { id: 2, bookingStatus: "Completed", startDate: "2026-06-18T12:00:00Z" },       // recent history
    { id: 3, bookingStatus: "Pay Now", startDate: "2026-09-14T12:00:00Z" },
    { id: 4, bookingStatus: "Pay Now", startDate: "2026-09-21T12:00:00Z" },
    { id: 5, bookingStatus: "Awaiting Invoice", startDate: "2026-09-17T12:00:00Z" },
    { id: 6, bookingStatus: "Confirmed", startDate: "2026-10-05T12:00:00Z" },
    { id: 7, bookingStatus: "Confirmed", startDate: "2026-09-16T12:00:00Z", isAdminBooking: true, isRecurring: true }, // season row
  ];

  it("leads with what the studio owes, then who it waits on", () => {
    const [first, second] = groupClientBookings(rows, now);
    expect(first.title).toBe("Needs payment");
    expect(first.rows.map((r: any) => r.id)).toEqual([3, 4]);
    expect(second.title).toBe("Waiting on artist");
    expect(second.rows.map((r: any) => r.id)).toEqual([5]);
  });

  it("never shows the season row itself", () => {
    const ids = groupClientBookings(rows, now).flatMap((g) => g.rows.map((r: any) => r.id));
    expect(ids).not.toContain(7);
    expect(isSeasonRow(rows[6])).toBe(true);
  });

  it("puts history newest first, not 2022 at the top", () => {
    const past = groupClientBookings(rows, now).find((g) => g.key === "past");
    expect(past?.rows.map((r: any) => r.id)).toEqual([2, 1]);
  });

  it("drops empty groups", () => {
    const keys = groupClientBookings([rows[0]], now).map((g) => g.key);
    expect(keys).toEqual(["past"]);
  });
});

describe("what the artist's booking list shows", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("shows what they are paid, not the hourly rate", () => {
    // A converted class date: hourly rate, four hours. The row used to read $55.
    expect(artistBookingTotal({ artistRate: 55, hours: 4, rateType: "hourly", recurringSeriesId: 900 })).toBe(220);
    // A one-off booking stores the total — never multiply it.
    expect(artistBookingTotal({ artistRate: 450, hours: 9 })).toBe(450);
    // McKell's admin hours: 36.1667 at $18.
    expect(artistBookingTotal({ artistRate: 18, hours: 36 + 10 / 60, rateType: "hourly" })).toBeCloseTo(651, 2);
    expect(artistBookingTotal({ artistRate: null, clientRate: null })).toBeNull();
  });

  it("knows which bookings the artist still owes hours for", () => {
    expect(needsArtistAction({ startDate: "2026-10-01T12:00:00Z", bookingStatus: "Confirmed" }, now)).toBe(true);
    expect(needsArtistAction({ startDate: "2026-10-15T12:00:00Z", bookingStatus: "Confirmed" }, now)).toBe(false);
    expect(needsArtistAction({ startDate: "2026-10-01T12:00:00Z", bookingStatus: "Completed" }, now)).toBe(false);
    // Already invoiced: waiting on the studio, nothing for the artist to do.
    expect(needsArtistAction({ startDate: "2026-10-01T12:00:00Z", bookingStatus: "Pay Now" }, now)).toBe(false);
  });

  it("puts overdue work first, then the next gig, then history", () => {
    const rows = [
      { id: "future-far", startDate: "2026-10-15T12:00:00Z", bookingStatus: "Confirmed" },
      { id: "done-recent", startDate: "2026-10-06T12:00:00Z", bookingStatus: "Completed" },
      { id: "overdue-old", startDate: "2026-09-29T12:00:00Z", bookingStatus: "Confirmed" },
      { id: "future-near", startDate: "2026-10-09T12:00:00Z", bookingStatus: "Confirmed" },
      { id: "overdue-new", startDate: "2026-10-06T12:00:00Z", bookingStatus: "Confirmed" },
      { id: "done-old", startDate: "2026-09-20T12:00:00Z", bookingStatus: "Completed" },
    ];
    expect(sortArtistBookings(rows, now).map((r) => r.id)).toEqual([
      "overdue-old", "overdue-new",     // most behind first
      "future-near", "future-far",      // next gig next
      "done-recent", "done-old",        // history, newest first
    ]);
  });
});

describe("a booking with no date", () => {
  const base = { bookingStatus: "Confirmed", artistRate: 100 };
  const find = (gs: any[], k: string) => gs.find((g) => g.key === k)?.rows ?? [];

  it("shows as upcoming, not as a 1970 booking in the past", () => {
    // Lambarri's tap sub: confirmed correctly, then invisible. new Date(null)
    // is the epoch, so it sorted into Past below years of old bookings.
    const groups = groupClientBookings([{ ...base, id: 1, startDate: null }]);
    expect(find(groups, "upcoming").map((r: any) => r.id)).toEqual([1]);
    expect(find(groups, "past")).toHaveLength(0);
  });

  it("sorts after bookings that do have a date", () => {
    const soon = new Date(Date.now() + 86400000).toISOString();
    const later = new Date(Date.now() + 86400000 * 7).toISOString();
    const groups = groupClientBookings([
      { ...base, id: 1, startDate: null },
      { ...base, id: 2, startDate: later },
      { ...base, id: 3, startDate: soon },
    ]);
    expect(find(groups, "upcoming").map((r: any) => r.id)).toEqual([3, 2, 1]);
  });

  it("still puts genuinely past bookings in the past", () => {
    const past = new Date(Date.now() - 86400000 * 7).toISOString();
    const groups = groupClientBookings([{ ...base, id: 1, startDate: past }]);
    expect(find(groups, "past").map((r: any) => r.id)).toEqual([1]);
  });

  it("does not resurrect a cancelled or completed dateless booking", () => {
    const groups = groupClientBookings([
      { ...base, id: 1, startDate: null, bookingStatus: "Cancelled" },
      { ...base, id: 2, startDate: null, bookingStatus: "Completed" },
    ]);
    expect(find(groups, "upcoming")).toHaveLength(0);
  });

  it("treats an unparseable date as missing rather than as 1970", () => {
    const groups = groupClientBookings([{ ...base, id: 1, startDate: "not a date" }]);
    expect(find(groups, "upcoming").map((r: any) => r.id)).toEqual([1]);
  });
});
