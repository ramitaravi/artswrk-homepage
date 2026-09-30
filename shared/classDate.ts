/**
 * How a class date is written to a studio or an artist.
 *
 * A weekly class is invoiced one class date at a time, so "September 2026" on a
 * payment link or an email tells a studio running payroll nothing: they are
 * paying for a Monday, and they need to see which Monday. Every customer-facing
 * label for a class date goes through here so they all read the same.
 *
 * The value is formatted in the same timezone it was parsed in — the database
 * stores a class date as midnight and the driver reads it as midnight locally,
 * so the calendar date survives without a timezone override.
 */
export function classDateLabel(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** The same date without the year, for use inside a sentence. */
export function classDateShort(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
