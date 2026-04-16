/**
 * Migration: Client Companies
 * Pulls all records from Bubble's "ClientCompany" type → `client_companies` table.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-client-companies.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleClientCompany {
  _id: string;
  "Company Name"?: string;
  "Logo"?: string;
  "Website"?: string;
  "Description"?: string;
  "Company Location"?: { address?: string; lat?: number; lng?: number };
  "Transport Reimbursed?"?: boolean;
  "Company Transport Details"?: string;
  "Client"?: string[];       // Bubble user IDs of the enterprise clients
  "Created By"?: string;     // Bubble user ID of creator
  "Created Date"?: string;
  "Modified Date"?: string;
}

function fixImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching client companies from Bubble...");
  const records = await fetchAllRecords<BubbleClientCompany>(
    "ClientCompany",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} records`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    // "Client" is an array; take the first entry as owner
  const clientIds = r["Client"] ?? [];
  const firstClientId = Array.isArray(clientIds) ? clientIds[0] : clientIds;
  const ownerUserId = firstClientId ? (bubbleToUserId[firstClientId] ?? null) : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO client_companies
           (bubbleClientCompanyId, ownerUserId, name, logo, website, description,
            locationAddress, locationLat, locationLng,
            transportReimbursed, transportDetails)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ownerUserId=VALUES(ownerUserId),
           name=VALUES(name),
           logo=VALUES(logo),
           website=VALUES(website),
           description=VALUES(description),
           locationAddress=VALUES(locationAddress),
           locationLat=VALUES(locationLat),
           locationLng=VALUES(locationLng),
           transportReimbursed=VALUES(transportReimbursed),
           transportDetails=VALUES(transportDetails)`,
        [
          r._id,
          ownerUserId ?? 0,          // ownerUserId is NOT NULL; use 0 as sentinel for unresolved
          r["Company Name"] ?? null,
          fixImageUrl(r["Logo"]),
          r["Website"] ?? null,
          r["Description"] ?? null,
          r["Company Location"]?.address ?? null,
          r["Company Location"]?.lat?.toString() ?? null,
          r["Company Location"]?.lng?.toString() ?? null,
          r["Transport Reimbursed?"] ? 1 : 0,
          r["Company Transport Details"] ?? null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on company ${r["Company Name"]} (${r._id}):`, e.message);
      errors++;
    }

    if ((inserted + updated + errors) % 200 === 0)
      process.stdout.write(`\r  Processed ${inserted + updated + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
