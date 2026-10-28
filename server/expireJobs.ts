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
import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { requireCronRequest } from "./_core/cronAuth";
import { getDb } from "./db";

/** A day's grace, so nothing closes on the morning of the job itself. */
export const EXPIRY_GRACE_DAYS = 1;

/** Date types whose first start is not the end of the engagement. */
const ONGOING_DATE_TYPES = ["Weekly", "Ongoing", "Dates Flexible", "Recurring"] as const;
const MULTIPLE_DATES = "Multiple Dates";
const ACTIVE = "Active";
const ARCHIVED = "Archived";
const BOOKING_STATUSES_THAT_KEEP_A_JOB_OPEN = ["Confirmed", "Pay Now"] as const;

export type JobExpiryDates = {
  dateType?: string | null;
  startDate?: unknown;
  endDate?: unknown;
};

const validDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Whether a job's date rule has elapsed. This mirrors the SQL predicate below
 * so date-type behavior can be tested without a database.
 */
export function isPastJobExpiryDate(job: JobExpiryDates, now: Date = new Date()): boolean {
  const start = validDate(job.startDate);
  if (!start) return false;

  const cutoff = now.getTime() - EXPIRY_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const hasElapsedValidEnd = () => {
    const end = validDate(job.endDate);
    return !!end && end > start && end.getTime() < cutoff;
  };

  if (ONGOING_DATE_TYPES.includes(job.dateType as (typeof ONGOING_DATE_TYPES)[number])) {
    return hasElapsedValidEnd();
  }
  if (job.dateType === MULTIPLE_DATES) return hasElapsedValidEnd();
  return start.getTime() < cutoff;
}

/**
 * The full condition is intentionally reused by the read and write. In
 * particular, the write rechecks Active status, date eligibility, and booking
 * status in case any of them changed after the candidate IDs were selected.
 */
function eligibleForExpirySql() {
  const ongoingTypes = sql.join(ONGOING_DATE_TYPES.map((type) => sql`${type}`), sql`, `);
  const protectedBookingStatuses = sql.join(
    BOOKING_STATUSES_THAT_KEEP_A_JOB_OPEN.map((status) => sql`${status}`),
    sql`, `,
  );
  const elapsedValidEnd = sql`
    j.endDate IS NOT NULL
    AND j.endDate > j.startDate
    AND j.endDate < NOW() - INTERVAL ${EXPIRY_GRACE_DAYS} DAY`;

  return sql`
    j.requestStatus = ${ACTIVE}
    AND j.startDate IS NOT NULL
    AND (
      (COALESCE(j.dateType, '') IN (${ongoingTypes}) AND ${elapsedValidEnd})
      OR (COALESCE(j.dateType, '') = ${MULTIPLE_DATES} AND ${elapsedValidEnd})
      OR (
        COALESCE(j.dateType, '') NOT IN (${ongoingTypes})
        AND COALESCE(j.dateType, '') <> ${MULTIPLE_DATES}
        AND j.startDate < NOW() - INTERVAL ${EXPIRY_GRACE_DAYS} DAY
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.jobId = j.id AND b.deleted = ${0}
        AND b.bookingStatus IN (${protectedBookingStatuses})
    )`;
}

export async function expirePastJobs(opts: { dryRun?: boolean } = {}): Promise<{
  expired: number;
  ids: number[];
}> {
  const db = await getDb();
  if (!db) return { expired: 0, ids: [] };

  const [rows] = await db.execute(sql`
    SELECT j.id FROM jobs j
    WHERE ${eligibleForExpirySql()}`);
  const ids = (rows as unknown as Array<{ id: number }>).map((r) => r.id);
  if (!ids.length || opts.dryRun) return { expired: opts.dryRun ? ids.length : 0, ids };

  const [writeResult] = await db.execute(sql`
    UPDATE jobs AS j SET requestStatus = ${ARCHIVED}, updatedAt = NOW()
    WHERE j.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      AND ${eligibleForExpirySql()}`);
  const expired = typeof (writeResult as { affectedRows?: unknown }).affectedRows === "number"
    ? (writeResult as { affectedRows: number }).affectedRows
    : ids.length;

  return { expired, ids };
}

/** Cron entry point. Safe to run as often as you like; it is a no-op when clean. */
export async function handleScheduledJobExpiry(req: Request, res: Response): Promise<void> {
  try {
    await requireCronRequest(req);
  } catch {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }

  try {
    const result = await expirePastJobs();
    if (result.expired) console.log(`[expireJobs] archived ${result.expired} past-dated jobs`);
    res.json({ ok: true, expired: result.expired });
  } catch (err) {
    console.error("[expireJobs] failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "failed to expire jobs" });
  }
}
