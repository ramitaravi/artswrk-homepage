/**
 * THE LAST-MINUTE PATH
 * ─────────────────────────────────────────────────────────────────────────────
 * A job starting within 48 hours can't wait for 1 PM, so it goes out
 * immediately: one job per email, urgent template, targeted matches only.
 *
 * No broad-reach equivalent, deliberately. These are unbatched, immediate
 * sends; broadcasting them is precisely the spam risk the whole system exists
 * to avoid. PRO jobs can never arrive here either — premium_jobs has no start
 * date, so "starts within 48 hours" cannot be evaluated for them.
 *
 * Hard cap: 3 per artist per rolling 24 hours. A fourth is skipped and written
 * to the log as `capped`, so a skip is visible in reporting rather than looking
 * like a matching failure.
 */
import { getDb } from "../db";
import { sendHtmlEmail, ASM_GROUP_JOB_ALERTS } from "../email";
import { findMatchingArtists, lastMinuteCountLast24h, type JobForMatching } from "./matching";
import { renderLastMinute, excerpt } from "./templates";
import { formatWhen, formatRate, formatLocation, jobTitle, toPublicJobUrl } from "./format";
import { decideSend, describeMode, loadSendPolicy } from "./safety";
import { unsubscribeUrl } from "./unsubscribe";

const WINDOW_HOURS = 48;
const DAILY_CAP = 3;

export interface LastMinuteResult {
  mode: string;
  jobId: number;
  eligible: boolean;
  reason?: string;
  matched: number;
  sent: number;
  capped: number;
  skipped: number;
  plan: Array<{ userId: number; email: string; willSend: boolean; reason?: string }>;
}

const appUrl = () => process.env.VITE_APP_URL || "https://app.artswrk.com";

/** Does this job start inside the urgent window? */
export function isLastMinute(startDate: Date | null | undefined, now = new Date()): boolean {
  if (!startDate) return false;
  const ms = startDate.getTime() - now.getTime();
  return ms > 0 && ms < WINDOW_HOURS * 3600 * 1000;
}

/**
 * Called when a job becomes Active, and again if an edit moves its start date
 * into the window. Safe to call more than once for the same job: the send log
 * excludes anyone already emailed about it.
 */
export async function maybeSendLastMinute(jobId: number): Promise<LastMinuteResult> {
  const policy = await loadSendPolicy();
  const base: LastMinuteResult = {
    mode: describeMode(policy), jobId, eligible: false,
    matched: 0, sent: 0, capped: 0, skipped: 0, plan: [],
  };
  const db = await getDb();
  if (!db) return { ...base, reason: "no database" };

  const rows: any = await db.execute(`
    SELECT j.id, j.title, j.slug, j.description, j.startDate, j.endDate, j.dateType,
           j.locationAddress, j.locationCity, j.locationState, j.locationLat, j.locationLng,
           j.isHourly, j.openRate, j.clientHourlyRate, j.clientFlatRate, j.hours,
           j.transportation, j.transportationDetails,
           j.masterServiceTypeId, j.clientUserId, j.networkStatus, j.requestStatus,
           m.name AS svc,
           COALESCE(cc.name, u.clientCompanyName,
             NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client
    FROM jobs j
    LEFT JOIN users u ON j.clientUserId = u.id
    LEFT JOIN client_companies cc ON j.clientCompanyId = cc.id
    LEFT JOIN master_service_types m ON m.bubbleId = j.masterServiceTypeId
    WHERE j.id = ${Number(jobId)}`);
  const job = (Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [])[0];

  if (!job) return { ...base, reason: "job not found" };
  if (job.requestStatus !== "Active") return { ...base, reason: `status is ${job.requestStatus}` };
  if (job.networkStatus === "suppressed") return { ...base, reason: "suppressed" };
  if (job.networkStatus === "sent_lastminute") return { ...base, reason: "already sent" };
  const start = job.startDate ? new Date(job.startDate) : null;
  if (!isLastMinute(start)) return { ...base, reason: "starts outside the 48h window" };

  const lat = job.locationLat != null ? Number(job.locationLat) : null;
  const lng = job.locationLng != null ? Number(job.locationLng) : null;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const matchable: JobForMatching = {
    id: job.id, isPremium: false,
    masterServiceTypeId: job.masterServiceTypeId ?? null,
    lat: hasCoords ? lat : null, lng: hasCoords ? lng : null,
    isRemote: !hasCoords, ownerUserId: job.clientUserId ?? null,
  };

  const { artists } = await findMatchingArtists(matchable);
  const result: LastMinuteResult = { ...base, eligible: true, matched: artists.length };

  const { subject, html: _probe } = renderLastMinute(previewData(job, "there"));
  void _probe;

  for (const a of artists) {
    // Read the cap immediately before queueing — it is per artist, not per
    // job, so a count taken once at the top lets a fourth email through.
    const already = await lastMinuteCountLast24h(a.userId);
    if (already >= DAILY_CAP) {
      result.capped++;
      await logLastMinute(db, job.id, a.userId, "capped");
      result.plan.push({ userId: a.userId, email: a.email, willSend: false, reason: "capped" });
      continue;
    }

    const decision = decideSend(policy, a.email);
    result.plan.push({
      userId: a.userId, email: a.email, willSend: decision.send,
      ...(decision.send ? {} : { reason: decision.reason }),
    });
    if (!decision.send) { result.skipped++; continue; }

    const rendered = renderLastMinute(previewData(job, a.firstName, a.userId));
    const { ok, messageId } = await sendHtmlEmail({
      to: a.email, subject: rendered.subject, html: rendered.html,
      asmGroupId: ASM_GROUP_JOB_ALERTS,
      unsubscribeUrl: unsubscribeUrl(appUrl(), a.userId),
    });
    await logLastMinute(db, job.id, a.userId, ok ? "sent" : "failed", messageId);
    if (ok) result.sent++; else result.skipped++;
  }

  if (policy.enabled) {
    await db.execute(
      `UPDATE jobs SET networkStatus='sent_lastminute', networkSentAt=NOW() WHERE id=${job.id}`
    );
  }

  void subject;
  return result;
}

function previewData(job: any, firstName: string, userId?: number) {
  return {
    firstName,
    serviceName: job.svc || jobTitle(job),
    title: jobTitle(job),
    client: job.client || null,
    whenLabel: formatWhen(job.startDate ? new Date(job.startDate) : null,
                          job.endDate ? new Date(job.endDate) : null, job.dateType) || "Starting soon",
    location: formatLocation(job.locationAddress, job.locationCity, job.locationState),
    transportationNote: job.transportation ? (job.transportationDetails || "Travel reimbursed") : null,
    rateLabel: formatRate(job),
    excerpt: excerpt(job.description),
    applyUrl: toPublicJobUrl(appUrl(), job),
    preferencesUrl: `${appUrl()}/app/settings?section=notifications`,
    unsubscribeUrl: userId != null ? unsubscribeUrl(appUrl(), userId) : `${appUrl()}/unsubscribe`,
  };
}

async function logLastMinute(
  db: any, jobId: number, userId: number,
  status: "sent" | "capped" | "failed", messageId?: string
) {
  const mid = messageId ? `'${String(messageId).replace(/'/g, "''")}'` : "NULL";
  await db.execute(`
    INSERT IGNORE INTO email_send_log (jobId, userId, sendType, status, providerMessageId, recipientCount, sentAt)
    VALUES (${jobId}, ${userId}, 'lastminute', '${status}', ${mid}, 1, NOW())`);
}
