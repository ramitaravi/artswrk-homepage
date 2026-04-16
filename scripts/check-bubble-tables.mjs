/**
 * check-bubble-tables.mjs
 * Checks what Bubble tables have data for Ramita's artist profile
 * Ramita is a Client in Bubble, but the screenshot shows her artist profile
 * Let's check the artist-profile-new page data
 */
import https from "https";
import * as dotenv from "dotenv";
dotenv.config();

const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1/obj";

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

async function main() {
  // Ramita's Bubble ID
  const ramitaBubbleId = "1651044182000x687647157655376300";
  
  // The screenshot shows the artist-profile-new page which uses Ramita as a "Client" user
  // Let's check the Bubble Data API for tables that might have photos/resumes
  const tablesToCheck = [
    "media-file",
    "artist-media",
    "profile-media",
    "artist-resume",
    "file",
    "document",
    "attachment",
    "portfolio-item",
    "gallery",
    "image",
  ];
  
  for (const table of tablesToCheck) {
    try {
      const url = `${BUBBLE_BASE}/${table}?limit=1`;
      const data = await fetchJson(url);
      const count = data?.response?.count;
      if (count !== undefined && count > 0) {
        console.log(`✅ Table "${table}" exists with ${count} records`);
        // Show first record keys
        const first = data?.response?.results?.[0];
        if (first) {
          console.log(`   Keys: ${Object.keys(first).join(", ")}`);
        }
      } else if (count === 0) {
        console.log(`⚠️  Table "${table}" exists but is empty`);
      }
    } catch (e) {
      // Table doesn't exist or error
    }
  }
  
  // Also check the "user" table for an artist version of Ramita
  // The screenshot shows her as an artist with photos - maybe there's a different user record
  console.log("\nSearching for Ramita as artist user...");
  const artistUrl = `${BUBBLE_BASE}/user?constraints=${encodeURIComponent(JSON.stringify([
    {"key":"User Role","constraint_type":"equals","value":"Artist"},
    {"key":"First Name","constraint_type":"equals","value":"Ramita"}
  ]))}&limit=5`;
  
  try {
    const artistData = await fetchJson(artistUrl);
    const artists = artistData?.response?.results;
    if (artists && artists.length > 0) {
      console.log(`Found ${artists.length} artist user(s) named Ramita:`);
      artists.forEach(a => {
        const keys = Object.keys(a).filter(k => 
          k.toLowerCase().includes("photo") || k.toLowerCase().includes("resume") || 
          k.toLowerCase().includes("media") || k.toLowerCase().includes("image") ||
          k.toLowerCase().includes("picture") || k.toLowerCase().includes("pro")
        );
        console.log(`  ID: ${a._id}, Email: ${a["Email Address"]}`);
        keys.forEach(k => console.log(`    ${k}: ${JSON.stringify(a[k])?.slice(0, 200)}`));
      });
    } else {
      console.log("No artist users named Ramita found");
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
  
  // Check for the "artist-profile-new" page data type
  // The page URL was: /page?id=artswrk-new&tab=Data&name=artist-profile-new
  // Let's check if there's a user with Ramita's name that has artist data
  console.log("\nLooking for any user with Ramita and photos...");
  const allRamitaUrl = `${BUBBLE_BASE}/user?constraints=${encodeURIComponent(JSON.stringify([
    {"key":"First Name","constraint_type":"equals","value":"Ramita"}
  ]))}&limit=10`;
  
  try {
    const allData = await fetchJson(allRamitaUrl);
    const all = allData?.response?.results;
    console.log(`Found ${all?.length ?? 0} users named Ramita`);
    all?.forEach(u => {
      console.log(`  ID: ${u._id}, Role: ${u["User Role"]}, Email: ${u["Email Address"]}`);
      // Check for photo-related fields
      const photoKeys = Object.keys(u).filter(k => 
        k.toLowerCase().includes("photo") || k.toLowerCase().includes("media") || 
        k.toLowerCase().includes("resume") || k.toLowerCase().includes("picture")
      );
      photoKeys.forEach(k => {
        if (u[k]) console.log(`    ${k}: ${JSON.stringify(u[k])?.slice(0, 200)}`);
      });
    });
  } catch (e) {
    console.log("Error:", e.message);
  }
}

main().catch(console.error);
