/**
 * Consolidates businessType down to the 5-category canonical list
 * (Dance Studio, Dance Competition, Music School, Event Company, Other) —
 * the list already used in client/src/pages/Admin.tsx's CLIENT_BUSINESS_TYPES
 * and client/src/pages/ClientOnboarding.tsx's BUSINESS_TYPES.
 *
 * Pure label consolidation — does NOT touch enterprise/planTier. Verified
 * separately that every businessType value already correctly drives
 * enterprise=1/planTier='enterprise_on_demand' except Dance Studio and
 * (mostly) Music School, matching the existing NON_ENTERPRISE_CATEGORIES
 * rule in server/db.ts. The one Music School row with enterprise=1
 * (id 781523, "Ensemble Schools") has enterprisePlan='subscriber' — a real,
 * deliberate paid subscriber, not a data error — left untouched.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const REMAP = {
  "Dance Convention": "Other",
  "Startup": "Other",
  "Fitness Studio": "Other",
  "Fashion Brand": "Other",
};

for (const [from, to] of Object.entries(REMAP)) {
  const [res] = await conn.execute(`UPDATE users SET businessType = ? WHERE businessType = ?`, [to, from]);
  console.log(`${from} -> ${to}: ${res.affectedRows} rows`);
}

const [after] = await conn.execute(
  `SELECT businessType, COUNT(*) n FROM users WHERE businessType IS NOT NULL AND businessType != '' GROUP BY businessType ORDER BY n DESC`
);
console.log("\nFinal businessType distribution:");
console.table(after);

await conn.end();
