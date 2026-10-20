/**
 * The public URL for a job, built so it always resolves.
 *
 * JobDetail finds a job by the numeric id on the END of the slug
 * (`/jobs/after-school-dance-instructor-2820001`), so any URL without that
 * trailing id is a 404 however well-formed it looks.
 *
 * `jobs.slug` is null on 1,830 of 3,979 rows — including every job posted
 * recently, because neither createJob caller ever passed one. Four places
 * built job URLs independently and only two of them handled that:
 *
 *   - the client's "share job" button fell back to `window.location.href`,
 *     which is the CLIENT'S OWN DASHBOARD page. Anyone they sent it to got a
 *     login wall or "job not found" (reported by Carly Gordon for Kennedi
 *     Tillman's job, 2026-10-19).
 *   - the public company page fell back to the jobs index, quietly dropping
 *     the visitor somewhere else entirely.
 *   - the dashboard company page had no fallback, producing `/jobs/null`.
 *
 * One function now, used everywhere, so a missing slug degrades to a URL that
 * still works instead of one that silently doesn't.
 */

/** Lowercase, hyphenated, ASCII — safe in a URL path. */
export function slugifyTitle(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** A slug the job page can actually resolve — i.e. one ending in the id. */
export function slugResolves(slug: string | null | undefined): boolean {
  return !!slug && /-\d+$/.test(slug);
}

/**
 * The canonical path for a job. Always ends in the job's id, which is what
 * the detail page actually looks it up by.
 *
 * A stored slug is only trusted when it ends in an id. 489 jobs carried over
 * from Bubble have slugs like "queens-based-dance-studio-" — a trailing hyphen
 * and no id — which the detail page cannot resolve, so linking straight off
 * `job.slug` sent people to a "job not found" page. Those fall through to a
 * generated path instead.
 */
export function jobPath(job: { id: number; slug?: string | null; title?: string | null }): string {
  if (slugResolves(job.slug)) return `/jobs/${job.slug}`;
  return `/jobs/${buildJobSlug(job.title, job.id)}`;
}

/** The absolute URL, for copying, sharing and emails. */
export function jobUrl(job: { id: number; slug?: string | null; title?: string | null }, origin: string): string {
  return `${origin.replace(/\/+$/, "")}${jobPath(job)}`;
}

/** The slug stored on a new job, so its canonical URL is right from the start. */
export function buildJobSlug(title: string | null | undefined, id: number): string {
  const base = slugifyTitle(title ?? "");
  return base ? `${base}-${id}` : `arts-job-${id}`;
}
