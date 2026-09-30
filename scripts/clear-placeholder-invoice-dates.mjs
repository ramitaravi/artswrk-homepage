/**
 * Clears the placeholder invoice-submitted date on weekly class bookings.
 *
 * Seven season bookings carry artswrkInvoiceSubmittedAt = '2001-01-01', written
 * when they were created. No invoice was ever submitted on them — the hours and
 * invoices live on the class dates — but the studio's booking page read it as
 * "Invoice submitted January 1, 2001". Nulling it is the honest state.
 *
 * Only touches rows whose date is before 2010, which no real invoice can be.
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [rows] = await c.query(`
  SELECT b.id, cl.clientCompanyName AS client, a.name AS artist,
         CAST(b.artswrkInvoiceSubmittedAt AS CHAR) AS placeholder,
         b.invoiceTotalCents, b.invoicePaidAt
  FROM bookings b
  LEFT JOIN users cl ON cl.id = b.clientUserId
  LEFT JOIN users a ON a.id = b.artistUserId
  WHERE b.artswrkInvoiceSubmittedAt IS NOT NULL AND YEAR(b.artswrkInvoiceSubmittedAt) < 2010
  ORDER BY b.id
`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ${rows.length} booking(s) with a placeholder invoice date\n`);
for (const r of rows) {
  console.log(`  ${r.id}  ${r.client ?? "—"} / ${r.artist ?? "—"}  ${r.placeholder}` +
    (r.invoiceTotalCents != null || r.invoicePaidAt ? "  ⚠ has invoice data — SKIPPED" : ""));
}

// A row with a real invoice total or payment is left alone: nulling its
// submitted date would hide a real invoice.
const safe = rows.filter((r) => r.invoiceTotalCents == null && r.invoicePaidAt == null);

if (WRITE && safe.length) {
  const [res] = await c.query(
    `UPDATE bookings SET artswrkInvoiceSubmittedAt = NULL, updatedAt = NOW() WHERE id IN (${safe.map((r) => r.id).join(",")})`);
  console.log(`\n✓ cleared ${res.affectedRows} row(s)`);
} else if (!WRITE) {
  console.log(`\nWould clear ${safe.length} row(s). Nothing was written — re-run with --write.`);
}

await c.end();
