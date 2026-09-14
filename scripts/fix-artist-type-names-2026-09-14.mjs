/**
 * Converts artist type, service type and style NAMES stored on users into the
 * ids everything else matches on (Bubble id, or the numeric id for types
 * created on the new site). Some migrated rows and older onboarding saves
 * stored names like "Dance Educator"; those never match a job's type id, so
 * the artist's job feed and the artist browse filters silently skip them.
 *
 *   node scripts/fix-artist-type-names-2026-09-14.mjs           # preview, changes nothing
 *   node scripts/fix-artist-type-names-2026-09-14.mjs --apply   # convert, one transaction
 *
 * A name with no matching type is kept as-is and listed, so nothing is lost —
 * add the type or fix those rows by hand.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");
const FIELDS = [
  { column: "masterArtistTypes", table: "master_artist_types" },
  { column: "masterServiceType", table: "master_service_types" },
  { column: "masterStyles", table: "master_style_types" },
];
const isId = (v) => /^\d{10,}x\d+$/.test(v) || /^\d+$/.test(v);

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z" });
const q = async (sql, params = []) => (await conn.query(sql, params))[0];

try {
  const lookups = {};
  for (const f of FIELDS) {
    const rows = await q(`SELECT id, bubbleId, name FROM \`${f.table}\` WHERE name IS NOT NULL`);
    lookups[f.column] = new Map(rows.map((r) => [String(r.name).trim().toLowerCase(), r.bubbleId ?? String(r.id)]));
  }

  const where = FIELDS.map((f) => `(\`${f.column}\` IS NOT NULL AND \`${f.column}\` <> '' AND \`${f.column}\` <> '[]')`).join(" OR ");
  const rows = await q(`SELECT id, ${FIELDS.map((f) => `\`${f.column}\``).join(", ")} FROM users WHERE ${where}`);

  const updates = [];
  const perColumn = Object.fromEntries(FIELDS.map((f) => [f.column, 0]));
  const unresolved = new Map();
  let unreadable = 0;

  for (const u of rows) {
    const set = {};
    for (const f of FIELDS) {
      const raw = u[f.column];
      if (!raw) continue;
      let values;
      try { values = JSON.parse(raw); } catch { unreadable++; continue; }
      if (!Array.isArray(values)) continue;
      const strings = values.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
      if (!strings.some((v) => !isId(v))) continue;

      const out = strings.map((v) => {
        if (isId(v)) return v;
        const id = lookups[f.column].get(v.toLowerCase());
        if (id) return id;
        const key = `${f.column}: "${v}"`;
        unresolved.set(key, (unresolved.get(key) ?? 0) + 1);
        return v;
      });
      const next = JSON.stringify([...new Set(out)]);
      if (next !== raw) { set[f.column] = next; perColumn[f.column]++; }
    }
    if (Object.keys(set).length) updates.push({ id: u.id, set, before: u });
  }

  console.log(APPLY ? "CONVERTING" : "PREVIEW — nothing will change (add --apply to convert)");
  console.log(`\nAccounts with names to convert: ${updates.length}`);
  for (const f of FIELDS) console.log(`  ${f.column}: ${perColumn[f.column]}`);
  for (const u of updates.slice(0, 3)) {
    console.log(`\n  account ${u.id}`);
    for (const [col, next] of Object.entries(u.set)) console.log(`    ${col}: ${u.before[col]}\n      → ${next}`);
  }
  if (unresolved.size) {
    console.log("\nNames with no matching type (kept as-is):");
    for (const [k, n] of [...unresolved].sort((a, b) => b[1] - a[1])) console.log(`  ${k} — ${n} account(s)`);
  }
  if (unreadable) console.log(`\nValues that aren't valid JSON (skipped): ${unreadable}`);

  if (!APPLY || !updates.length) {
    console.log(updates.length ? "\nRe-run with --apply to convert." : "\nNothing to convert.");
    process.exit(0);
  }

  await conn.beginTransaction();
  for (const u of updates) {
    const cols = Object.keys(u.set);
    await q(`UPDATE users SET ${cols.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`, [...cols.map((c) => u.set[c]), u.id]);
  }
  await conn.commit();
  console.log(`\nConverted ${updates.length} accounts.`);
} catch (err) {
  try { await conn.rollback(); } catch {}
  console.error(`\nFailed — ${APPLY ? "rolled back, nothing changed" : "nothing changed"}: ${err.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
