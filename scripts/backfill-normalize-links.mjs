/**
 * One-off backfill: apply the same normalizeSocialLink() logic already used
 * on every new profile save (server/db.ts) to existing rows, so legacy
 * bare-handle / schemeless links get the same clean https:// format.
 *
 * This is format normalization only — it does NOT verify a link actually
 * resolves (a 404 check against thousands of Instagram/TikTok URLs isn't
 * reliable: most social platforms block server-side HEAD/GET requests
 * regardless of whether the profile is real). "Never a broken link" would
 * need a different, slower approach — flagging that as a separate problem,
 * not silently attempting it here.
 *
 * Safe to re-run: normalizeSocialLink is idempotent (already-normalized
 * URLs pass through unchanged), and this only ever updates a row if the
 * normalized value actually differs from what's stored.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

function normalizeSocialLink(raw, platform) {
  const value = raw.trim();
  if (!value) return value;
  if (platform === "instagram" || platform === "tiktok") {
    if (/^https?:\/\//i.test(value)) return value;
    const handle = value.replace(/^@/, "").trim();
    if (!/^[\w.]+$/.test(handle)) return value;
    return platform === "instagram" ? `https://instagram.com/${handle}` : `https://www.tiktok.com/@${handle}`;
  }
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return value;
}

const FIELDS = ["instagram", "tiktok", "youtube", "website", "portfolio"];

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT id, instagram, tiktok, youtube, website, portfolio FROM users
   WHERE instagram IS NOT NULL AND instagram != ''
      OR tiktok IS NOT NULL AND tiktok != ''
      OR youtube IS NOT NULL AND youtube != ''
      OR website IS NOT NULL AND website != ''
      OR portfolio IS NOT NULL AND portfolio != ''`
);

console.log(`Checking ${rows.length} users with at least one link set...\n`);

let changed = 0;
const changeLog = [];
for (const row of rows) {
  const updates = {};
  for (const field of FIELDS) {
    const current = row[field];
    if (!current) continue;
    const normalized = normalizeSocialLink(current, field);
    if (normalized !== current) updates[field] = normalized;
  }
  if (Object.keys(updates).length === 0) continue;

  const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(", ");
  await conn.execute(`UPDATE users SET ${setClause} WHERE id = ?`, [...Object.values(updates), row.id]);
  changed++;
  for (const [field, val] of Object.entries(updates)) {
    changeLog.push({ id: row.id, field, before: row[field], after: val });
  }
}

console.log(`Done: ${changed} users updated, ${changeLog.length} individual link fields normalized.\n`);
console.log("Sample of changes:");
for (const c of changeLog.slice(0, 15)) {
  console.log(`  user ${c.id} | ${c.field}: "${c.before}" -> "${c.after}"`);
}

await conn.end();
