/**
 * Seed REVEL's 13 interested artists from Bubble into users table.
 * Then back-fill artistUserId FK on premium_job_interested_artists.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_KEY = "12172ddf5b3c42d8a4936d57afe0f029";

const db = await mysql.createConnection(process.env.DATABASE_URL);

function esc(val) {
  if (val === null || val === undefined) return "NULL";
  const s = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${s}'`;
}

// Get REVEL's job id
const [jobs] = await db.query("SELECT id FROM premium_jobs WHERE bubbleCreatedById = '1772121421134x418341755101401700'");
const premiumJobId = jobs[0]?.id;
if (!premiumJobId) { console.error("REVEL job not found!"); process.exit(1); }
console.log(`REVEL premium_job id: ${premiumJobId}`);

// Get all 13 interested artist Bubble IDs
const [rows] = await db.query(`SELECT id, bubbleArtistId FROM premium_job_interested_artists WHERE premiumJobId = ${premiumJobId}`);
console.log(`Found ${rows.length} interested artist records`);

let upserted = 0, backfilled = 0;

for (const row of rows) {
  const bubbleId = row.bubbleArtistId;
  console.log(`\nFetching Bubble user ${bubbleId}...`);
  
  try {
    const res = await fetch(`${BUBBLE_BASE}/user/${bubbleId}`, {
      headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
    });
    const json = await res.json();
    const u = json?.response;
    if (!u) { console.log(`  → No data returned`); continue; }

    const openId = `bubble_${bubbleId}`;
    const email = u.email ?? u.Email ?? null;
    const firstName = u["First Name"] ?? u.firstName ?? null;
    const lastName = u["Last Name"] ?? u.lastName ?? null;
    const name = firstName && lastName ? `${firstName} ${lastName}` : firstName ?? lastName ?? email ?? openId;
    const profilePicture = u["Profile Picture"] ?? u.profilePicture ?? null;
    const slug = u.Slug ?? u.slug ?? null;
    const location = u.Location ?? u.location ?? null;
    const artswrkPro = u["Artswrk PRO?"] ? 1 : 0;
    
    // Parse masterArtistTypes
    let masterArtistTypes = null;
    const types = u["Master Artist Type"] ?? u.masterArtistType ?? u["Artist Type"] ?? null;
    if (types) {
      masterArtistTypes = Array.isArray(types) ? JSON.stringify(types) : JSON.stringify([types]);
    }

    console.log(`  → ${name} | ${email ?? 'no email'} | ${location ?? 'no location'} | PRO: ${artswrkPro}`);

    await db.query(`INSERT INTO users (openId, bubbleId, email, firstName, lastName, name,
        profilePicture, userRole, slug, location, artswrkPro, loginMethod, masterArtistTypes)
      VALUES (${esc(openId)}, ${esc(bubbleId)}, ${esc(email)},
        ${esc(firstName)}, ${esc(lastName)}, ${esc(name)},
        ${esc(profilePicture)}, 'Artist',
        ${esc(slug)}, ${esc(location)},
        ${artswrkPro}, 'bubble', ${esc(masterArtistTypes)})
      ON DUPLICATE KEY UPDATE
        email=COALESCE(VALUES(email), email),
        firstName=COALESCE(VALUES(firstName), firstName),
        lastName=COALESCE(VALUES(lastName), lastName),
        name=COALESCE(VALUES(name), name),
        profilePicture=COALESCE(VALUES(profilePicture), profilePicture),
        userRole=COALESCE(VALUES(userRole), userRole),
        slug=COALESCE(VALUES(slug), slug),
        location=COALESCE(VALUES(location), location),
        artswrkPro=VALUES(artswrkPro),
        masterArtistTypes=COALESCE(VALUES(masterArtistTypes), masterArtistTypes)`);
    upserted++;

    // Get the local user id
    const [userRows] = await db.query(`SELECT id FROM users WHERE bubbleId = ${esc(bubbleId)}`);
    if (userRows.length > 0) {
      const localUserId = userRows[0].id;
      await db.query(`UPDATE premium_job_interested_artists SET artistUserId = ${localUserId} WHERE id = ${row.id}`);
      backfilled++;
      console.log(`  → Local user id: ${localUserId} — FK back-filled`);
    }
  } catch (err) {
    console.error(`  → Error: ${err.message}`);
  }
}

// Final verification
const [verify] = await db.query(`SELECT pjia.id, pjia.artistUserId, u.name, u.email, u.profilePicture, u.location, u.artswrkPro
  FROM premium_job_interested_artists pjia
  LEFT JOIN users u ON pjia.artistUserId = u.id
  WHERE pjia.premiumJobId = ${premiumJobId}`);

console.log("\n── REVEL Interested Artists (after seed) ──────────────────");
for (const a of verify) {
  console.log(`  [${a.id}] ${a.name ?? '(no name)'} | ${a.email ?? 'no email'} | ${a.location ?? 'no location'} | PRO: ${a.artswrkPro}`);
}

console.log(`\n── Summary ─────────────────────────────────────────────────`);
console.log(`  Upserted: ${upserted} artist users`);
console.log(`  Back-filled FKs: ${backfilled}`);

const [uCount] = await db.query("SELECT COUNT(*) as c FROM users");
console.log(`  Total users in DB: ${uCount[0].c}`);

await db.end();
console.log("\nDone!");
