/**
 * Migration: Payments
 * Pulls all 14,307 records from Bubble's "payment" type → `payments` table.
 *
 * Bubble fields:
 *   _id, Booking, Status, Stripe ID, Stripe Amount, Stripe Application Fee,
 *   Stripe Application Fee Amount, Stripe Card Brand, Stripe Card Last 4,
 *   Stripe Card Name, Stripe Description, Stripe Receipt URL, Stripe Refund URL,
 *   Stripe Status, Date, Created Date, Modified Date, Created By
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-payments.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubblePayment {
  _id: string;
  "Booking"?: string;               // Bubble booking ID
  "Status"?: string;                // e.g. "Success"
  "Stripe ID"?: string;             // ch_xxx or cs_xxx
  "Stripe Amount"?: number;         // amount in cents
  "Stripe Application Fee"?: string; // fee object ID
  "Stripe Application Fee Amount"?: number;
  "Stripe Card Brand"?: string;     // e.g. "Visa"
  "Stripe Card Last 4"?: string;    // last 4 digits
  "Stripe Card Name"?: string;      // cardholder name
  "Stripe Description"?: string;
  "Stripe Receipt URL"?: string;
  "Stripe Refund URL"?: string;
  "Stripe Status"?: string;         // e.g. "succeeded", "paid"
  "Date"?: string;                  // payment date
  "Created Date"?: string;
  "Modified Date"?: string;
  "Created By"?: string;            // Bubble user ID of the payer
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → bookingId lookup
  const [bookingRows] = await conn.execute(
    "SELECT id, bubbleId FROM bookings WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToBookingId: Record<string, number> = {};
  for (const b of bookingRows) bubbleToBookingId[b.bubbleId] = b.id;
  console.log(`Loaded ${Object.keys(bubbleToBookingId).length} booking mappings`);

  // Build bubbleId → userId lookup (for clientUserId via Created By)
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching payments from Bubble...");
  const records = await fetchAllRecords<BubblePayment>(
    "payment",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} payments`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const bookingId   = r["Booking"]    ? (bubbleToBookingId[r["Booking"]] ?? null)  : null;
    const clientUserId = r["Created By"] ? (bubbleToUserId[r["Created By"]] ?? null) : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO payments (
           bubbleId,
           bookingId, bubbleBookingId,
           clientUserId,
           stripeId, stripeStatus, status,
           stripeAmount,
           stripeApplicationFee, stripeApplicationFeeAmount,
           stripeCardBrand, stripeCardLast4, stripeCardName,
           stripeDescription, stripeReceiptUrl, stripeRefundUrl,
           paymentDate,
           bubbleCreatedAt, bubbleModifiedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           bookingId=VALUES(bookingId),
           clientUserId=VALUES(clientUserId),
           stripeId=VALUES(stripeId),
           stripeStatus=VALUES(stripeStatus),
           status=VALUES(status),
           stripeAmount=VALUES(stripeAmount),
           stripeApplicationFee=VALUES(stripeApplicationFee),
           stripeApplicationFeeAmount=VALUES(stripeApplicationFeeAmount),
           stripeCardBrand=VALUES(stripeCardBrand),
           stripeCardLast4=VALUES(stripeCardLast4),
           stripeCardName=VALUES(stripeCardName),
           stripeDescription=VALUES(stripeDescription),
           stripeReceiptUrl=VALUES(stripeReceiptUrl),
           stripeRefundUrl=VALUES(stripeRefundUrl),
           paymentDate=VALUES(paymentDate),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          bookingId,
          r["Booking"] ?? null,
          clientUserId,
          r["Stripe ID"] ?? null,
          r["Stripe Status"] ?? null,
          r["Status"] ?? null,
          r["Stripe Amount"] ?? null,
          r["Stripe Application Fee"] ?? null,
          r["Stripe Application Fee Amount"] ?? null,
          r["Stripe Card Brand"] ?? null,
          r["Stripe Card Last 4"] ?? null,
          r["Stripe Card Name"] ?? null,
          r["Stripe Description"] ?? null,
          r["Stripe Receipt URL"] ?? null,
          r["Stripe Refund URL"] ?? null,
          r["Date"] ? new Date(r["Date"]) : null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on payment ${r._id}:`, e.message);
      errors++;
    }

    if ((inserted + updated + errors) % 1000 === 0)
      process.stdout.write(`\r  Processed ${inserted + updated + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
