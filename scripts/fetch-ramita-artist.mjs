/**
 * fetch-ramita-artist.mjs
 * Fetches Ramita's full artist profile from Bubble and updates the DB
 */
import https from "https";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_CDN = "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.slice(0, 500)}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Request timeout")); });
  });
}

function fixUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BUBBLE_CDN}${url}`;
  return url;
}

async function main() {
  const ramitaArtistId = "1653048240176x373600625789868540";
  
  // Fetch the full artist user record
  const userUrl = `${BUBBLE_BASE}/user/${ramitaArtistId}`;
  console.log("Fetching Ramita's artist record...");
  const userData = await fetchJson(userUrl);
  const user = userData?.response;
  
  if (!user) {
    console.log("Not found");
    return;
  }
  
  console.log("\nAll non-empty fields:");
  Object.keys(user).sort().forEach(k => {
    const val = user[k];
    if (val !== null && val !== undefined && val !== "" && val !== false) {
      console.log(`  "${k}": ${JSON.stringify(val)?.slice(0, 200)}`);
    }
  });
  
  // Check the resume object
  const resumeIds = user["Resumes"] || [];
  console.log("\nResume IDs:", resumeIds);
  
  for (const resumeId of resumeIds) {
    try {
      const resumeUrl = `${BUBBLE_BASE}/resume/${resumeId}`;
      const resumeData = await fetchJson(resumeUrl);
      const resume = resumeData?.response;
      console.log("\nResume record:", JSON.stringify(resume, null, 2));
    } catch (e) {
      console.log("Resume fetch error:", e.message);
    }
  }
  
  // Check media photos
  const mediaPhotoIds = user["Media Photos"] || user["Photos"] || user["media-photos"] || [];
  console.log("\nMedia Photo IDs:", mediaPhotoIds);
  
  // Check profile picture
  const profilePic = fixUrl(user["Profile Picture"]);
  console.log("\nProfile Picture URL:", profilePic);
  
  // Now update the DB for Ramita (id=30001)
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Build update data
  const artswrkPro = user["Artswrk PRO - Artists"] ? 1 : 0;
  const pronouns = user["Pronouns"] || null;
  const bio = user["Bio"] || null;
  const location = user["Location"] ? 
    (typeof user["Location"] === "object" ? 
      [user["Location"].city, user["Location"].state].filter(Boolean).join(", ") :
      user["Location"]) : null;
  const instagram = user["Instagram"] || null;
  const portfolio = user["Portfolio"] || null;
  const website = user["Website"] || null;
  
  // Build masterArtistTypes from Bubble
  const masterTypes = user["Master Artist Types"] || [];
  const masterArtistTypes = Array.isArray(masterTypes) ? JSON.stringify(masterTypes) : null;
  
  const artistServices = user["Artist Services"] ? JSON.stringify(
    Array.isArray(user["Artist Services"]) ? user["Artist Services"] : [user["Artist Services"]]
  ) : null;
  
  console.log("\nUpdating DB for Ramita (id=30001)...");
  await conn.execute(
    `UPDATE users SET 
      artswrkPro = ?,
      pronouns = ?,
      bio = ?,
      location = ?,
      instagram = ?,
      portfolio = ?,
      website = ?,
      masterArtistTypes = ?,
      artistServices = ?,
      profilePicture = ?
    WHERE id = 30001`,
    [
      artswrkPro,
      pronouns,
      bio,
      location,
      instagram,
      portfolio,
      website,
      masterArtistTypes,
      artistServices,
      profilePic || null,
    ]
  );
  
  console.log("✅ Updated Ramita's profile in DB");
  
  // Verify
  const [rows] = await conn.execute(
    "SELECT id, firstName, artswrkPro, pronouns, masterArtistTypes, profilePicture FROM users WHERE id = 30001"
  );
  console.log("\nVerification:", JSON.stringify(rows[0], null, 2));
  
  await conn.end();
}

main().catch(console.error);
