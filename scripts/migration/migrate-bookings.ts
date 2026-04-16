/**
 * Migration: Bookings
 * Pulls all 5,574 records from Bubble's "booking" type → `bookings` table.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-bookings.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleBooking {
  _id: string;
  "Artist"?: string;
  "Client"?: string;
  "Request"?: string;
  "Interested Artist"?: string;
  "Artist Rate"?: number;
  "Client Rate"?: number;
  "Total Artist Rate (Artist Rate + Reimbursements)"?: number;
  "Total Client Rate (Client Rate + Reimbursements)"?: number;
  "Gross Profit"?: number;
  "Post Fee Revenue"?: number;
  "stripe fee"?: number;
  "hours"?: number;
  "Start date"?: string;
  "End date"?: string;
  "Location"?: { address?: string; lat?: number; lng?: number };
  "Description"?: string;
  "_Option_Booking_Status"?: string;
  "_Option_Payment_Status"?: string;
  "deleted?"?: boolean;
  "external payment?"?: boolean;
  "Added to Spreadsheet?"?: boolean;
  "Notification_Artist_Scheduled_Reminder"?: boolean;
  "Stripe checkout url"?: string;
  "List of Reimbursement"?: string[];
  "Created Date"?: string;
  "Modified Date"?: string;
  "Created By"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup
  const [userRows] = await conn.execute("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL") as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching bookings from Bubble...");
  const records = await fetchAllRecords<BubbleBooking>(
    "booking",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} bookings`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const artistUserId = r["Artist"] ? (bubbleToUserId[r["Artist"]] ?? null) : null;
    const clientUserId = r["Client"] ? (bubbleToUserId[r["Client"]] ?? null) : null;

    try {
      await conn.execute(
        `INSERT INTO bookings (
          bubbleId, bubbleRequestId, bubbleInterestedArtistId, bubbleClientId, bubbleArtistId,
          artistUserId, clientUserId,
          bookingStatus, paymentStatus,
          artistRate, clientRate, totalArtistRate, totalClientRate,
          grossProfit, stripeFee, postFeeRevenue, hours, externalPayment,
          startDate, endDate, locationAddress, locationLat, locationLng,
          description, stripeCheckoutUrl, addedToSpreadsheet, deleted,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          bubbleRequestId=VALUES(bubbleRequestId), artistUserId=VALUES(artistUserId),
          clientUserId=VALUES(clientUserId), bookingStatus=VALUES(bookingStatus),
          paymentStatus=VALUES(paymentStatus), artistRate=VALUES(artistRate),
          clientRate=VALUES(clientRate), totalArtistRate=VALUES(totalArtistRate),
          totalClientRate=VALUES(totalClientRate), grossProfit=VALUES(grossProfit),
          stripeFee=VALUES(stripeFee), postFeeRevenue=VALUES(postFeeRevenue),
          hours=VALUES(hours), startDate=VALUES(startDate), endDate=VALUES(endDate),
          locationAddress=VALUES(locationAddress), description=VALUES(description),
          deleted=VALUES(deleted), bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          r["Request"] ?? null,
          r["Interested Artist"] ?? null,
          r["Client"] ?? null,
          r["Artist"] ?? null,
          artistUserId,
          clientUserId,
          r["_Option_Booking_Status"] ?? null,
          r["_Option_Payment_Status"] ?? null,
          r["Artist Rate"] ?? null,
          r["Client Rate"] ?? null,
          r["Total Artist Rate (Artist Rate + Reimbursements)"] ?? null,
          r["Total Client Rate (Client Rate + Reimbursements)"] ?? null,
          r["Gross Profit"] ?? null,
          r["stripe fee"] ?? null,
          r["Post Fee Revenue"] ?? null,
          r["hours"] ?? null,
          r["external payment?"] ? 1 : 0,
          r["Start date"] ? new Date(r["Start date"]) : null,
          r["End date"] ? new Date(r["End date"]) : null,
          r["Location"]?.address ?? null,
          r["Location"]?.lat?.toString() ?? null,
          r["Location"]?.lng?.toString() ?? null,
          r["Description"] ?? null,
          r["Stripe checkout url"] ?? null,
          r["Added to Spreadsheet?"] ? 1 : 0,
          r["deleted?"] ? 1 : 0,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      );
      inserted++;
    } catch (e: any) {
      console.error(`\nError on booking ${r._id}:`, e.message);
      errors++;
    }

    if ((inserted + errors) % 200 === 0)
      process.stdout.write(`\r  Processed ${inserted + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted/Updated : ${inserted}`);
  console.log(`Errors           : ${errors}`);
  await conn.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
