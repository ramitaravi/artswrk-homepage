/**
 * Applies the 3 new columns from drizzle/0049_lively_marvel_apes.sql directly,
 * bypassing `drizzle-kit migrate` — the migration journal is out of sync with
 * the live DB (14 earlier migrations were applied by some other means and
 * were never recorded in __drizzle_migrations), so `migrate` tries to replay
 * everything from scratch and fails on tables that already exist.
 *
 * This is purely additive and safe to run once: 3 nullable columns, nothing
 * dropped, nothing renamed. Safe to re-run too — IF NOT EXISTS guards it.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function columnExists(name) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM users LIKE ?`, [name]);
  return rows.length > 0;
}

const statements = [
  {
    column: "planTier",
    sql: `ALTER TABLE users ADD planTier enum('artist_free','artist_basic','artist_pro','client_on_demand','client_premium','enterprise_on_demand','enterprise_subscription')`,
  },
  { column: "stripeSubscriptionId", sql: `ALTER TABLE users ADD stripeSubscriptionId varchar(64)` },
  { column: "stripePriceId", sql: `ALTER TABLE users ADD stripePriceId varchar(64)` },
];

for (const { column, sql } of statements) {
  if (await columnExists(column)) {
    console.log(`✓ ${column} already exists — skipping`);
    continue;
  }
  await conn.execute(sql);
  console.log(`✓ added ${column}`);
}

console.log("\nDone.");
await conn.end();
