/**
 * check-bubble-media.mjs
 * Checks Bubble API for media photos and resume tables for Ramita
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
  // Ramita's Bubble ID from previous check
  const ramitaBubbleId = "1651044182000x687647157655376300";
  
  // Check the user record directly
  const userUrl = `${BUBBLE_BASE}/user/${ramitaBubbleId}`;
  console.log("Fetching Ramita's full Bubble user record...");
  const userData = await fetchJson(userUrl);
  const user = userData?.response;
  
  if (!user) {
    console.log("User not found");
    return;
  }
  
  // Show ALL keys
  console.log("\nAll Bubble user fields for Ramita:");
  Object.keys(user).sort().forEach(k => {
    const val = user[k];
    if (val !== null && val !== undefined && val !== "") {
      console.log(`  "${k}": ${JSON.stringify(val)?.slice(0, 150)}`);
    }
  });
  
  // Try to find media/photo tables
  console.log("\n\nChecking for 'Media' table...");
  try {
    const mediaUrl = `${BUBBLE_BASE}/media?constraints=${encodeURIComponent(JSON.stringify([{"key":"user","constraint_type":"equals","value":ramitaBubbleId}]))}&limit=5`;
    const mediaData = await fetchJson(mediaUrl);
    console.log("Media results:", JSON.stringify(mediaData?.response?.results?.slice(0, 2), null, 2));
  } catch (e) {
    console.log("Media table error:", e.message);
  }
  
  // Try to find resume table
  console.log("\nChecking for 'Resume' table...");
  try {
    const resumeUrl = `${BUBBLE_BASE}/resume?constraints=${encodeURIComponent(JSON.stringify([{"key":"user","constraint_type":"equals","value":ramitaBubbleId}]))}&limit=5`;
    const resumeData = await fetchJson(resumeUrl);
    console.log("Resume results:", JSON.stringify(resumeData?.response?.results?.slice(0, 2), null, 2));
  } catch (e) {
    console.log("Resume table error:", e.message);
  }
  
  // Try to find photo table
  console.log("\nChecking for 'Photo' table...");
  try {
    const photoUrl = `${BUBBLE_BASE}/photo?constraints=${encodeURIComponent(JSON.stringify([{"key":"user","constraint_type":"equals","value":ramitaBubbleId}]))}&limit=5`;
    const photoData = await fetchJson(photoUrl);
    console.log("Photo results:", JSON.stringify(photoData?.response?.results?.slice(0, 2), null, 2));
  } catch (e) {
    console.log("Photo table error:", e.message);
  }
  
  // Try artist-profile table
  console.log("\nChecking for 'artist-profile' table...");
  try {
    const apUrl = `${BUBBLE_BASE}/artist-profile?constraints=${encodeURIComponent(JSON.stringify([{"key":"user","constraint_type":"equals","value":ramitaBubbleId}]))}&limit=5`;
    const apData = await fetchJson(apUrl);
    console.log("artist-profile results:", JSON.stringify(apData?.response?.results?.slice(0, 2), null, 2));
  } catch (e) {
    console.log("artist-profile table error:", e.message);
  }
}

main().catch(console.error);
