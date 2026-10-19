/**
 * Booking 1350001 — McKell's 36h10m of admin support for Fancy Feet — was
 * invoiced at $19.00 instead of $684.00.
 *
 * The cause: invoice.approve only multiplied hours for class dates, so an
 * hourly admin booking fell through to its stored artistRate, which on this
 * row holds the $18 UNIT rate rather than a total. 18 + round(18 x 0.05) = 19,
 * which is exactly the stored invoiceTotalCents of 1900.
 *
 * The code fix makes every per-hour booking price as rate x hours. This clears
 * what the broken run left behind so the invoice reprices on the next approve:
 *
 *   invoiceStripeCheckoutUrl  — a live Stripe session for $19. While it is
 *                               stored, canReuseCheckoutUrl hands that same
 *                               link back instead of making a correct one.
 *   invoiceTotalCents         — the stale $19, shown as authoritative on the
 *                               review page once an invoice is approved.
 *
 * The payment token and artswrkInvoiceSubmittedAt are deliberately kept: the
 * invoice is still McKell's, still submitted, and the client's emailed link
 * still works. They just have to press Approve once more, and this time it
 * computes $651 to her plus a $33 fee.
 *
 * RUN THIS ONLY AFTER THE FIX IS DEPLOYED. On the old code a fresh approve
 * would price it at $19 all over again.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const BOOKING = 1350001;
const FEE_RATE = 0.05;

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [[b]] = await c.query(`
  SELECT b.id, b.hourlyRate, b.hours, b.rateType, b.invoiceTotalCents,
         b.invoiceStripeCheckoutUrl, b.invoicePaidAt, b.paymentStatus, b.bookingStatus,
         b.invoicePaymentToken, DATE_FORMAT(b.startDate, '%a %b %e, %Y') d,
         a.name artist, cl.clientCompanyName client
  FROM bookings b
  LEFT JOIN users a  ON a.id  = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  WHERE b.id = ? AND b.deleted = 0`, [BOOKING]);

if (!b) { console.error(`Booking ${BOOKING} not found.`); process.exit(1); }

const base = Number(b.hourlyRate) * Number(b.hours);
const fee = Math.round(base * FEE_RATE);          // whole dollars, as processingFeeFor does
const total = base + fee;

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${b.artist} → ${b.client},  ${b.d}`);
console.log(`  ${Number(b.hours).toFixed(2)} hrs × $${Number(b.hourlyRate).toFixed(2)}/hr\n`);
console.log(`  invoiced now :  $${(b.invoiceTotalCents / 100).toFixed(2)}   ← wrong`);
console.log(`  should be    :  $${total.toFixed(2)}   ($${base.toFixed(2)} to ${b.artist?.split(" ")[0]} + $${fee} processing)`);
console.log(`  shortfall    :  $${(base - (b.invoiceTotalCents / 100 - 1)).toFixed(2)} to the artist\n`);

if (b.invoicePaidAt) {
  console.log(`✗ REFUSING: this invoice was paid on ${String(b.invoicePaidAt).slice(0, 10)}.`);
  console.log(`  Repricing a settled booking would misstate what the studio actually paid.`);
  console.log(`  The difference has to be handled as a separate invoice instead.`);
} else if (String(b.paymentStatus).toLowerCase() === "paid") {
  console.log(`✗ REFUSING: payment status is already "Paid".`);
} else if (b.rateType !== "hourly" || !(b.hourlyRate > 0) || !(b.hours > 0)) {
  console.log(`✗ REFUSING: this is not an hourly booking with a usable rate and hours.`);
} else if (WRITE) {
  await c.query(`
    UPDATE bookings
    SET invoiceStripeCheckoutUrl = NULL, invoiceTotalCents = NULL, updatedAt = NOW()
    WHERE id = ? AND invoicePaidAt IS NULL`, [BOOKING]);
  console.log(`✓ cleared the $${(b.invoiceTotalCents / 100).toFixed(2)} checkout link and stored total.`);
  console.log(`  The client's existing link still works: /invoice/${b.invoicePaymentToken?.slice(0, 8)}…`);
  console.log(`  Pressing Approve there now prices it at $${total.toFixed(2)}.`);
} else {
  console.log(`Nothing written — re-run with --write (AFTER the fix is deployed).`);
}

await c.end();
