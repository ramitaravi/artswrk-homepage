/**
 * Adds bookings.recurringSeriesId — the link between the class dates of one
 * weekly class. Additive and nullable, so the currently deployed code, which
 * doesn't know the column, is unaffected. This is migration 0058 applied by
 * hand so local development works before the next publish; Manus applies the
 * same migration at publish time and will find it already present.
 *
 * Safe to run twice: it checks first and does nothing if the column exists.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [existing] = await c.query(`SHOW COLUMNS FROM bookings LIKE 'recurringSeriesId'`);
if (existing.length) {
  console.log("Column already present — nothing to do.");
} else {
  await c.query(`ALTER TABLE bookings ADD COLUMN recurringSeriesId INT NULL`);
  await c.query(`CREATE INDEX idx_bookings_series ON bookings (recurringSeriesId)`);
  console.log("Added bookings.recurringSeriesId (nullable) + index.");
}

const [[counts]] = await c.query(`SELECT COUNT(*) AS total, COUNT(recurringSeriesId) AS withSeries FROM bookings`);
console.log(`bookings: ${counts.total} total, ${counts.withSeries} linked to a series`);

const [[smoke]] = await c.query(`SELECT id, bookingStatus, recurringSeriesId FROM bookings WHERE id = 1140006`);
console.log("smoke read:", JSON.stringify(smoke));

await c.end();
