/**
 * READ-ONLY. Does Bubble actually have real slug values for the artists whose
 * users.slug is null in our DB? Samples N of them, fetches each User record
 * straight from Bubble's Data API, and reports what's there.
 *
 * No writes to Bubble or to our DB. Run before any slug-recovery script.
 *
 *   node scripts/verify-bubble-slugs-2026-08-31.mjs [--sample=50]
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const SAMPLE = Number((process.argv.find((a) => a.startsWith("--sample=")) ?? "").split("=")[1]) || 30;

const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const apiKey = process.env.BUBBLE_API_KEY;
if (!apiKey) {
  console.error("BUBBLE_API_KEY not set");
  process.exit(1);
}

const c = await mysql.createConnection(process.env.DATABASE_URL);

const [total] = await c.query(
  `SELECT COUNT(*) n FROM users WHERE planTier LIKE 'artist_%' AND (slug IS NULL OR slug = '') AND bubbleId IS NOT NULL`
);
console.log(`Total artists missing slug with a bubbleId: ${total[0].n}`);

const [rows] = await c.query(
  `SELECT id, bubbleId, name, firstName, lastName FROM users
   WHERE planTier LIKE 'artist_%' AND (slug IS NULL OR slug = '') AND bubbleId IS NOT NULL
   ORDER BY RAND() LIMIT ?`,
  [SAMPLE]
);

console.log(`\nSampling ${rows.length} records from Bubble's live Data API...\n`);

let hasSlugField = 0;
let hasRealValue = 0;
let notFound = 0;
let errors = 0;
const sampleKeys = new Set();

for (const r of rows) {
  try {
    const res = await fetch(`${BUBBLE_BASE}/User/${r.bubbleId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 404) {
      notFound++;
      console.log(`  ${r.bubbleId}  404 not found  (${r.name ?? r.firstName ?? "?"})`);
      continue;
    }
    if (!res.ok) {
      errors++;
      console.log(`  ${r.bubbleId}  HTTP ${res.status}  (${r.name ?? r.firstName ?? "?"})`);
      continue;
    }
    const data = await res.json();
    const obj = data.response ?? data;
    Object.keys(obj).forEach((k) => sampleKeys.add(k));

    // Look for anything slug-like among the actual returned keys
    const slugKey = Object.keys(obj).find((k) => /slug/i.test(k));
    const val = slugKey ? obj[slugKey] : undefined;

    if (slugKey) hasSlugField++;
    if (val) hasRealValue++;

    console.log(
      `  ${r.bubbleId}  slugField=${slugKey ?? "—"}  value=${val ? `"${val}"` : "(empty)"}  (${r.name ?? r.firstName ?? "?"})`
    );
  } catch (e) {
    errors++;
    console.log(`  ${r.bubbleId}  ERROR ${e.message}`);
  }
}

console.log(`\n── Summary ──`);
console.log(`  sampled:        ${rows.length}`);
console.log(`  404 in Bubble:  ${notFound}`);
console.log(`  fetch errors:   ${errors}`);
console.log(`  has slug field: ${hasSlugField}`);
console.log(`  has real value: ${hasRealValue}`);
console.log(`\n  all field keys seen on User objects:`);
console.log(`  ${[...sampleKeys].sort().join(", ")}`);

await c.end();
