/**
 * Applies drizzle/0053_pro_service_type_mapping.sql (the two PRO mapping tables
 * + the General Staff service type), then seeds them from
 * drizzle/seeds/premium_service_type_map.sql.
 *
 * Run with:  node scripts/apply-migration-0053-pro-service-types.mjs
 *            node scripts/apply-migration-0053-pro-service-types.mjs --dry-run
 *
 * REQUIRES 0052 FIRST — this is phase 1's second half; run
 * scripts/apply-migration-0052-job-alerts.mjs before this one.
 *
 * THE PRE-FLIGHT CHECK
 * --------------------
 * The seed resolves master_service_types by NAME through an INNER JOIN. An
 * inner join SILENTLY DROPS a row whose name doesn't match — it does not error.
 * The seed was documented as "fails loudly instead of mis-mapping"; on its own
 * it does neither, it just quietly maps fewer values than you think.
 *
 * So before executing anything, this verifies every type name the seed
 * references actually exists, and aborts naming the missing ones. That check is
 * what makes the safety claim true. It runs AFTER the migration (which creates
 * General Staff) and BEFORE the seed (which maps to it).
 *
 * Idempotent: both files guard with NOT EXISTS, "already exists" is a no-op,
 * and the journal row is inserted once.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATION = path.resolve(__dirname, "../drizzle/0053_pro_service_type_mapping.sql");
const SEED = path.resolve(__dirname, "../drizzle/seeds/premium_service_type_map.sql");

/** Every master_service_types name the seed depends on, mapping and candidates
 *  alike. Kept here rather than parsed out of the SQL so the check is obvious
 *  and reviewable. */
const REQUIRED_TYPE_NAMES = [
  // auto-mapped targets
  "Judge", "Tabulator", "Emcee", "Event Director", "Executive Assistant / Admin",
  "Merch", "Competition Choreography", "Master Classes", "General Staff",
  // review candidates offered in the admin view
  "Backstage Staff", "Crew", "Stage Manager", "Registration", "Sales",
  "Customer Service", "Social Media Manager", "Content Creator", "Marketing",
  "Event Photography", "Event Videography", "Competition Photography",
  "Competition Videography", "Weekly Teacher",
];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set — nothing to connect to.");
  process.exit(1);
}

const splitStatements = (raw) =>
  raw
    .split("--> statement-breakpoint")
    .flatMap((chunk) =>
      // The seed is one file of plain statements rather than drizzle chunks, so
      // fall back to splitting on semicolons at end of line.
      chunk.includes("--> statement-breakpoint") ? [chunk] : chunk.split(/;\s*\n/)
    )
    .map((s) => s.trim().replace(/;$/, "").trim())
    .filter((s) => s.replace(/^\s*--.*$/gm, "").trim().length > 0);

const label = (s) => s.replace(/^\s*--.*$/gm, "").trim().split("\n")[0].slice(0, 76);

const migrationRaw = fs.readFileSync(MIGRATION, "utf8");
const seedRaw = fs.readFileSync(SEED, "utf8");
const migrationStatements = splitStatements(migrationRaw);
const seedStatements = splitStatements(seedRaw);
const hash = crypto.createHash("sha256").update(migrationRaw).digest("hex");

console.log(
  `${DRY_RUN ? "[dry run] " : ""}0053: ${migrationStatements.length} migration statements, ` +
  `${seedStatements.length} seed statements\n`
);

if (DRY_RUN) {
  console.log("migration:");
  for (const s of migrationStatements) console.log(`  · ${label(s)}`);
  console.log("\nseed:");
  for (const s of seedStatements) console.log(`  · ${label(s)}`);
  console.log(`\npre-flight would verify ${REQUIRED_TYPE_NAMES.length} type names exist.`);
  console.log("Nothing executed. Drop --dry-run to apply.");
  process.exit(0);
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const run = async (statements, phase) => {
  let applied = 0;
  let skipped = 0;
  for (const statement of statements) {
    const name = label(statement);
    try {
      const [result] = await conn.query(statement);
      applied++;
      const rows =
        /^\s*(INSERT|UPDATE)/i.test(name) && result?.affectedRows !== undefined
          ? `  (${result.affectedRows} rows)`
          : "";
      console.log(`  ✓ ${name}${rows}`);
    } catch (err) {
      if (/already exists|Duplicate column|Duplicate key name|Duplicate entry/i.test(err.message)) {
        skipped++;
        console.log(`  · ${name}   [already applied]`);
      } else {
        console.error(`  ✗ ${name}\n    ${err.message}`);
        await conn.end();
        process.exit(1);
      }
    }
  }
  console.log(`${phase}: applied ${applied}, skipped ${skipped}\n`);
};

console.log("── migration ──");
await run(migrationStatements, "migration");

// ── Pre-flight: every name the seed references must resolve ─────────────────
console.log("── pre-flight ──");
const [found] = await conn.query(
  `SELECT name FROM master_service_types WHERE name IN (${REQUIRED_TYPE_NAMES.map(() => "?").join(",")})`,
  REQUIRED_TYPE_NAMES
);
const have = new Set(found.map((r) => r.name));
const missing = REQUIRED_TYPE_NAMES.filter((n) => !have.has(n));
if (missing.length) {
  console.error(
    `  ✗ ${missing.length} master_service_types name(s) referenced by the seed do not exist:\n` +
    missing.map((n) => `      · ${n}`).join("\n") +
    `\n\n  Refusing to seed. The seed's inner joins would drop these silently,\n` +
    `  leaving those raw values unmapped with no error. Create the missing\n` +
    `  types (or correct the names in the seed) and re-run.`
  );
  await conn.end();
  process.exit(1);
}
console.log(`  ✓ all ${REQUIRED_TYPE_NAMES.length} referenced type names resolve\n`);

console.log("── seed ──");
await run(seedStatements, "seed");

const [[{ n }]] = await conn.query(
  "SELECT COUNT(*) n FROM __drizzle_migrations WHERE hash = ?",
  [hash]
);
if (n === 0) {
  await conn.query(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    [hash, Date.now()]
  );
  console.log("journal: recorded 0053");
} else {
  console.log("journal: 0053 already recorded");
}

// ── Result summary ─────────────────────────────────────────────────────────
const [[mapped]] = await conn.query("SELECT COUNT(*) n FROM premium_service_type_map");
const [[review]] = await conn.query(
  "SELECT COUNT(*) n FROM premium_service_type_review WHERE resolvedAt IS NULL"
);
// Keyed on serviceType, NOT category. The audit's raw values ("Judge",
// "Tabulator", "Emcee") live in premium_jobs.serviceType; category holds
// event/company types ("Dance Competition", "Admin") and some outright junk
// (city names). Matching on category resolves exactly zero rows — measured.
const [[coverage]] = await conn.query(`
  SELECT COUNT(*) total, SUM(m.id IS NOT NULL) mapped
  FROM premium_jobs p
  LEFT JOIN premium_service_type_map m ON m.rawValue = p.serviceType
  WHERE p.status = 'Active'`);
console.log(
  `\n${mapped.n} raw values mapped, ${review.n} awaiting review.\n` +
  `Active PRO jobs now resolvable: ${coverage.mapped ?? 0} of ${coverage.total}.\n` +
  `The rest need a service type picked by hand — see the note in\n` +
  `docs/premium-service-type-map.md about audit grain vs job rows.`
);

await conn.end();
