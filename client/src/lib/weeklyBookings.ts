import { isHourlyRateBooking as isHourly } from "@shared/bookingRates";

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
 * The bookings for the artist's "Your Tasks" panel: everything worked but not
 * yet completed, oldest first, from the same rows the Bookings tab shows.
 *
 * This used to look only at `periodDue`, a flag that exists on legacy weekly
 * rows alone — so a flattened class date, or a plain admin booking like
 * McKell's 36 hours of studio admin, never appeared as a task at all. The
 * artist's half of the handshake was invisible on the page that exists to
 * tell them what to do next.
 */
export function artistBookingTasks(rows: any[], now: Date = new Date()): { hoursDue: any[] } {
  const when = (b: any) => new Date(b?.startDate ?? b?.jobStartDate ?? 0).getTime();
  return {
    hoursDue: (rows ?? []).filter((b) => needsArtistAction(b, now)).sort((a, b) => when(a) - when(b)),
  };
}

/** Where a task row sends the artist — the exact week, when there is one. */
export function artistTaskHref(booking: any): string {
  const week = booking?.period?.id;
  return `/app/bookings?open=${booking?.id}${week ? `&week=${week}` : ""}`;
}

/**
 * A studio's view of a weekly class: one card per class date, never the season.
 *
 * Studios pay per class date with the Pay Now button they already know, so the
 * season row itself is not something they can act on — showing it, with a
 * status of its own and a hundred weeks folded inside, is what made the
 * dashboard unreadable. Each date carries only its own status, hours, amount
 * and invoice link. Skipped weeks are dropped: no class, nothing to pay.
 *
 * This mirrors what the data looks like once weekly bookings are stored one
 * row per class date, so the view does not change again when they are.
 */
export function toClientDateCards(adminBookings: any[], now: Date = new Date()): any[] {
  const STATUS: Record<string, { bookingStatus: string; paymentStatus: string }> = {
    client_paid:      { bookingStatus: "Completed", paymentStatus: "Paid" },
    artist_submitted: { bookingStatus: "Pay Now",   paymentStatus: "Unpaid" },
    open:             { bookingStatus: "Confirmed", paymentStatus: "Unpaid" },
    upcoming:         { bookingStatus: "Confirmed", paymentStatus: "Unpaid" },
  };

  return (adminBookings ?? []).flatMap((booking: any) => {
    // Ordinary admin bookings already appear in myBookings. This helper only
    // expands legacy weekly season rows into their per-date virtual cards.
    if (!booking?.isRecurring) return [];
    return (booking.periods ?? [])
      .filter((period: any) => period.status !== "skipped")
      .map((period: any) => {
        const day = periodClassDay(period);
        let mapped = STATUS[period.status] ?? STATUS.upcoming;
        // The class has happened and the teacher hasn't sent their hours yet.
        // "Confirmed" told the studio nothing and made a stalled date look
        // identical to one still months away; this says who it waits on.
        if (mapped.bookingStatus === "Confirmed" && day.getTime() < startOfDay(now).getTime()) {
          mapped = { bookingStatus: "Awaiting Invoice", paymentStatus: "Unpaid" };
        }
        const hours = period.actualHours ?? booking.hours ?? null;
        // What the studio owes for this date: the invoiced amount once hours are
        // in, otherwise the estimate from the scheduled hours. Never the bare
        // hourly rate, which read as an $80 booking.
        const total = period.invoiceTotalCents != null
          ? period.invoiceTotalCents / 100
          : hours != null ? Number(booking.clientRate ?? 0) * Number(hours) : null;
        return {
          ...booking,
          key: `date-${period.id}`,
          isClassDate: true,
          // Which class date this row is, so its detail page can show it.
          periodId: period.id,
          startDate: day,
          endDate: day,
          hours,
          bookingStatus: mapped.bookingStatus,
          paymentStatus: mapped.paymentStatus,
          totalClientRate: total,
          invoiceTotalCents: period.invoiceTotalCents ?? null,
          invoicePaymentToken: period.invoicePaymentToken ?? null,
          invoiceStripeCheckoutUrl: period.invoiceStripeCheckoutUrl ?? null,
          // Emptied so the card renders a single date, not an expander.
          periods: [],
        };
      })
      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  });
}

/** Midnight local, so "has this class happened yet" is a whole-day question. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * The order a studio reads their bookings in: anything they owe money on first,
 * then everything else by date. Within each group it stays chronological, so a
 * date never appears out of sequence.
 */
export function sortClientDateCards(cards: any[]): any[] {
  const rank = (b: any) => (b.bookingStatus === "Pay Now" ? 0 : 1);
  const when = (b: any) => new Date(b.startDate).getTime();
  return [...(cards ?? [])].sort((a, b) => rank(a) - rank(b) || when(a) - when(b));
}

/**
 * A weekly class's season row, which a studio must never see.
 *
 * It carries the season's start date and the hourly rate, so in a list of
 * bookings it reads as a $80 booking on a Sunday — a date nobody teaches and a
 * price nobody pays. The class dates stand in for it.
 */
export function isSeasonRow(booking: any): boolean {
  return Boolean(booking?.isAdminBooking && booking?.isRecurring);
}

export interface BookingGroup { key: string; title: string; hint?: string; rows: any[] }

/**
 * The studio's bookings, in the order they need them.
 *
 * Money owed first, then classes waiting on a teacher's hours, then what is
 * coming up, then history newest-first. A single flat list sorted by date put
 * 2022 at the top and this week's unpaid classes four hundred rows down.
 */
export function groupClientBookings(rows: any[], now: Date = new Date()): BookingGroup[] {
  const when = (b: any) => new Date(b.startDate ?? 0).getTime();
  const asc = (a: any, b: any) => when(a) - when(b);
  const desc = (a: any, b: any) => when(b) - when(a);
  const today = startOfDay(now).getTime();

  const live = (rows ?? []).filter((b) => !isSeasonRow(b));
  const needsPayment = live.filter((b) => b.bookingStatus === "Pay Now").sort(asc);
  const awaiting = live.filter((b) => b.bookingStatus === "Awaiting Invoice").sort(asc);
  const rest = live.filter((b) => b.bookingStatus !== "Pay Now" && b.bookingStatus !== "Awaiting Invoice");
  const upcoming = rest.filter((b) => when(b) >= today && b.bookingStatus !== "Completed" && b.bookingStatus !== "Cancelled").sort(asc);
  const past = rest.filter((b) => !upcoming.includes(b)).sort(desc);

  return [
    { key: "pay", title: "Needs payment", hint: "Hours submitted — pay to release payment to your artist", rows: needsPayment },
    { key: "awaiting", title: "Waiting on artist", hint: "These classes have happened; the artist hasn't sent hours yet", rows: awaiting },
    { key: "upcoming", title: "Upcoming", rows: upcoming },
    { key: "past", title: "Past bookings", rows: past },
  ].filter((g) => g.rows.length > 0);
}

/**
 * What the artist is owed for a booking, as a number of dollars.
 *
 * An hourly booking stores the RATE; everything else stores the total. The
 * artist's list printed the stored figure either way, so a 4-hour class at $55
 * read as "+$55.00" — the hourly rate dressed up as the payment. Class dates
 * stopped being flagged as recurring when they became ordinary bookings, which
 * is what broke it.
 */
export function artistBookingTotal(booking: any): number | null {
  const hours = Number(booking?.hours ?? 0);
  if (isHourly(booking) && hours > 0) {
    // hourlyRate is the unit rate. artistRate is not: on a confirmed applicant
    // it already holds the whole total ($60/hr x 3.25 hrs is stored as 195),
    // so multiplying it turned a $195 booking into $633.75. Legacy weekly rows
    // predate the column and carry their unit rate in artistRate instead.
    const unit = booking?.hourlyRate ?? booking?.artistRate ?? booking?.clientRate;
    return typeof unit === "number" ? unit * hours : null;
  }
  const rate = booking?.artistRate ?? booking?.clientRate;
  return typeof rate === "number" ? rate : null;
}

/**
 * A booking whose date has passed that the artist hasn't completed yet — the
 * only thing on the page standing between them and being paid.
 */
export function needsArtistAction(booking: any, now: Date = new Date()): boolean {
  if (booking?.periodDue) return true;
  // Already invoiced: it is the studio's move now. markArtswrkInvoiceSubmitted
  // also flips the status to "Pay Now", but a booking that carries a submitted
  // invoice is never the artist's to complete, whatever its status says.
  if (booking?.artswrkInvoiceSubmittedAt || booking?.periodSubmittedAt || booking?.invoicePaidAt) return false;
  const status = String(booking?.bookingStatus ?? "").toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "paid" || status === "pay now") return false;
  const raw = booking?.startDate ?? booking?.jobStartDate;
  if (!raw) return false;
  const day = new Date(raw);
  if (Number.isNaN(day.getTime())) return false;
  return day.getTime() < startOfDay(now).getTime();
}

/**
 * The order an artist reads their bookings in: work they still owe hours for
 * first (oldest first — the one they are most behind on), then what is coming
 * up soonest, then everything settled, newest first.
 */
export function sortArtistBookings(rows: any[], now: Date = new Date()): any[] {
  const when = (b: any) => new Date(b?.startDate ?? b?.jobStartDate ?? 0).getTime();
  const today = startOfDay(now).getTime();
  const rank = (b: any) => (needsArtistAction(b, now) ? 0 : when(b) >= today ? 1 : 2);
  return [...(rows ?? [])].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return ra === 2 ? when(b) - when(a) : when(a) - when(b);
  });
}

/**
 * The hourly test and hours formatter live in shared/ so the artist dashboard
 * and the invoice endpoint agree on what a booking is worth.
 */
export { isHourlyRateBooking, maxInvoiceHours, formatHours } from "@shared/bookingRates";
