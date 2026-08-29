/**
 * One-off backfill: apply the finalized Enterprise auto-detection rule
 * (everything except Dance Studio / Music School -> Enterprise) to legacy
 * Client accounts that only have businessType set (hiringCategory empty) —
 * these predate the current onboarding flow and were never evaluated by
 * the live rule in db.ts's updateUserOnboarding.
 *
 * Only touches rows where enterprise is not already true, and only
 * Client-role rows. Sets enterprise=true + planTier='enterprise_on_demand',
 * matching exactly what the live onboarding code does for a new signup.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const NON_ENTERPRISE = ["Dance Studio", "Music School"];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  `SELECT id, businessType FROM users
   WHERE userRole = 'Client'
     AND (enterprise = 0 OR enterprise IS NULL)
     AND businessType IS NOT NULL AND businessType != ''
     AND (hiringCategory IS NULL OR hiringCategory = '')
     AND businessType NOT IN (?, ?)`,
  NON_ENTERPRISE
);

console.log(`Found ${rows.length} legacy Client rows to promote to Enterprise (businessType-driven, hiringCategory empty)\n`);

const byType = {};
for (const r of rows) byType[r.businessType] = (byType[r.businessType] || 0) + 1;
console.table(byType);

if (rows.length > 0) {
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  await conn.execute(
    `UPDATE users SET enterprise = 1, planTier = 'enterprise_on_demand' WHERE id IN (${placeholders})`,
    ids
  );
  console.log(`\nUpdated ${ids.length} rows.`);
}

await conn.end();
