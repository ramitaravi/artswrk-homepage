/**
 * Booking 1350001 — McKell's 36h10m of admin support for Fancy Feet.
 *
 * Two things were wrong with it:
 *
 *   1. The rate. It was created at $18/hr; it should have been $20/hr
 *      (confirmed by Ramita, 2026-10-22).
 *   2. The invoice said $19.00. invoice.approve only multiplied hours for
 *      class dates, so an hourly ADMIN booking fell through to its stored
 *      artistRate — the $18 unit. 18 + round(18 x 0.05) = 19 exactly.
 *
 * This sets the rate to $20 and reshapes the row the way createAdminBooking
 * now writes an hourly booking: the unit in hourlyRate, the TOTAL in
 * artistRate/clientRate. That matters for more than tidiness — with the total
 * stored correctly the invoice prices right on BOTH the current deployed code
 * and the fixed code, so it does not matter which is live when Fancy Feet
 * presses Approve.
 *
 * The stale $19 Stripe link and stored total are cleared so the invoice
 * reprices. The payment token and submission date are kept: the invoice is
 * still McKell's, still submitted, and the client's emailed link still works.
 * They press Approve once more.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const BOOKING = 1350001;
const NEW_RATE = 20;

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
const [[b]] = await c.query(`
  SELECT b.id, b.hourlyRate, b.hours, b.rateType, b.artistRate, b.clientRate,
         b.invoiceTotalCents, b.invoiceStripeCheckoutUrl u, b.invoicePaidAt,
         b.paymentStatus, b.bookingStatus, b.invoicePaymentToken,
         DATE_FORMAT(b.startDate, '%a %b %e, %Y') d,
         a.name artist, cl.clientCompanyName client
  FROM bookings b
  LEFT JOIN users a ON a.id = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  WHERE b.id = ? AND b.deleted = 0`, [BOOKING]);

if (!b) { console.error(`Booking ${BOOKING} not found.`); process.exit(1); }

const hours = Number(b.hours);
const base = Math.round(NEW_RATE * hours * 100) / 100;
const fee = Math.round(base * 0.05);
const total = base + fee;

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${b.artist} → ${b.client},  ${b.d}`);
console.log(`  ${hours.toFixed(4)} hrs (36h10m)\n`);
console.log(`  rate      : $${b.hourlyRate}/hr  →  $${NEW_RATE}/hr`);
console.log(`  invoiced  : $${(b.invoiceTotalCents / 100).toFixed(2)}  →  $${total.toFixed(2)}`);
console.log(`  McKell    : $${base.toFixed(2)}`);
console.log(`  processing: $${fee.toFixed(2)}`);
console.log(`  she was short by $${(base - (b.invoiceTotalCents / 100 - 1)).toFixed(2)} on the old invoice\n`);

if (b.invoicePaidAt) {
  console.log(`✗ REFUSING: paid on ${String(b.invoicePaidAt).slice(0, 10)}. Repricing a settled booking`);
  console.log(`  would misstate what the studio actually paid; the difference needs its own invoice.`);
} else if (String(b.paymentStatus).toLowerCase() === "paid") {
  console.log(`✗ REFUSING: payment status is already "Paid".`);
} else if (b.rateType !== "hourly" || !(hours > 0)) {
  console.log(`✗ REFUSING: not an hourly booking with usable hours.`);
} else if (WRITE) {
  await c.query(`
    UPDATE bookings
    SET hourlyRate = ?, artistRate = ?, clientRate = ?,
        invoiceTotalCents = NULL, invoiceStripeCheckoutUrl = NULL, updatedAt = NOW()
    WHERE id = ? AND invoicePaidAt IS NULL`,
    [NEW_RATE, base, total, BOOKING]);
  console.log(`✓ rate set to $${NEW_RATE}/hr, stale $${(b.invoiceTotalCents / 100).toFixed(2)} link cleared`);
  console.log(`  Fancy Feet's existing link still works: /invoice/${String(b.invoicePaymentToken).slice(0, 8)}…`);
  console.log(`  Pressing Approve there now prices it at $${total.toFixed(2)}.`);
} else {
  console.log(`Nothing written — re-run with --write.`);
}
await c.end();
