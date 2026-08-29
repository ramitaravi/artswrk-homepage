/**
 * One-off backfill: fill masterArtistTypes / artistServices from the Bubble
 * full export wherever the DB is empty but Bubble has real data. Both fields
 * store raw Bubble internal IDs on both sides — no translation needed, this
 * is a direct copy.
 *
 * Never overwrites existing DB data — only fills genuine gaps (DB empty,
 * Bubble has a value). Safe to re-run.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import { parse } from "csv-parse/sync";
dotenv.config();

function hasReal(v) {
  const t = (v || "").trim();
  return t.length > 0 && t !== "[]";
}

const raw = fs.readFileSync("/Users/ramitaravi/Downloads/Artswrk Clients - Clean Pull Aug 28 - bubble_users_FULL_export.csv", "utf-8");
const bubbleRows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
const byBubbleId = new Map(bubbleRows.map((r) => [r["_id"], r]));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [dbRows] = await conn.execute(
  `SELECT id, bubbleId, masterArtistTypes, artistServices FROM users WHERE userRole = 'Artist' AND bubbleId IS NOT NULL`
);

console.log(`Checking ${dbRows.length} artist rows against ${bubbleRows.length} Bubble rows...\n`);

let typesFixed = 0, servicesFixed = 0, bothFixed = 0;
for (const row of dbRows) {
  const b = byBubbleId.get(row.bubbleId);
  if (!b) continue;

  const updates = {};
  const bubbleTypes = b["Master Artist Types"];
  const bubbleServices = b["List of Master Services"];

  if (hasReal(bubbleTypes) && !hasReal(row.masterArtistTypes)) {
    updates.masterArtistTypes = bubbleTypes.trim();
  }
  if (hasReal(bubbleServices) && !hasReal(row.artistServices)) {
    updates.artistServices = bubbleServices.trim();
  }

  if (Object.keys(updates).length === 0) continue;

  const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(", ");
  await conn.execute(`UPDATE users SET ${setClause} WHERE id = ?`, [...Object.values(updates), row.id]);

  if (updates.masterArtistTypes) typesFixed++;
  if (updates.artistServices) servicesFixed++;
  if (updates.masterArtistTypes && updates.artistServices) bothFixed++;
}

console.log(`Done.`);
console.log(`  masterArtistTypes filled: ${typesFixed}`);
console.log(`  artistServices filled: ${servicesFixed}`);
console.log(`  (both filled on same row: ${bothFixed})`);

await conn.end();
