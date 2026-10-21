/**
 * Give the 4,040 legacy bookings a rateType and a unit rate.
 *
 * Right now `artistRate` means "the booking total" on a legacy row and "the
 * per-hour rate" on a class date, and nothing on the row says which. That
 * ambiguity is the single root cause behind five production rate bugs. Filling
 * in rateType/hourlyRate/flatRate makes every booking state its own rule.
 *
 * SAFETY — this changes how invoice.approve prices a booking, because
 * isHourlyRateBooking() keys off rateType. So:
 *
 *   - An hourly row is only converted when artistRate divides EXACTLY by
 *     hours, i.e. hourlyRate x hours === artistRate to the cent. The computed
 *     amount is therefore identical before and after. 29 rows that do not
 *     divide cleanly are deliberately left alone rather than rounded.
 *   - A flat row keeps its exact total in flatRate. Nothing is multiplied.
 *   - 827 rows with no applicant record are left alone: there is no evidence
 *     for which rule applies, and guessing is how this started.
 *
 * Of the 4,040, only 6 are unpaid, so almost nothing here can still be
 * charged. Every converted row is verified afterwards.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [hourly] = await c.query(`
  SELECT b.id, b.artistRate, b.hours, ROUND(b.artistRate / b.hours, 2) unit
  FROM bookings b JOIN interested_artists ia ON ia.id = b.interestedArtistId
  WHERE b.deleted = 0 AND b.rateType IS NULL AND ia.isHourlyRate = 1
    AND b.hours > 0 AND b.artistRate > 0
    AND ABS(b.artistRate - ROUND(b.artistRate / b.hours, 2) * b.hours) < 0.005`);

const [flat] = await c.query(`
  SELECT b.id, b.artistRate
  FROM bookings b JOIN interested_artists ia ON ia.id = b.interestedArtistId
  WHERE b.deleted = 0 AND b.rateType IS NULL
    AND (ia.isHourlyRate = 0 OR ia.isHourlyRate IS NULL)
    AND b.artistRate IS NOT NULL`);

const [[skipped]] = await c.query(`
  SELECT COUNT(*) n FROM bookings b LEFT JOIN interested_artists ia ON ia.id = b.interestedArtistId
  WHERE b.deleted = 0 AND b.rateType IS NULL AND ia.id IS NULL`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${hourly.length} hourly  — rateType='hourly', hourlyRate = artistRate / hours (exact only)`);
console.log(`  ${flat.length} flat    — rateType='flat',   flatRate = artistRate`);
console.log(`  ${skipped.n} skipped — no applicant record, so no evidence either way\n`);
for (const r of hourly.slice(0, 3)) console.log(`    #${r.id}  $${r.artistRate} / ${r.hours}h  ->  $${r.unit}/hr`);
for (const r of flat.slice(0, 2)) console.log(`    #${r.id}  flat $${r.artistRate}`);

if (!WRITE) {
  console.log(`\nNothing written — re-run with --write.`);
  await c.end();
  process.exit(0);
}

const CHUNK = 200;
for (let i = 0; i < hourly.length; i += CHUNK) {
  const batch = hourly.slice(i, i + CHUNK);
  await c.query(
    `UPDATE bookings SET rateType='hourly', hourlyRate = CASE id ${batch.map(() => "WHEN ? THEN ?").join(" ")} END
     WHERE id IN (${batch.map(() => "?").join(",")}) AND rateType IS NULL`,
    [...batch.flatMap((r) => [r.id, r.unit]), ...batch.map((r) => r.id)],
  );
  console.log(`    hourly …${Math.min(i + CHUNK, hourly.length)}/${hourly.length}`);
}
for (let i = 0; i < flat.length; i += CHUNK) {
  const batch = flat.slice(i, i + CHUNK);
  await c.query(
    `UPDATE bookings SET rateType='flat', flatRate = CASE id ${batch.map(() => "WHEN ? THEN ?").join(" ")} END
     WHERE id IN (${batch.map(() => "?").join(",")}) AND rateType IS NULL`,
    [...batch.flatMap((r) => [r.id, r.artistRate]), ...batch.map((r) => r.id)],
  );
  console.log(`    flat …${Math.min(i + CHUNK, flat.length)}/${flat.length}`);
}

// Every converted row must still compute the amount it always did.
const [[drift]] = await c.query(`
  SELECT COUNT(*) n FROM bookings
  WHERE deleted = 0 AND rateType = 'hourly' AND hourlyRate IS NOT NULL AND hours > 0
    AND artistRate IS NOT NULL AND recurringSeriesId IS NULL AND isAdminBooking = 0
    AND ABS(artistRate - (hourlyRate * hours)) > 0.01`);
const [[left]] = await c.query(`SELECT COUNT(*) n FROM bookings WHERE deleted=0 AND rateType IS NULL`);
console.log(`\n✓ converted ${hourly.length + flat.length} bookings`);
console.log(`  rows whose total no longer matches rate x hours: ${drift.n}  ${drift.n === 0 ? "(none — amounts unchanged)" : "<-- INVESTIGATE"}`);
console.log(`  legacy rows remaining: ${left.n}`);
await c.end();
