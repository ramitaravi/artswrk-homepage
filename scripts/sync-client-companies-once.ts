import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleCompany = Record<string, unknown> & { _id: string };

export function companyClientIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value) return [value];
  return [];
}

export function companyLocation(value: unknown): { address: string | null; lat: string | null; lng: string | null } {
  if (!value || typeof value !== "object") return { address: null, lat: null, lng: null };
  const location = value as { address?: unknown; lat?: unknown; lng?: unknown };
  return {
    address: typeof location.address === "string" ? location.address : null,
    lat: location.lat == null ? null : String(location.lat),
    lng: location.lng == null ? null : String(location.lng),
  };
}

export function companyLogo(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.startsWith("//") ? `https:${value}` : value;
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

async function fetchCompanies(token: string): Promise<BubbleCompany[]> {
  const base = "https://artswrk.com/version-live/api/1.1/obj/ClientCompany";
  const rows: BubbleCompany[] = [];
  let cursor = 0;
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble ClientCompany API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleCompany[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rFetched ${rows.length} Bubble client companies`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const source = await fetchCompanies(readBubbleToken());
  const sourceIds = new Set(source.map((company) => company._id));
  if (source.length === 0 || source.length !== sourceIds.size) {
    throw new Error("Bubble ClientCompany source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM users WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [existingRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleClientCompanyId, ownerUserId
    FROM client_companies
    WHERE bubbleClientCompanyId IS NOT NULL
    ORDER BY (ownerUserId IS NOT NULL AND ownerUserId > 0) DESC, id ASC
  `);
  const existingByBubbleId = new Map<string, number[]>();
  for (const row of existingRows) {
    const key = String(row.bubbleClientCompanyId);
    const list = existingByBubbleId.get(key) ?? [];
    list.push(Number(row.id));
    existingByBubbleId.set(key, list);
  }

  const memberships = source.flatMap((company) =>
    companyClientIds(company.Client).map((bubbleUserId, index) => ({ company, bubbleUserId, index })),
  );
  const planned = {
    sourceCompanies: source.length,
    update: source.filter((company) => existingByBubbleId.has(company._id)).length,
    insert: source.filter((company) => !existingByBubbleId.has(company._id)).length,
    duplicateDestinationRowsToRemove: [...existingByBubbleId.values()].reduce((sum, ids) => sum + Math.max(ids.length - 1, 0), 0),
    memberships: memberships.length,
    unresolvedMemberships: memberships.filter(({ bubbleUserId }) => !userMap.has(bubbleUserId)).length,
    companiesWithoutClientMemberships: source.filter((company) => companyClientIds(company.Client).length === 0).length,
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE client_companies SET bubbleSourcePresent = 0");
    await conn.execute("DELETE FROM client_company_memberships");

    let processed = 0;
    for (const company of source) {
      const clientIds = companyClientIds(company.Client);
      const createdById = typeof company["Created By"] === "string" ? company["Created By"] : null;
      const ownerBubbleId = clientIds[0] ?? createdById;
      const ownerUserId = ownerBubbleId ? userMap.get(ownerBubbleId) ?? null : null;
      const location = companyLocation(company["Company Location"]);
      const existingIds = existingByBubbleId.get(company._id) ?? [];
      const canonicalId = existingIds[0];
      const values = [
        ownerUserId,
        String(company["Company Name"] ?? ""),
        companyLogo(company.logo ?? company.Logo),
        company.Website ?? null,
        company.Description ?? null,
        location.address,
        location.lat,
        location.lng,
        company["Transport Reimbursed?"] === true ? 1 : 0,
        company["Company Transport Details"] ?? null,
        company._id,
        1,
        createdById,
        JSON.stringify(clientIds),
        safeDate(company["Created Date"]),
        safeDate(company["Modified Date"]),
      ];

      let companyId: number;
      if (canonicalId) {
        await conn.execute(`
          UPDATE client_companies SET
            ownerUserId=?, name=?, logo=?, website=COALESCE(?, website), description=COALESCE(?, description),
            locationAddress=?, locationLat=?, locationLng=?, transportReimbursed=?, transportDetails=?,
            bubbleClientCompanyId=?, bubbleSourcePresent=?, bubbleCreatedById=?, bubbleClientIds=?,
            bubbleCreatedAt=?, bubbleModifiedAt=?
          WHERE id=?
        `, [...values, canonicalId]);
        companyId = canonicalId;
        if (existingIds.length > 1) {
          await conn.query(`DELETE FROM client_companies WHERE id IN (${existingIds.slice(1).map(() => "?").join(",")})`, existingIds.slice(1));
        }
      } else {
        const [result] = await conn.execute<mysql.ResultSetHeader>(`
          INSERT INTO client_companies (
            ownerUserId, name, logo, website, description, locationAddress, locationLat, locationLng,
            transportReimbursed, transportDetails, bubbleClientCompanyId, bubbleSourcePresent,
            bubbleCreatedById, bubbleClientIds, bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, values);
        companyId = result.insertId;
      }

      for (const [index, bubbleUserId] of clientIds.entries()) {
        await conn.execute(`
          INSERT INTO client_company_memberships (
            clientCompanyId, userId, bubbleClientCompanyId, bubbleUserId, isPrimary
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE userId=VALUES(userId), isPrimary=VALUES(isPrimary)
        `, [companyId, userMap.get(bubbleUserId) ?? null, company._id, bubbleUserId, index === 0 ? 1 : 0]);
      }

      processed += 1;
      if (processed % 200 === 0) process.stdout.write(`\rApplied ${processed}/${source.length} client companies`);
    }
    process.stdout.write("\n");

    const [companyValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS flaggedRows, COUNT(DISTINCT bubbleClientCompanyId) AS distinctBubbleCompanyIds,
             SUM(ownerUserId IS NOT NULL AND ownerUserId > 0) AS resolvedOwners
      FROM client_companies WHERE bubbleSourcePresent = 1
    `);
    const [membershipValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS memberships, SUM(userId IS NULL) AS unresolvedMemberships
      FROM client_company_memberships
    `);
    const validation = {
      ...companyValidationRows[0],
      ...membershipValidationRows[0],
    };
    if (
      Number(validation.flaggedRows) !== source.length ||
      Number(validation.distinctBubbleCompanyIds) !== sourceIds.size ||
      Number(validation.memberships) !== memberships.length
    ) {
      throw new Error(`Client-company validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/client-companies-sync-${timestamp}.json`;
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
