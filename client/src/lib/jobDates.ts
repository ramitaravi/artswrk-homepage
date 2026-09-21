/**
 * How job dates read to artists.
 *
 * Job start/end values are real instants. The post-job form converts the
 * hirer's local time to UTC ("5:00 PM" in New York → 21:00Z), and Bubble did
 * the same — its "11:30AM" classes are stored as 16:30Z. So times are shown in
 * the viewer's own zone, which for a local artist is the studio's. (Reading
 * them as UTC put every class 4–5 hours late: an 11:30 AM class read 4:30 PM.)
 *
 * A date picked with no time is saved as midnight — UTC midnight from the
 * form's date inputs, or Eastern midnight from a browser in New York. Those
 * show as just the date, on the day that was picked, never as "8:00 PM" the
 * evening before.
 */

type Zone = { timeZone?: string };      // undefined = the viewer's own zone
const EASTERN = "America/New_York";

function valid(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

const hhmm = (d: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);

/** No time was chosen — saved as midnight UTC or midnight Eastern. */
const isDateOnly = (d: Date) => hhmm(d, "UTC") === "00:00" || hhmm(d, EASTERN) === "00:00";

/** The zone whose calendar holds a date-only value's intended day. */
const dayZone = (d: Date) => (hhmm(d, "UTC") === "00:00" ? "UTC" : EASTERN);

/** Where to read this value's calendar date. */
const zoneFor = (d: Date, z: Zone) => (isDateOnly(d) ? dayZone(d) : z.timeZone);

/** "4:15 PM" — ICU puts a narrow no-break space before AM/PM; use a plain one. */
const clock = (d: Date, timeZone?: string) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(/\s/g, " ");

/** "4:45–6:15 PM", "11:30 AM–1:00 PM", or just "4:45 PM". */
function timeRange(start: Date, end: Date | null, z: Zone): string {
  const s = clock(start, z.timeZone);
  if (!end || isDateOnly(end)) return s;
  const e = clock(end, z.timeZone);
  if (e === s) return s;
  const [sTime, sMeridiem] = s.split(" ");
  return sMeridiem === e.split(" ")[1] ? `${sTime}–${e}` : `${s}–${e}`;
}

const calendarDay = (d: Date, z: Zone) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zoneFor(d, z) }).format(d);

/**
 * A weekly job: "Weekly · Wednesdays · 4:45–6:15 PM · Sep 23 – Jun 23".
 *
 * startDate is the first class (and its start time), endDate the last class
 * (and its end time). Shown as one range they read like a single nine-month
 * shift. An end on or before the first class is a data slip — e.g. "through
 * May 26" saved with this year — so it's left off rather than shown backwards.
 */
export function formatWeeklySchedule(job: { startDate?: unknown; endDate?: unknown }, z: Zone = {}): string {
  const start = valid(job.startDate);
  if (!start) return "Weekly";
  const end = valid(job.endDate);
  const monthDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: zoneFor(d, z) });
  const weekday = start.toLocaleDateString("en-US", { weekday: "long", timeZone: zoneFor(start, z) });
  const parts = ["Weekly", `${weekday}s`];
  if (!isDateOnly(start)) parts.push(timeRange(start, end, z));
  const endsLater = !!end && end > start && calendarDay(end, z) !== calendarDay(start, z);
  parts.push(endsLater ? `${monthDay(start)} – ${monthDay(end!)}` : `from ${monthDay(start)}`);
  return parts.join(" · ");
}

/** The compact date line on a job card: "Thu, 9/17/26, 4:00 PM". */
export function formatJobCardDate(
  job: { dateType?: string | null; startDate?: unknown; endDate?: unknown },
  z: Zone = {},
): string {
  switch (job.dateType) {
    case "Ongoing": return "Ongoing";
    case "Recurring": return "Recurring";
    case "Dates Flexible": return "Flexible";
    case "Weekly": return formatWeeklySchedule(job, z);
  }
  const start = valid(job.startDate);
  if (!start) return job.dateType ?? "";
  const day = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", year: "2-digit", timeZone: zoneFor(d, z) });
  const end = valid(job.endDate);
  const sameDay = !!end && calendarDay(end, z) === calendarDay(start, z);
  if (end && !sameDay && end > start) return `${day(start)} – ${day(end)}`;
  return isDateOnly(start) ? day(start) : `${day(start)}, ${timeRange(start, sameDay ? end : null, z)}`;
}

/** The long form on the job page: "Wednesday, September 23, 2026 at 4:45 PM". */
export function formatJobDateLong(value: unknown, z: Zone = {}): string {
  const d = valid(value);
  if (!d) return "Flexible";
  const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: zoneFor(d, z) });
  return isDateOnly(d) ? date : `${date} at ${clock(d, z.timeZone)}`;
}
