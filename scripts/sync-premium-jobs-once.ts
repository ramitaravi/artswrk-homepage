import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubblePremiumJob = Record<string, unknown> & { _id: string };

export function normalizePremiumLogo(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.startsWith("//") ? `https:${value}` : value;
}

export function parsePremiumLocation(value: unknown): {
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

export function serializePremiumApplicants(value: unknown): string | null {
  return Array.isArray(value) && value.length ? JSON.stringify(value) : null;
}

export function limitPremiumText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function normalizeCompanyName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
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

async function fetchPremiumJobs(token: string): Promise<BubblePremiumJob[]> {
  const rows: BubblePremiumJob[] = [];
  let cursor = 0;
  const base = "https://artswrk.com/version-live/api/1.1/obj/premium_jobs";
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble premium_jobs API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubblePremiumJob[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rFetched ${rows.length} Bubble premium jobs`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

const COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "company", "logo", "createdByUserId", "bubbleCreatedById",
  "bubbleClientCompanyId", "serviceType", "category", "description", "budget", "location",
  "locationLat", "locationLng", "tag", "slug", "applyDirect", "applyEmail", "applyLink",
  "bubbleInterestedArtistIds", "workFromAnywhere", "featured", "status", "bubbleCreatedAt",
  "bubbleModifiedAt",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const source = await fetchPremiumJobs(readBubbleToken());
  const sourceIds = new Set(source.map((job) => job._id));
  if (source.length === 0 || sourceIds.size !== source.length) {
    throw new Error("Bubble premium_jobs source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM users WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [companyRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleClientCompanyId, ownerUserId, name FROM client_companies
    WHERE bubbleSourcePresent = 1 AND bubbleClientCompanyId IS NOT NULL
  `);
  const companyIds = new Set(companyRows.map((row) => String(row.bubbleClientCompanyId)));
  const companyOwnerById = new Map(
    companyRows
      .filter((row) => row.ownerUserId != null)
      .map((row) => [String(row.bubbleClientCompanyId), Number(row.ownerUserId)]),
  );
  const ownersByCompanyName = new Map<string, Set<number>>();
  for (const row of companyRows) {
    if (row.ownerUserId == null) continue;
    const normalizedName = normalizeCompanyName(row.name);
    if (!normalizedName) continue;
    const owners = ownersByCompanyName.get(normalizedName) ?? new Set<number>();
    owners.add(Number(row.ownerUserId));
    ownersByCompanyName.set(normalizedName, owners);
  }
  const uniqueOwnerByCompanyName = new Map(
    [...ownersByCompanyName.entries()]
      .filter(([, owners]) => owners.size === 1)
      .map(([name, owners]) => [name, [...owners][0]]),
  );
  const [existingRows] = await conn.execute<RowDataPacket[]>(`
    SELECT bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL
  `);
  const existingIds = new Set(existingRows.map((row) => String(row.bubbleId)));

  const planned = {
    sourcePremiumJobs: source.length,
    update: source.filter((job) => existingIds.has(job._id)).length,
    insert: source.filter((job) => !existingIds.has(job._id)).length,
    directCreatorMisses: source.filter((job) => {
      const creator = limitPremiumText(job["Created By"], 64);
      return creator && !userMap.has(creator);
    }).length,
    unresolvedCreators: source.filter((job) => {
      const creator = limitPremiumText(job["Created By"], 64);
      const companyId = limitPremiumText(job["Client-Company"] ?? job["client company"], 64);
      const companyName = normalizeCompanyName(job.Company);
      return Boolean(
        creator &&
        !userMap.has(creator) &&
        !(companyId && companyOwnerById.has(companyId)) &&
        !(companyName && uniqueOwnerByCompanyName.has(companyName))
      );
    }).length,
    unresolvedCompanyRelationships: source.filter((job) => {
      const companyId = limitPremiumText(job["Client-Company"] ?? job["client company"], 64);
      return companyId && !companyIds.has(companyId);
    }).length,
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  const columnSql = COLUMNS.map((column) => `\`${column}\``).join(", ");
  const placeholders = COLUMNS.map(() => "?").join(", ");
  const updates = COLUMNS.slice(1).map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(", ");

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE premium_jobs SET bubbleSourcePresent = 0");
    let processed = 0;
    for (const job of source) {
      const creatorId = limitPremiumText(job["Created By"], 64);
      const companyId = limitPremiumText(job["Client-Company"] ?? job["client company"], 64);
      const companyName = normalizeCompanyName(job.Company);
      const resolvedCreatorUserId =
        (creatorId ? userMap.get(creatorId) : undefined) ??
        (companyId ? companyOwnerById.get(companyId) : undefined) ??
        (companyName ? uniqueOwnerByCompanyName.get(companyName) : undefined) ??
        null;
      const location = parsePremiumLocation(job.Location);
      const values = [
        job._id,
        1,
        limitPremiumText(job.Company, 256),
        normalizePremiumLogo(job.logo),
        resolvedCreatorUserId,
        creatorId,
        companyId,
        limitPremiumText(job["Service Type"], 256),
        limitPremiumText(job.Category, 128),
        job.Description ?? null,
        limitPremiumText(job.Budget, 256),
        limitPremiumText(location.address, 256),
        limitPremiumText(location.lat, 32),
        limitPremiumText(location.lng, 32),
        limitPremiumText(job.Tag, 256),
        limitPremiumText(job.Slug, 256),
        job["Apply Direct?"] === true ? 1 : 0,
        limitPremiumText(job.email, 320),
        job.link ?? null,
        serializePremiumApplicants(job.interested_artists),
        job["Work From Anywhere?"] === true ? 1 : 0,
        job.featured === true ? 1 : 0,
        limitPremiumText(job.Status, 64) ?? "Active",
        safeDate(job["Created Date"]),
        safeDate(job["Modified Date"]),
      ];
      await conn.execute(
        `INSERT INTO premium_jobs (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
        values,
      );
      processed += 1;
      if (processed % 100 === 0) process.stdout.write(`\rApplied ${processed}/${source.length} premium jobs`);
    }
    process.stdout.write("\n");

    const [validationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS flaggedRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(createdByUserId IS NOT NULL) AS resolvedCreators,
             SUM(bubbleCreatedById IS NOT NULL AND createdByUserId IS NULL) AS unresolvedCreators
      FROM premium_jobs WHERE bubbleSourcePresent = 1
    `);
    const validation = validationRows[0];
    if (Number(validation.flaggedRows) !== source.length || Number(validation.distinctBubbleIds) !== sourceIds.size) {
      throw new Error(`Premium-job validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const statusCounts = source.reduce<Record<string, number>>((counts, job) => {
      const status = String(job.Status ?? "(null)");
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const report = { appliedAt: new Date().toISOString(), planned, validation, sourceStatusCounts: statusCounts };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/premium-jobs-sync-${timestamp}.json`;
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
