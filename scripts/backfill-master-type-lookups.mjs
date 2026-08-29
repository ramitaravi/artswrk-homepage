/**
 * Populates master_artist_types and master_service_types from Bubble's
 * live Master_Artist_Type / Master_Service_Type data types — both tables
 * exist in our schema but were completely empty, meaning the raw Bubble
 * IDs stored in users.masterArtistTypes / users.masterServiceType had
 * nothing to resolve against.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || "12172ddf5b3c42d8a4936d57afe0f029";
const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";

function slugify(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

async function fetchAll(type) {
  const results = [];
  let cursor = 0;
  while (true) {
    const url = `${BUBBLE_API_BASE}/${type}?limit=100&cursor=${cursor}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` } });
    if (!res.ok) throw new Error(`Bubble API error ${res.status} for ${type}`);
    const data = await res.json();
    const page = data.response;
    results.push(...page.results);
    if (!page.remaining || page.remaining <= 0) break;
    cursor += 100;
  }
  return results;
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("Fetching Master_Artist_Type from Bubble...");
const artistTypes = await fetchAll("Master_Artist_Type");
console.log(`  ${artistTypes.length} entries`);

const artistTypeIdMap = new Map(); // bubbleId -> our new int id
for (const t of artistTypes) {
  const [res] = await conn.execute(
    `INSERT INTO master_artist_types (bubbleId, name, slug, iconUrl, listingOrder, isPublic)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [t._id, t["Artist Type Name"] || "", slugify(t["Artist Type Name"]), t.Icon || null, t["Listing Order"] ?? 0, !!t.Public]
  );
  artistTypeIdMap.set(t._id, res.insertId);
}
console.log(`  Inserted ${artistTypeIdMap.size} rows into master_artist_types\n`);

console.log("Fetching Master_Service_Type from Bubble...");
const serviceTypes = await fetchAll("Master_Service_Type");
console.log(`  ${serviceTypes.length} entries`);

let inserted = 0, unresolvedParent = 0;
for (const s of serviceTypes) {
  const parentBubbleId = s["Master_Artist_Type"];
  const parentId = artistTypeIdMap.get(parentBubbleId) ?? null;
  if (parentBubbleId && !parentId) unresolvedParent++;

  await conn.execute(
    `INSERT INTO master_service_types (bubbleId, name, slug, masterArtistTypeId, bubbleArtistTypeId, listingOrder, isPublic, isMcLandingPage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s._id,
      s["Service Name"] || "",
      slugify(s["Service Name"]),
      parentId,
      parentBubbleId || null,
      s["Listing Order"] ?? 0,
      !!s.Public,
      !!s["MC landing page?"],
    ]
  );
  inserted++;
}
console.log(`  Inserted ${inserted} rows into master_service_types (${unresolvedParent} with an unresolved parent artist type)\n`);

// Verify: pick a real user and confirm every ID in their masterServiceType/
// masterArtistTypes array now resolves to a real name.
const [[sampleUser]] = await conn.execute(
  `SELECT id, email, masterServiceType, masterArtistTypes FROM users WHERE masterServiceType IS NOT NULL AND masterServiceType != '' AND masterServiceType != '[]' LIMIT 1`
);
if (sampleUser) {
  const ids = JSON.parse(sampleUser.masterServiceType);
  const [names] = await conn.execute(
    `SELECT bubbleId, name FROM master_service_types WHERE bubbleId IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  console.log(`Verification — user ${sampleUser.email}'s masterServiceType resolves to:`);
  console.log(names.map((n) => n.name));
}

await conn.end();
