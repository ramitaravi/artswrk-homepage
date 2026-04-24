/**
 * generate-job-slugs.mjs
 * Generates URL slugs for jobs that don't have one yet.
 * Slug format: {service-type-or-description-excerpt}-{id}
 * Run: node scripts/generate-job-slugs.mjs
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 60);
}

function extractTitle(description) {
  if (!description) return "arts-job";
  const patterns = [
    [/sub(stitute)?\s+teacher/i, "substitute-teacher"],
    [/ballet/i, "ballet-teacher"],
    [/hip\s*hop/i, "hip-hop-instructor"],
    [/tap\s+teacher/i, "tap-teacher"],
    [/jazz\s+teacher/i, "jazz-teacher"],
    [/lyrical/i, "lyrical-teacher"],
    [/contemporary/i, "contemporary-teacher"],
    [/acro/i, "acro-teacher"],
    [/piano/i, "piano-teacher"],
    [/violin/i, "violin-teacher"],
    [/voice|vocal/i, "vocal-coach"],
    [/judge|adjudicat/i, "dance-adjudicator"],
    [/choreograph/i, "choreographer"],
    [/photographer/i, "photographer"],
    [/videograph/i, "videographer"],
    [/yoga/i, "yoga-instructor"],
    [/pilates/i, "pilates-instructor"],
    [/teacher|instructor|coach/i, "dance-teacher"],
  ];
  for (const [re, label] of patterns) {
    if (re.test(description)) return label;
  }
  // Fall back to first 6 words of description
  const words = description.trim().split(/\s+/).slice(0, 6).join(" ");
  return slugify(words) || "arts-job";
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Fetch all jobs missing slugs
  const [jobs] = await conn.execute(
    `SELECT j.id, j.description, mst.name as serviceType
     FROM jobs j
     LEFT JOIN master_service_types mst ON mst.bubbleId = j.masterServiceTypeId
     WHERE j.slug IS NULL OR j.slug = ''`
  );
  
  console.log(`Found ${jobs.length} jobs missing slugs. Generating...`);
  
  let updated = 0;
  for (const job of jobs) {
    const base = job.serviceType
      ? slugify(job.serviceType)
      : extractTitle(job.description);
    const slug = `${base}-${job.id}`;
    await conn.execute(`UPDATE jobs SET slug = ? WHERE id = ?`, [slug, job.id]);
    updated++;
  }
  
  console.log(`✅ Generated slugs for ${updated} jobs.`);
  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
