/**
 * THE DAILY DIGEST
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements §3 of docs/job-alerts-spec.md. Runs at 1:00 PM ET, content-gated:
 * an artist hears from us only on a day they have a real match.
 *
 * The loop is inverted on purpose. Matching is naturally per-job ("who wants
 * this?"), but an email is per-artist ("what does she get?"), so jobs are
 * matched first and the results pivoted into one bucket per artist. Sending
 * per-job instead would mean ten separate emails on a busy day.
 */
import { getDb } from "../db";
import { sendHtmlEmail, ASM_GROUP_JOB_ALERTS } from "../email";
import { findMatchingArtists, type JobForMatching, type MatchedArtist } from "./matching";
import { renderDigest, type DigestData } from "./templates";
import { toJobCard, toProCard } from "./format";
import { decideSend, describeMode, loadSendPolicy } from "./safety";
import { unsubscribeUrl } from "./unsubscribe";

const MAX_JOB_CARDS = 10;
const MAX_PRO_ITEMS = 5;

export interface DigestResult {
  mode: string;
  pendingJobs: number;
  pendingProJobs: number;
  recipients: number;
  sent: number;
  skipped: number;
  /** Per-artist breakdown — the whole point of a dry run. */
  plan: Array<{
    userId: number;
    email: string;
    firstName: string;
    isPro: boolean;
    targeted: number;
    ridealong: number;
    subject: string;
    willSend: boolean;
    reason?: string;
  }>;
}

type Bucket = {
  artist: MatchedArtist;
  targetedJobs: any[];
  targetedPro: any[];
  ridealongPro: any[];
};

const appUrl = () => process.env.VITE_APP_URL || "https://app.artswrk.com";

/**
 * True when it is currently the 1 PM hour in New York. The platform cron is
 * UTC, and 1 PM ET is 17:00 UTC in summer but 18:00 in winter — so the job is
 * scheduled hourly and returns immediately except in the right local hour.
 * Self-correcting across DST, and a missed run is picked up the next hour
 * instead of skipping a day.
 */
export function isDigestHour(now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", hour12: false,
    }).format(now)
  );
  return hour === 13;
}

export interface RunOptions {
  /**
   * Treat these job ids as if they were pending, whatever their real
   * networkStatus, and DO NOT advance any job's status afterwards. This is how
   * you test against a real job without disturbing the queue — every existing
   * job is quarantined as 'suppressed', so without it a dry run has nothing to
   * chew on and tells you nothing.
   */
  simulateJobIds?: number[];
  simulateProJobIds?: number[];
}

export async function runDigest(opts: RunOptions = {}): Promise<DigestResult> {
  const simulating = !!(opts.simulateJobIds?.length || opts.simulateProJobIds?.length);
  const policy = await loadSendPolicy();
  const db = await getDb();
  const empty: DigestResult = {
    mode: describeMode(policy), pendingJobs: 0, pendingProJobs: 0,
    recipients: 0, sent: 0, skipped: 0, plan: [],
  };
  if (!db) return empty;

  // Pending regular jobs whose start date hasn't already passed.
  const jobRows: any = await db.execute(`
    SELECT j.id, j.title, j.slug, j.description, j.startDate, j.endDate, j.dateType,
           j.locationAddress, j.locationCity, j.locationState, j.locationLat, j.locationLng,
           j.isHourly, j.openRate, j.clientHourlyRate, j.clientFlatRate, j.hours,
           j.masterServiceTypeId, j.clientUserId, m.name AS svc,
           COALESCE(cc.name, u.clientCompanyName,
             NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client
    FROM jobs j
    LEFT JOIN users u ON j.clientUserId = u.id
    LEFT JOIN client_companies cc ON j.clientCompanyId = cc.id
    LEFT JOIN master_service_types m ON m.bubbleId = j.masterServiceTypeId
    WHERE ${opts.simulateJobIds?.length
             ? `j.id IN (${opts.simulateJobIds.map(Number).join(",")})`
             : `j.networkStatus = 'pending' AND j.requestStatus = 'Active'
                AND (j.startDate IS NULL OR j.startDate > NOW())`}`);
  const jobs: any[] = unwrap(jobRows);

  const proRows: any = await db.execute(`
    SELECT p.id, p.serviceType, p.slug, p.company, p.description, p.location,
           p.locationLat, p.locationLng, p.budget, p.workFromAnywhere,
           p.masterServiceTypeId, p.createdByUserId
    FROM premium_jobs p
    WHERE ${opts.simulateProJobIds?.length
             ? `p.id IN (${opts.simulateProJobIds.map(Number).join(",")})`
             : `p.networkStatus = 'pending' AND p.status = 'Active'`}`);
  const proJobs: any[] = unwrap(proRows);

  const buckets = new Map<number, Bucket>();
  const put = (a: MatchedArtist, key: keyof Omit<Bucket, "artist">, row: any) => {
    let b = buckets.get(a.userId);
    if (!b) { b = { artist: a, targetedJobs: [], targetedPro: [], ridealongPro: [] }; buckets.set(a.userId, b); }
    b[key].push(row);
  };

  for (const j of jobs) {
    const { artists } = await findMatchingArtists(toMatchable(j, false));
    for (const a of artists) put(a, "targetedJobs", j);
  }
  for (const p of proJobs) {
    const { artists, mode } = await findMatchingArtists(toMatchable(p, true));
    for (const a of artists) put(a, mode === "broad" ? "ridealongPro" : "targetedPro", p);
  }

  const result: DigestResult = {
    mode: describeMode(policy),
    pendingJobs: jobs.length,
    pendingProJobs: proJobs.length,
    recipients: 0, sent: 0, skipped: 0, plan: [],
  };

  for (const b of buckets.values()) {
    const targetedCount = b.targetedJobs.length + b.targetedPro.length;
    // THE GATE. Ride-along PRO jobs are content, never a trigger — an artist
    // with only ride-along matches gets nothing today.
    if (targetedCount === 0) continue;

    result.recipients++;

    const ordered = [...b.targetedJobs].sort(compareJobs);
    const cards = ordered.slice(0, MAX_JOB_CARDS).map((r) => toJobCard(r, appUrl()));
    // Targeted PRO first — they actually matched this artist's services.
    const pro = [...b.targetedPro, ...b.ridealongPro].slice(0, MAX_PRO_ITEMS)
      .map((r) => toProCard(r, appUrl()));

    const data: DigestData = {
      firstName: b.artist.firstName,
      jobs: cards,
      totalMatchCount: ordered.length,
      proJobs: pro,
      isProMember: b.artist.isPro,
      jobsUrl: `${appUrl()}/jobs`,
      preferencesUrl: `${appUrl()}/app/settings?section=notifications`,
      unsubscribeUrl: unsubscribeUrl(appUrl(), b.artist.userId),
    };
    const { subject, html } = renderDigest(data);

    const decision = decideSend(policy, b.artist.email);
    result.plan.push({
      userId: b.artist.userId, email: b.artist.email, firstName: b.artist.firstName,
      isPro: b.artist.isPro, targeted: targetedCount, ridealong: b.ridealongPro.length,
      subject, willSend: decision.send,
      ...(decision.send ? {} : { reason: decision.reason }),
    });

    if (!decision.send) { result.skipped++; continue; }

    const { ok, messageId } = await sendHtmlEmail({
      to: b.artist.email,
      subject,
      html,
      asmGroupId: ASM_GROUP_JOB_ALERTS,
      unsubscribeUrl: data.unsubscribeUrl,
    });

    // Log every job the artist saw — targeted AND ride-along. Without the
    // ride-along rows those PRO jobs reappear in every future digest.
    for (const j of ordered.slice(0, MAX_JOB_CARDS)) {
      await logSend(db, { jobId: j.id, userId: b.artist.userId, ok, messageId });
    }
    for (const p of [...b.targetedPro, ...b.ridealongPro].slice(0, MAX_PRO_ITEMS)) {
      await logSend(db, { premiumJobId: p.id, userId: b.artist.userId, ok, messageId });
    }
    if (ok) result.sent++; else result.skipped++;
  }

  // Mark the batch done regardless of recipient count. A job that matched
  // nobody must not sit pending and be retried forever — §2 of the spec.
  // Never advance status while simulating: a test must leave the queue exactly
  // as it found it.
  if (!simulating && policy.enabled) {
    if (jobs.length) {
      await db.execute(`UPDATE jobs SET networkStatus='sent_digest', networkSentAt=NOW()
                        WHERE id IN (${jobs.map((j) => j.id).join(",")})`);
    }
    if (proJobs.length) {
      await db.execute(`UPDATE premium_jobs SET networkStatus='sent_digest', networkSentAt=NOW()
                        WHERE id IN (${proJobs.map((p) => p.id).join(",")})`);
    }
  }

  return result;
}

/** Soonest start first, then highest rate — the §5 ordering. */
function compareJobs(a: any, b: any): number {
  const at = a.startDate ? new Date(a.startDate).getTime() : Infinity;
  const bt = b.startDate ? new Date(b.startDate).getTime() : Infinity;
  if (at !== bt) return at - bt;
  return (b.clientHourlyRate ?? b.clientFlatRate ?? 0) - (a.clientHourlyRate ?? a.clientFlatRate ?? 0);
}

function toMatchable(row: any, isPremium: boolean): JobForMatching {
  const lat = row.locationLat != null ? Number(row.locationLat) : null;
  const lng = row.locationLng != null ? Number(row.locationLng) : null;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  return {
    id: row.id,
    isPremium,
    masterServiceTypeId: row.masterServiceTypeId ?? null,
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    isRemote: !hasCoords || row.workFromAnywhere === 1 || row.workFromAnywhere === true,
    ownerUserId: isPremium ? row.createdByUserId ?? null : row.clientUserId ?? null,
  };
}

async function logSend(
  db: any,
  { jobId, premiumJobId, userId, ok, messageId }:
    { jobId?: number; premiumJobId?: number; userId: number; ok: boolean; messageId?: string }
) {
  const mid = messageId ? `'${String(messageId).replace(/'/g, "''")}'` : "NULL";
  await db.execute(`
    INSERT IGNORE INTO email_send_log (jobId, premiumJobId, userId, sendType, status, providerMessageId, recipientCount, sentAt)
    VALUES (${jobId ?? "NULL"}, ${premiumJobId ?? "NULL"}, ${userId}, 'digest', '${ok ? "sent" : "failed"}', ${mid}, 1, NOW())`);
}

function unwrap(rows: any): any[] {
  return Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
}
