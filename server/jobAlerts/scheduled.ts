/**
 * Cron entry point for the daily digest.
 *
 * Scheduled HOURLY, not daily. 1:00 PM ET is 17:00 UTC under EDT and 18:00
 * under EST, and the platform's cron is UTC — so rather than two schedules
 * swapped twice a year, this runs every hour and returns immediately unless it
 * is the 1 PM hour in New York. Self-correcting across DST, and an hour that
 * fails is retried by the next one instead of skipping the day.
 */
import type { Request, Response } from "express";
import { runDigest, isDigestHour } from "./digest";
import { describeMode, loadSendPolicy } from "./safety";
import { syncBrevoSuppressions } from "./brevoSync";

export async function handleScheduledJobAlerts(req: Request, res: Response): Promise<void> {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
  const forced = req.body?.force === true;
  if (!taskUid && !forced) {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }

  if (!isDigestHour() && !forced) {
    res.json({ skipped: true, reason: "not the 1 PM hour in America/New_York" });
    return;
  }

  console.log(`[job-alerts] digest run starting — ${describeMode(await loadSendPolicy())}`);
  res.json({ accepted: true });

  try {
    const r = await runDigest();
    console.log(
      `[job-alerts] ${r.pendingJobs} jobs / ${r.pendingProJobs} PRO → ` +
      `${r.recipients} recipients, ${r.sent} sent, ${r.skipped} held back. ${r.mode}`
    );
  } catch (err) {
    console.error("[job-alerts] digest run failed:", (err as Error).message);
  }
}

/**
 * Nightly: pull Brevo's blocked list into email_suppressions. Separate cron
 * from the digest — it is maintenance, and it must keep running even if the
 * digest is switched off.
 */
export async function handleScheduledBrevoSync(req: Request, res: Response): Promise<void> {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
  if (!taskUid && req.body?.force !== true) {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }
  res.json({ accepted: true });
  try {
    await syncBrevoSuppressions();
  } catch (err) {
    console.error("[brevo-sync] failed:", (err as Error).message);
  }
}
