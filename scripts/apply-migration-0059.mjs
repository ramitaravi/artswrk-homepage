/**
 * Apply drizzle/0059_booking_edits_and_cancellations.sql.
 *
 * Each statement is checked before it runs, so this is safe to re-run: an
 * existing column or index is skipped rather than erroring. Prints what it
 * would do first; pass --write to apply.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const sqlText = readFileSync("drizzle/0059_booking_edits_and_cancellations.sql", "utf8");

// Strip comments, split on semicolons. Trailing comments matter too: a
// `...NULL;   -- artist | client` line otherwise glues its comment onto the
// FRONT of the next statement.
const statements = sqlText
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n")
  .split(";").map((s) => s.trim()).filter(Boolean);

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

const columnExists = async (table, col) => {
  const [r] = await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r.length > 0;
};
const tableExists = async (table) => {
  const [r] = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`, [table]);
  return r.length > 0;
};
const indexExists = async (table, idx) => {
  const [r] = await c.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, idx]);
  return r.length > 0;
};

console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ${statements.length} statements\n`);

let applied = 0, skipped = 0;
for (const stmt of statements) {
  let label = stmt.slice(0, 72).replace(/\s+/g, " ");
  let already = false;

  const addCol = /ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(stmt);
  const createTbl = /CREATE TABLE (\w+)/i.exec(stmt);
  const createIdx = /CREATE INDEX (\w+) ON (\w+)/i.exec(stmt);

  if (addCol) already = await columnExists(addCol[1], addCol[2]);
  else if (createTbl) already = await tableExists(createTbl[1]);
  else if (createIdx) already = await indexExists(createIdx[2], createIdx[1]);

  if (already) { console.log(`  skip   ${label}…`); skipped++; continue; }
  if (!WRITE) { console.log(`  would  ${label}…`); continue; }

  try {
    await c.query(stmt);
    console.log(`  ✓      ${label}…`);
    applied++;
  } catch (err) {
    console.log(`  ✗      ${label}…`);
    console.log(`         ${err.message}`);
  }
}

console.log(`\n${WRITE ? `applied ${applied}, skipped ${skipped} already present` : "Nothing written — re-run with --write."}`);
await c.end();
