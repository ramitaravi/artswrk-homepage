/**
 * Give every job a slug.
 *
 * jobs.slug is NULL on 1,830 of 3,979 rows, including every job posted on the
 * new site, because neither createJob caller ever passed one. createJob now
 * builds one; this is the backlog.
 *
 * The slug always ends in the job's id, because that is what the public job
 * page resolves by. Jobs that already have one are left alone.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");

function slugifyTitle(title) {
  return (title ?? "").toLowerCase().replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
const buildJobSlug = (title, id) => {
  const base = slugifyTitle(title);
  return base ? `${base}-${id}` : `arts-job-${id}`;
};

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
const [rows] = await c.query(`SELECT id, title FROM jobs WHERE slug IS NULL OR slug = ''`);

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);
console.log(`  ${rows.length} jobs without a slug\n`);
for (const j of rows.slice(0, 5)) console.log(`    #${j.id}  "${(j.title ?? "(untitled)").slice(0, 40)}"  ->  ${buildJobSlug(j.title, j.id)}`);
if (rows.length > 5) console.log(`    … and ${rows.length - 5} more`);

if (WRITE) {
  // Batched: one round trip per 200 rows rather than per row. Sequentially
  // this took minutes against the remote database and dropped its connection
  // partway through. Still scoped to rows with no slug, so re-running is safe.
  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const cases = batch.map(() => `WHEN ? THEN ?`).join(" ");
    const params = batch.flatMap((j) => [j.id, buildJobSlug(j.title, j.id)]);
    await c.query(
      `UPDATE jobs SET slug = CASE id ${cases} END
       WHERE id IN (${batch.map(() => "?").join(",")}) AND (slug IS NULL OR slug = '')`,
      [...params, ...batch.map((j) => j.id)],
    );
    done += batch.length;
    console.log(`    …${done}/${rows.length}`);
  }
  const [[left]] = await c.query(`SELECT COUNT(*) n FROM jobs WHERE slug IS NULL OR slug = ''`);
  console.log(`\n✓ set ${done} slugs — ${left.n} still without one`);
} else {
  console.log(`\nNothing written — re-run with --write.`);
}
await c.end();
