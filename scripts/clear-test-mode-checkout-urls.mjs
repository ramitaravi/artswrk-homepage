/**
 * Clears test-mode Stripe Checkout URLs stored on live bookings.
 *
 * Development runs against the live database with a test Stripe key, so
 * approving an invoice locally saved a cs_test_ session onto a real booking.
 * Days later the studio clicked Pay Now, got that same session back, and
 * Stripe declined their card for being a real card in test mode.
 *
 * Clearing the URL is safe: the invoice page creates a fresh session, in
 * whatever mode the server is actually running, the next time it is opened.
 * The payment token, total and hours are untouched, so emailed links still work.
 *
 * Never touches a booking that has been paid.
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [rows] = await c.query(`
  SELECT b.id, DATE_FORMAT(b.startDate, '%a %b %e, %Y') AS classDate,
         a.name AS artist, cl.clientCompanyName AS client,
         ROUND(b.invoiceTotalCents / 100, 2) AS total,
         b.invoicePaidAt, b.bookingStatus
  FROM bookings b
  LEFT JOIN users a ON a.id = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  WHERE b.invoiceStripeCheckoutUrl LIKE '%cs_test_%' AND b.deleted = 0
  ORDER BY b.startDate
`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ${rows.length} booking(s) holding a test-mode checkout\n`);
const safe = [];
for (const r of rows) {
  const paid = r.invoicePaidAt != null;
  console.log(`  ${paid ? "✗" : "✓"} ${r.id}  ${r.classDate}  ${r.artist ?? "—"} → ${r.client ?? "—"}  $${r.total ?? "—"}` +
    (paid ? "  PAID — left alone" : ""));
  if (!paid) safe.push(r.id);
}

if (WRITE && safe.length) {
  const [res] = await c.query(
    `UPDATE bookings SET invoiceStripeCheckoutUrl = NULL, updatedAt = NOW() WHERE id IN (${safe.join(",")})`);
  console.log(`\n✓ cleared ${res.affectedRows} — the next Pay Now creates a live session`);
} else if (!WRITE) {
  console.log(`\nWould clear ${safe.length}. Nothing written — re-run with --write.`);
}

// The same mistake can be made on the period rows the migration left behind.
const [[periods]] = await c.query(
  `SELECT COUNT(*) AS n FROM booking_periods WHERE invoiceStripeCheckoutUrl LIKE '%cs_test_%'`);
if (Number(periods.n)) {
  console.log(`\nNote: ${periods.n} retired billing period(s) also hold test URLs. They are no longer read by the app.`);
}

await c.end();
