/**
 * generate-job-titles.mjs
 * Backfills short, human-readable titles for jobs that don't have one.
 * Title format: "[ArtForm] [ServiceType]" e.g. "Ballet Recurring Classes"
 * Fallback order: artForm+serviceType → artForm+"Teacher" → serviceType → description excerpt
 * Run: node scripts/generate-job-titles.mjs
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

// Art form detection patterns: regex → display name
const ART_FORMS = [
  [/summer\s+intensive/i, "Summer Intensive"],
  [/hip[\s-]?hop/i, "Hip Hop"],
  [/ballet/i, "Ballet"],
  [/tap\b/i, "Tap"],
  [/jazz\b/i, "Jazz"],
  [/lyrical/i, "Lyrical"],
  [/contemporary/i, "Contemporary"],
  [/acro/i, "Acrobatics"],
  [/musical\s+theatre?/i, "Musical Theatre"],
  [/modern\b/i, "Modern"],
  [/breakdanc|b[\s-]?boy/i, "Breakdance"],
  [/ballroom/i, "Ballroom"],
  [/latin\b/i, "Latin"],
  [/salsa/i, "Salsa"],
  [/tumbl/i, "Tumbling"],
  [/cheer/i, "Cheer"],
  [/gymnastics/i, "Gymnastics"],
  [/piano/i, "Piano"],
  [/violin/i, "Violin"],
  [/cello/i, "Cello"],
  [/guitar/i, "Guitar"],
  [/voice|vocal/i, "Vocal"],
  [/singing|sing\b/i, "Singing"],
  [/music\b/i, "Music"],
  [/yoga/i, "Yoga"],
  [/pilates/i, "Pilates"],
  [/barre/i, "Barre"],
  [/fitness|aerobic/i, "Fitness"],
  [/photograph/i, "Photography"],
  [/videograph/i, "Videography"],
  [/judg|adjudicat/i, "Adjudication"],
  [/choreograph/i, "Choreography"],
  [/acting|theatre?/i, "Acting"],
  [/modeling|modelling/i, "Modeling"],
  [/aerial/i, "Aerial"],
  [/circus/i, "Circus Arts"],
];

// Service type label simplifications (for cleaner combined titles)
const SERVICE_TYPE_LABEL = {
  "Recurring Classes": "Teacher",
  "Substitute Teacher": "Substitute Teacher",
  "Summer Intensive": "Summer Intensive",
  "Private Lessons": "Private Coach",
  "Competition Coach": "Competition Coach",
  "Workshop": "Workshop Instructor",
  "Master Class": "Master Class Instructor",
  "Choreographer": "Choreographer",
  "Adjudicator": "Adjudicator",
  "Photographer": "Photographer",
  "Videographer": "Videographer",
};

function detectArtForm(description) {
  if (!description) return null;
  for (const [re, label] of ART_FORMS) {
    if (re.test(description)) return label;
  }
  return null;
}

function getServiceLabel(serviceTypeName) {
  if (!serviceTypeName) return null;
  return SERVICE_TYPE_LABEL[serviceTypeName] ?? serviceTypeName;
}

function buildTitle(description, serviceTypeName) {
  const artForm = detectArtForm(description);
  const serviceLabel = getServiceLabel(serviceTypeName);

  if (artForm && serviceLabel) {
    // Avoid redundancy like "Ballet Ballet Teacher"
    if (serviceLabel.toLowerCase().includes(artForm.toLowerCase())) return serviceLabel;
    if (artForm.toLowerCase() === serviceLabel.toLowerCase()) return artForm + " Teacher";
    return `${artForm} ${serviceLabel}`;
  }
  if (artForm) return `${artForm} Teacher`;
  if (serviceLabel) return serviceLabel;

  // Last resort: first 5 meaningful words from description
  if (description) {
    const words = description
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 5)
      .join(" ");
    if (words.length > 3) return words;
  }

  return "Artswrk Job";
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Add column if not yet present (safe to rerun)
  try {
    await conn.execute(`ALTER TABLE jobs ADD COLUMN title varchar(256)`);
    console.log("✅ Added title column to jobs table.");
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️  title column already exists — skipping ALTER.");
    } else {
      throw e;
    }
  }

  // Fetch jobs without titles
  const [rows] = await conn.execute(
    `SELECT j.id, j.description, mst.name AS serviceType
     FROM jobs j
     LEFT JOIN master_service_types mst ON mst.bubbleId = j.masterServiceTypeId
     WHERE j.title IS NULL OR j.title = ''`
  );

  console.log(`Found ${rows.length} jobs without titles. Generating…`);

  let updated = 0;
  for (const job of rows) {
    const title = buildTitle(job.description, job.serviceType);
    await conn.execute(`UPDATE jobs SET title = ? WHERE id = ?`, [title, job.id]);
    updated++;
    if (updated % 50 === 0) console.log(`  …${updated} done`);
  }

  console.log(`✅ Generated titles for ${updated} jobs.`);
  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
