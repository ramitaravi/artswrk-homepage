/**
 * Fills in bookings.rateType, hourlyRate and flatRate (migration 0057).
 *
 *   npx tsx scripts/backfill-booking-rate-basis-2026-09-17.mjs            # preview, changes nothing
 *   npx tsx scripts/backfill-booking-rate-basis-2026-09-17.mjs --apply
 *
 * Scope, agreed with Ramita 2026-09-17: ONLY the weekly class bookings she and
 * I created on Monday. artistRate on those rows IS the per-hour figure, so it
 * copies straight to hourlyRate with rateType "hourly". Each week's money lives
 * on its own period, so the booking's totals stay null.
 *
 * Every other booking is left alone, rateType null. That includes all 5,679
 * Bubble rows (old rate-conversion era, and on 2,186 of them unit x hours
 * doesn't even equal the stored total) and the handful of test bookings.
 * bookingMoney() falls back to their stored totals when rateType is null, so
 * their behaviour is unchanged.
 *
 * Never touches artistRate, clientRate, totalArtistRate, totalClientRate or
 * hours. Undo record: ~/Downloads/booking-rate-basis-backfill-2026-09-17.json
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import os from "os";

const APPLY = process.argv.includes("--apply");
const c = await mysql.createConnection(process.env.DATABASE_URL);
const q = async (sql, args = []) => (await c.query(sql, args))[0];

if (!(await q(`SHOW COLUMNS FROM bookings WHERE Field = 'rateType'`)).length) {
  console.error("bookings.rateType is missing — run scripts/apply-migration-0057-booking-rate-basis.mjs first.");
  await c.end(); process.exit(1);
}

const rows = await q(`
  SELECT b.id, b.artistRate, b.clientRate, b.hours, b.rateType,
         TRIM(CONCAT(COALESCE(a.firstName,''), ' ', COALESCE(a.lastName,''))) artist,
         SUBSTRING_INDEX(b.description, '\n', 1) studio
  FROM bookings b
  LEFT JOIN users a ON a.id = b.artistUserId
  WHERE COALESCE(b.isAdminBooking, 0) = 1 AND COALESCE(b.isRecurring, 0) = 1
    AND COALESCE(b.deleted, 0) = 0 AND b.rateType IS NULL
  ORDER BY b.id`);

const num = (v) => (v == null ? null : Number(v));
const plan = rows.map((b) => ({
  id: b.id, artist: b.artist, studio: b.studio, hours: num(b.hours),
  rateType: "hourly", hourlyRate: num(b.artistRate), flatRate: null,
  // What a full week will invoice once this is in place.
  weekArtist: num(b.artistRate) != null && num(b.hours) != null ? Number((num(b.artistRate) * num(b.hours)).toFixed(2)) : null,
}));

const mismatched = rows.filter((b) => num(b.artistRate) !== num(b.clientRate));
console.log(`weekly class bookings needing a rate type: ${plan.length}`);
if (mismatched.length) console.log(`NOTE: ${mismatched.length} have artistRate != clientRate (${mismatched.map((m) => `#${m.id}`).join(", ")}) — the single rate comes from artistRate.`);
console.table(plan.map((p) => ({ id: p.id, artist: String(p.artist).slice(0, 20), studio: String(p.studio).slice(0, 26), rateType: p.rateType, hourlyRate: p.hourlyRate, hours: p.hours, artistPerWeek: p.weekArtist })));

if (!APPLY) { console.log("\nPREVIEW — nothing written. Re-run with --apply."); await c.end(); process.exit(0); }

fs.writeFileSync(`${os.homedir()}/Downloads/booking-rate-basis-backfill-2026-09-17.json`,
  JSON.stringify({ note: "rateType/hourlyRate/flatRate were NULL before this ran. To undo: UPDATE bookings SET rateType=NULL, hourlyRate=NULL, flatRate=NULL WHERE id IN (<ids>).", plan }, null, 1));

let done = 0;
for (const p of plan) {
  const [r] = await c.query(
    `UPDATE bookings SET rateType = ?, hourlyRate = ?, flatRate = ? WHERE id = ? AND rateType IS NULL`,
    [p.rateType, p.hourlyRate, p.flatRate, p.id]);
  done += r.affectedRows;
}
console.log(`\nupdated: ${done}`);
console.log("Across the whole table (everything else must stay '(none — legacy)'):");
console.table(await q(`SELECT COALESCE(rateType,'(none — legacy)') rateType, COUNT(*) n, SUM(hourlyRate IS NOT NULL) withHourly, SUM(flatRate IS NOT NULL) withFlat FROM bookings GROUP BY rateType`));
console.log("The weekly class bookings now:");
console.table(await q(`SELECT b.id, TRIM(CONCAT(COALESCE(a.firstName,''),' ',COALESCE(a.lastName,''))) artist,
  b.rateType, b.hourlyRate, b.hours, ROUND(b.hourlyRate * b.hours, 2) artistPerWeek, b.artistRate legacyArtistRate
  FROM bookings b LEFT JOIN users a ON a.id = b.artistUserId
  WHERE COALESCE(b.isAdminBooking,0) = 1 AND COALESCE(b.isRecurring,0) = 1 AND COALESCE(b.deleted,0) = 0 ORDER BY b.id`));
await c.end();
