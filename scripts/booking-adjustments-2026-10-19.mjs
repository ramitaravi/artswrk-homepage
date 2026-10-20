/**
 * The booking corrections Nick relayed on 2026-10-19.
 *
 *   1. Marlon Santana @ Lambarri — remove the 10/7 class date (#1200238).
 *      A sub covered it, so it is not his to invoice.
 *   2. Marlon Santana @ Lambarri — remove the wrong travel receipt on the
 *      9/30 booking (#1200237, reimbursement #270002). He attached the wrong
 *      one, could not remove it, and added the right one (#300001) as well.
 *   3. Katya Salnikova @ Armonk — remove the 9/30 booking (#1470001). The
 *      artist cancelled.
 *
 * Cancelled, not deleted: a booking that happened and was called off is part
 * of the record. `deleted = 1` hides it from every list and report, which is
 * right for a row created in error and wrong for one that was cancelled.
 * Marked Cancelled, these stay auditable and stop appearing as work owed.
 *
 * The 9/30 receipt is a special case and this script will NOT silently fix the
 * money: that booking was already PAID on 2026-10-14 for $290.00, which
 * included BOTH $36 travel lines. Removing the row now changes no money that
 * has already moved. Lambarri is owed $36.00 back — see the note it prints.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);

/** Cancel a booking, refusing if money has already moved on it. */
async function cancel(id, why) {
  const [[b]] = await c.query(`
    SELECT b.id, DATE(b.startDate) d, b.hours, b.bookingStatus, b.paymentStatus,
           b.invoicePaidAt, b.artswrkInvoiceSubmittedAt,
           a.name artist, cl.clientCompanyName client
    FROM bookings b
    LEFT JOIN users a ON a.id = b.artistUserId
    LEFT JOIN users cl ON cl.id = b.clientUserId
    WHERE b.id = ? AND b.deleted = 0`, [id]);
  if (!b) { console.log(`  #${id} — not found or already removed\n`); return; }

  console.log(`  #${b.id}  ${b.artist} → ${b.client}  ${String(b.d).slice(4, 15)}  ${b.hours}h`);
  console.log(`      ${why}`);
  if (b.invoicePaidAt) {
    console.log(`      ✗ REFUSING — already paid ${String(b.invoicePaidAt).slice(4, 15)}. Cancelling a paid booking would misstate what was charged.\n`);
    return;
  }
  if (b.artswrkInvoiceSubmittedAt) {
    console.log(`      ! the artist has already submitted an invoice for this — its payment link will stop working`);
  }
  if (WRITE) {
    await c.query(`
      UPDATE bookings
      SET bookingStatus = 'Cancelled', invoicePaymentToken = NULL,
          invoiceStripeCheckoutUrl = NULL, updatedAt = NOW()
      WHERE id = ? AND invoicePaidAt IS NULL`, [id]);
    console.log(`      ✓ cancelled\n`);
  } else {
    console.log(`      would mark Cancelled and void any unused payment link\n`);
  }
}

console.log("1 + 3. Bookings to cancel\n");
await cancel(1200238, "Marlon @ Lambarri, 10/7 — a sub covered the class.");
await cancel(1470001, "Katya @ Armonk, 9/30 — the artist cancelled.");

console.log("2. The duplicate travel receipt on Marlon's 9/30 booking\n");
const [[paidBooking]] = await c.query(`SELECT invoiceTotalCents, DATE(invoicePaidAt) paid FROM bookings WHERE id = 1200237`);
const [reimb] = await c.query(`SELECT id, value, note FROM reimbursements WHERE bookingId = 1200237 ORDER BY createdAt`);
for (const r of reimb) console.log(`      #${r.id}  $${Number(r.value).toFixed(2)}  "${r.note}"`);
console.log(`\n      That booking was PAID on ${String(paidBooking.paid).slice(4, 15)} for $${(paidBooking.invoiceTotalCents / 100).toFixed(2)},`);
console.log(`      which included BOTH travel lines. Deleting the duplicate now moves no money.`);
console.log(`      → Lambarri is owed $36.00 back. Refund it in Stripe, or credit the next invoice.`);
console.log(`      This script does not touch a paid booking's reimbursements; doing so would make`);
console.log(`      the record disagree with what was actually charged.\n`);

if (!WRITE) console.log("Nothing written — re-run with --write.");
await c.end();
