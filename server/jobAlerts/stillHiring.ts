/**
 * Is a pending job still worth alerting artists about?
 *
 * The digest used to drop every job whose start date had passed. That's right
 * for a one-off sub, but a weekly class job is still hiring after its first
 * class — when alerts were paused Sep 15–21, Renner Dance's weekly teacher
 * post and The Dance Company's "Immediate Need" ballet job would have been
 * silently skipped forever. An ongoing engagement is over only once its end
 * date has passed.
 */

/** Date types that describe an ongoing engagement rather than a single day. */
const ONGOING = new Set(["Weekly", "Ongoing", "Dates Flexible", "Recurring"]);

const valid = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
};

export function isStillHiring(
  job: { dateType?: string | null; startDate?: unknown; endDate?: unknown },
  now: Date = new Date(),
): boolean {
  const start = valid(job.startDate);
  if (!start || start > now) return true;

  // An end on or before the start is a data slip (e.g. "through May 26" saved
  // with this year) — treat it as no end date rather than as already over.
  const end = valid(job.endDate);
  const realEnd = end && end > start ? end : null;

  if (ONGOING.has(job.dateType ?? "")) return !realEnd || realEnd > now;
  // Several dates: still open while the last one is ahead.
  if (job.dateType === "Multiple Dates") return !!realEnd && realEnd > now;
  // A single date that has passed.
  return false;
}
