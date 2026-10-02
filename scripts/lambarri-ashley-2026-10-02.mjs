/**
 * Two changes Lambarri asked for on 2026-10-02.
 *
 * 1. Ashley now runs a 4:30–5:30pm rehearsal before her Bayonne Thursday
 *    classes, so every Thursday becomes 4 hours (4:30–8:30pm) at the same $60
 *    rate — including the three she has already taught (Sep 17, Sep 24, Oct 1),
 *    none of which has been invoiced yet.
 *
 * 2. She subs at Matawan on three Wednesdays in October: Oct 14, 21 and 28,
 *    3.5 hours each (4:30–8:00pm) at $60.
 *
 * The Thursday class day starts an hour earlier now, so each booking's start
 * time moves back an hour too — that is what the day-of "Complete your booking"
 * reminder fires on. Shifting the stored time rather than rewriting it keeps
 * the existing convention and survives the November DST change.
 *
 * Refuses to touch any Thursday that has been invoiced or paid.
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const THURSDAY_SERIES = 1200157;
const ASHLEY = 781194;
const LAMBARRI = 1020795;
const RATE = 60;

const THURSDAY_DESCRIPTION = `Lambarri Dance Arts - Bayonne · Thursdays
4:30pm–5:30pm Rehearsal
5:30pm–6:30pm Fundamental Acro (ages 7–8)
6:30pm–7:30pm Acro 2 (ages 9–11)
7:30pm–8:30pm Acro 3 (ages 12+)
4 hrs per class day · $60/hr`;

const MATAWAN_DESCRIPTION = `Lambarri Dance Arts - Matawan · Wednesdays
4:30pm–5:30pm Tap 2 (12 & up, Int/Int Adv)
5:30pm–6:30pm Tiny Tap (8 & under, new to tap)
6:30pm–7:30pm Tap 1 (11 & under, Beg/Int Beg)
7:30pm–8:00pm Rehearsal (2 solos)
3.5 hrs per class day · $60/hr`;

// 4:20pm Eastern, ten minutes before the first class — the same convention the
// rest of the weekly bookings use, in UTC while Eastern is on daylight time.
const MATAWAN_DATES = ["2026-10-14 20:20:00", "2026-10-21 20:20:00", "2026-10-28 20:20:00"];
const MATAWAN_LOCATION = { address: "1070 NJ-34 #250, Matawan, NJ 07747, USA", lat: "40.3999613", lng: "-74.2291982" };

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);

// ── 1. Thursdays become 4 hours ──────────────────────────────────────────────
const [thursdays] = await c.query(`
  SELECT id, DATE_FORMAT(startDate, '%a %b %e') AS classDate, hours,
         invoiceTotalCents, invoicePaidAt, bookingStatus
  FROM bookings WHERE recurringSeriesId = ? AND deleted = 0 ORDER BY startDate
`, [THURSDAY_SERIES]);

const locked = thursdays.filter((t) => t.invoicePaidAt != null || t.invoiceTotalCents != null);
const updatable = thursdays.filter((t) => t.invoicePaidAt == null && t.invoiceTotalCents == null);

console.log(`1. Ashley's Bayonne Thursdays → 4 hours (4:30–8:30pm), $240 a class`);
console.log(`   ${updatable.length} of ${thursdays.length} bookings updating` + (locked.length ? `, ${locked.length} left alone (already invoiced)` : ""));
console.log(`   first three: ${updatable.slice(0, 3).map((t) => t.classDate).join(", ")}`);
console.log(`   last: ${updatable[updatable.length - 1]?.classDate}`);
for (const t of locked) console.log(`   ✗ ${t.id} ${t.classDate} — invoiced, not touched`);

if (WRITE && updatable.length) {
  const [res] = await c.query(`
    UPDATE bookings
       SET hours = 4,
           description = ?,
           startDate = DATE_SUB(startDate, INTERVAL 1 HOUR),
           endDate = DATE_SUB(endDate, INTERVAL 1 HOUR),
           updatedAt = NOW()
     WHERE id IN (${updatable.map((t) => t.id).join(",")})
  `, [THURSDAY_DESCRIPTION]);
  console.log(`   ✓ updated ${res.affectedRows}`);
}

// ── 2. Three Matawan Wednesdays ──────────────────────────────────────────────
console.log(`\n2. Ashley at Matawan · Wednesdays 4:30–8:00pm, 3.5 hrs, $60/hr → $210 a class`);
for (const d of MATAWAN_DATES) console.log(`   ${d.slice(0, 10)}`);

const [existing] = await c.query(`
  SELECT COUNT(*) AS n FROM bookings
  WHERE artistUserId = ? AND clientUserId = ? AND deleted = 0
    AND DATE(startDate) IN (${MATAWAN_DATES.map((d) => `'${d.slice(0, 10)}'`).join(",")})
`, [ASHLEY, LAMBARRI]);

if (Number(existing[0].n)) {
  console.log(`   ✗ REFUSING: ${existing[0].n} booking(s) already exist on those dates for Ashley — would duplicate.`);
} else if (WRITE) {
  let seriesId = null;
  for (const startAt of MATAWAN_DATES) {
    const [res] = await c.query(`
      INSERT INTO bookings
        (clientUserId, artistUserId, rateType, hourlyRate, artistRate, clientRate,
         startDate, endDate, locationAddress, locationLat, locationLng, description, hours,
         bookingStatus, paymentStatus, paymentMethod, isAdminBooking, isRecurring,
         recurringCadence, recurringSeriesId, deleted, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?, ?,?, 0, NOW(), NOW())
    `, [LAMBARRI, ASHLEY, "hourly", RATE, RATE, RATE,
        startAt, startAt, MATAWAN_LOCATION.address, MATAWAN_LOCATION.lat, MATAWAN_LOCATION.lng,
        MATAWAN_DESCRIPTION, 3.5,
        "Confirmed", "Unpaid", "artswrk", 1, 0,
        "weekly", seriesId]);
    if (seriesId === null) {
      seriesId = res.insertId;
      await c.query(`UPDATE bookings SET recurringSeriesId = ? WHERE id = ?`, [seriesId, seriesId]);
    }
  }
  console.log(`   ✓ created 3 bookings (series ${seriesId})`);
} else {
  console.log(`   would create 3 bookings`);
}

if (!WRITE) console.log(`\nNothing written — re-run with --write.`);
await c.end();
