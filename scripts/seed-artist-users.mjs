/**
 * seed-artist-users.mjs
 *
 * Fetches Bubble User records for every unique artist who has either:
 *   - applied as an interested artist (interested_artists.bubbleArtistId)
 *   - been booked (bookings.bubbleArtistId)
 * for Nick/Ferrari Dance Center, then upserts them into the users table
 * with userRole = 'Artist'.
 *
 * Run: node scripts/seed-artist-users.mjs
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const BUBBLE_BASE = "https://artswrk.com/version-test/api/1.1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (res.status === 429) {
          console.log(`  Rate limited, waiting 3s...`);
          await sleep(3000);
          continue;
        }
        if (res.status === 404) return null; // user not found
        throw new Error(`HTTP ${res.status}: ${url}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  Retry ${attempt}/${retries}: ${err.message}`);
      await sleep(1500 * attempt);
    }
  }
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function fixProfilePicture(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http")) return url;
  return `https://${url}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Collect all unique bubbleArtistIds from interested_artists + bookings
const [iaRows] = await db.execute(
  "SELECT DISTINCT bubbleArtistId FROM interested_artists WHERE bubbleArtistId IS NOT NULL"
);
const [bkRows] = await db.execute(
  "SELECT DISTINCT bubbleArtistId FROM bookings WHERE bubbleArtistId IS NOT NULL"
);

const allIds = new Set([
  ...iaRows.map((r) => r.bubbleArtistId),
  ...bkRows.map((r) => r.bubbleArtistId),
]);

console.log(`Found ${allIds.size} unique artist Bubble IDs to fetch.`);

// 2. Fetch each artist from Bubble and upsert into users table
let inserted = 0;
let updated = 0;
let skipped = 0;
let errors = 0;
const artistIds = [...allIds];

for (let i = 0; i < artistIds.length; i++) {
  const bubbleId = artistIds[i];
  if (i % 20 === 0) {
    console.log(`Progress: ${i}/${artistIds.length} (inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${errors})`);
  }

  try {
    const data = await fetchJson(`${BUBBLE_BASE}/obj/user/${bubbleId}`);
    if (!data) {
      skipped++;
      continue;
    }
    const u = data.response;

    // Build a synthetic openId from the Bubble ID (prefixed to avoid collisions)
    const syntheticOpenId = `bubble_artist_${bubbleId}`;

    // Extract location
    const loc = u["Location"];
    const locationAddress = loc?.address ?? null;
    const locationLat = loc?.lat != null ? String(loc.lat) : null;
    const locationLng = loc?.lng != null ? String(loc.lng) : null;

    // Extract artist types (store as JSON array of IDs for now)
    const masterArtistTypes = u["Master Artist Types"];
    const artistTypesJson = masterArtistTypes?.length
      ? JSON.stringify(masterArtistTypes)
      : null;

    // Profile picture — fix protocol-relative URLs
    const profilePicture = fixProfilePicture(u["Profile Picture"]);

    // Bio
    const bio = u["Bio"] ?? null;

    // Instagram
    const instagram = u["Instagram"] ?? null;

    // Availability
    const optionAvailability = u["Option_availability"] ?? null;

    // Onboarding
    const onboardingStep = u["Onboarding Step"] ?? 0;
    const userSignedUp = u["user_signed_up"] ?? false;
    const beta = u["BETA"] ?? false;

    // Pronouns
    const pronouns = u["Pronouns"] ?? null;

    // Phone
    const phoneNumber = u["Phone Number"] ?? null;

    // Slug
    const slug = u["Slug"] ?? null;

    // Dates
    const bubbleCreatedAt = parseDate(u["Created Date"]);
    const bubbleModifiedAt = parseDate(u["Modified Date"]);

    // Check if user already exists by bubbleId
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE bubbleId = ? LIMIT 1",
      [bubbleId]
    );

    if (existing.length > 0) {
      // Update existing record
      await db.execute(
        `UPDATE users SET
          firstName = ?, lastName = ?, name = ?, slug = ?,
          profilePicture = ?, phoneNumber = ?,
          userRole = 'Artist',
          optionAvailability = ?,
          onboardingStep = ?, userSignedUp = ?, beta = ?,
          bubbleCreatedAt = ?, bubbleModifiedAt = ?,
          updatedAt = NOW()
        WHERE bubbleId = ?`,
        [
          u["First Name"] ?? null,
          u["Last Name"] ?? null,
          u["Full Name"] ?? null,
          slug,
          profilePicture,
          phoneNumber,
          optionAvailability,
          onboardingStep,
          userSignedUp ? 1 : 0,
          beta ? 1 : 0,
          bubbleCreatedAt,
          bubbleModifiedAt,
          bubbleId,
        ]
      );
      updated++;
    } else {
      // Insert new record — openId must be unique, use synthetic one
      // email may be null for artists (Bubble doesn't expose it in public API)
      await db.execute(
        `INSERT INTO users (
          openId, bubbleId, role, userRole,
          firstName, lastName, name, slug,
          profilePicture, phoneNumber,
          optionAvailability,
          onboardingStep, userSignedUp, beta,
          bubbleCreatedAt, bubbleModifiedAt,
          createdAt, updatedAt, lastSignedIn
        ) VALUES (?, ?, 'user', 'Artist', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          syntheticOpenId,
          bubbleId,
          u["First Name"] ?? null,
          u["Last Name"] ?? null,
          u["Full Name"] ?? null,
          slug,
          profilePicture,
          phoneNumber,
          optionAvailability,
          onboardingStep,
          userSignedUp ? 1 : 0,
          beta ? 1 : 0,
          bubbleCreatedAt,
          bubbleModifiedAt,
        ]
      );
      inserted++;
    }

    // 3. Back-fill artistUserId FK in interested_artists and bookings
    const [newUser] = await db.execute(
      "SELECT id FROM users WHERE bubbleId = ? LIMIT 1",
      [bubbleId]
    );
    if (newUser.length > 0) {
      const userId = newUser[0].id;
      await db.execute(
        "UPDATE interested_artists SET artistUserId = ? WHERE bubbleArtistId = ? AND artistUserId IS NULL",
        [userId, bubbleId]
      );
      await db.execute(
        "UPDATE bookings SET artistUserId = ? WHERE bubbleArtistId = ? AND artistUserId IS NULL",
        [userId, bubbleId]
      );
    }

    // Small delay to avoid hammering the API
    await sleep(80);
  } catch (err) {
    console.error(`  ERROR for ${bubbleId}: ${err.message}`);
    errors++;
  }
}

console.log(`\n✅ Done!`);
console.log(`   Inserted: ${inserted}`);
console.log(`   Updated:  ${updated}`);
console.log(`   Skipped:  ${skipped}`);
console.log(`   Errors:   ${errors}`);
console.log(`   Total:    ${artistIds.length}`);

await db.end();
