/**
 * Artswrk Unified Bubble→DB Sync Script
 *
 * Usage:
 *   node scripts/sync-all.mjs --mode=frequent   # incremental sync (modified in last 20 min): jobs, premium_jobs, interested_artists, bookings, conversations, payments, messages
 *   node scripts/sync-all.mjs --mode=daily       # full sync of ALL tables including users (no time filter)
 *
 * Environment variables required:
 *   DATABASE_URL   — MySQL connection string
 *   BUBBLE_API_KEY — Bubble Data API key
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import sgMail from "@sendgrid/mail";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || "12172ddf5b3c42d8a4936d57afe0f029";
const mode = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "frequent";

if (!["frequent", "daily"].includes(mode)) {
  console.error(`Unknown mode: ${mode}. Use --mode=frequent or --mode=daily`);
  process.exit(1);
}

// ── Bubble fetch helpers ──────────────────────────────────────────────────────

async function fetchAllPages(dataType, constraints = []) {
  const all = [];
  let cursor = 0;
  while (true) {
    const params = new URLSearchParams({
      limit: "100",
      cursor: String(cursor),
    });
    if (constraints.length > 0) {
      params.set("constraints", JSON.stringify(constraints));
    }
    const url = `${BUBBLE_API_BASE}/${encodeURIComponent(dataType)}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Bubble API error ${res.status} for ${dataType}: ${await res.text()}`);
    }
    const data = await res.json();
    const results = data?.response?.results ?? [];
    all.push(...results);
    const remaining = data?.response?.remaining ?? 0;
    process.stdout.write(`\r  [${dataType}] fetched ${all.length}, remaining ${remaining}   `);
    if (remaining === 0) break;
    cursor += results.length;
    await new Promise((r) => setTimeout(r, 150));
  }
  process.stdout.write("\n");
  return all;
}

// ── Safe helpers ──────────────────────────────────────────────────────────────

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function safeInt(val) {
  if (val == null) return null;
  const n = Math.round(Number(val));
  return isNaN(n) ? null : n;
}

// ── Sync: Jobs ────────────────────────────────────────────────────────────────

async function syncJobs(conn, userMap, modifiedSince = null) {
  const STATUSES = ["Active", "Confirmed", "Submissions Paused"];
  let upserted = 0, errors = 0;

  for (const status of STATUSES) {
    const constraints = [
      { key: "Request status", constraint_type: "equals", value: status },
    ];
    if (modifiedSince) {
      constraints.push({ key: "Modified Date", constraint_type: "greater than", value: modifiedSince });
    }
    const records = await fetchAllPages("Request", constraints);
    for (const r of records) {
      const clientUserId = r["Created By"] ? (userMap.get(r["Created By"]) ?? null) : null;
      const loc = r.Location ?? {};
      const startDate = safeDate(r["Start date"] ?? r["start date"]);
      const endDate = safeDate(r["End date"] ?? r["end date"]);
      const bubbleCreatedAt = safeDate(r["Created Date"]);
      const bubbleModifiedAt = safeDate(r["Modified Date"]);

      // Resolve masterServiceTypeId from DB if available
      let masterServiceTypeId = null;
      if (r["Master Service Type"]) {
        const [rows] = await conn.execute(
          "SELECT id FROM master_service_types WHERE bubbleId = ? LIMIT 1",
          [r["Master Service Type"]]
        );
        masterServiceTypeId = rows[0]?.id ?? null;
      }

      try {
        await conn.execute(
          `INSERT INTO jobs (
            bubbleId, clientUserId, bubbleClientId, bubbleClientCompanyId,
            description, slug, requestStatus, status,
            dateType, startDate, endDate,
            locationAddress, locationLat, locationLng,
            isHourly, openRate, artistHourlyRate, clientHourlyRate,
            ages, direct, sentToNetwork, transportation, converted,
            masterServiceTypeId, clientEmail,
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
            r._id,
            clientUserId,
            r["Created By"] ?? null,
            r["Client-Company"] ?? null,
            r.Description ?? r.description ?? null,
            r.Slug ?? r.slug ?? null,
            r["Request status"] ?? status,
            status,
            r["Date type"] ?? r["date type"] ?? null,
            startDate,
            endDate,
            loc.address ?? null,
            loc.lat != null ? String(loc.lat) : null,
            loc.lng != null ? String(loc.lng) : null,
            r["is hourly?"] || r["Is Hourly?"] ? 1 : 0,
            r["open rate?"] || r["Open Rate?"] ? 1 : 0,
            r["Artist Hourly Rate"] ?? r["artist hourly rate"] ?? null,
            r["Client Hourly Rate"] ?? r["client hourly rate"] ?? null,
            r.Ages ?? r.ages ?? null,
            r["direct?"] || r["Direct?"] ? 1 : 0,
            r["sent to network?"] || r["Sent to Network?"] ? 1 : 0,
            r["transportation?"] || r["Transportation?"] ? 1 : 0,
            r["converted?"] || r["Converted?"] ? 1 : 0,
            masterServiceTypeId,
            r["client email"] ?? r["Client Email"] ?? null,
            bubbleCreatedAt,
            bubbleModifiedAt,
          ]
        );
        upserted++;
      } catch (err) {
        console.error(`  [jobs] Error upserting ${r._id}: ${err.message}`);
        errors++;
      }
    }
  }
  return { upserted, errors };
}

// ── Sync: Premium Jobs ────────────────────────────────────────────────────────

async function syncPremiumJobs(conn, userMap, modifiedSince = null) {
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("premium_jobs", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    const createdByLocalId = r["Created By"] ? (userMap.get(r["Created By"]) ?? null) : null;
    const logo = r.logo ? (r.logo.startsWith("//") ? `https:${r.logo}` : r.logo) : null;
    // Location can be a plain string OR a Bubble geo-object {address, lat, lng}
    const locationRaw = r.Location ?? null;
    const location = locationRaw && typeof locationRaw === "object"
      ? (locationRaw.address ?? null)
      : locationRaw;
    try {
      await conn.execute(
        `INSERT INTO premium_jobs (
          bubbleId, company, logo, createdByUserId, bubbleCreatedById, bubbleClientCompanyId,
          serviceType, category, description, budget, location, tag, slug,
          applyDirect, applyEmail, applyLink, workFromAnywhere, featured, status,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company=VALUES(company), logo=VALUES(logo),
          createdByUserId=VALUES(createdByUserId),
          bubbleClientCompanyId=VALUES(bubbleClientCompanyId),
          serviceType=VALUES(serviceType), category=VALUES(category),
          description=VALUES(description), budget=VALUES(budget),
          location=VALUES(location), tag=VALUES(tag), slug=VALUES(slug),
          applyDirect=VALUES(applyDirect), applyEmail=VALUES(applyEmail),
          applyLink=VALUES(applyLink), workFromAnywhere=VALUES(workFromAnywhere),
          featured=VALUES(featured), status=VALUES(status),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id, r.Company ?? null, logo,
          createdByLocalId, r["Created By"] ?? null, r["Client-Company"] ?? null,
          r["Service Type"] ?? null, r.Category ?? null, r.Description ?? null,
          r.Budget ?? null, location, r.Tag ?? null, r.Slug ?? null,
          r["Apply Direct?"] ? 1 : 0, r.email ?? null, r.link ?? null,
          r["Work From Anywhere?"] ? 1 : 0, r.featured ? 1 : 0, r.Status ?? "Active",
          safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [premium_jobs] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Sync: Interested Artists ──────────────────────────────────────────────────

async function syncInterestedArtists(conn, userMap, jobMap, modifiedSince = null) {
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("interested artists", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    const jobId = r.request ? (jobMap.get(r.request) ?? null) : null;
    const artistUserId = r.artist ? (userMap.get(r.artist) ?? null) : null;
    const clientUserId = r.client ? (userMap.get(r.client) ?? null) : null;

    try {
      await conn.execute(
        `INSERT INTO interested_artists (
          bubbleId, jobId, bubbleRequestId,
          artistUserId, bubbleArtistId,
          clientUserId, bubbleClientId,
          bubbleServiceId, bubbleBookingId,
          status, converted,
          isHourlyRate, artistHourlyRate, clientHourlyRate,
          artistFlatRate, clientFlatRate, totalHours,
          startDate, endDate,
          resumeLink, message,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          jobId=VALUES(jobId),
          artistUserId=VALUES(artistUserId),
          clientUserId=VALUES(clientUserId),
          status=VALUES(status),
          converted=VALUES(converted),
          isHourlyRate=VALUES(isHourlyRate),
          artistHourlyRate=VALUES(artistHourlyRate),
          clientHourlyRate=VALUES(clientHourlyRate),
          artistFlatRate=VALUES(artistFlatRate),
          clientFlatRate=VALUES(clientFlatRate),
          totalHours=VALUES(totalHours),
          startDate=VALUES(startDate),
          endDate=VALUES(endDate),
          resumeLink=VALUES(resumeLink),
          message=VALUES(message),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id, jobId, r.request ?? null,
          artistUserId, r.artist ?? null,
          clientUserId, r.client ?? null,
          r.service ?? null, r.booking ?? null,
          r.status_interestedartists ?? null, r["converted?"] ? 1 : 0,
          r["is hourly rate?"] ? 1 : 0,
          r["artist hourly rate"] ?? null, r["client hourly rate"] ?? null,
          r["artist flat rate"] ?? null, r["client flat rate"] ?? null,
          r["total hours"] ?? null,
          safeDate(r["start date"]), safeDate(r["end date"]),
          r.link ?? null, r.message ?? null,
          safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [interested_artists] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Sync: Bookings ────────────────────────────────────────────────────────────

async function syncBookings(conn, userMap, jobMap, iaMap, modifiedSince = null) {
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("booking", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    if (r["deleted?"]) continue;
    const jobId = r.Request ? (jobMap.get(r.Request) ?? null) : null;
    const interestedArtistId = r["Interested Artist"] ? (iaMap.get(r["Interested Artist"]) ?? null) : null;
    const clientUserId = r.Client ? (userMap.get(r.Client) ?? null) : null;
    const artistUserId = r.Artist ? (userMap.get(r.Artist) ?? null) : null;
    const loc = r.Location ?? {};

    try {
      await conn.execute(
        `INSERT INTO bookings (
          bubbleId, jobId, bubbleRequestId,
          interestedArtistId, bubbleInterestedArtistId,
          clientUserId, bubbleClientId,
          artistUserId, bubbleArtistId,
          bookingStatus, paymentStatus,
          clientRate, artistRate,
          totalClientRate, totalArtistRate,
          grossProfit, stripeFee, postFeeRevenue,
          hours, externalPayment,
          startDate, endDate,
          locationAddress, locationLat, locationLng,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          jobId=VALUES(jobId),
          interestedArtistId=VALUES(interestedArtistId),
          clientUserId=VALUES(clientUserId),
          artistUserId=VALUES(artistUserId),
          bookingStatus=VALUES(bookingStatus),
          paymentStatus=VALUES(paymentStatus),
          clientRate=VALUES(clientRate),
          artistRate=VALUES(artistRate),
          totalClientRate=VALUES(totalClientRate),
          totalArtistRate=VALUES(totalArtistRate),
          grossProfit=VALUES(grossProfit),
          stripeFee=VALUES(stripeFee),
          postFeeRevenue=VALUES(postFeeRevenue),
          hours=VALUES(hours),
          externalPayment=VALUES(externalPayment),
          startDate=VALUES(startDate),
          endDate=VALUES(endDate),
          locationAddress=VALUES(locationAddress),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id, jobId, r.Request ?? null,
          interestedArtistId, r["Interested Artist"] ?? null,
          clientUserId, r.Client ?? null,
          artistUserId, r.Artist ?? null,
          r._Option_Booking_Status ?? null, r._Option_Payment_Status ?? null,
          safeInt(r["Client Rate"]), safeInt(r["Artist Rate"]),
          safeInt(r["Total Client Rate (Client Rate + Reimbursements)"]),
          safeInt(r["Total Artist Rate (Artist Rate + Reimbursements)"]),
          safeInt(r["Gross Profit"]), safeInt(r["stripe fee"]), safeInt(r["Post Fee Revenue"]),
          safeInt(r.hours), r["external payment?"] ? 1 : 0,
          safeDate(r["Start date"]), safeDate(r["End date"]),
          loc.address ?? null,
          loc.lat != null ? String(loc.lat) : null,
          loc.lng != null ? String(loc.lng) : null,
          safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [bookings] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Sync: Payments ────────────────────────────────────────────────────────────

async function syncPayments(conn, userMap, bookingMap, modifiedSince = null) {
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("payment", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    const bookingId = r.Booking ? (bookingMap.get(r.Booking) ?? null) : null;
    const clientUserId = r.Client ? (userMap.get(r.Client) ?? null) : null;

    try {
      await conn.execute(
        `INSERT INTO payments (
          bubbleId, bookingId, bubbleBookingId, clientUserId,
          stripeId, stripeStatus, status,
          stripeAmount, stripeApplicationFee, stripeApplicationFeeAmount,
          stripeCardBrand, stripeCardLast4, stripeCardName,
          stripeDescription, stripeReceiptUrl, stripeRefundUrl,
          paymentDate, bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          bookingId=VALUES(bookingId),
          clientUserId=VALUES(clientUserId),
          stripeId=VALUES(stripeId),
          stripeStatus=VALUES(stripeStatus),
          status=VALUES(status),
          stripeAmount=VALUES(stripeAmount),
          stripeApplicationFeeAmount=VALUES(stripeApplicationFeeAmount),
          stripeReceiptUrl=VALUES(stripeReceiptUrl),
          paymentDate=VALUES(paymentDate),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id, bookingId, r.Booking ?? null, clientUserId,
          r["Stripe ID"] ?? null, r["Stripe Status"] ?? null, r.Status ?? null,
          r["Stripe Amount"] ?? null, r["Stripe Application Fee"] ?? null,
          r["Stripe Application Fee Amount"] ? safeInt(r["Stripe Application Fee Amount"]) : null,
          r["Stripe Card Brand"] ?? null, r["Stripe Card Last 4"] ?? null, r["Stripe Card Name"] ?? null,
          r["Stripe Description"] ?? null, r["Stripe Receipt URL"] ?? null, r["Stripe Refund URL"] ?? null,
          safeDate(r.Date), safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [payments] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Sync: Messages ────────────────────────────────────────────────────────────

async function syncMessages(conn, userMap, convoMap, modifiedSince = null) {
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("message", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    const conversationId = r.conversation ? (convoMap.get(r.conversation) ?? null) : null;
    const senderUserId = r["sent by"] ? (userMap.get(r["sent by"]) ?? null) : null;

    try {
      await conn.execute(
        `INSERT INTO messages (
          bubbleId, conversationId, bubbleConversationId,
          senderUserId, bubbleSentById,
          content, isSystem,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          conversationId=VALUES(conversationId),
          senderUserId=VALUES(senderUserId),
          content=VALUES(content),
          isSystem=VALUES(isSystem),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id, conversationId, r.conversation ?? null,
          senderUserId, r["sent by"] ?? null,
          r.message ?? r.content ?? null,
          r["is system?"] ? 1 : 0,
          safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [messages] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Sync: Conversations (needed for message FK) ───────────────────────────────

async function syncConversations(conn, userMap, modifiedSince = null) {
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("conversation", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    const clientUserId = r.client ? (userMap.get(r.client) ?? null) : null;
    const artistUserId = r.artist ? (userMap.get(r.artist) ?? null) : null;
    const unreadCount = Array.isArray(r["unread messages"]) ? r["unread messages"].length : 0;

    try {
      await conn.execute(
        `INSERT INTO conversations (
          bubbleId, clientUserId, bubbleClientId,
          artistUserId, bubbleArtistId,
          bubbleLastMessageId, lastMessageDate, unreadCount,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          clientUserId=VALUES(clientUserId),
          artistUserId=VALUES(artistUserId),
          bubbleLastMessageId=VALUES(bubbleLastMessageId),
          lastMessageDate=VALUES(lastMessageDate),
          unreadCount=VALUES(unreadCount),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id, clientUserId, r.client ?? null,
          artistUserId, r.artist ?? null,
          r["last message"] ?? null,
          safeDate(r["last message date"]),
          unreadCount,
          safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [conversations] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Sync: Users (daily — new signups only) ────────────────────────────────────

async function syncUsers(conn, modifiedSince = null) {
  // modifiedSince=null → full sync (daily); modifiedSince set → incremental
  const constraints = modifiedSince
    ? [{ key: "Modified Date", constraint_type: "greater than", value: modifiedSince }]
    : [];
  const records = await fetchAllPages("user", constraints);
  let upserted = 0, errors = 0;

  for (const r of records) {
    const firstName = r["First Name"] ?? r.firstName ?? null;
    const lastName = r["Last Name"] ?? r.lastName ?? null;
    const name = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName ?? lastName ?? r.email ?? `bubble_${r._id}`;

    try {
      await conn.execute(
        `INSERT INTO users (
          openId, bubbleId, email, firstName, lastName, name,
          profilePicture, userRole, slug, location,
          artswrkPro, artswrkBasic, loginMethod,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email=COALESCE(VALUES(email), email),
          firstName=COALESCE(VALUES(firstName), firstName),
          lastName=COALESCE(VALUES(lastName), lastName),
          name=COALESCE(VALUES(name), name),
          profilePicture=COALESCE(VALUES(profilePicture), profilePicture),
          userRole=COALESCE(VALUES(userRole), userRole),
          slug=COALESCE(VALUES(slug), slug),
          location=COALESCE(VALUES(location), location),
          artswrkPro=VALUES(artswrkPro),
          artswrkBasic=VALUES(artswrkBasic),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          `bubble_${r._id}`, r._id,
          r.email ?? r.Email ?? null,
          firstName, lastName, name,
          r["Profile Picture"] ?? null,
          r["User Role"] ?? r.userRole ?? "Artist",
          r.Slug ?? r.slug ?? null,
          r.Location ?? r.location ?? null,
          r["Artswrk PRO?"] ? 1 : 0,
          r["Artswrk Basic?"] ? 1 : 0,
          "bubble",
          safeDate(r["Created Date"]), safeDate(r["Modified Date"]),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  [users] Error upserting ${r._id}: ${err.message}`);
      errors++;
    }
  }
  return { upserted, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n=== Artswrk Sync [mode=${mode}] ===`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database.\n");

  // Log this run to sync_runs
  const [runResult] = await conn.execute(
    "INSERT INTO sync_runs (mode, status, startedAt) VALUES (?, 'running', NOW())",
    [mode]
  );
  const runId = runResult.insertId;

  const summary = {};
  let overallError = null;

  // For frequent mode: only fetch records modified in the last 20 minutes (5 min overlap buffer)
  // For daily mode: no time filter — full sync of everything
  const modifiedSince = mode === "frequent"
    ? new Date(Date.now() - 20 * 60 * 1000).toISOString()
    : null;

  if (modifiedSince) {
    console.log(`Incremental sync — fetching records modified since: ${modifiedSince}\n`);
  } else {
    console.log("Full sync — fetching all records (no time filter)\n");
  }

  try {
    // Build lookup maps (needed for FK resolution in both modes)
    console.log("Building lookup maps...");
    const [userRows] = await conn.execute("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
    const userMap = new Map(userRows.map((r) => [r.bubbleId, r.id]));
    console.log(`  Users: ${userMap.size}`);

    const [jobRows] = await conn.execute("SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
    const jobMap = new Map(jobRows.map((r) => [r.bubbleId, r.id]));
    console.log(`  Jobs: ${jobMap.size}`);

    const [iaRows] = await conn.execute("SELECT id, bubbleId FROM interested_artists WHERE bubbleId IS NOT NULL");
    const iaMap = new Map(iaRows.map((r) => [r.bubbleId, r.id]));
    console.log(`  Interested artists: ${iaMap.size}`);

    const [bookingRows] = await conn.execute("SELECT id, bubbleId FROM bookings WHERE bubbleId IS NOT NULL");
    const bookingMap = new Map(bookingRows.map((r) => [r.bubbleId, r.id]));
    console.log(`  Bookings: ${bookingMap.size}`);

    const [convoRows] = await conn.execute("SELECT id, bubbleId FROM conversations WHERE bubbleId IS NOT NULL");
    const convoMap = new Map(convoRows.map((r) => [r.bubbleId, r.id]));
    console.log(`  Conversations: ${convoMap.size}\n`);

    if (mode === "frequent" || mode === "daily") {
      // Sync all transactional tables
      console.log("--- Syncing Jobs ---");
      summary.jobs = await syncJobs(conn, userMap, modifiedSince);
      console.log(`  → ${summary.jobs.upserted} synced, ${summary.jobs.errors} errors`);

      console.log("\n--- Syncing Premium Jobs ---");
      summary.premiumJobs = await syncPremiumJobs(conn, userMap, modifiedSince);
      console.log(`  → ${summary.premiumJobs.upserted} synced, ${summary.premiumJobs.errors} errors`);

      console.log("\n--- Syncing Interested Artists ---");
      const [jobRows2] = await conn.execute("SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
      const jobMap2 = new Map(jobRows2.map((r) => [r.bubbleId, r.id]));
      summary.interestedArtists = await syncInterestedArtists(conn, userMap, jobMap2, modifiedSince);
      console.log(`  → ${summary.interestedArtists.upserted} synced, ${summary.interestedArtists.errors} errors`);

      console.log("\n--- Syncing Bookings ---");
      const [iaRows2] = await conn.execute("SELECT id, bubbleId FROM interested_artists WHERE bubbleId IS NOT NULL");
      const iaMap2 = new Map(iaRows2.map((r) => [r.bubbleId, r.id]));
      summary.bookings = await syncBookings(conn, userMap, jobMap2, iaMap2, modifiedSince);
      console.log(`  → ${summary.bookings.upserted} synced, ${summary.bookings.errors} errors`);

      console.log("\n--- Syncing Conversations ---");
      summary.conversations = await syncConversations(conn, userMap, modifiedSince);
      console.log(`  → ${summary.conversations.upserted} synced, ${summary.conversations.errors} errors`);

      console.log("\n--- Syncing Payments ---");
      const [bookingRows2] = await conn.execute("SELECT id, bubbleId FROM bookings WHERE bubbleId IS NOT NULL");
      const bookingMap2 = new Map(bookingRows2.map((r) => [r.bubbleId, r.id]));
      summary.payments = await syncPayments(conn, userMap, bookingMap2, modifiedSince);
      console.log(`  → ${summary.payments.upserted} synced, ${summary.payments.errors} errors`);

      console.log("\n--- Syncing Messages ---");
      const [convoRows2] = await conn.execute("SELECT id, bubbleId FROM conversations WHERE bubbleId IS NOT NULL");
      const convoMap2 = new Map(convoRows2.map((r) => [r.bubbleId, r.id]));
      summary.messages = await syncMessages(conn, userMap, convoMap2, modifiedSince);
      console.log(`  → ${summary.messages.upserted} synced, ${summary.messages.errors} errors`);
    }

    if (mode === "daily") {
      // Daily also syncs all users (full, no time filter)
      console.log("\n--- Syncing Users (full) ---");
      summary.users = await syncUsers(conn, null);
      console.log(`  → ${summary.users.upserted} synced, ${summary.users.errors} errors`);
    }

  } catch (err) {
    overallError = err.message;
    console.error("\nFATAL ERROR:", err.message);
  }

  // Update sync_runs record
  const durationMs = Date.now() - startTime;
  const status = overallError ? "error" : "success";
  await conn.execute(
    "UPDATE sync_runs SET status=?, summary=?, errorMessage=?, durationMs=?, finishedAt=NOW() WHERE id=?",
    [status, JSON.stringify(summary), overallError ?? null, durationMs, runId]
  );

  await conn.end();

  console.log("\n=== Sync Complete ===");
  console.log(`Status:   ${status}`);
  console.log(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Summary:  ${JSON.stringify(summary, null, 2)}`);

  // ── Send email summary ──────────────────────────────────────────────────────
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    sgMail.setApiKey(sendgridKey);
    const tableRows = Object.entries(summary)
      .map(([table, s]) => {
        const stats = s;
        const errBadge = stats.errors > 0 ? ` <span style="color:#e53e3e">(${stats.errors} errors)</span>` : "";
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">${table}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${stats.upserted} synced${errBadge}</td></tr>`;
      })
      .join("");
    const syncTypeNote = modifiedSince
      ? `<p style="color:#666;font-size:13px;margin-top:8px">Incremental sync — records modified since ${new Date(modifiedSince).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>`
      : `<p style="color:#666;font-size:13px;margin-top:8px">Full sync — all records fetched</p>`;

    const statusColor = status === "success" ? "#38a169" : "#e53e3e";
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="margin-bottom:4px">Artswrk DB Sync Report</h2>
        <p style="color:#666;margin-top:0">Mode: <strong>${mode}</strong> &nbsp;|&nbsp; Status: <strong style="color:${statusColor}">${status.toUpperCase()}</strong> &nbsp;|&nbsp; Duration: <strong>${(durationMs / 1000).toFixed(1)}s</strong></p>
        ${syncTypeNote}
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead><tr style="background:#f7f7f7"><th style="padding:8px 12px;text-align:left">Table</th><th style="padding:8px 12px;text-align:right">Result</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${overallError ? `<p style="color:#e53e3e;margin-top:16px"><strong>Error:</strong> ${overallError}</p>` : ""}
        <p style="color:#999;font-size:12px;margin-top:24px">Ran at ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
      </div>
    `;

    try {
      await sgMail.send({
        to: "ramita@artswrk.com",
        from: { email: "contact@artswrk.com", name: "Artswrk Sync" },
        subject: `[Artswrk Sync] ${mode} — ${status.toUpperCase()} (${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" })})`,
        html,
      });
      console.log("\nSync summary email sent to ramita@artswrk.com");
    } catch (emailErr) {
      console.error("Failed to send sync summary email:", emailErr.message);
    }
  } else {
    console.log("\n[Email] SENDGRID_API_KEY not set — skipping summary email.");
  }

  if (overallError) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
