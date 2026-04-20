/**
 * sync-all-jobs.mjs
 *
 * Fetches ALL job-request records from Bubble (across all clients) and upserts
 * them into the local `jobs` table. Safe to re-run — uses INSERT … ON DUPLICATE
 * KEY UPDATE keyed on bubbleId.
 *
 * Fetches jobs with statuses: Active, Confirmed, Submissions Paused
 * (change STATUSES below to include more)
 *
 * Run with:
 *   node scripts/sync-all-jobs.mjs
 *
 * Env vars required (in .env):
 *   DATABASE_URL   — mysql connection string
 *   BUBBLE_API_KEY — Bearer token from Bubble Settings → API
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;
const STATUSES = ["Active", "Confirmed", "Submissions Paused"];

if (!BUBBLE_API_KEY) {
  console.error("ERROR: BUBBLE_API_KEY is not set in .env");
  process.exit(1);
}

// ── Bubble fetch helpers ──────────────────────────────────────────────────────

async function fetchBubblePage(dataType, constraints, cursor, limit = 100) {
  const params = new URLSearchParams({
    limit: String(limit),
    cursor: String(cursor),
    sort_field: "Created Date",
    descending: "true",
  });
  if (constraints) params.set("constraints", JSON.stringify(constraints));

  const url = `${BUBBLE_API_BASE}/${dataType}?${params}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Bubble API ${resp.status} for ${url}: ${text}`);
  }
  return resp.json();
}

async function fetchAllPages(dataType, constraints) {
  const all = [];
  let cursor = 0;
  const limit = 100;

  while (true) {
    console.log(`  Fetching ${dataType} cursor=${cursor}…`);
    let data;
    try {
      data = await fetchBubblePage(dataType, constraints, cursor, limit);
    } catch (err) {
      console.error("  Fetch error:", err.message, "— retrying in 3s…");
      await sleep(3000);
      data = await fetchBubblePage(dataType, constraints, cursor, limit);
    }

    const results = data?.response?.results ?? [];
    const remaining = data?.response?.remaining ?? 0;
    all.push(...results);
    console.log(`  Got ${results.length} (remaining: ${remaining}, total: ${all.length})`);

    if (remaining === 0 || results.length === 0) break;
    cursor += limit;
    await sleep(400); // be nice to Bubble
  }
  return all;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Field mappers ─────────────────────────────────────────────────────────────

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

function mapJob(job) {
  const description =
    job["Description"] ?? job["description"] ?? job["Request Description"] ?? null;

  const slug = job["Slug"] ?? job["slug"] ?? null;

  const requestStatus =
    job["Request status"] ??
    job["Request Status"] ??
    job["request_status"] ??
    job["Status"] ??
    null;

  const status = job["status"] ?? null;

  const dateType =
    job["Date Type"] ?? job["date_type"] ?? job["dateType"] ?? null;

  const startDate = safeDate(job["Start date"] ?? job["Start Date"] ?? job["start_date"]);
  const endDate = safeDate(job["End date"] ?? job["End Date"] ?? job["end_date"]);

  // Location — Bubble geographic address can be an object or string
  const locationObj =
    job["Location"] ?? job["location"] ?? job["Address"] ?? job["address"] ?? null;
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

  const isHourly = job["Is Hourly"] ?? job["is_hourly"] ?? job["isHourly"] ?? true;
  const openRate = job["Open Rate"] ?? job["open_rate"] ?? job["openRate"] ?? false;
  const artistHourlyRate = safeInt(
    job["Artist hourly rate"] ??
    job["Artist Hourly Rate"] ??
    job["artist_hourly_rate"] ??
    job["Rate"] ??
    job["rate"]
  );
  const clientHourlyRate = safeInt(
    job["Client hourly rate"] ??
    job["Client Hourly Rate"] ??
    job["client_hourly_rate"]
  );

  const agesRaw = job["Ages"] ?? job["ages"] ?? job["Age Range"] ?? job["age_range"];
  const ages = agesRaw
    ? JSON.stringify(Array.isArray(agesRaw) ? agesRaw : [agesRaw])
    : null;

  const direct = job["Direct"] ?? job["direct"] ?? false;
  const sentToNetwork = job["Sent to Network"] ?? job["sent_to_network"] ?? false;
  const transportation = job["Transportation"] ?? job["transportation"] ?? false;
  const converted = job["Converted"] ?? job["converted"] ?? false;

  const masterServiceTypeId =
    job["Master Service Type"] ??
    job["master_service_type"] ??
    job["masterServiceType"] ??
    null;

  // Bubble stores the client as a User ID reference
  const bubbleClientId = job["Client"] ?? job["client"] ?? null;
  const bubbleClientCompanyId =
    job["Client Company"] ?? job["client_company"] ?? null;
  const clientEmail = job["Client Email"] ?? job["client_email"] ?? null;

  const bubbleCreatedAt = safeDate(job["Created Date"] ?? job["created_date"]);
  const bubbleModifiedAt = safeDate(job["Modified Date"] ?? job["modified_date"]);

  return {
    bubbleId: job._id,
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
    isHourly: isHourly ? 1 : 0,
    openRate: openRate ? 1 : 0,
    artistHourlyRate,
    clientHourlyRate,
    ages,
    direct: direct ? 1 : 0,
    sentToNetwork: sentToNetwork ? 1 : 0,
    transportation: transportation ? 1 : 0,
    converted: converted ? 1 : 0,
    masterServiceTypeId,
    clientEmail,
    bubbleCreatedAt,
    bubbleModifiedAt,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Artswrk Job Sync ===");
  console.log(`Statuses: ${STATUSES.join(", ")}`);

  // Connect to DB
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database.\n");

  // Build a lookup map: bubbleId → local user ID
  console.log("Loading user bubble ID map…");
  const [userRows] = await conn.execute("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
  const userIdByBubbleId = new Map(userRows.map((r) => [r.bubbleId, r.id]));
  console.log(`Loaded ${userIdByBubbleId.size} users with Bubble IDs.\n`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Fetch jobs for each status separately (Bubble can't OR constraints)
  for (const status of STATUSES) {
    console.log(`\nFetching jobs with status: ${status}`);
    const constraints = [
      { key: "Request status", constraint_type: "equals", value: status },
    ];

    let bubbleJobs;
    try {
      bubbleJobs = await fetchAllPages("Request", constraints);
    } catch (err) {
      console.error(`Failed to fetch jobs for status ${status}:`, err.message);
      continue;
    }

    console.log(`\nUpserting ${bubbleJobs.length} jobs (status: ${status})…`);

    for (const raw of bubbleJobs) {
      const job = mapJob(raw);
      const clientUserId = job.bubbleClientId
        ? (userIdByBubbleId.get(job.bubbleClientId) ?? null)
        : null;

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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            clientUserId = VALUES(clientUserId),
            requestStatus = VALUES(requestStatus),
            status = VALUES(status),
            description = VALUES(description),
            dateType = VALUES(dateType),
            startDate = VALUES(startDate),
            endDate = VALUES(endDate),
            locationAddress = VALUES(locationAddress),
            locationLat = VALUES(locationLat),
            locationLng = VALUES(locationLng),
            isHourly = VALUES(isHourly),
            openRate = VALUES(openRate),
            artistHourlyRate = VALUES(artistHourlyRate),
            clientHourlyRate = VALUES(clientHourlyRate),
            direct = VALUES(direct),
            masterServiceTypeId = VALUES(masterServiceTypeId),
            bubbleModifiedAt = VALUES(bubbleModifiedAt)`,
          [
            job.bubbleId,
            clientUserId,
            job.bubbleClientId,
            job.bubbleClientCompanyId,
            job.description,
            job.slug,
            job.requestStatus,
            job.status,
            job.dateType,
            job.startDate,
            job.endDate,
            job.locationAddress,
            job.locationLat,
            job.locationLng,
            job.isHourly,
            job.openRate,
            job.artistHourlyRate,
            job.clientHourlyRate,
            job.ages,
            job.direct,
            job.sentToNetwork,
            job.transportation,
            job.converted,
            job.masterServiceTypeId,
            job.clientEmail,
            job.bubbleCreatedAt,
            job.bubbleModifiedAt,
          ]
        );

        // mysql2 returns affectedRows: 1 = insert, 2 = update
        totalInserted++;
      } catch (err) {
        console.error(`  Error upserting job ${job.bubbleId}:`, err.message);
        totalErrors++;
      }
    }
  }

  await conn.end();

  console.log("\n=== Sync Complete ===");
  console.log(`Upserted: ${totalInserted}`);
  console.log(`Errors:   ${totalErrors}`);
  console.log("\nThe /jobs page will now show live data from the DB.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
