/**
 * Turning DB rows into the strings a recipient reads. Kept apart from the
 * templates so the fallback rules — which exist because real rows are patchy —
 * are in one reviewable place rather than scattered through HTML.
 *
 * All dates render in America/New_York. The audience is a US network and the
 * digest goes out on ET; showing a job time in UTC would be actively wrong.
 */
import type { JobCard, ProCard } from "./templates";
import { excerpt } from "./templates";

const TZ = "America/New_York";

export function formatWhen(start: Date | null, end: Date | null, dateType?: string | null): string | null {
  if (!start) {
    if (dateType === "Ongoing") return "Ongoing";
    if (dateType === "Dates Flexible") return "Flexible dates";
    if (dateType === "Weekly") return "Weekly, recurring";
    return null;
  }
  const day = start.toLocaleDateString("en-US", {
    timeZone: TZ, month: "short", day: "numeric", year: "numeric",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
      .replace(":00", "").toLowerCase();
  // Midnight both ends means the time was never really set — showing
  // "12am – 12am" reads as a bug to the recipient.
  const startsAtMidnight = start.getUTCHours() === 0 && start.getUTCMinutes() === 0;
  if (startsAtMidnight && !end) return day;
  if (!end) return `${day} at ${t(start)}`;
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${day}, ${t(start)} – ${t(end)}`
                 : `${day} – ${end.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" })}`;
}

/** 58% of active jobs are open-rate, 40% hourly, 2% flat — all three appear. */
export function formatRate(j: {
  openRate?: boolean | number | null;
  isHourly?: boolean | number | null;
  clientHourlyRate?: number | null;
  clientFlatRate?: number | null;
  hours?: number | null;
}): string | null {
  if (j.openRate) return "Pitch Your Rate";
  if (j.clientHourlyRate) {
    const h = j.hours ? ` · ~${j.hours} ${j.hours === 1 ? "hour" : "hours"}` : "";
    return `$${j.clientHourlyRate}/hr${h}`;
  }
  if (j.clientFlatRate) return `$${j.clientFlatRate} flat`;
  return null;
}

/** locationCity is set on only 8% of active jobs; the full address is on 99%.
 *  Trim the country and any postcode so a card shows "Brooklyn, NY". */
export function formatLocation(address: string | null, city?: string | null, state?: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const trimmed = parts.filter((p) => !/^(usa|united states)$/i.test(p));
  const last = trimmed[trimmed.length - 1];
  if (last) trimmed[trimmed.length - 1] = last.replace(/\s*\d{5}(-\d{4})?$/, "").trim();
  return trimmed.slice(-2).join(", ") || address;
}

/** Title is required at posting now, but migrated rows predate that. Fall back
 *  to the service type, then the first clause of the description, so a card is
 *  never headed by an empty string. */
export function jobTitle(row: { title?: string | null; svc?: string | null; description?: string | null }): string {
  const t = (row.title ?? "").trim();
  if (t) return t;
  if (row.svc) return row.svc;
  const first = String(row.description ?? "").replace(/\s+/g, " ").trim().split(/[.\n—-]/)[0];
  return first ? first.slice(0, 70) : "New job";
}

/**
 * Mirrors slugify/toJobUrl in client/src/pages/JobDetail.tsx. Kept as a small
 * copy rather than an import because the server can't reach into a React page
 * module, and because the URL shape is now load-bearing for email links.
 */
export function slugify(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * PUBLIC job URL — /jobs/{title-slug}-{id}.
 *
 * NOT /app/jobs/{id}: that is the client-side dashboard route for the person
 * who POSTED the job, and it sits behind the auth wrapper, so an artist
 * clicking it from an email lands on a login redirect. The public detail page
 * renders without a session and its Apply flow offers "Login to Apply" in
 * place, which is what a cold recipient needs.
 *
 * Only 2 of 224 active jobs have a stored slug, so the slug is derived from the
 * title; the page extracts the trailing -{id} and ignores the rest, so the
 * derived text never has to match anything.
 */
export function toPublicJobUrl(appUrl: string, row: { id: number; slug?: string | null; title?: string | null; svc?: string | null; description?: string | null }): string {
  if (row.slug) return `${appUrl}/jobs/${row.slug}`;
  return `${appUrl}/jobs/${slugify(jobTitle(row)) || "job"}-${row.id}`;
}

/** PUBLIC PRO job URL — /pro/{service-slug}-{id}. Same reasoning. */
export function toPublicProUrl(appUrl: string, row: { id: number; slug?: string | null; serviceType?: string | null }): string {
  if (row.slug) return `${appUrl}/pro/${row.slug}`;
  return `${appUrl}/pro/${slugify(row.serviceType ?? "open-position") || "open-position"}-${row.id}`;
}

export function toJobCard(row: any, appUrl: string): JobCard {
  return {
    title: jobTitle(row),
    client: row.client || null,
    dateLabel: formatWhen(row.startDate ? new Date(row.startDate) : null,
                          row.endDate ? new Date(row.endDate) : null, row.dateType),
    location: formatLocation(row.locationAddress, row.locationCity, row.locationState),
    rateLabel: formatRate(row),
    excerpt: excerpt(row.description),
    applyUrl: toPublicJobUrl(appUrl, row),
  };
}

export function toProCard(row: any, appUrl: string): ProCard {
  return {
    title: (row.serviceType || "PRO job").trim(),
    company: row.company || null,
    location: row.workFromAnywhere ? "Work from anywhere" : formatLocation(row.location),
    budget: row.budget || null,
    excerpt: excerpt(row.description),
    applyUrl: toPublicProUrl(appUrl, row),
  };
}
