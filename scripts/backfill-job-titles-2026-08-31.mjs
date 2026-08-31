/**
 * Backfills jobs.title from a raw Bubble jobs export CSV. No header row;
 * column 1 (0-indexed) is the job's bubbleId, column 36 is the title.
 * Confirmed by inspecting several rows directly — titles are short and
 * human-readable ("Acro & Hip Hop Instructors"), unlike column 5 (the long
 * free-text description).
 *
 * Only fills jobs.title where it's currently NULL/empty — never overwrites
 * an existing title. 3,451 of 3,902 jobs (88%) have no title at all right now.
 *
 *   node scripts/backfill-job-titles-2026-08-31.mjs [--dry-run]
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

const DRY = process.argv.includes("--dry-run");
const CSV_PATH =
  "/Users/ramitaravi/Downloads/Artswrk Clients - Clean Pull Aug 28 - _instinct _ bubble_jobs_FULL_export_audit_Aug31.csv";

const raw = readFileSync(CSV_PATH, "utf-8");
const records = parse(raw, { columns: false, relax_column_count: true });

const titleByBubbleId = new Map();
for (const row of records) {
  const bubbleId = row[1]?.trim();
  const title = row[36]?.trim();
  if (bubbleId && title) titleByBubbleId.set(bubbleId, title);
}
console.log(`CSV: ${records.length} rows, ${titleByBubbleId.size} with a usable bubbleId + title`);

const c = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await c.query(
  `SELECT id, bubbleId FROM jobs WHERE (title IS NULL OR title = '') AND bubbleId IS NOT NULL`
);
console.log(`DB: ${rows.length} jobs missing a title with a bubbleId`);

const matches = [];
let noCsvMatch = 0;
for (const r of rows) {
  const title = titleByBubbleId.get(r.bubbleId);
  if (title) matches.push({ id: r.id, bubbleId: r.bubbleId, title });
  else noCsvMatch++;
}

console.log(`\n  matched in CSV: ${matches.length}`);
console.log(`  no match in CSV: ${noCsvMatch}`);
console.log(`\nFirst 15 matches:`);
for (const m of matches.slice(0, 15)) {
  console.log(`  #${m.id}  ${m.title}`);
}

if (!DRY) {
  console.log(`\nApplying ${matches.length} updates...`);
  for (const m of matches) {
    await c.query(`UPDATE jobs SET title = ? WHERE id = ?`, [m.title, m.id]);
  }
  const [after] = await c.query(
    `SELECT COUNT(*) n FROM jobs WHERE title IS NULL OR title = ''`
  );
  console.log(`  done. jobs still missing title: ${after[0].n}`);
} else {
  console.log(`\n(dry run — nothing written)`);
}

await c.end();
