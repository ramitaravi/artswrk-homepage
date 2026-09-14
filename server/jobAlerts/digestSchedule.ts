/**
 * DIGEST SCHEDULE — one-off overrides for the 1 PM digest, keyed by Eastern date.
 *
 *   app_settings.job_alerts_schedule = {"2026-09-15":"pro","2026-09-16":"jobs"}
 *
 *   "pro"   PRO jobs only, in their own email. Regular jobs stay queued for the next run.
 *   "jobs"  Regular jobs only. PRO jobs stay queued.
 *
 * Any date that isn't listed — or a missing or malformed setting — runs the normal
 * combined digest, so a bad value can only ever fall back to normal behaviour.
 */
export type DigestMode = "combined" | "pro" | "jobs";

export const DIGEST_SCHEDULE_KEY = "job_alerts_schedule";

export function digestModeFor(scheduleJson: string | null | undefined, dateEt: string): DigestMode {
  if (!scheduleJson) return "combined";
  try {
    const mode = JSON.parse(scheduleJson)?.[dateEt];
    return mode === "pro" || mode === "jobs" ? mode : "combined";
  } catch {
    return "combined";
  }
}
