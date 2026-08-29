/**
 * Removes the 3 confirmed-dead Stripe duplicate columns from users:
 * stripeConnectAccountId (dup of artistStripeAccountId), stripeProductId
 * (dup of artistStripeProductId), artistStripeAccountType (mislabeled,
 * holds a raw account id, zero live references). Verified before running:
 * 0 rows where stripeProductId diverges from artistStripeProductId; exactly
 * 1 row has stripeProductId set with artistStripeProductId empty — backfilled
 * below before the column is dropped, so no data is silently lost.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [res] = await conn.execute(
  `UPDATE users SET artistStripeProductId = stripeProductId
   WHERE stripeProductId IS NOT NULL AND stripeProductId != ''
   AND (artistStripeProductId IS NULL OR artistStripeProductId = '')`
);
console.log(`Backfilled artistStripeProductId from stripeProductId: ${res.affectedRows} row(s)`);

for (const col of ["stripeConnectAccountId", "stripeProductId", "artistStripeAccountType"]) {
  await conn.execute(`ALTER TABLE users DROP COLUMN \`${col}\``);
  console.log(`Dropped column: ${col}`);
}

await conn.end();
