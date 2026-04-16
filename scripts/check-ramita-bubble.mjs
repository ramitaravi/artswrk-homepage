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
        catch (e) { reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Request timeout")); });
  });
}

async function main() {
  // Search for Ramita by email
  const url = `${BUBBLE_BASE}/user?constraints=${encodeURIComponent(JSON.stringify([{"key":"email","constraint_type":"equals","value":"ramita@artswrk.com"}]))}`;
  const data = await fetchJson(url);
  let user = data?.response?.results?.[0];
  
  if (!user) {
    console.log("Not found by email, trying First Name...");
    const url2 = `${BUBBLE_BASE}/user?constraints=${encodeURIComponent(JSON.stringify([{"key":"First Name","constraint_type":"equals","value":"Ramita"}]))}`;
    const data2 = await fetchJson(url2);
    user = data2?.response?.results?.[0];
  }
  
  if (!user) {
    console.log("Ramita not found in Bubble");
    return;
  }
  
  console.log("Bubble ID:", user._id);
  
  // Show all keys with photo/resume/media related fields
  const relevantKeys = Object.keys(user).filter(k => 
    k.toLowerCase().includes("photo") || k.toLowerCase().includes("resume") || 
    k.toLowerCase().includes("media") || k.toLowerCase().includes("image") ||
    k.toLowerCase().includes("picture") || k.toLowerCase().includes("pro") ||
    k.toLowerCase().includes("profile")
  );
  console.log("\nRelevant keys:");
  relevantKeys.forEach(k => console.log(`  ${k}: ${JSON.stringify(user[k])}`));
  
  console.log("\nAll keys:");
  Object.keys(user).forEach(k => console.log(`  ${k}`));
}

main().catch(console.error);
