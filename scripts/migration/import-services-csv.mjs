/**
 * Import Artist Services from Bubble CSV export.
 * CSV columns: Email Opt-In, Fixed Rate, Hourly Rate, Master Artist Type,
 *              Master Service Type, Rate Flexible, Text Opt-In, User (email),
 *              Creation Date, Modified Date, Slug, Creator, unique id
 *
 * Maps to artist_service_categories table.
 * Groups by (artistUserId, masterArtistType) and collects sub-services.
 */
import mysql from "mysql2/promise";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

const CSV_PATH = "/home/ubuntu/upload/export_All-ARTIST-SERVICES-copied-modified_2026-04-16_02-28-43.csv";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to DB");

  const raw = readFileSync(CSV_PATH, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true });
  console.log(`Parsed ${records.length} rows from CSV`);

  // Build email → userId lookup
  const [userRows] = await conn.execute("SELECT id, email FROM users WHERE email IS NOT NULL");
  const emailToId = {};
  for (const u of userRows) {
    if (u.email) emailToId[u.email.toLowerCase().trim()] = u.id;
  }
  console.log(`Loaded ${Object.keys(emailToId).length} user email→id mappings`);

  // Group rows by (artistUserId, masterArtistType)
  // Each unique (artist, artistType) combo becomes one row in artist_service_categories
  // with subServices = JSON array of all the Master Service Types for that combo
  const grouped = {}; // key: `${artistUserId}::${masterArtistType}` → { artistUserId, name, subServices: Set, bubbleIds: [], emailOptIn, hourlyRate, fixedRate }

  let noUser = 0;

  for (const row of records) {
    const email = (row["User"] || "").toLowerCase().trim();
    const artistUserId = emailToId[email];
    if (!artistUserId) { noUser++; continue; }

    const masterArtistType = (row["Master Artist Type"] || "").trim();
    const masterServiceType = (row["Master Service Type"] || "").trim();
    const bubbleId = (row["unique id"] || "").trim();
    const emailOptIn = (row["Email Opt-In"] || "").toLowerCase() === "yes";
    const hourlyRate = parseFloat(row["Hourly Rate"] || "") || null;
    const fixedRate = parseFloat(row["Fixed Rate"] || "") || null;

    if (!masterArtistType) continue;

    const key = `${artistUserId}::${masterArtistType}`;
    if (!grouped[key]) {
      grouped[key] = {
        artistUserId,
        name: masterArtistType,
        subServices: new Set(),
        bubbleIds: [],
        emailOptIn,
        hourlyRate,
        fixedRate,
      };
    }
    if (masterServiceType) grouped[key].subServices.add(masterServiceType);
    if (bubbleId) grouped[key].bubbleIds.push(bubbleId);
  }

  console.log(`Grouped into ${Object.keys(grouped).length} service category rows`);

  let inserted = 0;
  let skipped = 0;
  let i = 0;

  for (const key of Object.keys(grouped)) {
    const g = grouped[key];
    const subServices = JSON.stringify([...g.subServices]);
    const bubbleId = g.bubbleIds[0] || null; // use first bubbleId as reference

    try {
      // Check if this artist already has this service category
      const [existing] = await conn.execute(
        "SELECT id FROM artist_service_categories WHERE artistUserId = ? AND name = ? LIMIT 1",
        [g.artistUserId, g.name]
      );
      if (existing.length > 0) {
        // Update subServices if we have more data
        await conn.execute(
          "UPDATE artist_service_categories SET subServices = ?, bubbleId = COALESCE(bubbleId, ?) WHERE id = ?",
          [subServices, bubbleId, existing[0].id]
        );
        skipped++;
      } else {
        await conn.execute(
          `INSERT INTO artist_service_categories
            (artistUserId, name, subServices, bubbleId, listOnProfile, jobEmailEnabled)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [g.artistUserId, g.name, subServices, bubbleId, g.emailOptIn ? 1 : 0]
        );
        inserted++;
      }
    } catch (e) {
      console.error("Error inserting row:", e.message, key);
    }

    i++;
    if (i % 50 === 0) process.stdout.write(`\r  Processed ${i} / ${Object.keys(grouped).length}`);
  }

  console.log(`\n\n── Summary ──────────────────────────────────`);
  console.log(`Inserted  : ${inserted}`);
  console.log(`Updated   : ${skipped} (already existed, updated subServices)`);
  console.log(`No user   : ${noUser} (email not found in DB)`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
