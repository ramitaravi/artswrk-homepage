/**
 * Import users from Bubble CSV export into the Artswrk database.
 * Upserts on email: updates existing records, inserts new ones.
 * Run: node scripts/import-users-csv.mjs
 */

import { createConnection } from "mysql2/promise";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import * as dotenv from "dotenv";
dotenv.config();

const CSV_PATH = "/home/ubuntu/upload/export_All-Users_2026-04-16_00-20-54.csv";

// Fix Bubble CDN URLs: "//cdn.bubble.io/..." → "https://cdn.bubble.io/..."
function fixUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return "https:" + trimmed;
  if (trimmed.startsWith("http")) return trimmed;
  return null;
}

// Clean Instagram handle: strip full URLs, keep just the handle
function cleanInstagram(val) {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  // If it's a URL, extract the handle
  const match = trimmed.match(/instagram\.com\/([^/?#\s]+)/i);
  if (match) return match[1];
  // Strip leading @
  return trimmed.replace(/^@/, "");
}

// Parse CSV into rows
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
      .on("data", row => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

const db = await createConnection(process.env.DATABASE_URL);

console.log("📂 Parsing CSV...");
const rows = await parseCSV(CSV_PATH);
console.log(`✅ Parsed ${rows.length} rows`);

let inserted = 0;
let updated = 0;
let skipped = 0;
let errors = 0;

const BATCH_SIZE = 100;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);

  for (const row of batch) {
    const email = row["email"]?.trim()?.toLowerCase();
    if (!email) { skipped++; continue; }

    const bio = row["Bio"]?.trim() || null;
    const instagram = cleanInstagram(row["Instagram"]);
    const transportation = row["Artist Transportation Accesses"]?.trim() || null;
    const location = row["Location"]?.trim() || null;
    const priorityList = row["Priority List"]?.trim()?.toLowerCase() === "yes" ? 1 : 0;
    const profilePicture = fixUrl(row["Profile Picture"]);
    const pronouns = row["Pronouns"]?.trim() || null;

    try {
      // Check if user exists
      const [existing] = await db.execute(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );

      if (existing.length > 0) {
        // Update existing user — only overwrite fields that have values in CSV
        const updates = [];
        const values = [];

        if (bio) { updates.push("bio = ?"); values.push(bio); }
        if (instagram) { updates.push("instagram = ?"); values.push(instagram); }
        if (transportation) { updates.push("artistTransportationAccommodation = ?"); values.push(transportation); }
        if (location) { updates.push("location = ?"); values.push(location); }
        if (pronouns) { updates.push("pronouns = ?"); values.push(pronouns); }
        if (profilePicture) { updates.push("profilePicture = ?"); values.push(profilePicture); }
        updates.push("priorityList = ?"); values.push(priorityList ? 1 : 0);

        if (updates.length > 0) {
          values.push(existing[0].id);
          await db.execute(
            `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
            values
          );
        }
        updated++;
      } else {
        // Insert new user
        await db.execute(
          `INSERT INTO users (openId, email, bio, instagram, artistTransportationAccommodation, location, pronouns, profilePicture, priorityList, userRole, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Artist', NOW())`,
          [`bubble_csv_${email.replace(/[^a-z0-9]/gi, '_')}`, email, bio, instagram, transportation, location, pronouns, profilePicture, priorityList]
        );
        inserted++;
      }
    } catch (err) {
      console.error(`  ❌ Error on ${email}: ${err.message}`);
      errors++;
    }
  }

  const done = Math.min(i + BATCH_SIZE, rows.length);
  process.stdout.write(`\r  Progress: ${done}/${rows.length} (${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors} errors)`);
}

console.log("\n\n📊 Import Summary:");
console.log(`  ✅ Inserted: ${inserted} new users`);
console.log(`  🔄 Updated:  ${updated} existing users`);
console.log(`  ⏭️  Skipped:  ${skipped} (no email)`);
console.log(`  ❌ Errors:   ${errors}`);

const [total] = await db.execute("SELECT COUNT(*) as c FROM users");
console.log(`\n  Total users in DB: ${total[0].c}`);

await db.end();
console.log("\n✅ Done!");
