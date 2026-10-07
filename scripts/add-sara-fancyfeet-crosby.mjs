/**
 * Sara Pagliaro's Thursday classes at Fancy Feet (Crosby), Oct 1 2026 – Jun 17 2027.
 *
 * One booking per class date, which is how weekly classes are stored since the
 * conversion: each Thursday carries its own hours, invoice and Pay Now.
 *
 * The stored start time is ten minutes before the first class, the convention
 * the other weekly bookings use and what the day-of reminder fires on. It is
 * computed per date through the Eastern timezone, so the November and March
 * clock changes land correctly rather than drifting an hour.
 *
 * Refuses to run twice: it checks for bookings Sara already has with this
 * studio on these dates.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";
import { easternDateTimeToUtc } from "../shared/adminBookingSchedule.ts";

const WRITE = process.argv.includes("--write");

const ARTIST = 780227;        // Sara Pagliaro
const CLIENT = 1020767;       // Fancy Feet Dance Studio
const RATE = 50;
const HOURS = 3;              // 4:30–7:30pm
const FIRST = "2026-10-01";   // Thursday
const LAST = "2027-06-17";    // Thursday
const CLASS_START = "16:20";  // 4:20pm Eastern — ten minutes before the 4:30 class

const LOCATION = {
  address: "1717 Crosby Ave, The Bronx, NY 10461, USA",
  lat: "40.845639",
  lng: "-73.8316062",
};

const DESCRIPTION = `Fancy Feet - Crosby · Thursdays
4:30pm–5:30pm Tiny Tutu's (3 yr olds, creative movement)
5:30pm–6:30pm Tap Level 1/2 (ages 7–10)
6:30pm–7:30pm Tap Level 3/4 (ages 10–14)
3 hrs per class day · $50/hr`;

/** Every Thursday from FIRST through LAST, inclusive. */
function classDates() {
  const dates = [];
  const cursor = new Date(`${FIRST}T12:00:00Z`);
  const end = new Date(`${LAST}T12:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

const dates = classDates();
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`Sara Pagliaro → Fancy Feet (Crosby), Thursdays`);
console.log(`  ${dates.length} class dates, ${dates[0]} → ${dates[dates.length - 1]}`);
console.log(`  ${HOURS} hrs at $${RATE}/hr — $${RATE * HOURS} to Sara, $${(RATE * HOURS * 1.05).toFixed(2)} to the studio per class`);
console.log(`  season total: $${(RATE * HOURS * dates.length).toFixed(2)} to Sara`);

const [clash] = await c.query(`
  SELECT COUNT(*) AS n FROM bookings
  WHERE artistUserId = ? AND clientUserId = ? AND deleted = 0
    AND DATE(startDate) IN (${dates.map(() => "?").join(",")})
`, [ARTIST, CLIENT, ...dates]);

if (Number(clash[0].n)) {
  console.log(`\n✗ REFUSING: Sara already has ${clash[0].n} booking(s) with this studio on those dates.`);
  await c.end();
  process.exit(1);
}

// A couple of dates spelled out, so the timezone handling is visible before writing.
for (const d of [dates[0], "2026-11-05", "2027-03-18"].filter((d) => dates.includes(d))) {
  console.log(`  ${d} → stored ${easternDateTimeToUtc(d, CLASS_START).toISOString()} (4:20pm Eastern)`);
}

if (WRITE) {
  let seriesId = null;
  for (const date of dates) {
    const startAt = easternDateTimeToUtc(date, CLASS_START);
    const [res] = await c.query(`
      INSERT INTO bookings
        (clientUserId, artistUserId, rateType, hourlyRate, artistRate, clientRate,
         startDate, endDate, locationAddress, locationLat, locationLng, description, hours,
         bookingStatus, paymentStatus, paymentMethod, isAdminBooking, isRecurring,
         recurringCadence, recurringSeriesId, deleted, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?, ?,?, 0, NOW(), NOW())
    `, [CLIENT, ARTIST, "hourly", RATE, RATE, RATE,
        startAt, startAt, LOCATION.address, LOCATION.lat, LOCATION.lng, DESCRIPTION, HOURS,
        "Confirmed", "Unpaid", "artswrk", 1, 0, "weekly", seriesId]);
    if (seriesId === null) {
      seriesId = res.insertId;
      await c.query(`UPDATE bookings SET recurringSeriesId = ? WHERE id = ?`, [seriesId, seriesId]);
    }
  }
  console.log(`\n✓ created ${dates.length} bookings (series ${seriesId})`);
} else {
  console.log(`\nWould create ${dates.length} bookings. Nothing written — re-run with --write.`);
}

await c.end();
