/**
 * sync-user-account.mjs
 *
 * Syncs a single client user's full account from Bubble into the local DB:
 *   - Jobs (requests where they are the client)
 *   - Bookings
 *   - Payments
 *
 * Usage:
 *   node scripts/sync-user-account.mjs ramita@artswrk.com
 *   node scripts/sync-user-account.mjs nick@ferraridancecenter.com
 *
 * Safe to re-run — all upserts use ON DUPLICATE KEY UPDATE / INSERT … ON DUPLICATE.
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;
const TARGET_EMAIL = process.argv[2] || "ramita@artswrk.com";

if (!BUBBLE_API_KEY) {
  console.error("ERROR: BUBBLE_API_KEY not set in .env");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function safeInt(val) {
  if (val == null || val === "") return null;
  const n = Math.round(Number(val));
  return isNaN(n) ? null : n;
}

async function bubbleFetch(path) {
  const url = `${BUBBLE_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Bubble ${res.status} for ${url}: ${await res.text()}`);
  return res.json();
}

async function fetchAllPages(dataType, constraints) {
  const all = [];
  let cursor = 0;
  while (true) {
    const params = new URLSearchParams({
      limit: "100",
      cursor: String(cursor),
      sort_field: "Created Date",
      descending: "true",
    });
    if (constraints.length) params.set("constraints", JSON.stringify(constraints));
    console.log(`    Fetching ${dataType} cursor=${cursor}…`);
    let data;
    try {
      data = await bubbleFetch(`/${dataType}?${params}`);
    } catch (err) {
      console.error(`    Fetch error: ${err.message} — retrying in 3s`);
      await sleep(3000);
      data = await bubbleFetch(`/${dataType}?${params}`);
    }
    const results = data?.response?.results ?? [];
    const remaining = data?.response?.remaining ?? 0;
    all.push(...results);
    console.log(`    Got ${results.length} (remaining: ${remaining}, total: ${all.length})`);
    if (!results.length || remaining === 0) break;
    cursor += 100;
    await sleep(300);
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Syncing account: ${TARGET_EMAIL} ===\n`);

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to DB.\n");

  // ── Step 1: Find the user in Bubble by email ──────────────────────────────
  console.log("[1] Looking up user in Bubble…");
  const userSearch = await bubbleFetch(
    `/user?constraints=${encodeURIComponent(JSON.stringify([
      { key: "email", constraint_type: "equals", value: TARGET_EMAIL }
    ]))}`
  );
  const bubbleUser = userSearch?.response?.results?.[0];
  if (!bubbleUser) {
    console.error(`  User not found in Bubble for email: ${TARGET_EMAIL}`);
    await db.end();
    process.exit(1);
  }
  const BUBBLE_USER_ID = bubbleUser._id;
  console.log(`  Found Bubble user: ${bubbleUser["First name"] || ""} ${bubbleUser["Last name"] || ""} (${BUBBLE_USER_ID})`);

  // ── Step 2: Find or confirm local user ───────────────────────────────────
  console.log("\n[2] Looking up local user…");
  const [localRows] = await db.execute(
    "SELECT id, email, bubbleId FROM users WHERE email = ? OR bubbleId = ? LIMIT 1",
    [TARGET_EMAIL, BUBBLE_USER_ID]
  );
  if (!localRows.length) {
    console.error(`  User ${TARGET_EMAIL} not found in local DB. Run the user seed first.`);
    await db.end();
    process.exit(1);
  }
  const localUser = localRows[0];
  const LOCAL_USER_ID = localUser.id;
  console.log(`  Local user ID: ${LOCAL_USER_ID} (bubbleId: ${localUser.bubbleId})`);

  // If bubbleId isn't set yet, update it
  if (!localUser.bubbleId) {
    await db.execute("UPDATE users SET bubbleId = ? WHERE id = ?", [BUBBLE_USER_ID, LOCAL_USER_ID]);
    console.log(`  Updated bubbleId on local user.`);
  }

  // ── Step 3: Build lookup maps ─────────────────────────────────────────────
  console.log("\n[3] Building lookup maps…");
  const [jobRows] = await db.execute("SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
  const jobMap = new Map(jobRows.map(r => [r.bubbleId, r.id]));
  console.log(`  Jobs: ${jobMap.size}`);

  const [iaRows] = await db.execute("SELECT id, bubbleId FROM interested_artists WHERE bubbleId IS NOT NULL");
  const iaMap = new Map(iaRows.map(r => [r.bubbleId, r.id]));
  console.log(`  Interested artists: ${iaMap.size}`);

  const [userRows2] = await db.execute("SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL");
  const userByBubbleId = new Map(userRows2.map(r => [r.bubbleId, r.id]));
  console.log(`  Users: ${userByBubbleId.size}`);

  // ── Step 4: Sync Jobs ─────────────────────────────────────────────────────
  console.log(`\n[4] Fetching jobs where client = ${BUBBLE_USER_ID}…`);
  const bubbleJobs = await fetchAllPages("Request", [
    { key: "Client", constraint_type: "equals", value: BUBBLE_USER_ID },
  ]);
  console.log(`  Total jobs: ${bubbleJobs.length}`);

  let jobsUpserted = 0, jobErrors = 0;
  for (const job of bubbleJobs) {
    const locationObj = job["Location"] ?? job["location"] ?? null;
    let locationAddress = null, locationLat = null, locationLng = null;
    if (typeof locationObj === "string") {
      locationAddress = locationObj;
    } else if (locationObj && typeof locationObj === "object") {
      locationAddress = locationObj.address ?? locationObj.formatted_address ?? null;
      locationLat = locationObj.lat != null ? String(locationObj.lat) : null;
      locationLng = locationObj.lng != null ? String(locationObj.lng) : null;
    }

    try {
      await db.execute(
        `INSERT INTO jobs (
          bubbleId, clientUserId, bubbleClientId, bubbleClientCompanyId,
          description, slug, requestStatus, status,
          dateType, startDate, endDate,
          locationAddress, locationLat, locationLng,
          isHourly, openRate, artistHourlyRate, clientHourlyRate,
          direct, sentToNetwork, transportation, converted,
          masterServiceTypeId, clientEmail,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          clientUserId=VALUES(clientUserId), requestStatus=VALUES(requestStatus),
          description=VALUES(description), dateType=VALUES(dateType),
          startDate=VALUES(startDate), endDate=VALUES(endDate),
          locationAddress=VALUES(locationAddress), locationLat=VALUES(locationLat),
          locationLng=VALUES(locationLng), isHourly=VALUES(isHourly),
          openRate=VALUES(openRate), artistHourlyRate=VALUES(artistHourlyRate),
          clientHourlyRate=VALUES(clientHourlyRate), direct=VALUES(direct),
          masterServiceTypeId=VALUES(masterServiceTypeId),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          job._id, LOCAL_USER_ID,
          job["Client"] ?? null, job["Client Company"] ?? null,
          job["Description"] ?? job["description"] ?? null,
          job["Slug"] ?? null,
          job["Request status"] ?? job["Request Status"] ?? null,
          job["status"] ?? null,
          job["Date Type"] ?? null,
          safeDate(job["Start date"] ?? job["Start Date"]),
          safeDate(job["End date"] ?? job["End Date"]),
          locationAddress, locationLat, locationLng,
          (job["Is Hourly"] ?? true) ? 1 : 0,
          (job["Open Rate"] ?? false) ? 1 : 0,
          safeInt(job["Artist hourly rate"] ?? job["Artist Hourly Rate"] ?? job["Rate"]),
          safeInt(job["Client hourly rate"] ?? job["Client Hourly Rate"]),
          (job["Direct"] ?? false) ? 1 : 0,
          (job["Sent to Network"] ?? false) ? 1 : 0,
          (job["Transportation"] ?? false) ? 1 : 0,
          (job["Converted"] ?? false) ? 1 : 0,
          job["Master Service Type"] ?? null,
          job["Client Email"] ?? null,
          safeDate(job["Created Date"]),
          safeDate(job["Modified Date"]),
        ]
      );
      // Update jobMap with newly inserted jobs
      const [newJob] = await db.execute("SELECT id FROM jobs WHERE bubbleId = ?", [job._id]);
      if (newJob[0]) jobMap.set(job._id, newJob[0].id);
      jobsUpserted++;
    } catch (err) {
      console.error(`  Error upserting job ${job._id}:`, err.message);
      jobErrors++;
    }
  }
  console.log(`  Upserted: ${jobsUpserted}, Errors: ${jobErrors}`);

  // ── Step 5: Sync Bookings ─────────────────────────────────────────────────
  console.log(`\n[5] Fetching bookings where client = ${BUBBLE_USER_ID}…`);
  const bubbleBookings = await fetchAllPages("booking", [
    { key: "client", constraint_type: "equals", value: BUBBLE_USER_ID },
  ]);
  console.log(`  Total bookings: ${bubbleBookings.length}`);

  let bookingsUpserted = 0, bookingErrors = 0;
  for (const rec of bubbleBookings) {
    if (rec["deleted?"]) continue;
    const bubbleRequestId = rec.Request ?? null;
    const bubbleInterestedArtistId = rec["Interested Artist"] ?? null;
    const bubbleArtistId = rec.Artist ?? null;
    const jobId = bubbleRequestId ? (jobMap.get(bubbleRequestId) ?? null) : null;
    const interestedArtistId = bubbleInterestedArtistId ? (iaMap.get(bubbleInterestedArtistId) ?? null) : null;
    const artistUserId = bubbleArtistId ? (userByBubbleId.get(bubbleArtistId) ?? null) : null;
    const loc = rec.Location ?? {};
    const locationAddress = typeof loc === "string" ? loc : (loc.address ?? null);
    const locationLat = loc.lat != null ? String(loc.lat) : null;
    const locationLng = loc.lng != null ? String(loc.lng) : null;

    try {
      await db.execute(
        `INSERT INTO bookings (
          bubbleId, jobId, bubbleRequestId, interestedArtistId, bubbleInterestedArtistId,
          clientUserId, bubbleClientId, artistUserId, bubbleArtistId,
          bookingStatus, paymentStatus,
          clientRate, artistRate, totalClientRate, totalArtistRate,
          grossProfit, stripeFee, postFeeRevenue, hours, externalPayment,
          startDate, endDate, locationAddress, locationLat, locationLng,
          description, stripeCheckoutUrl, addedToSpreadsheet, deleted,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          jobId=VALUES(jobId), interestedArtistId=VALUES(interestedArtistId),
          clientUserId=VALUES(clientUserId), artistUserId=VALUES(artistUserId),
          bookingStatus=VALUES(bookingStatus), paymentStatus=VALUES(paymentStatus),
          clientRate=VALUES(clientRate), artistRate=VALUES(artistRate),
          totalClientRate=VALUES(totalClientRate), totalArtistRate=VALUES(totalArtistRate),
          grossProfit=VALUES(grossProfit), stripeFee=VALUES(stripeFee),
          startDate=VALUES(startDate), endDate=VALUES(endDate),
          locationAddress=VALUES(locationAddress), locationLat=VALUES(locationLat),
          locationLng=VALUES(locationLng), description=VALUES(description),
          stripeCheckoutUrl=VALUES(stripeCheckoutUrl),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          rec._id, jobId, bubbleRequestId, interestedArtistId, bubbleInterestedArtistId,
          LOCAL_USER_ID, rec.Client ?? null, artistUserId, bubbleArtistId,
          rec._Option_Booking_Status ?? rec["Booking Status"] ?? null,
          rec._Option_Payment_Status ?? rec["Payment Status"] ?? null,
          safeInt(rec["Client Rate"]), safeInt(rec["Artist Rate"]),
          safeInt(rec["Total Client Rate (Client Rate + Reimbursements)"]),
          safeInt(rec["Total Artist Rate (Artist Rate + Reimbursements)"]),
          safeInt(rec["Gross Profit"]), safeInt(rec["stripe fee"]),
          safeInt(rec["Post Fee Revenue"]), safeInt(rec.hours),
          (rec["external payment?"] ?? false) ? 1 : 0,
          safeDate(rec["Start date"]), safeDate(rec["End date"]),
          locationAddress, locationLat, locationLng,
          rec.Description ?? null, rec["Stripe checkout url"] ?? null,
          (rec["Added to Spreadsheet?"] ?? false) ? 1 : 0,
          (rec["deleted?"] ?? false) ? 1 : 0,
          safeDate(rec["Created Date"]), safeDate(rec["Modified Date"]),
        ]
      );
      // Update booking map
      const [newBk] = await db.execute("SELECT id FROM bookings WHERE bubbleId = ?", [rec._id]);
      if (newBk[0]) iaMap.set(rec._id, newBk[0].id); // reuse map for booking IDs
      bookingsUpserted++;
    } catch (err) {
      console.error(`  Error upserting booking ${rec._id}:`, err.message);
      bookingErrors++;
    }
  }
  console.log(`  Upserted: ${bookingsUpserted}, Errors: ${bookingErrors}`);

  // Build bookingMap: bubbleId → local id
  const [bkRows] = await db.execute("SELECT id, bubbleId FROM bookings WHERE bubbleId IS NOT NULL");
  const bookingMap = new Map(bkRows.map(r => [r.bubbleId, r.id]));

  // ── Step 6: Sync Payments ─────────────────────────────────────────────────
  console.log(`\n[6] Fetching payments where client = ${BUBBLE_USER_ID}…`);
  const bubblePayments = await fetchAllPages("payment", [
    { key: "client", constraint_type: "equals", value: BUBBLE_USER_ID },
  ]);
  console.log(`  Total payments: ${bubblePayments.length}`);

  let paymentsUpserted = 0, paymentErrors = 0;
  for (const rec of bubblePayments) {
    const bubbleBookingId = rec.Booking ?? rec.booking ?? null;
    const bookingId = bubbleBookingId ? (bookingMap.get(bubbleBookingId) ?? null) : null;

    try {
      await db.execute(
        `INSERT INTO payments (
          bubbleId, bookingId, bubbleBookingId, clientUserId, bubbleClientId,
          stripeId, stripeStatus, status,
          stripeAmount, stripeApplicationFee, stripeApplicationFeeAmount,
          stripeCardBrand, stripeCardLast4, stripeCardName,
          stripeDescription, stripeReceiptUrl, stripeRefundUrl,
          paymentDate, bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          bookingId=VALUES(bookingId), clientUserId=VALUES(clientUserId),
          stripeStatus=VALUES(stripeStatus), status=VALUES(status),
          stripeAmount=VALUES(stripeAmount),
          stripeReceiptUrl=VALUES(stripeReceiptUrl),
          paymentDate=VALUES(paymentDate),
          bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          rec._id, bookingId, bubbleBookingId,
          LOCAL_USER_ID, rec.Client ?? rec.client ?? null,
          rec["Stripe ID"] ?? rec["stripe_id"] ?? null,
          rec["Stripe Status"] ?? rec["stripe_status"] ?? null,
          rec.Status ?? rec.status ?? null,
          safeInt(rec["Stripe Amount"] ?? rec["stripe_amount"] ?? rec["Amount"]),
          safeInt(rec["Stripe Application Fee"] ?? null),
          safeInt(rec["Stripe Application Fee Amount"] ?? null),
          rec["Stripe Card Brand"] ?? null,
          rec["Stripe Card Last 4"] ?? rec["Stripe Card Last4"] ?? null,
          rec["Stripe Card Name"] ?? null,
          rec["Stripe Description"] ?? rec.Description ?? null,
          rec["Stripe Receipt URL"] ?? rec["stripe_receipt_url"] ?? null,
          rec["Stripe Refund URL"] ?? null,
          safeDate(rec["Payment Date"] ?? rec["payment_date"]),
          safeDate(rec["Created Date"]),
          safeDate(rec["Modified Date"]),
        ]
      );
      paymentsUpserted++;
    } catch (err) {
      console.error(`  Error upserting payment ${rec._id}:`, err.message);
      paymentErrors++;
    }
  }
  console.log(`  Upserted: ${paymentsUpserted}, Errors: ${paymentErrors}`);

  await db.end();

  console.log(`
=== Sync Complete for ${TARGET_EMAIL} ===
  Jobs:     ${jobsUpserted} upserted
  Bookings: ${bookingsUpserted} upserted
  Payments: ${paymentsUpserted} upserted
  `);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
