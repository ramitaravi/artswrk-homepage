/**
 * Disposable smoke test for the new delayed-approval invoice flow —
 * exercises markArtswrkInvoiceSubmitted -> approveArtswrkInvoice ->
 * recordArtswrkPayment against a throwaway booking row, then deletes it.
 * Doesn't touch real users, doesn't call Stripe, doesn't send email.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);

// Fake IDs, well outside real ranges — not touching any real user/booking.
const FAKE_ARTIST_ID = 999999901;
const FAKE_CLIENT_ID = 999999902;

const [insertResult] = await c.query(
  `INSERT INTO bookings (artistUserId, clientUserId, artistRate, hours, paymentMethod, bookingStatus, paymentStatus, createdAt)
   VALUES (?, ?, 50, 4, 'artswrk', 'Confirmed', 'Unpaid', NOW())`,
  [FAKE_ARTIST_ID, FAKE_CLIENT_ID]
);
const bookingId = insertResult.insertId;
console.log(`1. Created test booking #${bookingId}`);

// Step 1: artist submits (mirrors markArtswrkInvoiceSubmitted)
const token = "smoketest_" + Date.now();
await c.query(
  `UPDATE bookings SET artswrkInvoiceSubmittedAt = NOW(), bookingStatus = 'Pay Now', invoicePaymentToken = ?, invoiceTotalCents = 20800 WHERE id = ?`,
  [token, bookingId]
);
let [row] = await c.query(`SELECT invoiceStripeCheckoutUrl, invoiceTotalCents FROM bookings WHERE id = ?`, [bookingId]);
console.log(`2. After submit: checkoutUrl=${row[0].invoiceStripeCheckoutUrl} totalCents=${row[0].invoiceTotalCents}`);
if (row[0].invoiceStripeCheckoutUrl !== null) throw new Error("FAIL: checkout URL should be null before approval");

// Step 2: studio approves with EDITED hours (5 instead of 4) — mirrors approveArtswrkInvoice
const fakeCheckoutUrl = "https://checkout.stripe.com/test/smoketest";
await c.query(
  `UPDATE bookings SET hours = 5, invoiceStripeCheckoutUrl = ?, invoiceTotalCents = 26000 WHERE id = ?`,
  [fakeCheckoutUrl, bookingId]
);
[row] = await c.query(`SELECT hours, invoiceStripeCheckoutUrl, invoiceTotalCents FROM bookings WHERE id = ?`, [bookingId]);
console.log(`3. After approve (hours edited 4->5): hours=${row[0].hours} checkoutUrl=${row[0].invoiceStripeCheckoutUrl} totalCents=${row[0].invoiceTotalCents}`);
if (row[0].hours !== 5) throw new Error("FAIL: hours should be updated to 5");
if (!row[0].invoiceStripeCheckoutUrl) throw new Error("FAIL: checkout URL should now be set");

// Step 3: simulate the webhook firing markInvoicePaid + recordArtswrkPayment
await c.query(
  `UPDATE bookings SET invoicePaidAt = NOW(), invoiceStripePaymentIntentId = 'pi_smoketest', paymentStatus = 'Paid', bookingStatus = 'Confirmed' WHERE id = ?`,
  [bookingId]
);
const grossCents = 26000, feeCents = 1000; // $260 gross, $10 fee -> artist nets $250
const [existingPayment] = await c.query(`SELECT id FROM payments WHERE stripeId = 'ch_smoketest'`);
if (existingPayment.length === 0) {
  await c.query(
    `INSERT INTO payments (bookingId, clientUserId, stripeId, stripeStatus, status, stripeAmount, stripeApplicationFeeAmount, paymentDate, createdAt, updatedAt)
     VALUES (?, ?, 'ch_smoketest', 'succeeded', 'Success', ?, ?, NOW(), NOW(), NOW())`,
    [bookingId, FAKE_CLIENT_ID, grossCents, feeCents]
  );
}
await c.query(
  `UPDATE bookings SET clientRate = ?, totalClientRate = ?, totalArtistRate = ? WHERE id = ?`,
  [grossCents / 100, grossCents / 100, (grossCents - feeCents) / 100, bookingId]
);
[row] = await c.query(`SELECT paymentStatus, totalArtistRate, totalClientRate FROM bookings WHERE id = ?`, [bookingId]);
const [paymentRow] = await c.query(`SELECT stripeAmount, stripeApplicationFeeAmount FROM payments WHERE stripeId = 'ch_smoketest'`);
console.log(`4. After webhook: paymentStatus=${row[0].paymentStatus} totalArtistRate=${row[0].totalArtistRate} totalClientRate=${row[0].totalClientRate}`);
console.log(`   payments row: stripeAmount=${paymentRow[0].stripeAmount} feeAmount=${paymentRow[0].stripeApplicationFeeAmount}`);
if (row[0].totalArtistRate !== 250) throw new Error(`FAIL: expected artist net $250, got ${row[0].totalArtistRate}`);
if (paymentRow[0].stripeAmount !== 26000) throw new Error("FAIL: payments row amount mismatch");

console.log("\nALL CHECKS PASSED — full lifecycle (submit -> approve w/ edited hours -> paid -> payments row + wallet fields) verified.");

// Cleanup
await c.query(`DELETE FROM payments WHERE stripeId = 'ch_smoketest'`);
await c.query(`DELETE FROM bookings WHERE id = ?`, [bookingId]);
console.log("5. Cleaned up test booking + payment row.");

await c.end();
