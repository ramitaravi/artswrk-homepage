/**
 * update-artist-profiles.mjs
 * Fetches extended profile fields from Bubble for all 194 artist users
 * and updates the users table with bio, pronouns, disciplines, services,
 * portfolio, social links, resumes, videos, etc.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import https from "https";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function fetchArtistById(bubbleId) {
  const url = `${BUBBLE_BASE}/user/${bubbleId}`;
  try {
    const data = await fetchJson(url);
    return data?.response ?? null;
  } catch (e) {
    return null;
  }
}

function parseLocation(locObj) {
  if (!locObj) return null;
  if (typeof locObj === "string") return locObj;
  const parts = [];
  if (locObj.city) parts.push(locObj.city);
  if (locObj.state) parts.push(locObj.state);
  if (locObj.country && locObj.country !== "United States") parts.push(locObj.country);
  return parts.join(", ") || null;
}

function safeJson(val) {
  if (!val) return null;
  if (Array.isArray(val)) return JSON.stringify(val);
  return JSON.stringify([val]);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get all artist users with their Bubble IDs
  const [artists] = await conn.execute(
    `SELECT id, bubbleId, firstName, lastName FROM users WHERE userRole = 'Artist' AND bubbleId IS NOT NULL`
  );

  console.log(`Found ${artists.length} artist users to update`);

  let updated = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const bubbleRecord = await fetchArtistById(artist.bubbleId);

    if (!bubbleRecord) {
      console.log(`  [${i + 1}/${artists.length}] SKIP ${artist.firstName} ${artist.lastName} — not found in Bubble`);
      failed++;
      continue;
    }

    // Map Bubble fields to our schema
    const location = parseLocation(bubbleRecord["Location"]);
    const bio = bubbleRecord["Bio"] || null;
    const pronouns = bubbleRecord["Pronouns"] || null;
    const portfolio = bubbleRecord["Portfolio"] || null;
    const website = bubbleRecord["Website"] || null;
    const instagram = bubbleRecord["Instagram"] || null;
    const tiktok = bubbleRecord["Tiktok"] || null;
    const youtube = bubbleRecord["YouTube"] || null;
    const artswrkPro = bubbleRecord["Artswrk PRO - Artists"] ? 1 : 0;
    const artswrkBasic = bubbleRecord["Artswrk Basic"] ? 1 : 0;
    const businessOrIndividual = bubbleRecord["Business or Individual?"] || null;
    const businessType = bubbleRecord["Business Type"] || null;
    const artistBusinessName = bubbleRecord["Artist Business Na..."] || bubbleRecord["Artist Business Name"] || null;
    const artistTransportationAccommodation = bubbleRecord["Artist Transportation Acc..."] || bubbleRecord["Artist Transportation Accommodation"] || null;
    const hiringCategory = bubbleRecord["Hiring Category"] || null;
    const optionAvailability = bubbleRecord["Option_availability"] || null;

    // JSON arrays
    const artistDisciplines = safeJson(bubbleRecord["Master Artist Types"]);
    const artistServices = safeJson(bubbleRecord["Artist Services"]);
    const masterArtistTypes = safeJson(bubbleRecord["Master Artist Types"]);
    const masterStyles = safeJson(bubbleRecord["List of Master Styles"]);
    const artistExperiences = safeJson(bubbleRecord["Artist Experiences"]);
    const resumes = safeJson(bubbleRecord["Resumes"]);
    const videos = safeJson(bubbleRecord["Videos"]);

    try {
      await conn.execute(
        `UPDATE users SET
          bio = ?,
          pronouns = ?,
          location = ?,
          portfolio = ?,
          website = ?,
          instagram = ?,
          tiktok = ?,
          youtube = ?,
          artswrkPro = ?,
          artswrkBasic = ?,
          businessOrIndividual = ?,
          businessType = ?,
          artistBusinessName = ?,
          artistTransportationAccommodation = ?,
          hiringCategory = ?,
          optionAvailability = ?,
          artistDisciplines = ?,
          artistServices = ?,
          masterArtistTypes = ?,
          masterStyles = ?,
          artistExperiences = ?,
          resumes = ?,
          videos = ?
        WHERE id = ?`,
        [
          bio, pronouns, location, portfolio, website, instagram, tiktok, youtube,
          artswrkPro, artswrkBasic, businessOrIndividual, businessType, artistBusinessName,
          artistTransportationAccommodation, hiringCategory, optionAvailability,
          artistDisciplines, artistServices, masterArtistTypes, masterStyles,
          artistExperiences, resumes, videos,
          artist.id,
        ]
      );
      updated++;
      if ((i + 1) % 20 === 0 || i === artists.length - 1) {
        console.log(`  [${i + 1}/${artists.length}] Updated ${updated} artists so far...`);
      }
    } catch (e) {
      errors.push({ id: artist.id, name: `${artist.firstName} ${artist.lastName}`, error: e.message });
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  await conn.end();

  console.log(`\n✅ Done! Updated: ${updated}, Failed: ${failed}`);
  if (errors.length > 0) {
    console.log("Errors:", errors.slice(0, 5));
  }
}

main().catch(console.error);
