/**
 * Set the hours on a single class-date booking.
 *
 * Studios and admins have no way to correct hours on a booking today — only the
 * artist can, by submitting them — so a class that ran short sits at its
 * scheduled hours until they do. This sets them directly.
 *
 * It only touches the scheduled hours, not an invoice: if the artist has
 * already submitted, the invoice total is what the studio pays and rewriting
 * it behind them would be wrong, so the script refuses.
 *
 *   node scripts/set-booking-hours.mjs <bookingId> <hours> [--write]
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const [idArg, hoursArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WRITE = process.argv.includes("--write");
const bookingId = Number(idArg);
const hours = Number(hoursArg);

if (!Number.isFinite(bookingId) || !Number.isFinite(hours) || hours <= 0 || hours > 24) {
  console.error("Usage: node scripts/set-booking-hours.mjs <bookingId> <hours> [--write]");
  process.exit(1);
}

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [[b]] = await c.query(`
  SELECT b.id, DATE_FORMAT(b.startDate, '%a %b %e, %Y') AS classDate, b.hours, b.hourlyRate, b.rateType,
         b.bookingStatus, b.invoiceTotalCents, b.invoicePaidAt, b.artswrkInvoiceSubmittedAt,
         a.name AS artist, cl.clientCompanyName AS client
  FROM bookings b
  LEFT JOIN users a ON a.id = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  WHERE b.id = ${bookingId} AND b.deleted = 0
`);

if (!b) { console.error(`Booking ${bookingId} not found.`); process.exit(1); }

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${b.artist} → ${b.client ?? "—"}, ${b.classDate}`);
console.log(`  ${b.hours} hrs → ${hours} hrs at $${b.hourlyRate}/hr`);
console.log(`  artist is paid  $${(b.hourlyRate * hours).toFixed(2)}  (was $${(b.hourlyRate * b.hours).toFixed(2)})`);
console.log(`  studio pays     $${(b.hourlyRate * hours * 1.05).toFixed(2)}  (incl. the 5% processing fee)`);

if (b.invoicePaidAt) {
  console.log(`\n✗ REFUSING: this class was already paid on ${String(b.invoicePaidAt).slice(0, 10)}.`);
} else if (b.invoiceTotalCents != null || b.artswrkInvoiceSubmittedAt) {
  console.log(`\n✗ REFUSING: the artist has already submitted an invoice ($${(b.invoiceTotalCents / 100).toFixed(2)}).`);
  console.log(`  The studio adjusts hours on the invoice review page instead.`);
} else if (WRITE) {
  await c.query(`UPDATE bookings SET hours = ?, updatedAt = NOW() WHERE id = ?`, [hours, bookingId]);
  console.log(`\n✓ set to ${hours} hrs`);
} else {
  console.log(`\nNothing written — re-run with --write.`);
}

await c.end();
