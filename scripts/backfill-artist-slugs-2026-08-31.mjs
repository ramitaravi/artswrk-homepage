/**
 * Generates name-based slugs for artists whose users.slug is null.
 *
 * Confirmed via scripts/verify-bubble-slugs-2026-08-31.mjs that Bubble has no
 * slug field on artist records at all (sampled 30/2102, zero had one) — so
 * there is nothing to recover from Bubble. This generates fresh slugs instead,
 * deduplicated against every existing slug (including ones generated earlier
 * in this same run) so no two artists ever share a /book/:slug URL.
 *
 * Same base pattern as the existing admin.createArtist slug generation
 * (server/routers.ts ~L459: `${firstName}-${lastName}` lowercased), but that
 * one-at-a-time path never deduped — this does, since running it in bulk
 * across 2,102 people guarantees name collisions.
 *
 *   node scripts/backfill-artist-slugs-2026-08-31.mjs [--dry-run]
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DRY = process.argv.includes("--dry-run");
const c = await mysql.createConnection(process.env.DATABASE_URL);

function baseSlug(row) {
  const first = (row.firstName ?? "").trim();
  const last = (row.lastName ?? "").trim();
  let raw = first || last ? `${first}-${last}` : (row.name ?? "").trim();
  if (!raw) raw = `artist-${row.id}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || `artist-${row.id}`;
}

const [existingRows] = await c.query(`SELECT slug FROM users WHERE slug IS NOT NULL AND slug != ''`);
const taken = new Set(existingRows.map((r) => r.slug));

const [rows] = await c.query(
  `SELECT id, bubbleId, name, firstName, lastName FROM users
   WHERE planTier LIKE 'artist_%' AND (slug IS NULL OR slug = '') AND bubbleId IS NOT NULL
   ORDER BY id ASC`
);

console.log(`${DRY ? "[dry run] " : ""}${rows.length} artists missing slug, ${taken.size} existing slugs to dedupe against\n`);

const updates = [];
let collisions = 0;
for (const r of rows) {
  const base = baseSlug(r);
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  if (slug !== base) collisions++;
  taken.add(slug);
  updates.push({ id: r.id, slug, name: r.name ?? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() });
}

console.log(`  collisions resolved with numeric suffix: ${collisions}`);
console.log(`\nFirst 15 generated:`);
for (const u of updates.slice(0, 15)) {
  console.log(`  #${u.id}  ${u.slug.padEnd(30)}  ${u.name}`);
}

if (!DRY) {
  console.log(`\nApplying ${updates.length} updates...`);
  for (const u of updates) {
    await c.query(`UPDATE users SET slug = ? WHERE id = ?`, [u.slug, u.id]);
  }
  const [check] = await c.query(
    `SELECT COUNT(*) n FROM users WHERE planTier LIKE 'artist_%' AND (slug IS NULL OR slug = '') AND bubbleId IS NOT NULL`
  );
  const [dupeCheck] = await c.query(
    `SELECT slug, COUNT(*) n FROM users WHERE slug IS NOT NULL AND slug != '' GROUP BY slug HAVING n > 1`
  );
  console.log(`  done. artists still missing slug: ${check[0].n}`);
  console.log(`  duplicate slugs in DB after backfill: ${dupeCheck.length}`);
  if (dupeCheck.length) console.log(dupeCheck);
} else {
  console.log(`\n(dry run — nothing written)`);
}

await c.end();
