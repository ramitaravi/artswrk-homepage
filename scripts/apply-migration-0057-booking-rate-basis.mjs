/**
 * Applies drizzle/0057_booking_rate_basis.sql — three nullable columns on bookings
 * (rateType, hourlyRate, flatRate) that make hourly-vs-flat explicit on the
 * booking itself, with one rate rather than an artist/client pair.
 *
 *   node scripts/apply-migration-0057-booking-rate-basis.mjs [--dry-run]
 *
 * Additive and idempotent: nothing is backfilled here, so no existing booking
 * changes by a cent. Run it BEFORE deploying the code that reads these columns,
 * then run scripts/backfill-booking-rate-basis-2026-09-17.mjs to populate them.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs"; import path from "path"; import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../drizzle/0057_booking_rate_basis.sql");
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

const [cols] = await c.query(
  "SHOW COLUMNS FROM bookings WHERE Field IN ('rateType','hourlyRate','flatRate')");
const [[{ total, withType }]] = await c.query(
  "SELECT COUNT(*) total, SUM(rateType IS NOT NULL) withType FROM bookings");
console.log(`\ncolumns present: ${cols.map(r => r.Field).join(", ") || "(none)"}   ← must list all three`);
console.log(`bookings: ${total}, with a rate type: ${withType}   ← should be 0 until the backfill runs`);
await c.end();
