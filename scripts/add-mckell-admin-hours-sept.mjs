/**
 * McKell's admin hours for Fancy Feet, Aug 31 – Oct 4 2026.
 *
 * Created as an ordinary confirmed booking rather than a pre-made invoice, so
 * McKell completes it from her own dashboard and invoices the studio herself —
 * the same flow as any other booking. 36h10m at $18/hr.
 *
 * The hours are itemised by week in the description, matching the format of her
 * August booking (#1110001) so the studio recognises it.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");

const ARTIST = 781139;    // McKell Norton-Duren
const CLIENT = 1020767;   // Fancy Feet Dance Studio
const RATE = 18;
const HOURS = 36 + 10 / 60;            // 36h10m, as submitted
const START = "2026-10-04 17:00:00";   // the last day of the period, 1pm Eastern

const DESCRIPTION = `Admin support · 36h10m @ $18.00/hr

Week of Aug 31–Sep 6 — 6.75 hrs
  8/31  10:00–11:00 (1.0)
  9/1   10:45–12:30 (1.75)
  9/3   9:30–11:30 (2.0)
  9/4   5:00–7:00 (2.0)

Week of Sep 7–13 — 6.75 hrs
  9/7   10:30–12:00 (1.5)
  9/8   1:00–2:00 (1.0)
  9/10  5:30–7:00 (1.5)
  9/11  7:30–9:00 (1.5)
  9/13  7:30–8:45 (1.25)

Week of Sep 14–20 — 6.75 hrs
  9/14  10:00–11:00 (1.0)
  9/15  10:45–12:30 (1.75)
  9/17  9:30–11:30 (2.0)
  9/18  5:00–7:00 (2.0)

Week of Sep 21–27 — 7.5 hrs
  9/21  11:00–12:00 (1.0)
  9/23  10:00–12:30 (2.5)
  9/24  12:00–2:00 (2.0)
  9/25  9:00–10:00 (1.0)
  9/26  12:30–1:30 (1.0)

Week of Sep 28–Oct 4 — 8h25m
  9/29  8:00–9:00 (1.0)
  9/30  8:30–9:00 (0.5) + 10:45–12:00 (1.25) + 8:30–9:00pm (0.5)
  10/1  12:00–2:00 (2.0)
  10/2  9:00–9:45 (0.75) + 11:15–12:00 (0.75) + 4:50–5:30 (0h40m)
  10/4  2:30–3:30 (1.0)`;

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const base = RATE * HOURS;
const fee = Math.round(base * 0.05 * 100) / 100;

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  McKell Norton-Duren → Fancy Feet Dance Studio`);
console.log(`  ${HOURS.toFixed(4)} hrs (36h10m) at $${RATE}/hr`);
console.log(`  McKell is paid   $${base.toFixed(2)}`);
console.log(`  Studio pays      $${(base + fee).toFixed(2)}  (incl. $${fee.toFixed(2)} processing)`);
console.log(`  Status: Confirmed — she completes it and invoices from her dashboard.`);

const [dupes] = await c.query(`
  SELECT id, DATE(startDate) AS d, hours FROM bookings
  WHERE artistUserId = ? AND clientUserId = ? AND deleted = 0
    AND description LIKE 'Admin support%' AND startDate >= '2026-08-31'
`, [ARTIST, CLIENT]);

if (dupes.length) {
  console.log(`\n✗ REFUSING: an admin-support booking already exists for this period (id ${dupes.map((d) => d.id).join(", ")}).`);
} else if (WRITE) {
  const [res] = await c.query(`
    INSERT INTO bookings
      (clientUserId, artistUserId, rateType, hourlyRate, artistRate, clientRate,
       startDate, endDate, description, hours,
       bookingStatus, paymentStatus, paymentMethod, isAdminBooking, isRecurring,
       deleted, createdAt, updatedAt)
    VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?,?, 0, NOW(), NOW())
  `, [CLIENT, ARTIST, "hourly", RATE, RATE, RATE,
      START, START, DESCRIPTION, HOURS,
      "Confirmed", "Unpaid", "artswrk", 1, 0]);
  console.log(`\n✓ created booking ${res.insertId}`);
} else {
  console.log(`\nNothing written — re-run with --write.`);
}

await c.end();
