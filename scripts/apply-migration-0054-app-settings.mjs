/**
 * Applies drizzle/0054_app_settings.sql — the key/value table holding the
 * job-alert master switch, seeded explicitly OFF.
 *
 *   node scripts/apply-migration-0054-app-settings.mjs [--dry-run]
 *
 * Additive and idempotent. The switch is seeded to 'false' so that deploying
 * this code cannot start emailing anyone: the admin UI is the only thing that
 * turns it on.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs"; import path from "path"; import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../drizzle/0054_app_settings.sql");
const DRY = process.argv.includes("--dry-run");
const raw = fs.readFileSync(FILE, "utf8");
const hash = crypto.createHash("sha256").update(raw).digest("hex");
const stmts = raw.split("--> statement-breakpoint").map(s => s.trim())
  .filter(s => s.replace(/^\s*--.*$/gm, "").trim());
const label = s => s.replace(/^\s*--.*$/gm, "").trim().split("\n")[0].slice(0, 74);

if (DRY) { console.log(`[dry run] ${stmts.length} statements`); stmts.forEach(s => console.log("  · " + label(s))); process.exit(0); }

const c = await mysql.createConnection(process.env.DATABASE_URL);
for (const st of stmts) {
  try { const [r] = await c.query(st); console.log(`  ✓ ${label(st)}${r.affectedRows !== undefined && /^INSERT/i.test(label(st)) ? `  (${r.affectedRows} rows)` : ""}`); }
  catch (e) {
    if (/already exists|Duplicate/i.test(e.message)) console.log(`  · ${label(st)}   [already applied]`);
    else { console.error(`  ✗ ${label(st)}\n    ${e.message}`); await c.end(); process.exit(1); }
  }
}
const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM __drizzle_migrations WHERE hash=?", [hash]);
if (!n) await c.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?,?)", [hash, Date.now()]);
const [[row]] = await c.query("SELECT settingValue FROM app_settings WHERE settingKey='job_alerts_enabled'");
console.log(`\njob_alerts_enabled = ${row?.settingValue ?? "(missing)"}   ← must be 'false'`);
await c.end();
