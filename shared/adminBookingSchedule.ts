/**
 * Scheduling helpers for admin (manually entered) recurring bookings.
 * Admins enter class dates and times as Eastern wall-clock; storage is UTC.
 */
const TZ = "America/New_York";

/** "YYYY-MM-DD" of a date-only value stored as UTC midnight (how <input type="date"> values are saved). */
export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Offset of `tz` from UTC at instant `at`, in minutes (e.g. -240 for EDT). */
function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(at)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The UTC instant for a wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in Eastern, DST-aware. */
export function easternDateTimeToUtc(dateYmd: string, timeHm: string, tz = TZ): Date {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [h, mi] = timeHm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let result = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  // Re-check with the offset at the result itself — matters right at a DST switch.
  result = guess - tzOffsetMinutes(new Date(result), tz) * 60000;
  return new Date(result);
}
