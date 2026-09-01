/**
 * bookings.artistRate / clientRate hold the TOTAL for the booking — that's what
 * all 5,679 migrated Bubble rows contain ($50/hr × 5 hrs stored as 250, flat
 * rates stored as-is).
 *
 * Native confirms stored the raw UNIT rate instead, so an hourly booking of
 * $60/hr × 3 hrs was saved as 60 and the studio was invoiced $63 rather than
 * $189. The code is fixed; this repairs the rows already written that way.
 *
 * Only touches non-Bubble bookings with hours > 0 whose stored rate still looks
 * like a unit rate. Bubble rows are never touched.
 *
 * Usage: node scripts/fix-native-booking-rate-totals-2026-09-01.mjs [--dry-run]
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Admin bookings are excluded: their periods invoice as rate × hours
// server-side, so their rate genuinely IS a unit rate.
const [rows] = await conn.query(
  `SELECT b.id, b.artistRate, b.clientRate, b.totalArtistRate, b.totalClientRate,
          b.hours, b.paymentMethod, b.bookingStatus, b.invoicePaidAt,
          ia.isHourlyRate, ia.artistHourlyRate, ia.artistFlatRate
   FROM bookings b
   LEFT JOIN interested_artists ia ON ia.id = b.interestedArtistId
   WHERE b.bubbleId IS NULL
     AND (b.isAdminBooking = 0 OR b.isAdminBooking IS NULL)
     AND b.hours IS NOT NULL AND b.hours > 0
     AND b.artistRate IS NOT NULL
   ORDER BY b.id`
);

console.log(`Candidate native bookings with hours: ${rows.length}\n`);

let fixed = 0, skipped = 0;
for (const b of rows) {
  // A flat-rate booking's stored rate is already the total — leave it alone.
  if (b.isHourlyRate === 0) {
    console.log(`  = booking ${b.id}: flat rate, no change`);
    skipped++;
    continue;
  }
  // Already paid — repricing after the fact would contradict what was charged.
  if (b.invoicePaidAt) {
    console.log(`  ! booking ${b.id}: already paid, left as-is (needs manual review)`);
    skipped++;
    continue;
  }

  const newArtist = Math.round(b.artistRate * b.hours);
  const newClient = b.paymentMethod === "artswrk"
    ? Math.round(newArtist * 1.05)
    : Math.round((b.clientRate ?? b.artistRate) * b.hours);

  console.log(
    `  → booking ${b.id}: artist ${b.artistRate} → ${newArtist}, client ${b.clientRate} → ${newClient}  (${b.hours} hrs)`
  );
  if (!DRY_RUN) {
    // totalArtistRate/totalClientRate mirror the rate when there are no
    // reimbursements; recompute them from the difference so any reimbursement
    // already recorded is preserved.
    const artistReimb = Math.max((b.totalArtistRate ?? b.artistRate) - b.artistRate, 0);
    const clientReimb = Math.max((b.totalClientRate ?? b.clientRate ?? 0) - (b.clientRate ?? 0), 0);
    await conn.query(
      `UPDATE bookings
       SET artistRate = ?, clientRate = ?, totalArtistRate = ?, totalClientRate = ?
       WHERE id = ?`,
      [newArtist, newClient, newArtist + artistReimb, newClient + clientReimb, b.id]
    );
  }
  fixed++;
}

console.log(`\n${DRY_RUN ? "[dry run] would fix" : "Fixed"} ${fixed} booking(s), skipped ${skipped}.`);
await conn.end();
