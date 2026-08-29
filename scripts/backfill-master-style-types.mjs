/**
 * Populates master_style_types from Bubble's live Master_Style_Type data
 * type — same gap as master_artist_types/master_service_types: the table
 * exists but was empty, so users.masterStyles raw IDs had nothing to
 * resolve against.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || "12172ddf5b3c42d8a4936d57afe0f029";
const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";

async function fetchAll(type) {
  const results = [];
  let cursor = 0;
  while (true) {
    const res = await fetch(`${BUBBLE_API_BASE}/${type}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Bubble API error ${res.status}`);
    const data = await res.json();
    results.push(...data.response.results);
    if (!data.response.remaining || data.response.remaining <= 0) break;
    cursor += 100;
  }
  return results;
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("Fetching Master_Style_Type from Bubble...");
const styles = await fetchAll("Master_Style_Type");
console.log(`  ${styles.length} entries`);

let inserted = 0;
for (const s of styles) {
  await conn.execute(
    `INSERT INTO master_style_types (bubbleId, name) VALUES (?, ?)`,
    [s._id, s["Style Name"] || ""]
  );
  inserted++;
}
console.log(`  Inserted ${inserted} rows into master_style_types`);

await conn.end();
