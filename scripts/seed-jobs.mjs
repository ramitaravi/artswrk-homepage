/**
 * Fetches all Request (job) records from Bubble for Ferrari Dance Center NYC
 * and seeds them into the local jobs table.
 *
 * Nick's Bubble user ID: 1734405859649x711945883530600400
 * Run with: node scripts/seed-jobs.mjs
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-test/api/1.1/obj";
const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const NICK_BUBBLE_ID = "1659533883431x527826980339748400";

// Fetch all pages from Bubble for a given constraint
async function fetchAllBubbleRecords(dataType, constraints) {
  const allRecords = [];
  let cursor = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      limit: String(limit),
      cursor: String(cursor),
    });
    if (constraints) {
      params.set("constraints", JSON.stringify(constraints));
    }

    const url = `${BUBBLE_API_BASE}/${dataType}?${params.toString()}`;
    console.log(`Fetching ${dataType} cursor=${cursor}...`);

    let resp;
    try {
      resp = await fetch(url, {
        headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
      });
    } catch (err) {
      console.error("Network error:", err.message);
      // Wait and retry once
      await new Promise((r) => setTimeout(r, 3000));
      resp = await fetch(url, {
        headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
      });
    }

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`HTTP ${resp.status}: ${text}`);
      break;
    }

    const data = await resp.json();
    const results = data?.response?.results ?? [];
    const remaining = data?.response?.remaining ?? 0;

    allRecords.push(...results);
    console.log(
      `  Got ${results.length} records (remaining: ${remaining}, total so far: ${allRecords.length})`
    );

    if (remaining === 0 || results.length === 0) break;
    cursor += limit;

    // Small delay to avoid SSL connection resets
    await new Promise((r) => setTimeout(r, 500));
  }

  return allRecords;
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function safeInt(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

async function main() {
  console.log("=== Artswrk Job Seeder ===");
  console.log(`Fetching jobs for Bubble user: ${NICK_BUBBLE_ID}`);

  // Fetch jobs where the client is Nick
  const constraints = [
    { key: "Client", constraint_type: "equals", value: NICK_BUBBLE_ID },
  ];

  const bubbleJobs = await fetchAllBubbleRecords("Request", constraints);
  console.log(`\nTotal jobs fetched from Bubble: ${bubbleJobs.length}`);

  if (bubbleJobs.length === 0) {
    console.log("No jobs found. Exiting.");
    return;
  }

  // Print a sample to understand the structure
  console.log("\nSample job fields:", Object.keys(bubbleJobs[0]));
  console.log("Sample job:", JSON.stringify(bubbleJobs[0], null, 2));

  // Connect to DB
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("\nConnected to database.");

  // Get Nick's local user ID
  const [nickRows] = await conn.execute(
    "SELECT id FROM users WHERE bubbleId = ?",
    [NICK_BUBBLE_ID]
  );
  const nickLocalId = nickRows[0]?.id ?? null;
  console.log(`Nick's local user ID: ${nickLocalId}`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const job of bubbleJobs) {
    const bubbleId = job._id;

    // Check if already exists
    const [existing] = await conn.execute(
      "SELECT id FROM jobs WHERE bubbleId = ?",
      [bubbleId]
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Map Bubble fields to our schema
    // Bubble field names may vary — we handle both camelCase and underscore variants
    const description =
      job["Description"] ??
      job["description"] ??
      job["Request Description"] ??
      null;
    const slug = job["Slug"] ?? job["slug"] ?? null;
    const requestStatus =
      job["Request Status"] ?? job["request_status"] ?? job["Status"] ?? null;
    const status = job["status"] ?? null;
    const dateType =
      job["Date Type"] ?? job["date_type"] ?? job["dateType"] ?? null;

    // Dates
    const startDate = safeDate(
      job["Start Date"] ?? job["start_date"] ?? job["startDate"]
    );
    const endDate = safeDate(
      job["End Date"] ?? job["end_date"] ?? job["endDate"]
    );

    // Location — Bubble geographic address is an object
    const locationObj =
      job["Location"] ??
      job["location"] ??
      job["Address"] ??
      job["address"] ??
      null;
    let locationAddress = null;
    let locationLat = null;
    let locationLng = null;
    if (typeof locationObj === "string") {
      locationAddress = locationObj;
    } else if (locationObj && typeof locationObj === "object") {
      locationAddress =
        locationObj.address ?? locationObj.formatted_address ?? null;
      locationLat = locationObj.lat
        ? String(locationObj.lat)
        : locationObj.latitude
          ? String(locationObj.latitude)
          : null;
      locationLng = locationObj.lng
        ? String(locationObj.lng)
        : locationObj.longitude
          ? String(locationObj.longitude)
          : null;
    }

    // Rates
    const isHourly =
      job["Is Hourly"] ?? job["is_hourly"] ?? job["isHourly"] ?? true;
    const openRate =
      job["Open Rate"] ?? job["open_rate"] ?? job["openRate"] ?? false;
    const artistHourlyRate = safeInt(
      job["Artist Hourly Rate"] ??
        job["artist_hourly_rate"] ??
        job["artistHourlyRate"] ??
        job["Rate"] ??
        job["rate"]
    );
    const clientHourlyRate = safeInt(
      job["Client Hourly Rate"] ??
        job["client_hourly_rate"] ??
        job["clientHourlyRate"]
    );

    // Ages — may be an array
    const agesRaw =
      job["Ages"] ?? job["ages"] ?? job["Age Range"] ?? job["age_range"];
    const ages = agesRaw
      ? JSON.stringify(Array.isArray(agesRaw) ? agesRaw : [agesRaw])
      : null;

    // Flags
    const direct = job["Direct"] ?? job["direct"] ?? false;
    const sentToNetwork =
      job["Sent to Network"] ??
      job["sent_to_network"] ??
      job["sentToNetwork"] ??
      false;
    const transportation =
      job["Transportation"] ?? job["transportation"] ?? false;
    const converted = job["Converted"] ?? job["converted"] ?? false;

    // Service type
    const masterServiceTypeId =
      job["Master Service Type"] ??
      job["master_service_type"] ??
      job["masterServiceType"] ??
      null;

    // Client info
    const bubbleClientId = job["Client"] ?? NICK_BUBBLE_ID;
    const bubbleClientCompanyId =
      job["Client Company"] ?? job["client_company"] ?? null;
    const clientEmail = job["Client Email"] ?? job["client_email"] ?? null;

    // Bubble timestamps
    const bubbleCreatedAt = safeDate(job["Created Date"] ?? job["created_date"]);
    const bubbleModifiedAt = safeDate(
      job["Modified Date"] ?? job["modified_date"]
    );

    try {
      await conn.execute(
        `INSERT INTO jobs (
          bubbleId, clientUserId, bubbleClientId, bubbleClientCompanyId,
          description, slug,
          requestStatus, status,
          dateType, startDate, endDate,
          locationAddress, locationLat, locationLng,
          isHourly, openRate, artistHourlyRate, clientHourlyRate,
          ages,
          direct, sentToNetwork, transportation, converted,
          masterServiceTypeId,
          clientEmail,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bubbleId,
          nickLocalId,
          bubbleClientId,
          bubbleClientCompanyId,
          description,
          slug,
          requestStatus,
          status,
          dateType,
          startDate,
          endDate,
          locationAddress,
          locationLat,
          locationLng,
          isHourly ? 1 : 0,
          openRate ? 1 : 0,
          artistHourlyRate,
          clientHourlyRate,
          ages,
          direct ? 1 : 0,
          sentToNetwork ? 1 : 0,
          transportation ? 1 : 0,
          converted ? 1 : 0,
          masterServiceTypeId,
          clientEmail,
          bubbleCreatedAt,
          bubbleModifiedAt,
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`Error inserting job ${bubbleId}:`, err.message);
      errors++;
    }
  }

  await conn.end();

  console.log("\n=== Seeding Complete ===");
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
