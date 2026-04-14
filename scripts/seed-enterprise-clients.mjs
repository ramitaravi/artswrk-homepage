/**
 * Seed all 11 enterprise clients from Bubble API into users table.
 * Marks them as enterprise=true and links their premium_jobs.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const BUBBLE_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const BASE = "https://artswrk.com/version-live/api/1.1/obj/user";

const ENTERPRISE_EMAILS = [
  "taylor@dancerevel.com",
  "raj@onstageamerica.com",
  "decapartner@gmail.com",
  "juliana@elevationontour.com",
  "alli@journeycompetition.com",
  "tiffany@thunderstruckdance.com",
  "julie@americandanceawards.com",
  "elaine@legacystudios.co",
  "recruiting+corporate@ensembleschools.com",
  "lori@tickettobroadway.com",
  "diana@destinytalentcompetition.com",
];

async function bubbleFetch(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${BUBBLE_KEY}` },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function searchUserByEmail(email) {
  const encoded = encodeURIComponent(
    JSON.stringify([{ key: "email", constraint_type: "equals", value: email }])
  );
  const url = `${BASE}?constraints=${encoded}&limit=1`;
  const data = await bubbleFetch(url);
  if (!data?.response?.results?.length) return null;
  return data.response.results[0];
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

function esc(val) {
  if (val === null || val === undefined || val === "") return "NULL";
  return db.escape(val);
}

console.log("Seeding 11 enterprise clients from Bubble...\n");

const results = [];

for (const email of ENTERPRISE_EMAILS) {
  process.stdout.write(`  Fetching ${email}... `);
  const u = await searchUserByEmail(email);
  if (!u) {
    console.log("NOT FOUND in Bubble");
    results.push({ email, status: "not_found" });
    continue;
  }

  const bubbleId = u._id;
  const firstName = u["First Name"] || u["first name"] || "";
  const lastName = u["Last Name"] || u["last name"] || "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];
  const clientCompanyName = u["Studio Name"] || u["studio name"] || u["Company Name"] || u["company name"] || u["Name"] || "";
  const location = u["Location"] || u["location"] || u["City"] || "";
  const profilePicture = u["Profile Picture"] || u["profile picture"] || u["Photo"] || null;
  const slug = u["Slug"] || u["slug"] || null;
  const website = u["Website"] || u["website"] || null;
  const phone = u["Phone"] || u["phone"] || null;
  const instagram = u["Instagram"] || u["instagram"] || null;
  const bio = u["Bio"] || u["bio"] || null;
  const hiringCategory = u["Hiring Category"] || u["hiring category"] || u["Business Type"] || null;
  const enterpriseLogoUrl = u["Enterprise Logo"] || u["enterprise logo"] || u["Logo"] || profilePicture || null;
  const enterpriseDescription = u["Enterprise Description"] || u["enterprise description"] || bio || null;

  // Upsert into users table
  const openId = `bubble_enterprise_${bubbleId}`;
  await db.query(`
    INSERT INTO users (
      openId, email, name, firstName, lastName, clientCompanyName,
      location, profilePicture, slug, website, phoneNumber, instagram, bio,
      hiringCategory, enterprise, enterpriseLogoUrl, enterpriseDescription,
      userRole, bubbleId, createdAt
    ) VALUES (
      ${esc(openId)}, ${esc(email)}, ${esc(name)}, ${esc(firstName)}, ${esc(lastName)},
      ${esc(clientCompanyName)}, ${esc(location)}, ${esc(profilePicture)}, ${esc(slug)},
      ${esc(website)}, ${esc(phone)}, ${esc(instagram)}, ${esc(bio)},
      ${esc(hiringCategory)}, 1, ${esc(enterpriseLogoUrl)}, ${esc(enterpriseDescription)},
      'Client', ${esc(bubbleId)}, NOW()
    )
    ON DUPLICATE KEY UPDATE
      name = IF(name IS NULL OR name = '', VALUES(name), name),
      firstName = IF(firstName IS NULL OR firstName = '', VALUES(firstName), firstName),
      lastName = IF(lastName IS NULL OR lastName = '', VALUES(lastName), lastName),
      clientCompanyName = IF(clientCompanyName IS NULL OR clientCompanyName = '', VALUES(clientCompanyName), clientCompanyName),
      location = IF(location IS NULL, VALUES(location), location),
      profilePicture = IF(profilePicture IS NULL, VALUES(profilePicture), profilePicture),
      slug = IF(slug IS NULL, VALUES(slug), slug),
      website = IF(website IS NULL, VALUES(website), website),
      phoneNumber = IF(phoneNumber IS NULL, VALUES(phoneNumber), phoneNumber),
      instagram = IF(instagram IS NULL, VALUES(instagram), instagram),
      bio = IF(bio IS NULL, VALUES(bio), bio),
      hiringCategory = IF(hiringCategory IS NULL, VALUES(hiringCategory), hiringCategory),
      enterprise = 1,
      enterpriseLogoUrl = IF(enterpriseLogoUrl IS NULL, VALUES(enterpriseLogoUrl), enterpriseLogoUrl),
      enterpriseDescription = IF(enterpriseDescription IS NULL, VALUES(enterpriseDescription), enterpriseDescription),
      bubbleId = IF(bubbleId IS NULL, VALUES(bubbleId), bubbleId)
  `);

  // Get the inserted/updated user ID
  const [[row]] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  const userId = row?.id;

  console.log(`✓ ${name} (${clientCompanyName || "no company"}) → DB id: ${userId}`);
  results.push({ email, name, clientCompanyName, bubbleId, userId, status: "seeded" });

  // Small delay to avoid rate limiting
  await new Promise((r) => setTimeout(r, 300));
}

console.log("\n=== Linking premium_jobs to enterprise clients ===");

// Now link premium_jobs.createdByUserId for each seeded client
for (const r of results) {
  if (r.status !== "seeded" || !r.userId || !r.bubbleId) continue;

  // Update premium_jobs where clientCompanyId or createdByBubbleId matches
  const [updateResult] = await db.query(
    `UPDATE premium_jobs SET createdByUserId = ? WHERE bubbleCreatedById = ? AND (createdByUserId IS NULL OR createdByUserId = 0)`,
    [r.userId, r.bubbleId]
  );

  if (updateResult.affectedRows > 0) {
    console.log(`  ${r.name}: linked ${updateResult.affectedRows} premium jobs`);
  } else {
    // Try matching by email in the jobs table
    const [updateResult2] = await db.query(
      `UPDATE premium_jobs SET createdByUserId = ? WHERE applyEmail = ? AND (createdByUserId IS NULL OR createdByUserId = 0)`,
      [r.userId, r.email]
    );
    if (updateResult2.affectedRows > 0) {
      console.log(`  ${r.name}: linked ${updateResult2.affectedRows} premium jobs (by email)`);
    } else {
      console.log(`  ${r.name}: no unlinked premium jobs found`);
    }
  }
}

console.log("\n=== Summary ===");
const seeded = results.filter((r) => r.status === "seeded");
const notFound = results.filter((r) => r.status === "not_found");
console.log(`Seeded: ${seeded.length} | Not found: ${notFound.length}`);
if (notFound.length > 0) {
  console.log("Not found:", notFound.map((r) => r.email).join(", "));
}

// Final job link counts
const [[jobStats]] = await db.query(
  "SELECT COUNT(*) as total, COUNT(createdByUserId) as linked FROM premium_jobs"
);
console.log(`Premium jobs: ${jobStats.total} total, ${jobStats.linked} linked to a user`);

await db.end();
