/**
 * Remove the travel receipt Marlon attached to the wrong day.
 *
 * Booking 1200237 (Lambarri, 9/30) carries two $36 travel reimbursements:
 *
 *   #270002  "Travel"            <- attached by mistake, could not self-remove
 *   #300001  "Correct Travel!!"  <- the right one, added after
 *
 * The booking was charged $290.00 on 2026-10-14 and that figure included
 * BOTH. The $36 difference was settled manually outside the platform
 * (confirmed by Ramita, 2026-10-22), so the charge stands and only the
 * duplicate row goes.
 *
 * THIS LEAVES A DELIBERATE DISCREPANCY: after this runs, the booking's
 * reimbursements total $36 while its invoice records $290 charged, which
 * is $36 more than the line items now add up to. That is correct — the
 * money really did move and was refunded outside Artswrk. Anyone auditing
 * booking 1200237 should read this file rather than assume a bug.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const BOOKING = 1200237;
const REMOVE = 270002;   // "Travel" — the one on the wrong day
const KEEP = 300001;     // "Correct Travel!!"

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
const [[b]] = await c.query(`
  SELECT id, invoiceTotalCents, hours, hourlyRate, DATE(invoicePaidAt) paid
  FROM bookings WHERE id = ? AND deleted = 0`, [BOOKING]);
const [rows] = await c.query(`SELECT id, value, note FROM reimbursements WHERE bookingId = ?`, [BOOKING]);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  booking #${BOOKING} — charged $${(b.invoiceTotalCents / 100).toFixed(2)} on ${String(b.paid).slice(4, 15)}`);
console.log(`  reimbursements on it now:`);
for (const r of rows) {
  const mark = r.id === REMOVE ? "  <- REMOVE (wrong day)" : r.id === KEEP ? "  <- keep" : "";
  console.log(`    #${r.id}  $${Number(r.value).toFixed(2)}  "${r.note}"${mark}`);
}

const target = rows.find((r) => r.id === REMOVE);
const keeper = rows.find((r) => r.id === KEEP);

if (!target) {
  console.log(`\n  #${REMOVE} is already gone — nothing to do.`);
} else if (!keeper) {
  console.log(`\n✗ REFUSING: the replacement (#${KEEP}) is not there, so removing #${REMOVE}`);
  console.log(`  would leave the booking with no travel receipt at all.`);
} else if (WRITE) {
  await c.query(`DELETE FROM reimbursements WHERE id = ? AND bookingId = ?`, [REMOVE, BOOKING]);
  const [after] = await c.query(`SELECT COALESCE(SUM(value), 0) total FROM reimbursements WHERE bookingId = ?`, [BOOKING]);
  const reimbTotal = Number(after[0].total);
  const work = Number(b.hourlyRate) * Number(b.hours);
  console.log(`\n✓ removed #${REMOVE}`);
  console.log(`  reimbursements now total $${reimbTotal.toFixed(2)} (was $${(reimbTotal + Number(target.value)).toFixed(2)})`);
  console.log(`\n  Note: the booking still records $${(b.invoiceTotalCents / 100).toFixed(2)} charged`);
  console.log(`  (${b.hours}h × $${b.hourlyRate} = $${work.toFixed(2)} + $72 travel + fee). That is $36 more than`);
  console.log(`  the line items now add to, because the $36 was refunded outside Artswrk.`);
} else {
  console.log(`\n  would delete #${REMOVE}, leaving $36.00 of travel on the booking`);
  console.log(`\nNothing written — re-run with --write.`);
}
await c.end();
