/**
 * Merges the duplicate "BOCO" affiliation (two Bubble records for the same
 * school) into the canonical one.
 *
 * getAllAffiliations lists any affiliation with at least one user attached, so
 * the duplicate showed up as a second identical "BOCO" filter option. This
 * remaps the stray user_affiliations row onto the canonical affiliation and
 * leaves the now-userless duplicate row in place (deliberately not deleted) —
 * with zero users it drops out of the listing on its own, and any old bubbleId
 * reference still resolves.
 *
 * Usage: node scripts/merge-duplicate-boco-2026-09-01.mjs [--dry-run]
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [dupes] = await conn.query(
  `SELECT a.id, a.display, a.bubbleId, COUNT(ua.id) AS users
   FROM affiliations a
   LEFT JOIN user_affiliations ua ON ua.affiliationId = a.id
   WHERE a.display = 'BOCO'
   GROUP BY a.id
   ORDER BY users DESC`
);

console.log("Before:");
dupes.forEach((d) => console.log(`  id=${d.id} users=${d.users} bubbleId=${d.bubbleId}`));

if (dupes.length !== 2) {
  console.log(`Expected exactly 2 BOCO rows, found ${dupes.length}. Refusing to guess — no changes made.`);
  await conn.end();
  process.exit(1);
}

// Keep the one people are actually attached to.
const [keep, drop] = dupes;
console.log(`\nKeeping id=${keep.id} (${keep.users} users), merging id=${drop.id} (${drop.users} users) into it.`);

// Don't create a duplicate pairing for anyone already on the canonical row.
const [conflicts] = await conn.query(
  `SELECT ua.id FROM user_affiliations ua
   WHERE ua.affiliationId = ?
     AND ua.artistUserId IN (SELECT artistUserId FROM (
       SELECT artistUserId FROM user_affiliations WHERE affiliationId = ?
     ) AS existing)`,
  [drop.id, keep.id]
);

if (!DRY_RUN) {
  if (conflicts.length) {
    const ids = conflicts.map((c) => c.id);
    await conn.query(`DELETE FROM user_affiliations WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
    console.log(`  Removed ${ids.length} redundant pairing(s) — those artists were already on id=${keep.id}.`);
  }
  const [res] = await conn.query(
    "UPDATE user_affiliations SET affiliationId = ? WHERE affiliationId = ?",
    [keep.id, drop.id]
  );
  console.log(`  Remapped ${res.affectedRows} user_affiliations row(s).`);
} else {
  console.log(`  [dry run] would remap ${drop.users} row(s), ${conflicts.length} of them redundant.`);
}

const [after] = await conn.query(
  `SELECT a.id, a.display, COUNT(ua.id) AS users
   FROM affiliations a
   LEFT JOIN user_affiliations ua ON ua.affiliationId = a.id
   WHERE a.display = 'BOCO'
   GROUP BY a.id ORDER BY users DESC`
);
console.log("\nAfter:");
after.forEach((d) => console.log(`  id=${d.id} users=${d.users}${d.users === 0 ? "  ← drops out of the filter list" : ""}`));

await conn.end();
