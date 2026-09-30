/**
 * Convert weekly class bookings from "one booking + hidden billing periods"
 * into one ordinary booking per class date.
 *
 * Each class date becomes a normal booking the studio pays with Pay Now, the
 * same flow they already use for one-off bookings. Payment state carries over
 * exactly: a paid week becomes a Completed/Paid booking keeping its invoice
 * total, token and paid-at date; a submitted week becomes a Pay Now booking
 * keeping its hours, invoice total and token, so an invoice link already
 * emailed still works. Reimbursements move to the date they belong to. The
 * original season row keeps its periods and is retired rather than deleted, so
 * this can be unwound.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");

const STATUS_MAP = {
  client_paid:      { bookingStatus: "Completed", paymentStatus: "Paid" },
  artist_submitted: { bookingStatus: "Pay Now",   paymentStatus: "Unpaid" },
  open:             { bookingStatus: "Confirmed", paymentStatus: "Unpaid" },
  upcoming:         { bookingStatus: "Confirmed", paymentStatus: "Unpaid" },
};

const money = (cents) => (cents == null ? "—" : `$${(cents / 100).toFixed(2)}`);
const day = (d) => new Date(d).toISOString().slice(0, 10);

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [series] = await c.query(`
  SELECT b.*, a.name AS artistName, cl.clientCompanyName, cl.email AS clientEmail
  FROM bookings b
  LEFT JOIN users a ON a.id = b.artistUserId
  LEFT JOIN users cl ON cl.id = b.clientUserId
  -- Season rows only. A converted class date has isRecurring = 0, so it never
  -- matches here and re-running this cannot double-convert anything.
  WHERE b.isRecurring = 1 AND b.deleted = 0
    -- #630002 is a test booking with no hours on it: converting it would create
    -- 19 bookings nobody can invoice. Ramita asked for it to be dropped instead.
    AND b.id <> 630002
  ORDER BY b.id
`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN — nothing will be written"}`);
console.log(`${series.length} weekly bookings to convert\n`);

let totalNew = 0, totalSkipped = 0, totalReimb = 0, totalPaid = 0, totalOwed = 0, owedCents = 0;

for (const b of series) {
  const [periods] = await c.query(
    `SELECT * FROM booking_periods WHERE bookingId = ? ORDER BY periodNumber`, [b.id]);
  const live = periods.filter((p) => p.status !== "skipped");
  const skipped = periods.length - live.length;
  const counts = live.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});

  const [reimb] = await c.query(
    `SELECT COUNT(*) n, COALESCE(SUM(value),0) v FROM reimbursements
     WHERE bookingPeriodId IN (SELECT id FROM booking_periods WHERE bookingId = ?)`, [b.id]);

  console.log(`── booking ${b.id} · ${b.artistName} → ${b.clientCompanyName ?? b.clientEmail}`);
  console.log(`   ${(b.description ?? "").split("\n")[0]}`);
  console.log(`   $${b.hourlyRate}/hr × ${b.hours ?? "?"}h · ${day(b.startDate)} → ${day(b.endDate)}`);
  console.log(`   becomes ${live.length} bookings` + (skipped ? ` (${skipped} skipped week(s) left behind)` : ""));
  console.log(`   ${Object.entries(counts).map(([k, v]) => `${v} × ${STATUS_MAP[k].bookingStatus}`).join(", ")}`);

  for (const p of live.filter((p) => p.status === "client_paid" || p.status === "artist_submitted")) {
    const m = STATUS_MAP[p.status];
    console.log(`     · ${day(p.periodStart)}  ${m.bookingStatus.padEnd(9)} ${money(p.invoiceTotalCents)}` +
      `  ${p.actualHours ?? "?"}h` +
      (p.invoicePaidAt ? `  paid ${day(p.invoicePaidAt)}` : "") +
      (p.invoicePaymentToken ? `  invoice link preserved` : ""));
    if (p.status === "client_paid") totalPaid++;
    else { totalOwed++; owedCents += Number(p.invoiceTotalCents ?? 0); }
  }
  if (Number(reimb[0].n)) console.log(`   ${reimb[0].n} reimbursement(s), $${reimb[0].v} total, move to their dates`);

  totalNew += live.length;
  totalSkipped += skipped;
  totalReimb += Number(reimb[0].n);

  if (WRITE) {
    let seriesId = null;
    for (const p of live) {
      const m = STATUS_MAP[p.status];
      // The class day at the time the artist was reminded: the moment class
      // starts, which is what both dashboards display and what the day-of
      // completion reminder fires on.
      const startAt = p.notifyArtistAt ?? p.periodStart;
      const [res] = await c.query(
        `INSERT INTO bookings
           (clientUserId, artistUserId, rateType, hourlyRate, artistRate, clientRate,
            startDate, endDate, locationAddress, locationLat, locationLng, locationCity, locationState,
            locationPlaceId, description, hours, bookingStatus, paymentStatus, paymentMethod,
            isAdminBooking, isRecurring, recurringCadence, recurringSeriesId,
            artswrkInvoiceSubmittedAt, invoicePaymentToken, invoiceStripeCheckoutUrl,
            invoiceTotalCents, invoicePaidAt, invoiceStripePaymentIntentId,
            totalClientRate, deleted, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?, ?,0,NOW(),NOW())`,
        [b.clientUserId, b.artistUserId, "hourly", b.hourlyRate, b.artistRate, b.clientRate,
         startAt, startAt, b.locationAddress, b.locationLat, b.locationLng, b.locationCity, b.locationState,
         b.locationPlaceId, b.description, p.actualHours ?? b.hours, m.bookingStatus, m.paymentStatus, "artswrk",
         1, 0, b.recurringCadence, seriesId,
         p.artistSubmittedAt, p.invoicePaymentToken, p.invoiceStripeCheckoutUrl,
         p.invoiceTotalCents, p.invoicePaidAt, p.invoiceStripePaymentIntentId,
         p.status === "client_paid" && p.invoiceTotalCents != null ? p.invoiceTotalCents / 100 : null]);
      const newId = res.insertId;
      if (seriesId === null) {
        seriesId = newId;
        await c.query(`UPDATE bookings SET recurringSeriesId = ? WHERE id = ?`, [seriesId, newId]);
      }
      await c.query(`UPDATE reimbursements SET bookingId = ? WHERE bookingPeriodId = ?`, [newId, p.id]);
      await c.query(
        `UPDATE booking_periods SET artistNotes = CONCAT(COALESCE(artistNotes,''), ' [converted to booking ', ?, ']') WHERE id = ?`,
        [newId, p.id]);
    }
    await c.query(`UPDATE bookings SET bookingStatus = 'Cancelled', deleted = 1, updatedAt = NOW() WHERE id = ?`, [b.id]);
    console.log(`   ✓ created ${live.length} bookings (series ${seriesId}); original ${b.id} retired`);
  }
  console.log();
}

console.log(`${WRITE ? "Created" : "Would create"} ${totalNew} class-date bookings from ${series.length} series`);
console.log(`  ${totalPaid} already-paid weeks carry their receipts`);
console.log(`  ${totalOwed} submitted weeks stay payable — ${money(owedCents)} owed`);
console.log(`  ${totalSkipped} skipped weeks left behind, ${totalReimb} reimbursements re-pointed`);
if (!WRITE) console.log(`\nNothing was written. Re-run with --write to apply.`);

await c.end();
