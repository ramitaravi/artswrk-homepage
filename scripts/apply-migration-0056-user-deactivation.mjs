/**
 * Applies drizzle/0056_user_deactivation.sql — two nullable columns on users
 * that back the admin "Deactivate account" action.
 *
 *   node scripts/apply-migration-0056-user-deactivation.mjs [--dry-run]
 *
 * Additive and idempotent: nothing is backfilled, so every existing account
 * stays active. Run it BEFORE deploying the code that reads these columns.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs"; import path from "path"; import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../drizzle/0056_user_deactivation.sql");
const DRY = process.argv.includes("--dry-run");
const raw = fs.readFileSync(FILE, "utf8");
const hash = crypto.createHash("sha256").update(raw).digest("hex");
const stmts = raw.split("--> statement-breakpoint").map(s => s.trim())
  .filter(s => s.replace(/^\s*--.*$/gm, "").trim());
const label = s => s.replace(/^\s*--.*$/gm, "").trim().split("\n")[0].slice(0, 74);

if (DRY) { console.log(`[dry run] ${stmts.length} statements`); stmts.forEach(s => console.log("  · " + label(s))); process.exit(0); }

const c = await mysql.createConnection(process.env.DATABASE_URL);
for (const st of stmts) {
  try { await c.query(st); console.log(`  ✓ ${label(st)}`); }
  catch (e) {
    if (/already exists|Duplicate/i.test(e.message)) console.log(`  · ${label(st)}   [already applied]`);
    else { console.error(`  ✗ ${label(st)}\n    ${e.message}`); await c.end(); process.exit(1); }
  }
}
const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM __drizzle_migrations WHERE hash=?", [hash]);
if (!n) await c.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?,?)", [hash, Date.now()]);
const [cols] = await c.query("SHOW COLUMNS FROM users WHERE Field IN ('deactivatedAt','deactivatedBy')");
const [[{ active }]] = await c.query("SELECT COUNT(*) active FROM users WHERE deactivatedAt IS NULL");
console.log(`\ncolumns present: ${cols.map(r => r.Field).join(", ") || "(none)"}   ← must list both`);
console.log(`active accounts: ${active}   ← should equal the total user count`);
await c.end();
