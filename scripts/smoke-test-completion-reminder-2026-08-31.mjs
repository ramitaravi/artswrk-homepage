/**
 * Disposable smoke test for the completion-reminder sweep logic — creates
 * three test bookings (artswrk-pay w/ real start time 20 min ago, direct-pay
 * w/ no time set today, and an artswrk-pay one NOT yet due), runs the same
 * SQL query the scheduled handler uses, checks exactly the right ones match,
 * then cleans up. Doesn't call the real email sender.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
// Must be a REAL users.id — the sweep query INNER JOINs users, so a
// nonexistent artist id silently excludes the booking regardless of dates.
// Not calling the real email sender here, so using a real id is safe.
const [[realArtist]] = await c.query(`SELECT id FROM users WHERE planTier LIKE 'artist_%' LIMIT 1`);
const FAKE_ARTIST_ID = realArtist.id;
const FAKE_CLIENT_ID = 999999902;

// Computed via MySQL's own NOW(), not Node's Date — this sandbox's system
// clock runs ~4h behind the DB server's, so comparing Node-computed
// timestamps against the DB's NOW() gives nonsense results. The real
// production query never touches Node's clock at all (see below), so this
// is purely a test-harness fix, not a fix to the actual feature.
const rows = [
  { label: "artswrk, 20 min ago (DUE)", paymentMethod: "artswrk", expr: "DATE_SUB(NOW(), INTERVAL 20 MINUTE)" },
  { label: "direct, no time set / today (DUE)", paymentMethod: "direct", expr: "DATE(NOW())" },
  { label: "artswrk, 5 min from now (NOT due)", paymentMethod: "artswrk", expr: "DATE_ADD(NOW(), INTERVAL 5 MINUTE)" },
];

const ids = [];
for (const r of rows) {
  const [res] = await c.query(
    `INSERT INTO bookings (artistUserId, clientUserId, paymentMethod, startDate, bookingStatus, deleted, createdAt)
     VALUES (?, ?, ?, ${r.expr}, 'Confirmed', 0, NOW())`,
    [FAKE_ARTIST_ID, FAKE_CLIENT_ID, r.paymentMethod]
  );
  ids.push(res.insertId);
  console.log(`created #${res.insertId}: ${r.label}`);
}

const [due] = await c.query(`
  SELECT b.id, b.paymentMethod
  FROM bookings b
  JOIN users a ON b.artistUserId = a.id
  WHERE b.bookingStatus <> 'Cancelled'
    AND b.deleted = false
    AND b.completionReminderSentAt IS NULL
    AND b.startDate IS NOT NULL
    AND (
      (COALESCE(b.paymentMethod, 'artswrk') = 'artswrk' AND b.artswrkInvoiceSubmittedAt IS NULL)
      OR (b.paymentMethod = 'direct' AND b.directPayConfirmedAt IS NULL)
    )
    AND (
      (TIME(b.startDate) <> '00:00:00' AND b.startDate <= (NOW() - INTERVAL 10 MINUTE))
      OR (TIME(b.startDate) = '00:00:00' AND DATE(b.startDate) <= CURDATE())
    )
    AND b.id IN (?, ?, ?)
`, ids);

console.log("\nDue rows:", due);
const dueIds = due.map((r) => r.id).sort();
const expected = [ids[0], ids[1]].sort();
if (JSON.stringify(dueIds) === JSON.stringify(expected)) {
  console.log("\nPASS — exactly the 2 expected bookings matched, the not-yet-due one correctly excluded.");
} else {
  console.log(`\nFAIL — expected ${JSON.stringify(expected)}, got ${JSON.stringify(dueIds)}`);
}

await c.query(`DELETE FROM bookings WHERE id IN (?, ?, ?)`, ids);
console.log("cleaned up.");
await c.end();
