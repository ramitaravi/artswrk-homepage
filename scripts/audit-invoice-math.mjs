/**
 * Checks the money the invoice page now shows against reality, booking by booking.
 *
 * PAID bookings are the ground truth: a studio's card was charged a real
 * amount. If the shared function reproduces that amount from the stored rate
 * and hours, the preview and the charge agree. Anything it cannot reproduce is
 * printed in full rather than summarised away.
 *
 * PAYABLE bookings are what a studio will see next. For each one it prints what
 * the page will quote, so a wrong number is caught here and not by a customer.
 *
 * Read-only.
 */
import mysql from "mysql2/promise";
import "dotenv/config";
import { resolveInvoiceTotals, bookingMoney } from "../shared/bookingRates.ts";

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

/** What the invoice page will now show, by the same rules the server charges by. */
function previewTotal(b) {
  if (b.recurringSeriesId) {
    return bookingMoney(
      { rateType: "hourly", hourlyRate: Number(b.hourlyRate ?? 0), flatRate: null, hours: Number(b.hours ?? 0) },
      { hoursOverride: Number(b.hours ?? 0), reimbursements: Number(b.reimb ?? 0) },
    ).clientTotal;
  }
  return resolveInvoiceTotals(
    {
      isHourlyRate: b.isHourlyRate,
      storedTotal: Number(b.artistRate ?? 0),
      unitHourlyRate: b.artistHourlyRate ?? b.hourlyRate ?? null,
      storedHours: b.hours,
    },
    { adjustedHours: Number(b.hours ?? 0), reimbursements: Number(b.reimb ?? 0) },
  ).total;
}

const SELECT = `
  SELECT b.id, b.artistRate, b.clientRate, b.hourlyRate, b.flatRate, b.rateType, b.hours,
         b.recurringSeriesId, b.invoiceTotalCents, b.invoicePaidAt, b.bookingStatus,
         ia.isHourlyRate, ia.artistHourlyRate,
         a.name AS artist, cl.clientCompanyName AS client,
         COALESCE((SELECT SUM(r.value) FROM reimbursements r WHERE r.bookingId = b.id), 0) AS reimb
  FROM bookings b
  LEFT JOIN interested_artists ia ON ia.id = b.interestedArtistId
  LEFT JOIN users a ON a.id = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  WHERE b.deleted = 0
`;

const [paid] = await c.query(`${SELECT} AND b.invoiceTotalCents IS NOT NULL AND b.invoicePaidAt IS NOT NULL ORDER BY b.invoicePaidAt`);

console.log(`CHARGED INVOICES — does the new math reproduce what the card was actually charged?\n`);
let ok = 0;
const mismatches = [];
for (const b of paid) {
  const charged = Number(b.invoiceTotalCents) / 100;
  const preview = previewTotal(b);
  if (Math.abs(preview - charged) < 0.01) ok++;
  else mismatches.push({ ...b, charged, preview });
}
console.log(`  ${ok}/${paid.length} reproduce exactly`);
for (const m of mismatches) {
  console.log(`  ✗ ${m.id}  ${m.artist} → ${m.client}: charged $${m.charged.toFixed(2)}, page would show $${m.preview.toFixed(2)}` +
    `  [rate ${m.artistRate}, hourly ${m.hourlyRate ?? "—"}, hrs ${m.hours}, hourlyFlag ${m.isHourlyRate ?? "—"}, reimb ${m.reimb}]`);
}

const [payable] = await c.query(`${SELECT} AND b.bookingStatus = 'Pay Now' AND b.invoicePaidAt IS NULL ORDER BY b.startDate`);
console.log(`\nPAYABLE NOW — what each studio will be quoted:\n`);
for (const b of payable) {
  const preview = previewTotal(b);
  const stored = b.invoiceTotalCents != null ? Number(b.invoiceTotalCents) / 100 : null;
  const flag = stored != null && Math.abs(stored - preview) >= 0.01 ? `  ⚠ stored invoice says $${stored.toFixed(2)}` : "";
  console.log(`  ${b.id}  ${b.artist} → ${b.client}  ${b.hours}h` +
    `  → $${preview.toFixed(2)}${flag}`);
}

await c.end();
