/**
 * DAY-OF REMINDER WINDOW
 * ─────────────────────────────────────────────────────────────────────────────
 * Reminder emails ("Complete Your Booking", "Did you get paid?" and the weekly
 * class reminders) only ever go out on the Eastern calendar day of the booking
 * or class. Once that day has passed the reminder is never sent — not after
 * scheduler downtime, not after a deploy, not for records imported from Bubble.
 *
 * Why this exists: on 2026-09-14 the sweep had no such limit and emailed 404
 * reminders for 2021–2024 bookings in four minutes.
 *
 * The bounds are computed here and passed to SQL as UTC literals (the database
 * session runs in UTC), so the rule doesn't depend on MySQL time zone tables
 * and can be dry-run at any simulated time.
 */
import { easternDateTimeToUtc } from "../shared/adminBookingSchedule";

const TZ = "America/New_York";
/** A timed booking's reminder is due from this many minutes before it starts. */
const LEAD_MINUTES = 10;

export interface ReminderWindow {
  /** Today on the Eastern calendar, "YYYY-MM-DD". */
  today: string;
  /** Eastern midnight starting today, as a UTC SQL literal. */
  dayStart: string;
  /** Eastern midnight ending today (exclusive). 23–25 hours after dayStart across DST. */
  dayEnd: string;
  /** Now, as a UTC SQL literal. */
  now: string;
  /** Now plus the lead time. */
  leadUntil: string;
}

const sqlUtc = (d: Date): string => d.toISOString().slice(0, 19).replace("T", " ");

/** "YYYY-MM-DD" of `at` on the Eastern calendar. */
export function easternDateString(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function reminderWindow(now: Date = new Date()): ReminderWindow {
  const today = easternDateString(now);
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return {
    today,
    dayStart: sqlUtc(easternDateTimeToUtc(today, "00:00", TZ)),
    dayEnd: sqlUtc(easternDateTimeToUtc(tomorrow, "00:00", TZ)),
    now: sqlUtc(now),
    leadUntil: sqlUtc(new Date(now.getTime() + LEAD_MINUTES * 60_000)),
  };
}

/**
 * SQL condition: a one-time booking's reminder is due now.
 * - A real start time: from 10 minutes before it, and only while it is still that Eastern day.
 * - A bare date (stored as midnight, "no time set"): on that calendar day only.
 */
export function completionReminderDueSql(w: ReminderWindow, col = "b.startDate"): string {
  return `(
        (TIME(${col}) <> '00:00:00' AND ${col} >= '${w.dayStart}' AND ${col} < '${w.dayEnd}' AND ${col} <= '${w.leadUntil}')
        OR (TIME(${col}) = '00:00:00' AND DATE(${col}) = '${w.today}')
      )`;
}

/** SQL condition: a weekly reminder's time has arrived. */
export function periodReminderDueSql(w: ReminderWindow, col = "bp.notifyArtistAt"): string {
  return `${col} <= '${w.now}'`;
}

/**
 * SQL expression, 1 when a due weekly reminder falls on today's Eastern date
 * (email it) and 0 when it belongs to an earlier day (open the week for hours
 * without emailing).
 */
export function periodReminderIsTodaySql(w: ReminderWindow, col = "bp.notifyArtistAt"): string {
  return `(${col} >= '${w.dayStart}')`;
}
