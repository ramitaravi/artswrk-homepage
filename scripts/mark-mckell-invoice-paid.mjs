/**
 * Booking 1350001 — McKell's 36h10m of admin support for Fancy Feet.
 *
 * Settled manually outside Artswrk (confirmed by Ramita, 2026-10-22), so the
 * platform record is brought in line with what actually happened:
 *
 *   36.1667 hrs x $20/hr = $723.33 to McKell
 *   + $36 processing     = $759.33 charged to Fancy Feet
 *
 * The payment token is cleared along with it. The invoice link was emailed to
 * the studio and still resolves; leaving it live on a settled booking invites
 * a second payment for the same work.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const BOOKING = 1350001;

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
const [[b]] = await c.query(`
  SELECT b.id, b.hours, b.hourlyRate, b.artistRate, b.clientRate, b.rateType,
         b.bookingStatus, b.paymentStatus, b.invoiceTotalCents, b.invoicePaidAt,
         b.invoicePaymentToken, DATE_FORMAT(b.startDate, '%a %b %e, %Y') d,
         a.name artist, cl.clientCompanyName client
  FROM bookings b
  LEFT JOIN users a ON a.id = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  WHERE b.id = ? AND b.deleted = 0`, [BOOKING]);

if (!b) { console.error(`Booking ${BOOKING} not found.`); process.exit(1); }

const hours = Number(b.hours);
const base = Math.round(Number(b.hourlyRate) * hours * 100) / 100;
const fee = Math.round(base * 0.05);
const total = base + fee;
const cents = Math.round(total * 100);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${b.artist} → ${b.client},  ${b.d}`);
console.log(`  ${hours.toFixed(4)} hrs × $${b.hourlyRate}/hr`);
console.log(`  McKell receives : $${base.toFixed(2)}`);
console.log(`  Fancy Feet paid : $${total.toFixed(2)}  (incl. $${fee} processing)`);
console.log(`  status          : ${b.bookingStatus}/${b.paymentStatus} → Completed/Paid\n`);

if (b.invoicePaidAt) {
  console.log(`  ✓ already marked paid on ${String(b.invoicePaidAt).slice(4, 15)} — nothing to write`);
} else if (b.rateType !== "hourly" || !(hours > 0) || !(Number(b.hourlyRate) > 0)) {
  console.log(`  ✗ REFUSING: not an hourly booking with a usable rate and hours.`);
} else if (Math.abs(Number(b.artistRate) - base) > 0.01) {
  console.log(`  ✗ REFUSING: stored artistRate ($${b.artistRate}) disagrees with rate × hours ($${base.toFixed(2)}).`);
  console.log(`    Marking it paid would record a total the booking does not support.`);
} else if (WRITE) {
  await c.query(`
    UPDATE bookings
    SET bookingStatus = 'Completed', paymentStatus = 'Paid',
        invoiceTotalCents = ?, invoicePaidAt = NOW(),
        invoicePaymentToken = NULL, invoiceStripeCheckoutUrl = NULL,
        updatedAt = NOW()
    WHERE id = ? AND invoicePaidAt IS NULL`, [cents, BOOKING]);
  console.log(`  ✓ marked Completed/Paid at $${total.toFixed(2)}`);
  console.log(`  ✓ payment link voided, so the emailed invoice can't be paid twice`);
} else {
  console.log(`  would mark Completed/Paid at $${total.toFixed(2)} and void the payment link`);
  console.log(`\nNothing written — re-run with --write.`);
}
await c.end();
