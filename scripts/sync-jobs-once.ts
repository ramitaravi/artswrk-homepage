import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleJob = Record<string, unknown> & { _id: string };

export function limitJobText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function serializeBubbleList(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return JSON.stringify(value);
}

export function bubbleBoolean(value: unknown): number {
  return value === true ? 1 : 0;
}

export function safeJobNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseBubbleLocation(value: unknown): {
  address: string | null;
  lat: string | null;
  lng: string | null;
} {
  if (typeof value === "string") return { address: value || null, lat: null, lng: null };
  if (!value || typeof value !== "object") return { address: null, lat: null, lng: null };
  const location = value as { address?: unknown; lat?: unknown; lng?: unknown };
  return {
    address: typeof location.address === "string" ? location.address : null,
    lat: location.lat == null ? null : String(location.lat),
    lng: location.lng == null ? null : String(location.lng),
  };
}

function readBubbleToken(): string {
  if (process.env.BUBBLE_API_KEY) return process.env.BUBBLE_API_KEY;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(root, "scripts/sync-all.mjs"), "utf8");
  const fallback = source.match(/BUBBLE_API_KEY\s*=\s*process\.env\.BUBBLE_API_KEY\s*\|\|\s*"([^"]+)"/)?.[1];
  if (!fallback) throw new Error("Bubble API credential is unavailable");
  return fallback;
}

async function fetchBubbleJobs(token: string): Promise<BubbleJob[]> {
  const base = "https://artswrk.com/version-live/api/1.1/obj/Request";
  const jobs: BubbleJob[] = [];
  let cursor = 0;
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble Request API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleJob[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    jobs.push(...batch);
    process.stdout.write(`\rFetched ${jobs.length} Bubble jobs`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return jobs;
}

const JOB_COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "clientUserId", "bubbleClientId", "bubbleCreatedById",
  "bubbleClientCompanyId", "bubbleArtistId", "bubbleArtistTypeId", "bubbleBookingIds",
  "bubbleInterestedArtistIds", "bubbleInterestedArtistUserIds", "description", "title", "slug",
  "requestStatus", "status", "dateType", "dateDetails", "startDate", "endDate",
  "locationAddress", "locationLat", "locationLng", "isHourly", "openRate", "artistHourlyRate",
  "clientHourlyRate", "artistFlatRate", "clientFlatRate", "hours", "rateType", "ages", "direct",
  "sentToNetwork", "transportation", "transportationDetails", "converted", "sameDay", "unlocked",
  "outreachStatus", "sentTo", "masterServiceTypeId", "bubbleMasterStyleIds", "clientEmail",
  "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

function mapJob(job: BubbleJob, userMap: Map<string, number>) {
  const bubbleClientId = limitJobText(job.client, 64);
  const bubbleCreatedById = limitJobText(job["Created By"], 64);
  const clientUserId =
    (bubbleClientId ? userMap.get(bubbleClientId) : undefined) ??
    (bubbleCreatedById ? userMap.get(bubbleCreatedById) : undefined) ??
    null;
  const location = parseBubbleLocation(job.location ?? job.Location);
  const values = [
    job._id,
    1,
    clientUserId,
    bubbleClientId,
    bubbleCreatedById,
    limitJobText(job["client company"] ?? job["Client-Company"], 64),
    limitJobText(job.artist, 64),
    limitJobText(job["artist type"], 64),
    serializeBubbleList(job.bookings),
    serializeBubbleList(job["Interested Artists"]),
    serializeBubbleList(job["interested artists users"]),
    job.description ?? job.Description ?? null,
    limitJobText(job["Job Title"], 256),
    limitJobText(job.Slug ?? job.slug, 256),
    limitJobText(job["Request Status"] ?? job["Request status"], 64),
    limitJobText(job.Status, 64),
    limitJobText(job.DateType ?? job["Date type"] ?? job["date type"], 32),
    job["date details"] ?? null,
    safeDate(job["start date"] ?? job["Start date"]),
    safeDate(job["end date"] ?? job["End date"]),
    location.address,
    limitJobText(location.lat, 32),
    limitJobText(location.lng, 32),
    bubbleBoolean(job["is hourly?"] ?? job["Is Hourly?"]),
    bubbleBoolean(job["open rate?"] ?? job["Open Rate?"]),
    safeJobNumber(job["artist hourly rate"] ?? job["Artist Hourly Rate"]),
    safeJobNumber(job["client hourly rate"] ?? job["Client Hourly Rate"]),
    safeJobNumber(job["artist flat rate"]),
    safeJobNumber(job["client flat rate"]),
    safeJobNumber(job.hours),
    limitJobText(job.option_rateType, 64),
    Array.isArray(job.ages) ? JSON.stringify(job.ages) : job.ages ?? null,
    bubbleBoolean(job["direct?"] ?? job["Direct?"]),
    bubbleBoolean(job["sent to network?"] ?? job["Sent to Network?"]),
    bubbleBoolean(job["tranportation?"] ?? job["transportation?"] ?? job["Transportation?"]),
    job["transportation details"] ?? null,
    bubbleBoolean(job["converted?"] ?? job["Converted?"]),
    bubbleBoolean(job["sameDay?"]),
    bubbleBoolean(job["unlock?"]),
    limitJobText(job["outreach status"], 128),
    serializeBubbleList(job["sent to"]),
    limitJobText(job["master service type"] ?? job["Master Service Type"], 64),
    serializeBubbleList(job["master styles"]),
    limitJobText(job["client email"] ?? job["Client Email"], 320),
    safeDate(job["Created Date"]),
    safeDate(job["Modified Date"]),
  ];
  return values;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const jobs = await fetchBubbleJobs(readBubbleToken());
  const sourceIds = new Set(jobs.map((job) => job._id));
  if (jobs.length === 0 || jobs.length !== sourceIds.size) {
    throw new Error("Bubble Request source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM users WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [existingRows] = await conn.execute<RowDataPacket[]>("SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
  const existingByBubbleId = new Map(existingRows.map((row) => [String(row.bubbleId), Number(row.id)]));

  const planned = {
    sourceJobs: jobs.length,
    update: jobs.filter((job) => existingByBubbleId.has(job._id)).length,
    insert: jobs.filter((job) => !existingByBubbleId.has(job._id)).length,
    unresolvedClients: jobs.filter((job) => {
      const bubbleClientId = limitJobText(job.client, 64);
      const bubbleCreatedById = limitJobText(job["Created By"], 64);
      const hasSourceOwner = Boolean(bubbleClientId || bubbleCreatedById);
      const resolved =
        (bubbleClientId ? userMap.has(bubbleClientId) : false) ||
        (bubbleCreatedById ? userMap.has(bubbleCreatedById) : false);
      return hasSourceOwner && !resolved;
    }).length,
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  const columnSql = JOB_COLUMNS.map((column) => `\`${column}\``).join(", ");
  const updateSql = JOB_COLUMNS.slice(1).map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(", ");
  const placeholders = JOB_COLUMNS.map(() => "?").join(", ");

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE jobs SET bubbleSourcePresent = 0");
    let processed = 0;
    for (const job of jobs) {
      await conn.execute(
        `INSERT INTO jobs (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSql}`,
        mapJob(job, userMap),
      );
      processed += 1;
      if (processed % 250 === 0) process.stdout.write(`\rApplied ${processed}/${jobs.length} jobs`);
    }
    process.stdout.write("\n");

    const [validationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS flaggedRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(clientUserId IS NOT NULL) AS resolvedClients,
             SUM(bubbleClientId IS NOT NULL AND clientUserId IS NULL) AS unresolvedClients
      FROM jobs WHERE bubbleSourcePresent = 1
    `);
    const validation = validationRows[0];
    if (Number(validation.flaggedRows) !== jobs.length || Number(validation.distinctBubbleIds) !== sourceIds.size) {
      throw new Error(`Job validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const statusCounts = jobs.reduce<Record<string, number>>((counts, job) => {
      const status = String(job["Request Status"] ?? job["Request status"] ?? "(null)");
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const report = { appliedAt: new Date().toISOString(), planned, validation, sourceStatusCounts: statusCounts };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/jobs-sync-${timestamp}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`REPORT=${outputPath}`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
