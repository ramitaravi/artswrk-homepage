/**
 * Applies drizzle/0052_naive_the_fallen.sql (job alert emails — phase 1 schema)
 * to the database in DATABASE_URL, then records it in __drizzle_migrations.
 *
 * Run with:  node scripts/apply-migration-0052-job-alerts.mjs
 * Add --dry-run to print the statements without executing any of them.
 *
 * WHY THIS EXISTS INSTEAD OF `drizzle-kit migrate`
 * ------------------------------------------------
 * The journal is out of sync with reality: drizzle/meta/_journal.json lists 53
 * migrations, but __drizzle_migrations only has 35 rows. Eighteen migrations
 * were applied to the DB by hand without being recorded (0050 among them — its
 * columns are definitely live). `drizzle-kit migrate` would therefore replay
 * all eighteen and die on the first duplicate column. This applies only 0052
 * and records only 0052, leaving that pre-existing drift alone rather than
 * papering over it.
 *
 * WHAT IT DOES
 * ------------
 * Additive only: 3 new tables, 6 new nullable columns on jobs/premium_jobs,
 * 3 indexes. Nothing is dropped and no existing column is modified. The two
 * trailing UPDATEs write the brand-new networkStatus column on existing rows,
 * parking the entire pre-launch backlog as 'suppressed' so the first digest
 * run cannot blast it. They touch no other column.
 *
 * Safe to re-run: "already exists" / "duplicate column" errors are treated as
 * a no-op, any other error stops the run immediately, and the journal row is
 * only inserted once.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const FILE = path.resolve(__dirname, "../drizzle/0052_naive_the_fallen.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set — nothing to connect to.");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
// drizzle hashes the raw file contents; matching that keeps the journal row
// consistent with what drizzle-kit itself would have written.
const hash = crypto.createHash("sha256").update(raw).digest("hex");

const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  // Drop chunks that are nothing but SQL comments.
  .filter((s) => s.replace(/^\s*--.*$/gm, "").trim().length > 0);

const label = (s) =>
  s.replace(/^\s*--.*$/gm, "").trim().split("\n")[0].slice(0, 76);

console.log(`${DRY_RUN ? "[dry run] " : ""}${statements.length} statements from 0052\n`);

if (DRY_RUN) {
  for (const s of statements) console.log(`  · ${label(s)}`);
  console.log("\nNothing executed. Drop --dry-run to apply.");
  process.exit(0);
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
let applied = 0;
let skipped = 0;

for (const statement of statements) {
  const name = label(statement);
  try {
    const [result] = await conn.query(statement);
    applied++;
    const rows =
      /^\s*UPDATE/i.test(name) && result?.affectedRows !== undefined
        ? `  (${result.affectedRows} rows)`
        : "";
    console.log(`  ✓ ${name}${rows}`);
  } catch (err) {
    if (/already exists|Duplicate column|Duplicate key name/i.test(err.message)) {
      skipped++;
      console.log(`  · ${name}   [already applied]`);
    } else {
      console.error(`  ✗ ${name}\n    ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }
}

const [[{ n }]] = await conn.query(
  "SELECT COUNT(*) n FROM __drizzle_migrations WHERE hash = ?",
  [hash]
);
if (n === 0) {
  await conn.query(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    [hash, Date.now()]
  );
  console.log("\njournal: recorded 0052");
} else {
  console.log("\njournal: 0052 already recorded");
}

console.log(`applied ${applied}, skipped ${skipped}`);
await conn.end();
