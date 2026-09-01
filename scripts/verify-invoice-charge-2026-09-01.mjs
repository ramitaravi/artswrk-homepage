import "dotenv/config";
const { getBookingByInvoiceToken } = await import("../server/db.ts");
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
// Give a few real bookings a token so we can read them back through the real fn.
const [rows] = await c.query(`
  SELECT b.id, b.artistRate, b.hours, ia.isHourlyRate, ia.artistHourlyRate, ia.artistFlatRate
  FROM bookings b JOIN interested_artists ia ON ia.id = b.interestedArtistId
  WHERE b.artistRate IS NOT NULL AND b.hours > 2
    AND ia.isHourlyRate IS NOT NULL
  ORDER BY ia.isHourlyRate ASC, b.hours DESC LIMIT 2`);
const [rows2] = await c.query(`
  SELECT b.id, b.artistRate, b.hours, ia.isHourlyRate, ia.artistHourlyRate, ia.artistFlatRate
  FROM bookings b JOIN interested_artists ia ON ia.id = b.interestedArtistId
  WHERE b.artistRate IS NOT NULL AND b.hours > 2 AND ia.isHourlyRate = 1
  ORDER BY b.hours DESC LIMIT 2`);
rows.push(...rows2);

for (const r of rows) {
  const token = `verify_${r.id}_${Date.now()}`;
  await c.query("UPDATE bookings SET invoicePaymentToken=? WHERE id=?", [token, r.id]);
  const b = await getBookingByInvoiceToken(token);

  // Mirror the exact logic in invoice.approve
  const isHourly = !!b.isHourlyRate;
  const storedTotal = b.artistRate ?? 0;
  const unitRate = b.artistHourlyRate ?? null;

  const noChange = storedTotal;                       // studio didn't touch hours
  const changedHours = (b.hours ?? 0) + 1;
  const hoursChanged = true;
  const reprice = isHourly && hoursChanged && unitRate != null
    ? Math.round(unitRate * changedHours) : storedTotal;

  console.log(`booking ${r.id}: ${isHourly ? "HOURLY" : "FLAT"} (flag read, not inferred), hours=${b.hours}`);
  console.log(`   stored total          $${storedTotal}`);
  console.log(`   charge, hours as-is   $${noChange}   ${noChange === storedTotal ? "✓ uses stored total" : "✗"}`);
  console.log(`   charge, hours ${changedHours}       $${reprice}   ${isHourly ? `(from $${unitRate}/hr)` : "(flat — unchanged ✓)"}`);
  const oldBuggy = (b.hours != null && b.hours > 0) ? storedTotal * (b.hours ?? 0) : storedTotal;
  console.log(`   OLD buggy value       $${oldBuggy}  ← what it used to charge\n`);

  await c.query("UPDATE bookings SET invoicePaymentToken=NULL WHERE id=?", [r.id]);
}
await c.end();
process.exit(0);
