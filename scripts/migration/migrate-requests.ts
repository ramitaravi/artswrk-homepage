/**
 * Migration: Requests (Regular Marketplace Jobs)
 * Pulls all 3,623 records from Bubble's "request" type → `jobs` table.
 *
 * NOTE: In Bubble, a "Request" is what clients post to hire artists.
 * In our schema these are stored in the `jobs` table.
 *
 * Bubble fields:
 *   _id, description, Slug, client, client company, client email,
 *   Status, Request Status, DateType, start date, end date, sameDay?,
 *   location (address/lat/lng), is hourly?, open rate?, artist hourly rate,
 *   client hourly rate, option_rateType, hours,
 *   ages, artist type, master service type,
 *   direct?, sent to network?, tranportation? (sic), transportation details,
 *   converted?, Interested Artists, interested artists users,
 *   Created Date, Modified Date, Created By
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-requests.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleLocation {
  address?: string;
  lat?: number;
  lng?: number;
}

interface BubbleRequest {
  _id: string;
  "description"?: string;
  "Slug"?: string;
  "client"?: string;               // Bubble user ID of the hirer
  "client company"?: string;       // Bubble client company ID
  "client email"?: string;
  "Status"?: string;               // e.g. "Awaiting Response", "Confirmed"
  "Request Status"?: string;       // e.g. "Active", "Completed", "Deleted by Client"
  "DateType"?: string;             // "Single Date" | "Ongoing" | "Recurring"
  "start date"?: string;
  "end date"?: string;
  "sameDay?"?: boolean;
  "location"?: BubbleLocation;
  "is hourly?"?: boolean;
  "open rate?"?: boolean;
  "artist hourly rate"?: number;
  "client hourly rate"?: number;
  "option_rateType"?: string;
  "hours"?: number;
  "ages"?: string[];
  "artist type"?: string;          // Bubble artist type bubble ID
  "master service type"?: string;  // Bubble master service type ID
  "direct?"?: boolean;
  "sent to network?"?: boolean;
  "tranportation?"?: boolean;      // note: typo in Bubble ("tranportation" not "transportation")
  "transportation details"?: string;
  "converted?"?: boolean;
  "Interested Artists"?: string[];
  "interested artists users"?: string[];
  "Created Date"?: string;
  "Modified Date"?: string;
  "Created By"?: string;           // Bubble user ID — same as client most of the time
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup (for clientUserId)
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching requests from Bubble...");
  const records = await fetchAllRecords<BubbleRequest>(
    "request",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} requests`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const clientUserId = r["client"] ? (bubbleToUserId[r["client"]] ?? null) : null;
    const loc = r["location"];

    try {
      const [result] = await conn.execute(
        `INSERT INTO jobs (
           bubbleId,
           clientUserId, bubbleClientId, bubbleClientCompanyId,
           description, slug,
           status, requestStatus,
           dateType, startDate, endDate,
           locationAddress, locationLat, locationLng,
           isHourly, openRate,
           artistHourlyRate, clientHourlyRate,
           ages,
           direct, sentToNetwork, transportation, converted,
           masterServiceTypeId, clientEmail,
           bubbleCreatedAt, bubbleModifiedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           clientUserId=VALUES(clientUserId),
           bubbleClientId=VALUES(bubbleClientId),
           bubbleClientCompanyId=VALUES(bubbleClientCompanyId),
           description=VALUES(description),
           slug=VALUES(slug),
           status=VALUES(status),
           requestStatus=VALUES(requestStatus),
           dateType=VALUES(dateType),
           startDate=VALUES(startDate),
           endDate=VALUES(endDate),
           locationAddress=VALUES(locationAddress),
           locationLat=VALUES(locationLat),
           locationLng=VALUES(locationLng),
           isHourly=VALUES(isHourly),
           openRate=VALUES(openRate),
           artistHourlyRate=VALUES(artistHourlyRate),
           clientHourlyRate=VALUES(clientHourlyRate),
           ages=VALUES(ages),
           direct=VALUES(direct),
           sentToNetwork=VALUES(sentToNetwork),
           transportation=VALUES(transportation),
           converted=VALUES(converted),
           masterServiceTypeId=VALUES(masterServiceTypeId),
           clientEmail=VALUES(clientEmail),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          clientUserId,
          r["client"] ?? null,
          r["client company"] ?? null,
          r["description"] ?? null,
          r["Slug"] ?? null,
          r["Status"] ?? null,
          r["Request Status"] ?? null,
          r["DateType"] ?? null,
          r["start date"] ? new Date(r["start date"]) : null,
          r["end date"] ? new Date(r["end date"]) : null,
          loc?.address ?? null,
          loc?.lat != null ? String(loc.lat) : null,
          loc?.lng != null ? String(loc.lng) : null,
          r["is hourly?"] ? 1 : 0,
          r["open rate?"] ? 1 : 0,
          r["artist hourly rate"] ?? null,
          r["client hourly rate"] ?? null,
          r["ages"] && r["ages"].length > 0 ? JSON.stringify(r["ages"]) : null,
          r["direct?"] ? 1 : 0,
          r["sent to network?"] ? 1 : 0,
          r["tranportation?"] ? 1 : 0,
          r["converted?"] ? 1 : 0,
          r["master service type"] ?? null,
          r["client email"] ?? null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on request ${r._id}:`, e.message);
      errors++;
    }

    if ((inserted + updated + errors) % 500 === 0)
      process.stdout.write(`\r  Processed ${inserted + updated + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
