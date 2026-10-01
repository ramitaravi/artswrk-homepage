/**
 * Deletes test booking #630002 and its class weeks.
 *
 * It is Ramita's own test weekly booking (client and artist both internal),
 * carries no hours, and has produced nothing payable — but it sits in the
 * recurring data and would otherwise be converted into 19 bookings nobody can
 * invoice. Soft-deleted, the same as any cancelled booking, so it disappears
 * from every dashboard while the row survives.
 *
 * Refuses to touch it if any week was ever submitted or paid.
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const BOOKING_ID = 630002;
const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [[booking]] = await c.query(`
  SELECT b.id, b.bookingStatus, b.paymentStatus, b.hours, b.deleted,
         DATE(b.startDate) AS startD, DATE(b.endDate) AS endD,
         cl.email AS clientEmail, a.email AS artistEmail
  FROM bookings b
  LEFT JOIN users cl ON cl.id = b.clientUserId
  LEFT JOIN users a ON a.id = b.artistUserId
  WHERE b.id = ${BOOKING_ID}
`);

if (!booking) {
  console.log(`Booking ${BOOKING_ID} not found — nothing to do.`);
  await c.end();
  process.exit(0);
}

const [[periods]] = await c.query(`
  SELECT COUNT(*) AS n,
         SUM(status IN ('artist_submitted', 'client_paid')) AS touched,
         SUM(invoiceTotalCents IS NOT NULL) AS invoiced
  FROM booking_periods WHERE bookingId = ${BOOKING_ID}
`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  booking ${booking.id}: ${booking.bookingStatus}/${booking.paymentStatus}, ${booking.hours ?? "no"} hours`);
console.log(`  ${booking.clientEmail ?? "—"} → ${booking.artistEmail ?? "—"}`);
console.log(`  ${booking.startD} → ${booking.endD}, ${periods.n} class weeks`);
console.log(`  already deleted: ${booking.deleted ? "yes" : "no"}`);

if (Number(periods.touched) || Number(periods.invoiced)) {
  console.log(`\n✗ REFUSING: ${periods.touched} week(s) submitted or paid, ${periods.invoiced} invoiced. This is not a dead test booking.`);
  await c.end();
  process.exit(1);
}

if (WRITE) {
  await c.query(`DELETE FROM booking_periods WHERE bookingId = ${BOOKING_ID}`);
  const [res] = await c.query(
    `UPDATE bookings SET deleted = 1, bookingStatus = 'Cancelled', updatedAt = NOW() WHERE id = ${BOOKING_ID}`);
  console.log(`\n✓ removed ${periods.n} class weeks and soft-deleted the booking (${res.affectedRows} row)`);
} else {
  console.log(`\nWould remove ${periods.n} class weeks and soft-delete the booking. Nothing written — re-run with --write.`);
}

await c.end();
