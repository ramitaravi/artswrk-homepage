import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleBenefit = Record<string, unknown> & { _id: string };

export function benefitArray(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : null;
  return value == null || value === "" ? null : JSON.stringify([value]);
}

export function benefitLogo(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.startsWith("//") ? `https:${value}` : value;
}

export function benefitText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
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

async function fetchBenefits(token: string): Promise<BubbleBenefit[]> {
  const rows: BubbleBenefit[] = [];
  let cursor = 0;
  const base = "https://artswrk.com/version-live/api/1.1/obj/Benefits";
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble Benefits API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleBenefit[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  return rows;
}

const COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "bubbleCreatedById", "companyName", "slug", "logoUrl", "url",
  "businessDescription", "discountOffering", "howToRedeem", "contactName", "contactEmail",
  "audienceTypes", "businessTypes", "artistTypes", "categories", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const source = await fetchBenefits(readBubbleToken());
  const sourceIds = new Set(source.map((benefit) => benefit._id));
  if (!source.length || sourceIds.size !== source.length) {
    throw new Error("Bubble Benefits source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [existingRows] = await conn.execute<RowDataPacket[]>("SELECT bubbleId FROM benefits WHERE bubbleId IS NOT NULL");
  const existingIds = new Set(existingRows.map((row) => String(row.bubbleId)));
  const planned = {
    sourceBenefits: source.length,
    update: source.filter((benefit) => existingIds.has(benefit._id)).length,
    insert: source.filter((benefit) => !existingIds.has(benefit._id)).length,
    withAudienceEligibility: source.filter((benefit) => benefitArray(benefit["Artists or Clients"])).length,
    withBusinessEligibility: source.filter((benefit) => benefitArray(benefit["Business Type"])).length,
    withArtistEligibility: source.filter((benefit) => benefitArray(benefit["Artist Type"])).length,
    withCategoryEligibility: source.filter((benefit) => benefitArray(benefit["Benefits Category"])).length,
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
    await conn.execute("UPDATE benefits SET bubbleSourcePresent = 0");
    for (const benefit of source) {
      await conn.execute(
        `INSERT INTO benefits (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
        [
          benefit._id,
          1,
          benefitText(benefit["Created By"], 64),
          benefitText(benefit["Company Name"], 256),
          benefitText(benefit.Slug, 256),
          benefitLogo(benefit.Logo),
          benefit.URL ?? null,
          benefit["Business Description"] ?? null,
          benefit["Discount Offering"] ?? null,
          benefit["How to Redeem"] ?? null,
          benefitText(benefit["Contact Name"], 256),
          benefitText(benefit["Contact Email"], 320),
          benefitArray(benefit["Artists or Clients"]),
          benefitArray(benefit["Business Type"]),
          benefitArray(benefit["Artist Type"]),
          benefitArray(benefit["Benefits Category"]),
          safeDate(benefit["Created Date"]),
          safeDate(benefit["Modified Date"]),
        ],
      );
    }

    const [validationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(audienceTypes IS NOT NULL) AS withAudienceEligibility,
             SUM(businessTypes IS NOT NULL) AS withBusinessEligibility,
             SUM(artistTypes IS NOT NULL) AS withArtistEligibility,
             SUM(categories IS NOT NULL) AS withCategoryEligibility
      FROM benefits WHERE bubbleSourcePresent = 1
    `);
    const validation = validationRows[0];
    if (Number(validation.liveRows) !== source.length || Number(validation.distinctBubbleIds) !== sourceIds.size) {
      throw new Error(`Benefit validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = fs.existsSync("/home/ubuntu/artswrk-backups")
      ? "/home/ubuntu/artswrk-backups"
      : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const outputPath = path.join(backupDir, `benefits-sync-${timestamp}.json`);
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
