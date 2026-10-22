/**
 * Booking corrections requested 2026-10-22 (Ramita, via Nick's Slack relay).
 *
 *   1200237  Marlon @ Lambarri, 9/30  — mark paid.
 *            ALREADY paid: $290.00 on 2026-10-14 via a live Stripe session.
 *            Nothing to write. The duplicate $36 travel receipt it included
 *            was handled manually outside the platform, so the charged amount
 *            stands and the reimbursement rows are deliberately left as they
 *            are — editing them would make the record disagree with the money.
 *
 *   1200238  Marlon @ Lambarri, 10/7  — cancel. A sub covered the class.
 *            Cancelled rather than deleted: it happened and was called off,
 *            which is part of the record. `deleted` would hide it everywhere.
 *
 *   1290002  Sara Pagliaro @ Fancy Feet, 10/8 — mark paid at $158.00.
 *            3 hrs x $50/hr = $150 to Sara, plus the $8 processing fee.
 *            Paid outside the normal flow, so there is no Stripe session on
 *            it; the total is recorded so her wallet and the studio's spend
 *            both show the real figure rather than nothing.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const show = async (id) => {
  const [[b]] = await c.query(`
    SELECT b.id, a.name artist, cl.clientCompanyName client, DATE(b.startDate) d, b.hours, b.hourlyRate,
           b.bookingStatus, b.paymentStatus, b.invoiceTotalCents, b.invoicePaidAt
    FROM bookings b LEFT JOIN users a ON a.id=b.artistUserId LEFT JOIN users cl ON cl.id=b.clientUserId
    WHERE b.id = ? AND b.deleted = 0`, [id]);
  return b;
};
const line = (b) => `${b.artist} → ${b.client}, ${String(b.d).slice(4,15)} — ${b.bookingStatus}/${b.paymentStatus}`
  + `, ${b.invoiceTotalCents != null ? "$" + (b.invoiceTotalCents/100).toFixed(2) : "no total"}`
  + `, paid ${b.invoicePaidAt ? String(b.invoicePaidAt).slice(4,15) : "NO"}`;

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);

// ── 1200237 — already settled, so this is a check, not a write ─────────────
const marlon930 = await show(1200237);
console.log(`#1200237  ${line(marlon930)}`);
if (marlon930.invoicePaidAt) {
  console.log(`   ✓ already paid — nothing to write\n`);
} else {
  console.log(`   ! expected this to be paid already; leaving it alone\n`);
}

// ── 1200238 — cancel ───────────────────────────────────────────────────────
const marlon107 = await show(1200238);
console.log(`#1200238  ${line(marlon107)}`);
if (!marlon107) {
  console.log(`   already removed\n`);
} else if (marlon107.invoicePaidAt) {
  console.log(`   ✗ REFUSING — it has been paid; cancelling would misstate what was charged\n`);
} else if (WRITE) {
  await c.query(`
    UPDATE bookings SET bookingStatus='Cancelled', invoicePaymentToken=NULL,
      invoiceStripeCheckoutUrl=NULL, updatedAt=NOW()
    WHERE id=1200238 AND invoicePaidAt IS NULL`);
  console.log(`   ✓ cancelled (a sub covered it)\n`);
} else {
  console.log(`   would mark Cancelled and void any unused payment link\n`);
}

// ── 1290002 — mark paid at $158.00 ─────────────────────────────────────────
const sara = await show(1290002);
const BASE = Number(sara.hourlyRate) * Number(sara.hours);      // 3 x 50 = 150
const FEE = Math.round(BASE * 0.05);                            // 8
const TOTAL_CENTS = Math.round((BASE + FEE) * 100);             // 15800
console.log(`#1290002  ${line(sara)}`);
console.log(`   ${sara.hours} hrs × $${sara.hourlyRate}/hr = $${BASE.toFixed(2)} to Sara + $${FEE} fee = $${((BASE+FEE)).toFixed(2)}`);
if (sara.invoicePaidAt) {
  console.log(`   ✓ already paid — nothing to write\n`);
} else if (TOTAL_CENTS !== 15800) {
  console.log(`   ✗ REFUSING — computed $${(TOTAL_CENTS/100).toFixed(2)}, expected $158.00. Check the hours and rate.\n`);
} else if (WRITE) {
  await c.query(`
    UPDATE bookings
    SET bookingStatus='Completed', paymentStatus='Paid',
        invoiceTotalCents=?, invoicePaidAt=NOW(),
        artswrkInvoiceSubmittedAt=COALESCE(artswrkInvoiceSubmittedAt, NOW()),
        updatedAt=NOW()
    WHERE id=1290002 AND invoicePaidAt IS NULL`, [TOTAL_CENTS]);
  console.log(`   ✓ marked paid at $158.00\n`);
} else {
  console.log(`   would mark Completed/Paid at $158.00\n`);
}

if (!WRITE) console.log("Nothing written — re-run with --write.");
await c.end();
