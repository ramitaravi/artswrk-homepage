/**
 * JOB ALERT MATCHING
 * ─────────────────────────────────────────────────────────────────────────────
 * The single implementation of §2–3 of docs/job-alerts-spec.md. Both send paths
 * use it: the daily digest, and the last-minute path (which is this plus a cap).
 *
 * Two populations come out of here and they are NOT interchangeable:
 *
 *   targeted  — passed the service-type AND distance tests. Presence of a
 *               targeted match is what causes a digest to be sent at all.
 *   broad     — eligible only, no service-type or distance test. PRO jobs with
 *               no service type mapped. Ride-along content: appears inside an
 *               email that a targeted match already earned, and can never
 *               trigger one on its own.
 *
 * Getting that asymmetry wrong is the difference between "PRO jobs reach
 * everyone, free" and "everyone gets an email every day".
 */
import { getDb } from "../db";
import { distanceMiles, DEFAULT_RADIUS_MILES } from "@shared/location";

/** One artist who should see a given job. */
export interface MatchedArtist {
  userId: number;
  email: string;
  firstName: string;
  isPro: boolean;
  /** Miles from the job. null when the job is remote or has no coordinates. */
  distance: number | null;
}

export interface JobForMatching {
  /** jobs.id, or premium_jobs.id when isPro is set. */
  id: number;
  isPremium: boolean;
  /** Bubble master_service_type id. Null on a PRO job = broad reach. */
  masterServiceTypeId: string | null;
  lat: number | null;
  lng: number | null;
  /** PRO "work from anywhere", or a regular job with no coordinates. */
  isRemote: boolean;
  /** users.id of whoever posted it — never matched to their own job. */
  ownerUserId: number | null;
}

/**
 * Bounding-box padding, in degrees.
 *
 * One degree of LATITUDE is ~69 miles everywhere, so this figure is correct
 * north-south. One degree of LONGITUDE is 69 * cos(latitude) miles — only ~52
 * at New York's latitude — so the same number of degrees covers far FEWER
 * miles east-west. Using this value for both (as an earlier version did) made
 * the box 41 miles wide instead of 50 and silently dropped genuine matches
 * before the exact haversine ever saw them.
 *
 * lngPadding() below divides it back out. The box only has to be generous; the
 * haversine trims whatever it over-selects.
 */
const BOX_DEGREES = DEFAULT_RADIUS_MILES / 69 + 0.05;

/** Longitude padding that really covers BOX_DEGREES worth of miles at this
 *  latitude. Clamped near the poles, where cos() collapses toward zero. */
function lngPadding(lat: number): number {
  const shrink = Math.cos((lat * Math.PI) / 180);
  return BOX_DEGREES / Math.max(0.2, shrink);
}

/**
 * Artists who should receive this job.
 *
 * A job with no service type is broad-reach ONLY if it is a PRO job; a regular
 * job without one is a data error and matches nobody rather than broadcasting.
 */
export async function findMatchingArtists(job: JobForMatching): Promise<{
  artists: MatchedArtist[];
  mode: "targeted" | "broad";
}> {
  const db = await getDb();
  if (!db) return { artists: [], mode: "targeted" };

  const broad = job.isPremium && !job.masterServiceTypeId;
  if (!job.isPremium && !job.masterServiceTypeId) {
    // Regular job with no service type: never broadcast.
    return { artists: [], mode: "targeted" };
  }

  const useDistance = !broad && !job.isRemote && job.lat != null && job.lng != null;

  // Service type test. user_notification_settings is authoritative once a row
  // exists; until then we fall back to the artist's profile service types, so
  // the system works for every artist without a seeding step having to have run
  // first. New settings rows simply override.
  const serviceClause = broad
    ? ""
    : `AND JSON_CONTAINS(COALESCE(NULLIF(s.serviceTypes,''), NULLIF(u.masterServiceType,''), '[]'),
                         JSON_QUOTE(${escape(job.masterServiceTypeId!)}))`;

  // Bounding box prefilter — cheap, index-friendly, trimmed by haversine below.
  const boxClause = useDistance
    ? `AND u.locationLat IS NOT NULL AND u.locationLng IS NOT NULL
       AND CAST(u.locationLat AS DECIMAL(10,6)) BETWEEN ${job.lat! - BOX_DEGREES} AND ${job.lat! + BOX_DEGREES}
       AND CAST(u.locationLng AS DECIMAL(10,6)) BETWEEN ${job.lng! - lngPadding(job.lat!)} AND ${job.lng! + lngPadding(job.lat!)}`
    : "";

  const appliedClause = job.isPremium
    ? `AND NOT EXISTS (SELECT 1 FROM premium_job_interested_artists pia
                       WHERE pia.premiumJobId = ${job.id} AND pia.artistUserId = u.id)`
    : `AND NOT EXISTS (SELECT 1 FROM interested_artists ia
                       WHERE ia.jobId = ${job.id} AND ia.artistUserId = u.id)`;

  const logClause = job.isPremium
    ? `AND NOT EXISTS (SELECT 1 FROM email_send_log l WHERE l.premiumJobId = ${job.id} AND l.userId = u.id)`
    : `AND NOT EXISTS (SELECT 1 FROM email_send_log l WHERE l.jobId = ${job.id} AND l.userId = u.id)`;

  const ownerClause = job.ownerUserId != null ? `AND u.id <> ${job.ownerUserId}` : "";

  const rows: any = await db.execute(`
    SELECT u.id, u.email, u.firstName, u.name, u.planTier, u.artswrkPro,
           u.locationLat, u.locationLng
    FROM users u
    LEFT JOIN user_notification_settings s ON s.userId = u.id
    WHERE u.userRole = 'Artist'
      AND u.email IS NOT NULL AND u.email <> ''
      -- E2: opted in. No settings row = opted in by default, but the legacy
      -- users.unsubscribe flag still counts as an opt-out.
      AND COALESCE(s.jobEmailsEnabled, 1) = 1
      AND COALESCE(u.unsubscribe, 0) = 0
      -- E3: not suppressed, by us or by a provider event
      AND NOT EXISTS (SELECT 1 FROM email_suppressions e WHERE e.email = LOWER(u.email))
      ${ownerClause}
      ${serviceClause}
      ${boxClause}
      ${appliedClause}
      ${logClause}
  `);

  const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];

  const artists: MatchedArtist[] = [];
  for (const r of list) {
    let distance: number | null = null;
    if (useDistance) {
      const aLat = Number(r.locationLat), aLng = Number(r.locationLng);
      if (!Number.isFinite(aLat) || !Number.isFinite(aLng)) continue;
      distance = distanceMiles({ lat: job.lat!, lng: job.lng! }, { lat: aLat, lng: aLng });
      // The box is generous on purpose; this is the real test.
      if (distance > DEFAULT_RADIUS_MILES) continue;
    }
    artists.push({
      userId: r.id,
      email: String(r.email),
      firstName: r.firstName || String(r.name ?? "").split(" ")[0] || "there",
      isPro: r.planTier === "artist_pro" || r.artswrkPro === 1 || r.artswrkPro === true,
      distance,
    });
  }

  return { artists, mode: broad ? "broad" : "targeted" };
}

/**
 * How many last-minute emails this artist has had in the trailing 24 hours.
 * Read immediately before queueing — the cap is per artist, not per job, so a
 * stale count lets a fourth email through.
 */
export async function lastMinuteCountLast24h(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows: any = await db.execute(`
    SELECT COUNT(*) AS n FROM email_send_log
    WHERE userId = ${userId} AND sendType = 'lastminute' AND status = 'sent'
      AND sentAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
  const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
  return Number(list[0]?.n ?? 0);
}

/** Single-quote escaping for the one interpolated string value above. */
function escape(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}
