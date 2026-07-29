/**
 * One-shot script: apply the admin_bookings migration directly.
 * Usage: npx tsx scripts/apply-admin-bookings.ts
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

const stmts = [
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS isAdminBooking boolean DEFAULT false`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS isRecurring boolean DEFAULT false`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurringCadence varchar(32)`,
  `ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS bookingPeriodId int`,
  `CREATE TABLE IF NOT EXISTS booking_periods (
    id int AUTO_INCREMENT NOT NULL,
    bookingId int NOT NULL,
    periodNumber int NOT NULL,
    periodStart timestamp NOT NULL,
    periodEnd timestamp NOT NULL,
    notifyArtistAt timestamp NOT NULL,
    artistNotifiedAt timestamp,
    artistSubmittedAt timestamp,
    status varchar(32) DEFAULT 'upcoming',
    actualHours double,
    artistNotes text,
    invoicePaymentToken varchar(64),
    invoiceStripeCheckoutUrl text,
    invoiceTotalCents int,
    invoicePaidAt timestamp,
    invoiceStripePaymentIntentId varchar(128),
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT booking_periods_pk PRIMARY KEY (id)
  )`,
];

for (const stmt of stmts) {
  try {
    await conn.execute(stmt);
    console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " "));
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME" || e.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("SKIP (already exists):", stmt.slice(0, 60).replace(/\s+/g, " "));
    } else {
      console.error("FAIL:", e.message);
    }
  }
}

await conn.end();
console.log("Migration complete.");
