/**
 * Import Artist Experiences from Bubble CSV export.
 * CSV columns: Age Groups, Artist Type, Competitions, LINK NEW, Media Examples Links,
 *              Resume Title, Styles, User (email), Years of Experience,
 *              Creation Date, Modified Date, Slug, Creator, unique id
 */
import mysql from "mysql2/promise";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

const CSV_PATH = "/home/ubuntu/upload/export_All-ARTIST-EXPERIENCES--clean-view-_2026-04-16_02-28-26.csv";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to DB");

  // Read CSV
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

  let inserted = 0;
  let skipped = 0;
  let noUser = 0;

  for (const row of records) {
    const email = (row["User"] || "").toLowerCase().trim();
    const bubbleId = (row["unique id"] || "").trim();
    const artistUserId = emailToId[email];

    if (!artistUserId) {
      noUser++;
      continue;
    }

    // Parse styles into JSON array
    const stylesRaw = row["Styles"] || "";
    const styles = stylesRaw
      ? JSON.stringify(stylesRaw.split(",").map((s) => s.trim()).filter(Boolean))
      : null;

    // Parse age groups into JSON array
    const ageGroupsRaw = row["Age Groups"] || "";
    const ageGroups = ageGroupsRaw
      ? JSON.stringify(ageGroupsRaw.split(",").map((s) => s.trim()).filter(Boolean))
      : null;

    const artistType = (row["Artist Type"] || "").trim() || null;
    const yearsOfExperience = (row["Years of Experience "] || row["Years of Experience"] || "").trim() || null;
    const legacyResumeLink = (row["LINK NEW"] || "").trim() || null;
    const bubbleCreatedAt = row["Creation Date"] ? new Date(row["Creation Date"]) : null;
    const bubbleModifiedAt = row["Modified Date"] ? new Date(row["Modified Date"]) : null;

    try {
      await conn.execute(
        `INSERT IGNORE INTO artist_experiences
          (bubbleId, artistUserId, artistType, yearsOfExperience, ageGroups, styles, legacyResumeLink, bubbleCreatedAt, bubbleModifiedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bubbleId || null, artistUserId, artistType, yearsOfExperience, ageGroups, styles, legacyResumeLink, bubbleCreatedAt, bubbleModifiedAt]
      );
      inserted++;
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        skipped++;
      } else {
        console.error("Error inserting row:", e.message, row);
      }
    }

    if ((inserted + skipped + noUser) % 100 === 0) {
      process.stdout.write(`\r  Processed ${inserted + skipped + noUser} / ${records.length}`);
    }
  }

  console.log(`\n\n── Summary ──────────────────────────────────`);
  console.log(`Inserted  : ${inserted}`);
  console.log(`Skipped   : ${skipped} (already exist)`);
  console.log(`No user   : ${noUser} (email not found in DB)`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
