/**
 * Make the artist-invoice feature testable on localhost without involving
 * anyone real.
 *
 * localhost runs against the PRODUCTION database, so a walkthrough on a live
 * artist account would list live studios in the "Create invoice" dropdown and
 * one misclick would put a real payment request in a real client's dashboard.
 * This wires up a closed pair instead, both sides owned by Artswrk:
 *
 *   artist  40800011  Ramita Ravi-Invoice  <ramita+invoice@artswrk.com>
 *   client  38370002  Nick's Dance Competition  <nick-test2@artswrk.com>
 *
 * Two changes, both reversible with --undo:
 *   1. A placeholder payout account on the artist, so "Create invoice" opens
 *      at all. It is deliberately NOT a usable Stripe account — approving the
 *      invoice will fail at Stripe, which is the point: localhost holds a TEST
 *      key, and writing a cs_test_ checkout URL onto a booking is the bug that
 *      already bit us once.
 *   2. One past, settled booking between them, so the client appears in the
 *      dropdown. The dropdown only offers clients you've worked with.
 *
 * The client is a competition, not a studio — it exercises the "Client"
 * wording as well as the flow.
 *
 * Dry run by default. Pass --write to apply, --undo --write to remove.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const UNDO = process.argv.includes("--undo");

const ARTIST = 40800011;
const CLIENT = 38370002;
const PLACEHOLDER_ACCT = "acct_localtest_invoice_flow";
const MARKER = "Localhost test fixture — artist invoice flow";

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const [[artist]] = await c.query(
  `SELECT id, name, email, artistStripeAccountId FROM users WHERE id = ?`, [ARTIST]);
const [[client]] = await c.query(
  `SELECT id, clientCompanyName, email FROM users WHERE id = ?`, [CLIENT]);

if (!artist || !client) {
  console.error("✗ One of the fixture accounts is missing — stopping.");
  process.exit(1);
}

// Never touch an account that has a real Stripe account behind it.
if (artist.artistStripeAccountId && artist.artistStripeAccountId !== PLACEHOLDER_ACCT) {
  console.error(`✗ REFUSING: artist ${ARTIST} has a real payout account on it.`);
  process.exit(1);
}

const [existing] = await c.query(
  `SELECT id FROM bookings WHERE artistUserId = ? AND clientUserId = ? AND description = ? AND deleted = 0`,
  [ARTIST, CLIENT, MARKER]);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}${UNDO ? " (undo)" : ""}\n`);
console.log(`  artist  ${artist.id}  ${artist.name} <${artist.email}>`);
console.log(`  client  ${client.id}  ${client.clientCompanyName} <${client.email}>\n`);

if (UNDO) {
  console.log(`  clear the placeholder payout account`);
  console.log(`  delete ${existing.length} fixture booking(s): ${existing.map(r => r.id).join(", ") || "none"}`);
  if (WRITE) {
    await c.query(`UPDATE users SET artistStripeAccountId = NULL WHERE id = ? AND artistStripeAccountId = ?`,
      [ARTIST, PLACEHOLDER_ACCT]);
    if (existing.length) {
      await c.query(`UPDATE bookings SET deleted = 1 WHERE id IN (${existing.map(() => "?").join(",")})`,
        existing.map(r => r.id));
    }
    console.log(`\n✓ removed`);
  } else {
    console.log(`\nNothing written — re-run with --undo --write.`);
  }
} else {
  console.log(`  set a placeholder payout account (${PLACEHOLDER_ACCT})`);
  console.log(existing.length
    ? `  fixture booking already exists (${existing.map(r => r.id).join(", ")}) — leaving it`
    : `  create one settled past booking so the client shows in the dropdown`);
  if (WRITE) {
    await c.query(`UPDATE users SET artistStripeAccountId = ? WHERE id = ?`, [PLACEHOLDER_ACCT, ARTIST]);
    if (!existing.length) {
      const [res] = await c.query(`
        INSERT INTO bookings
          (clientUserId, artistUserId, rateType, hourlyRate, artistRate, clientRate,
           startDate, endDate, description, hours,
           bookingStatus, paymentStatus, paymentMethod, isAdminBooking, isRecurring,
           deleted, createdAt, updatedAt)
        VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?,?, 0, NOW(), NOW())`,
        [CLIENT, ARTIST, "hourly", 50, 100, 100,
         "2026-09-01 15:00:00", "2026-09-01 17:00:00", MARKER, 2,
         "Completed", "Paid", "artswrk", 1, 0]);
      console.log(`  created booking ${res.insertId}`);
    }
    console.log(`\n✓ ready — log in as ${artist.email} and open /app/bookings`);
  } else {
    console.log(`\nNothing written — re-run with --write.`);
  }
}

await c.end();
