/**
 * get-ramita-portfolio.mjs
 * Gets the full Portfolio array from Bubble for Ramita's artist record
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
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
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
  const userData = await fetchJson(userUrl);
  const user = userData?.response;
  
  const portfolio = user["Portfolio"] || [];
  console.log("Portfolio photos:", portfolio.length);
  portfolio.forEach((url, i) => {
    console.log(`  ${i + 1}: ${fixUrl(url)}`);
  });
  
  // Update DB with all portfolio photos
  const mediaPhotos = JSON.stringify(portfolio.map(fixUrl).filter(Boolean));
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  await conn.execute(
    "UPDATE users SET mediaPhotos = ? WHERE id = 30001",
    [mediaPhotos]
  );
  console.log("\n✅ Updated mediaPhotos for Ramita");
  
  const [rows] = await conn.execute("SELECT mediaPhotos FROM users WHERE id = 30001");
  console.log("mediaPhotos:", rows[0].mediaPhotos);
  
  await conn.end();
}

main().catch(console.error);
