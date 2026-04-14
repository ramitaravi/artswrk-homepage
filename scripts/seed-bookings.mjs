/**
 * Fetches all Booking records from Bubble for Ferrari Dance Center NYC (Nick)
 * and seeds them into the local bookings table.
 * Also back-fills the interestedArtistId FK on each booking by matching
 * bubbleInterestedArtistId → interested_artists.bubbleId.
 *
 * Nick's Bubble user ID: 1659533883431x527826980339748400
 * Run with: node scripts/seed-bookings.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const NICK_BUBBLE_ID = "1659533883431x527826980339748400";

// ── Fetch all pages from Bubble ───────────────────────────────────────────────
async function fetchAllBubbleRecords(dataType, constraints) {
  const allRecords = [];
  let cursor = 0;
  const limit = 100;
  while (true) {
    const params = new URLSearchParams({
      limit: String(limit),
      cursor: String(cursor),
      constraints: JSON.stringify(constraints),
    });
    const url = `${BUBBLE_API_BASE}/${dataType}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Bubble API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const results = data?.response?.results ?? [];
    allRecords.push(...results);
    const remaining = data?.response?.remaining ?? 0;
    console.log(`  Fetched ${results.length} records (cursor=${cursor}), remaining=${remaining}`);
    if (!results.length || remaining === 0) break;
    cursor += limit;
  }
  return allRecords;
}

// ── Safe int helper ───────────────────────────────────────────────────────────
function safeInt(val) {
  if (val == null) return null;
  const n = Math.round(Number(val));
  return isNaN(n) ? null : n;
}

// ── Safe date helper ──────────────────────────────────────────────────────────
function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database.");

  // 1. Fetch all bookings for Nick from Bubble
  console.log("\n[1] Fetching bookings from Bubble...");
  const bubbleBookings = await fetchAllBubbleRecords("booking", [
    { key: "client", constraint_type: "equals", value: NICK_BUBBLE_ID },
  ]);
  console.log(`Total bookings fetched: ${bubbleBookings.length}`);

  // 2. Build lookup maps from local DB
  console.log("\n[2] Building lookup maps from local DB...");

  // jobs: bubbleId → local id
  const [jobRows] = await db.execute("SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
  const jobMap = new Map(jobRows.map((r) => [r.bubbleId, r.id]));
  console.log(`  Job map: ${jobMap.size} entries`);

  // interested_artists: bubbleId → local id
  const [iaRows] = await db.execute("SELECT id, bubbleId FROM interested_artists WHERE bubbleId IS NOT NULL");
  const iaMap = new Map(iaRows.map((r) => [r.bubbleId, r.id]));
  console.log(`  Interested artist map: ${iaMap.size} entries`);

  // Get local client user ID for Nick
  const [userRows] = await db.execute(
    "SELECT id FROM users WHERE bubbleId = ?",
    [NICK_BUBBLE_ID]
  );
  const clientLocalId = userRows[0]?.id ?? null;
  console.log(`  Client local user ID: ${clientLocalId}`);

  // 3. Upsert bookings
  console.log("\n[3] Upserting bookings...");
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let noJobLink = 0;
  let noIALink = 0;

  for (const rec of bubbleBookings) {
    // Skip deleted records
    if (rec["deleted?"]) {
      skipped++;
      continue;
    }

    const bubbleId = rec._id;
    const bubbleRequestId = rec.Request ?? null;
    const bubbleInterestedArtistId = rec["Interested Artist"] ?? null;
    const bubbleArtistId = rec.Artist ?? null;

    const jobId = bubbleRequestId ? (jobMap.get(bubbleRequestId) ?? null) : null;
    const interestedArtistId = bubbleInterestedArtistId
      ? (iaMap.get(bubbleInterestedArtistId) ?? null)
      : null;

    if (!jobId) noJobLink++;
    if (!interestedArtistId) noIALink++;

    const location = rec.Location ?? {};
    const locationAddress = location.address ?? null;
    const locationLat = location.lat != null ? String(location.lat) : null;
    const locationLng = location.lng != null ? String(location.lng) : null;

    const row = {
      bubbleId,
      jobId,
      bubbleRequestId,
      interestedArtistId,
      bubbleInterestedArtistId,
      clientUserId: clientLocalId,
      bubbleClientId: rec.Client ?? null,
      artistUserId: null, // will be filled when artist profiles are migrated
      bubbleArtistId,
      bookingStatus: rec._Option_Booking_Status ?? null,
      paymentStatus: rec._Option_Payment_Status ?? null,
      clientRate: safeInt(rec["Client Rate"]),
      artistRate: safeInt(rec["Artist Rate"]),
      totalClientRate: safeInt(rec["Total Client Rate (Client Rate + Reimbursements)"]),
      totalArtistRate: safeInt(rec["Total Artist Rate (Artist Rate + Reimbursements)"]),
      grossProfit: safeInt(rec["Gross Profit"]),
      stripeFee: safeInt(rec["stripe fee"]),
      postFeeRevenue: safeInt(rec["Post Fee Revenue"]),
      hours: safeInt(rec.hours),
      externalPayment: rec["external payment?"] ? 1 : 0,
      startDate: safeDate(rec["Start date"]),
      endDate: safeDate(rec["End date"]),
      locationAddress,
      locationLat,
      locationLng,
      description: rec.Description ?? null,
      stripeCheckoutUrl: rec["Stripe checkout url"] ?? null,
      addedToSpreadsheet: rec["Added to Spreadsheet?"] ? 1 : 0,
      deleted: rec["deleted?"] ? 1 : 0,
      bubbleCreatedAt: safeDate(rec["Created Date"]),
      bubbleModifiedAt: safeDate(rec["Modified Date"]),
    };

    // Check if already exists
    const [existing] = await db.execute(
      "SELECT id FROM bookings WHERE bubbleId = ?",
      [bubbleId]
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE bookings SET
          jobId=?, bubbleRequestId=?, interestedArtistId=?, bubbleInterestedArtistId=?,
          clientUserId=?, bubbleClientId=?, bubbleArtistId=?,
          bookingStatus=?, paymentStatus=?,
          clientRate=?, artistRate=?, totalClientRate=?, totalArtistRate=?,
          grossProfit=?, stripeFee=?, postFeeRevenue=?, hours=?, externalPayment=?,
          startDate=?, endDate=?,
          locationAddress=?, locationLat=?, locationLng=?,
          description=?, stripeCheckoutUrl=?,
          addedToSpreadsheet=?, deleted=?,
          bubbleCreatedAt=?, bubbleModifiedAt=?
        WHERE bubbleId=?`,
        [
          row.jobId, row.bubbleRequestId, row.interestedArtistId, row.bubbleInterestedArtistId,
          row.clientUserId, row.bubbleClientId, row.bubbleArtistId,
          row.bookingStatus, row.paymentStatus,
          row.clientRate, row.artistRate, row.totalClientRate, row.totalArtistRate,
          row.grossProfit, row.stripeFee, row.postFeeRevenue, row.hours, row.externalPayment,
          row.startDate, row.endDate,
          row.locationAddress, row.locationLat, row.locationLng,
          row.description, row.stripeCheckoutUrl,
          row.addedToSpreadsheet, row.deleted,
          row.bubbleCreatedAt, row.bubbleModifiedAt,
          bubbleId,
        ]
      );
      updated++;
    } else {
      await db.execute(
        `INSERT INTO bookings (
          bubbleId, jobId, bubbleRequestId, interestedArtistId, bubbleInterestedArtistId,
          clientUserId, bubbleClientId, bubbleArtistId,
          bookingStatus, paymentStatus,
          clientRate, artistRate, totalClientRate, totalArtistRate,
          grossProfit, stripeFee, postFeeRevenue, hours, externalPayment,
          startDate, endDate,
          locationAddress, locationLat, locationLng,
          description, stripeCheckoutUrl,
          addedToSpreadsheet, deleted,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          row.bubbleId, row.jobId, row.bubbleRequestId, row.interestedArtistId, row.bubbleInterestedArtistId,
          row.clientUserId, row.bubbleClientId, row.bubbleArtistId,
          row.bookingStatus, row.paymentStatus,
          row.clientRate, row.artistRate, row.totalClientRate, row.totalArtistRate,
          row.grossProfit, row.stripeFee, row.postFeeRevenue, row.hours, row.externalPayment,
          row.startDate, row.endDate,
          row.locationAddress, row.locationLat, row.locationLng,
          row.description, row.stripeCheckoutUrl,
          row.addedToSpreadsheet, row.deleted,
          row.bubbleCreatedAt, row.bubbleModifiedAt,
        ]
      );
      inserted++;
    }
  }

  // 4. Back-fill bookingId on interested_artists rows
  console.log("\n[4] Back-filling bookingId on interested_artists...");
  const [bookingRows] = await db.execute(
    "SELECT id, bubbleInterestedArtistId FROM bookings WHERE bubbleInterestedArtistId IS NOT NULL"
  );
  let iaUpdated = 0;
  for (const b of bookingRows) {
    if (!b.bubbleInterestedArtistId) continue;
    const [res] = await db.execute(
      "UPDATE interested_artists SET bubbleBookingId = ? WHERE bubbleId = ? AND bubbleBookingId IS NULL",
      [b.id, b.bubbleInterestedArtistId]
    );
    if (res.affectedRows > 0) iaUpdated++;
  }

  console.log("\n=== Seed Summary ===");
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped (deleted): ${skipped}`);
  console.log(`  Bookings without job link: ${noJobLink}`);
  console.log(`  Bookings without IA link: ${noIALink}`);
  console.log(`  Interested artists back-filled: ${iaUpdated}`);

  // 5. Final counts
  const [countRows] = await db.execute("SELECT COUNT(*) as cnt FROM bookings");
  console.log(`\n  Total bookings in DB: ${countRows[0].cnt}`);

  const [statusRows] = await db.execute(
    "SELECT bookingStatus, COUNT(*) as cnt FROM bookings GROUP BY bookingStatus"
  );
  console.log("  Status breakdown:", statusRows.map((r) => `${r.bookingStatus}: ${r.cnt}`).join(", "));

  const [payRows] = await db.execute(
    "SELECT paymentStatus, COUNT(*) as cnt FROM bookings GROUP BY paymentStatus"
  );
  console.log("  Payment breakdown:", payRows.map((r) => `${r.paymentStatus}: ${r.cnt}`).join(", "));

  await db.end();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
