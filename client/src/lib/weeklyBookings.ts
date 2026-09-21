/**
 * Weekly class bookings, as artists see them.
 *
 * A weekly class booking is one admin booking with a billing period per week.
 * Artists are used to Bubble, which listed one booking per class date — so
 * instead of a single booking with a table of periods, each week becomes its
 * own row, labelled with what the artist needs to do next. Opening one leads
 * to "Complete Booking", which submits that week's hours.
 */

/**
 * The class date for a week, as a local date at noon.
 *
 * periodStart holds the class date as UTC midnight — 01:00 once the clocks
 * change — so the UTC calendar date is the real one. Formatting the raw value
 * in the viewer's zone would put an evening-before date on it in the Americas.
 */
export function periodClassDay(period: { periodStart: string | Date }): Date {
  const d = new Date(period.periodStart);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
}

export type PeriodRowStatus = "Submit Hours" | "Confirmed" | "Pay Now" | "Paid" | "No class";

/**
 * What the artist should see for a week. "Pay Now" is the stored status the
 * artist UI already renders as "Payment Pending".
 *
 * A week is due once it's marked open (the server opens it the evening of
 * class) or once its class day has arrived — whichever is first — so a missed
 * status flip never hides a week the artist has already taught.
 */
export function periodRowStatus(
  period: { status: string },
  classDay: Date,
  now: Date = new Date(),
): { status: PeriodRowStatus; due: boolean } {
  switch (period.status) {
    case "skipped": return { status: "No class", due: false };
    case "client_paid": return { status: "Paid", due: false };
    case "artist_submitted": return { status: "Pay Now", due: false };
  }
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const due = period.status === "open" || classDay <= endOfToday;
  return due ? { status: "Submit Hours", due: true } : { status: "Confirmed", due: false };
}

/**
 * One list row per week of an admin booking — every week of the term, as in
 * Bubble. (Weeks waiting on hours are floated to the top by the list itself.)
 *
 * `parent` is the booking's row from the artist's bookings list (client name,
 * photo, payment method…); `admin` is the same booking from myAdminBookings,
 * which carries the hourly rate, scheduled hours and the periods.
 */
export function toPeriodRows(parent: any, admin: any, now: Date = new Date()): any[] {
  const hourlyRate = Number(admin.hourlyRate ?? admin.artistRate ?? parent.artistRate ?? 0);

  return (admin.periods ?? [])
    .map((period: any) => ({ period, day: periodClassDay(period) }))
    .map(({ period, day }: { period: any; day: Date }) => {
      const { status, due } = periodRowStatus(period, day, now);
      return {
        ...parent,
        key: `period-${period.id}`,
        startDate: day,
        endDate: null,
        bookingStatus: status,
        paymentStatus: period.status === "client_paid" ? "Paid" : "Unpaid",
        // Never set the one-off invoice timestamp on a week — that would switch
        // on the whole-booking invoice UI. The week's own submission date is
        // kept separately so it can still be filed by invoice date.
        artswrkInvoiceSubmittedAt: null,
        periodSubmittedAt: period.artistSubmittedAt ?? null,
        artistRate: hourlyRate,
        hours: period.actualHours ?? admin.hours ?? parent.hours ?? null,
        isAdminBooking: true,
        isRecurring: true,
        periodDue: due,
        period,
        adminBooking: admin,
      };
    });
}

/**
 * Replace only recurring admin-booking parents with their weekly rows.
 * One-time admin bookings also have an entry in `myAdminBookings` (and one
 * billing period), but they remain ordinary whole-booking rows and must never
 * be sent through the hourly weekly-invoice flow.
 */
export function expandWeeklyBookingRows(
  parentBookings: any[],
  adminBookings: any[],
  now: Date = new Date(),
): any[] {
  const adminById = new Map((adminBookings ?? []).map((admin: any) => [admin.id, admin]));
  return (parentBookings ?? []).flatMap((booking: any) => {
    const admin: any = adminById.get(booking.id);
    return admin?.isRecurring ? toPeriodRows(booking, admin, now) : [booking];
  });
}

/**
 * The weeks for the artist's "Your Tasks" panel: every week that's been taught
 * and still needs hours, oldest first, from the same rows the Bookings tab shows.
 */
export function artistBookingTasks(rows: any[]): { hoursDue: any[] } {
  const when = (b: any) => new Date(b.startDate).getTime();
  return { hoursDue: rows.filter((b) => b.periodDue).sort((a, b) => when(a) - when(b)) };
}
