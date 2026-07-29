/**
 * One-shot migration: create the saved_artists table.
 * Usage: npx tsx scripts/apply-saved-artists.ts
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS saved_artists (
      id int AUTO_INCREMENT NOT NULL,
      clientUserId int NOT NULL,
      artistUserId int NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY saved_artists_unique (clientUserId, artistUserId),
      CONSTRAINT saved_artists_pk PRIMARY KEY (id)
    )
  `);
  console.log("✅ saved_artists table ready.");
} catch (e: any) {
  console.error("FAIL:", e.message);
}

await conn.end();
