/**
 * Does every booking's stored money agree with itself?
 *
 * The recurring failure in this codebase is confusing `artistRate`/`clientRate`
 * (booking TOTALS) with `hourlyRate` (the per-hour unit). This checks the
 * database for rows where those disagree, so a regression shows up as a number
 * rather than as a studio complaining.
 *
 * Read-only. Safe to run any time.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
const check = async (label, sql) => {
  const [[r]] = await c.query(sql);
  const n = Number(r.n);
  console.log(`  ${n === 0 ? "ok  " : "FLAG"}  ${String(n).padStart(5)}  ${label}`);
  return n;
};

console.log("Booking rate integrity\n");

// `artistRate` means different things on different rows, by design:
//   - a confirmed applicant stores the booking TOTAL there
//   - a class date / admin booking stores the per-hour UNIT there
// So each is checked against its own rule. Checking one rule against both is
// what made an earlier version of this script flag 351 perfectly good rows.
await check("confirmed applicants where artistRate != hourlyRate x hours",
  `SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND rateType='hourly'
     AND hourlyRate IS NOT NULL AND hours > 0 AND artistRate IS NOT NULL
     AND recurringSeriesId IS NULL AND isAdminBooking = 0
     AND ABS(artistRate - (hourlyRate * hours)) > 1`);

await check("class dates where artistRate != the unit rate",
  `SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND recurringSeriesId IS NOT NULL
     AND hourlyRate IS NOT NULL AND artistRate IS NOT NULL
     AND ABS(artistRate - hourlyRate) >= 0.01`);

await check("hourly bookings with no unit rate (would price at $0)",
  `SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND rateType='hourly'
     AND (hourlyRate IS NULL OR hourlyRate <= 0)`);

await check("flat bookings carrying an hourly rate (two meanings at once)",
  `SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND rateType='flat' AND hourlyRate IS NOT NULL`);

await check("artswrk bookings where clientRate is below artistRate (fee missing)",
  `SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND paymentMethod='artswrk'
     AND artistRate IS NOT NULL AND clientRate IS NOT NULL AND clientRate < artistRate`);

await check("paid class-date invoices charged something other than rate x hours",
  `SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND invoicePaidAt IS NOT NULL
     AND recurringSeriesId IS NOT NULL AND invoiceTotalCents IS NOT NULL
     AND hourlyRate IS NOT NULL AND hours > 0
     AND (SELECT COUNT(*) FROM reimbursements r WHERE r.bookingId = bookings.id) = 0
     AND ABS(invoiceTotalCents/100 - (hourlyRate*hours + ROUND(hourlyRate*hours*0.05))) > 1`);

console.log(`\n  Any FLAG above is a real disagreement. "artistRate != hourlyRate" on`);
console.log(`  its own is NOT a fault — the column legitimately holds a total on one`);
console.log(`  kind of row and a unit rate on another.`);

const [[spread]] = await c.query(`
  SELECT SUM(rateType='hourly') hourly, SUM(rateType='flat') flat, SUM(rateType IS NULL) legacy, COUNT(*) total
  FROM bookings WHERE deleted=0`);
console.log(`\n  rate types: ${Number(spread.hourly)} hourly, ${Number(spread.flat)} flat, ${Number(spread.legacy)} legacy (no rateType), ${Number(spread.total)} total`);
await c.end();
