/**
 * Applies drizzle/0051_rich_avengers.sql directly, bypassing `drizzle-kit
 * migrate` (same journal-mismatch issue as before — the DB has migrations
 * applied outside the tracked journal, so `migrate` tries to replay
 * everything from scratch and fails on tables that already exist).
 *
 * Purely additive: 1 new table (referrals) + 5 new nullable columns on
 * users. Safe to re-run — checks existence before creating/adding.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function tableExists(name) {
  const [rows] = await conn.execute(`SHOW TABLES LIKE ?`, [name]);
  return rows.length > 0;
}
async function columnExists(table, name) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM ${table} LIKE ?`, [name]);
  return rows.length > 0;
}

if (await tableExists("referrals")) {
  console.log("✓ referrals table already exists — skipping");
} else {
  await conn.execute(`
    CREATE TABLE referrals (
      id int AUTO_INCREMENT NOT NULL,
      referrerUserId int NOT NULL,
      invitedUserId int NOT NULL,
      bubbleId varchar(64),
      createdAt timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT referrals_id PRIMARY KEY(id)
    )
  `);
  console.log("✓ created referrals table");
}

const columns = [
  { name: "masterServiceType", sql: "ALTER TABLE users ADD masterServiceType text" },
  { name: "addedByAdmin", sql: "ALTER TABLE users ADD addedByAdmin boolean DEFAULT false" },
  { name: "source", sql: "ALTER TABLE users ADD source varchar(128)" },
  { name: "unsubscribe", sql: "ALTER TABLE users ADD unsubscribe boolean DEFAULT false" },
  { name: "artistStripeAccountType", sql: "ALTER TABLE users ADD artistStripeAccountType varchar(32)" },
  { name: "stripeProductId", sql: "ALTER TABLE users ADD stripeProductId varchar(64)" },
];

for (const { name, sql } of columns) {
  if (await columnExists("users", name)) {
    console.log(`✓ ${name} already exists — skipping`);
    continue;
  }
  await conn.execute(sql);
  console.log(`✓ added ${name}`);
}

console.log("\nDone.");
await conn.end();
