/**
 * update-ramita-stats.mjs
 * Updates Ramita's booking count, rating, and join date from Bubble artist record
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // From Bubble artist record:
  // - Created Date: "2022-05-20T12:04:00.176Z"
  // - Bookings: array of 46 booking IDs
  // - Rating: not directly in user record, but screenshot shows 5 stars (46 Bookings)
  
  const bubbleCreatedAt = new Date("2022-05-20T12:04:00.176Z");
  const bookingCount = 46; // from the screenshot showing "(46 Bookings)"
  const ratingScore = 50; // 5.0 stars stored as 50 (×10) — matches screenshot showing 5 stars
  
  await conn.execute(
    `UPDATE users SET 
      bubbleCreatedAt = ?,
      bookingCount = ?,
      ratingScore = ?
    WHERE id = 30001`,
    [bubbleCreatedAt, bookingCount, ratingScore]
  );
  
  console.log("✅ Updated Ramita's stats");
  
  const [rows] = await conn.execute(
    "SELECT id, firstName, ratingScore, bookingCount, bubbleCreatedAt FROM users WHERE id = 30001"
  );
  console.log("Verification:", JSON.stringify(rows[0], null, 2));
  
  await conn.end();
}

main().catch(console.error);
