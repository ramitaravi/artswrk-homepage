/**
 * Close jobs whose date has gone by.
 *
 * Nothing expired them, so 223 jobs sat marked Active with a date already in
 * the past. They clutter the board, they pad the counts Kylie pushes from, and
 * an artist applying to a class that happened last week is a bad first
 * impression nobody intended.
 *
 * Deliberately conservative:
 *  - only jobs with a real start date; a date-TBD job has not expired, it has
 *    just not been scheduled
 *  - a grace day after the date, so a job today is never closed mid-morning
 *  - only "Active"; a Paused or Archived job is already somebody's decision
 *  - never touches a job that has confirmed bookings on it
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/** A day's grace, so nothing closes on the morning of the job itself. */
export const EXPIRY_GRACE_DAYS = 1;

export async function expirePastJobs(opts: { dryRun?: boolean } = {}): Promise<{
  expired: number;
  ids: number[];
}> {
  const db = await getDb();
  if (!db) return { expired: 0, ids: [] };

  const [rows] = await db.execute(sql`
    SELECT j.id FROM jobs j
    WHERE j.requestStatus = 'Active'
      AND j.startDate IS NOT NULL
      AND j.startDate < NOW() - INTERVAL ${EXPIRY_GRACE_DAYS} DAY
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.jobId = j.id AND b.deleted = 0
          AND b.bookingStatus IN ('Confirmed', 'Pay Now')
      )`);
  const ids = (rows as unknown as Array<{ id: number }>).map((r) => r.id);
  if (!ids.length || opts.dryRun) return { expired: opts.dryRun ? ids.length : 0, ids };

  await db.execute(sql`
    UPDATE jobs SET requestStatus = 'Archived', updatedAt = NOW()
    WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);

  return { expired: ids.length, ids };
}

/** Cron entry point. Safe to run as often as you like; it is a no-op when clean. */
export async function handleScheduledJobExpiry(_req: unknown, res: any) {
  try {
    const result = await expirePastJobs();
    if (result.expired) console.log(`[expireJobs] archived ${result.expired} past-dated jobs`);
    res.json({ ok: true, expired: result.expired });
  } catch (err) {
    console.error("[expireJobs] failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ ok: false });
  }
}
