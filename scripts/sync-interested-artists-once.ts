import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleApplication = Record<string, unknown> & { _id: string };

export function applicationNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function applicationText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function applicationKind(row: BubbleApplication): "standard" | "premium" | "both" | "orphan" {
  if (row.request && row.premiumjob) return "both";
  if (row.request) return "standard";
  if (row.premiumjob) return "premium";
  return "orphan";
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function readBubbleToken(): string {
  if (process.env.BUBBLE_API_KEY) return process.env.BUBBLE_API_KEY;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(root, "scripts/sync-all.mjs"), "utf8");
  const fallback = source.match(/BUBBLE_API_KEY\s*=\s*process\.env\.BUBBLE_API_KEY\s*\|\|\s*"([^"]+)"/)?.[1];
  if (!fallback) throw new Error("Bubble API credential is unavailable");
  return fallback;
}

async function fetchApplications(token: string): Promise<BubbleApplication[]> {
  const rows: BubbleApplication[] = [];
  let cursor = 0;
  const base = "https://artswrk.com/version-live/api/1.1/obj/interestedartists";
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble interestedartists API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleApplication[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rFetched ${rows.length} Bubble applications`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

const RAW_COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "bubbleCreatedById", "bubbleArtistId", "bubbleRequestId",
  "bubblePremiumJobId", "bubbleClientId", "bubbleBookingId", "bubbleServiceId", "status",
  "converted", "isHourlyRate", "artistHourlyRate", "clientHourlyRate", "artistFlatRate",
  "clientFlatRate", "premiumJobRate", "rateType", "totalHours", "startDate", "endDate",
  "resumeLink", "message", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

const STANDARD_COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "jobId", "bubbleRequestId", "artistUserId", "bubbleArtistId",
  "clientUserId", "bubbleClientId", "bubbleServiceId", "bubbleBookingId", "status", "converted",
  "isHourlyRate", "artistHourlyRate", "clientHourlyRate", "artistFlatRate", "clientFlatRate",
  "totalHours", "startDate", "endDate", "resumeLink", "message", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

const PREMIUM_COLUMNS = [
  "premiumJobId", "bubblePremiumJobId", "artistUserId", "bubbleArtistId",
  "bubbleInterestedArtistId", "message", "rate", "resumeLink", "status", "bubbleSourcePresent",
  "createdAt", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

function upsertSql(table: string, columns: readonly string[], keyColumn: string): string {
  const columnSql = columns.map((column) => `\`${column}\``).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((column) => column !== keyColumn)
    .map((column) => `\`${column}\`=VALUES(\`${column}\`)`)
    .join(", ");
  return `INSERT INTO ${table} (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const source = await fetchApplications(readBubbleToken());
  const sourceIds = new Set(source.map((row) => row._id));
  if (source.length === 0 || source.length !== sourceIds.size) {
    throw new Error("Bubble interestedartists source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM users WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [jobRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM jobs WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const jobMap = new Map(jobRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [premiumRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM premium_jobs WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const premiumMap = new Map(premiumRows.map((row) => [String(row.bubbleId), Number(row.id)]));

  const standard = source.filter((row) => Boolean(row.request));
  const premium = source.filter((row) => Boolean(row.premiumjob));
  const orphans = source.filter((row) => !row.request && !row.premiumjob);
  const both = source.filter((row) => row.request && row.premiumjob);
  const planned = {
    sourceRows: source.length,
    standardRows: standard.length,
    premiumRows: premium.length,
    rowsWithBothJobTypes: both.length,
    orphanRowsRetainedInSourceMirror: orphans.length,
    unresolvedStandardJobs: standard.filter((row) => !jobMap.has(String(row.request))).length,
    unresolvedPremiumJobs: premium.filter((row) => !premiumMap.has(String(row.premiumjob))).length,
    unresolvedArtists: source.filter((row) => row.artist && !userMap.has(String(row.artist))).length,
    unresolvedClients: standard.filter((row) => row.client && !userMap.has(String(row.client))).length,
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  const rawSql = upsertSql("bubble_interested_artists_source", RAW_COLUMNS, "bubbleId");
  const standardSql = upsertSql("interested_artists", STANDARD_COLUMNS, "bubbleId");
  const premiumSql = upsertSql("premium_job_interested_artists", PREMIUM_COLUMNS, "bubbleInterestedArtistId");

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE bubble_interested_artists_source SET bubbleSourcePresent = 0");
    await conn.execute("UPDATE interested_artists SET bubbleSourcePresent = 0");
    await conn.execute("UPDATE premium_job_interested_artists SET bubbleSourcePresent = 0");

    let processed = 0;
    let normalizedStandard = 0;
    let normalizedPremium = 0;
    for (const row of source) {
      const createdAt = safeDate(row["Created Date"]);
      const modifiedAt = safeDate(row["Modified Date"]);
      const rawValues = [
        row._id,
        1,
        applicationText(row["Created By"], 64),
        applicationText(row.artist, 64),
        applicationText(row.request, 64),
        applicationText(row.premiumjob, 64),
        applicationText(row.client, 64),
        applicationText(row.booking, 64),
        applicationText(row.service, 64),
        applicationText(row.status_interestedartists, 64),
        row["converted?"] === true ? 1 : 0,
        row["is hourly rate?"] === true ? 1 : 0,
        applicationNumber(row["artist hourly rate"]),
        applicationNumber(row["client hourly rate"]),
        applicationNumber(row["artist flat rate"]),
        applicationNumber(row["client flat rate"]),
        applicationText(row["premium job rate"], 255),
        applicationText(row.option_rateType, 64),
        applicationNumber(row["total hours"]),
        safeDate(row["start date"]),
        safeDate(row["end date"]),
        row.link ?? null,
        row.message ?? null,
        createdAt,
        modifiedAt,
      ];
      await conn.execute(rawSql, rawValues);

      if (row.request) {
        const requestId = String(row.request);
        const artistId = row.artist ? String(row.artist) : null;
        const clientId = row.client ? String(row.client) : null;
        await conn.execute(standardSql, [
          row._id,
          1,
          jobMap.get(requestId) ?? null,
          requestId,
          artistId ? userMap.get(artistId) ?? null : null,
          artistId,
          clientId ? userMap.get(clientId) ?? null : null,
          clientId,
          applicationText(row.service, 64),
          applicationText(row.booking, 64),
          applicationText(row.status_interestedartists, 64),
          row["converted?"] === true ? 1 : 0,
          row["is hourly rate?"] === true ? 1 : 0,
          applicationNumber(row["artist hourly rate"]),
          applicationNumber(row["client hourly rate"]),
          applicationNumber(row["artist flat rate"]),
          applicationNumber(row["client flat rate"]),
          applicationNumber(row["total hours"]),
          safeDate(row["start date"]),
          safeDate(row["end date"]),
          row.link ?? null,
          row.message ?? null,
          createdAt,
          modifiedAt,
        ]);
        normalizedStandard += 1;
      }

      if (row.premiumjob && premiumMap.has(String(row.premiumjob))) {
        const premiumJobBubbleId = String(row.premiumjob);
        const artistId = row.artist ? String(row.artist) : null;
        await conn.execute(premiumSql, [
          premiumMap.get(premiumJobBubbleId),
          premiumJobBubbleId,
          artistId ? userMap.get(artistId) ?? null : null,
          artistId,
          row._id,
          row.message ?? null,
          applicationText(row["premium job rate"], 255),
          row.link ?? null,
          applicationText(row.status_interestedartists, 64),
          1,
          createdAt ?? new Date(),
          createdAt,
          modifiedAt,
        ]);
        normalizedPremium += 1;
      }

      processed += 1;
      if (processed % 500 === 0) process.stdout.write(`\rApplied ${processed}/${source.length} applications`);
    }
    process.stdout.write("\n");

    const [rawValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds
      FROM bubble_interested_artists_source WHERE bubbleSourcePresent = 1
    `);
    const [standardValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(jobId IS NOT NULL) AS resolvedJobs, SUM(artistUserId IS NOT NULL) AS resolvedArtists,
             SUM(clientUserId IS NOT NULL) AS resolvedClients
      FROM interested_artists WHERE bubbleSourcePresent = 1
    `);
    const [premiumValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleInterestedArtistId) AS distinctBubbleIds,
             SUM(premiumJobId IS NOT NULL) AS resolvedJobs, SUM(artistUserId IS NOT NULL) AS resolvedArtists
      FROM premium_job_interested_artists WHERE bubbleSourcePresent = 1
    `);
    const validation = {
      raw: rawValidationRows[0],
      standard: standardValidationRows[0],
      premium: premiumValidationRows[0],
      normalizedStandard,
      normalizedPremium,
    };
    if (
      Number(validation.raw.liveRows) !== source.length ||
      Number(validation.raw.distinctBubbleIds) !== sourceIds.size ||
      Number(validation.standard.liveRows) !== standard.length ||
      Number(validation.premium.liveRows) !== normalizedPremium
    ) {
      throw new Error(`Application validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/interested-artists-sync-${timestamp}.json`;
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
