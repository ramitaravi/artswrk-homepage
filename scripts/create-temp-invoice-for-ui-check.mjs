import "dotenv/config";
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const token = "uicheck_" + Date.now();
const [insertResult] = await c.query(
  `INSERT INTO bookings (artistUserId, clientUserId, artistRate, hours, paymentMethod, bookingStatus, paymentStatus, artswrkInvoiceSubmittedAt, invoicePaymentToken, invoiceTotalCents, createdAt)
   VALUES (999999901, 999999902, 50, 4, 'artswrk', 'Pay Now', 'Unpaid', NOW(), ?, 20800, NOW())`,
  [token]
);
console.log(`booking id: ${insertResult.insertId}`);
console.log(`token: ${token}`);
await c.end();
