/**
 * Seed script: imports all Lambarri (Alexa S.) data from Bubble
 * Bubble user ID: 1660327940281x921038367851854000
 *
 * Run with: node scripts/seed-lambarri.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-live/api/1.1/obj";
const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const LAMBARRI_BUBBLE_ID = "1660327940281x921038367851854000";

async function fetchAllBubbleRecords(dataType, constraints) {
  const allRecords = [];
  let cursor = 0;
  const limit = 100;
  while (true) {
    const params = new URLSearchParams({ limit: String(limit), cursor: String(cursor) });
    if (constraints) params.set("constraints", JSON.stringify(constraints));
    const url = `${BUBBLE_API_BASE}/${dataType}?${params.toString()}`;
    process.stdout.write(`  Fetching ${dataType} cursor=${cursor}...\r`);
    let resp;
    try {
      resp = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` } });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 3000));
      resp = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` } });
    }
    if (!resp.ok) { console.error(`\nHTTP ${resp.status} for ${dataType}`); break; }
    const data = await resp.json();
    const results = data?.response?.results ?? [];
    const remaining = data?.response?.remaining ?? 0;
    allRecords.push(...results);
    if (remaining === 0) break;
    cursor += limit;
    await new Promise((r) => setTimeout(r, 200));
  }
  return allRecords;
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function parseFloat2(val) {
  if (val === null || val === undefined) return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}
function parseBoolean(val) {
  if (val === true || val === "true" || val === 1) return 1;
  if (val === false || val === "false" || val === 0) return 0;
  return null;
}
function arr1(val) {
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

const db = await mysql.createConnection(process.env.DATABASE_URL);
console.log("✅ Connected to database\n");

// ── 1. Upsert Lambarri user ────────────────────────────────────────────────────
console.log("📋 Step 1: Fetching Lambarri user record...");
const userResp = await fetch(`${BUBBLE_API_BASE}/user/${LAMBARRI_BUBBLE_ID}`, {
  headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
});
const u = (await userResp.json()).response;

const pic = u["Profile Picture"];
const profilePicture = pic ? (pic.startsWith("//") ? "https:" + pic : pic) : null;
const locationJson = u["Location"]
  ? JSON.stringify({ address: u["Location"].address, lat: u["Location"].lat, lng: u["Location"].lng })
  : null;

await db.execute(
  `INSERT INTO users (openId, bubbleId, email, firstName, lastName, name, slug, profilePicture, phoneNumber,
    userRole, pronouns, clientCompanyName, clientStripeCustomerId, clientSubscriptionId, clientPremium,
    stripeCustomerId, onboardingStep, userSignedUp, beta, location,
    bubbleCreatedAt, bubbleModifiedAt, lastSignedIn)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
   ON DUPLICATE KEY UPDATE
     email=VALUES(email), firstName=VALUES(firstName), lastName=VALUES(lastName),
     name=VALUES(name), slug=VALUES(slug), profilePicture=VALUES(profilePicture),
     pronouns=VALUES(pronouns), clientCompanyName=VALUES(clientCompanyName),
     clientStripeCustomerId=VALUES(clientStripeCustomerId),
     clientSubscriptionId=VALUES(clientSubscriptionId), clientPremium=VALUES(clientPremium),
     stripeCustomerId=VALUES(stripeCustomerId), onboardingStep=VALUES(onboardingStep),
     userSignedUp=VALUES(userSignedUp), beta=VALUES(beta), location=VALUES(location),
     bubbleCreatedAt=VALUES(bubbleCreatedAt), bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
  [
    `bubble_${LAMBARRI_BUBBLE_ID}`,
    LAMBARRI_BUBBLE_ID,
    u["authentication"]?.email?.email ?? `${LAMBARRI_BUBBLE_ID}@artswrk.com`,
    u["First Name"] ?? null, u["Last Name"] ?? null, u["Full Name"] ?? null,
    u["Slug"] ?? null, profilePicture, u["Phone Number"] ?? null,
    "Client", u["Pronouns"] ?? null,
    u["Client Company Name"] ?? null,
    u["Client Stripe Customer ID"] ?? null,
    u["Client Subscription ID"] ?? null,
    parseBoolean(u["Client Premium"]) ?? 0,
    u["StripeCustomerID"] ?? null,
    u["Onboarding Step"] ?? 0,
    parseBoolean(u["user_signed_up"]) ?? 1,
    parseBoolean(u["BETA"]) ?? 0,
    locationJson,
    parseDate(u["Created Date"]), parseDate(u["Modified Date"]),
  ]
);

const [[lambarriDbUser]] = await db.execute("SELECT id FROM users WHERE bubbleId = ?", [LAMBARRI_BUBBLE_ID]);
const LAMBARRI_DB_ID = lambarriDbUser.id;
console.log(`✅ User upserted — DB id: ${LAMBARRI_DB_ID}, name: ${u["Full Name"]}, company: ${u["Client Company Name"]}`);

// ── 2. Seed Jobs ───────────────────────────────────────────────────────────────
console.log("\n📋 Step 2: Fetching Lambarri jobs (Requests)...");
const jobs = await fetchAllBubbleRecords("request", [
  { key: "client", constraint_type: "equals", value: LAMBARRI_BUBBLE_ID },
]);
console.log(`\n  Found ${jobs.length} jobs`);

let jobsInserted = 0;
const jobBubbleIdToDbId = {};

for (const j of jobs) {
  const loc = j["location"] ?? {};
  try {
    await db.execute(
      `INSERT INTO jobs (
        bubbleId, clientUserId, bubbleClientId, bubbleClientCompanyId,
        description, slug, requestStatus, status, dateType,
        startDate, endDate,
        locationAddress, locationLat, locationLng,
        isHourly, openRate, artistHourlyRate, clientHourlyRate,
        direct, sentToNetwork, transportation, converted,
        masterServiceTypeId, clientEmail,
        bubbleCreatedAt, bubbleModifiedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        requestStatus=VALUES(requestStatus), status=VALUES(status),
        description=VALUES(description), clientHourlyRate=VALUES(clientHourlyRate),
        artistHourlyRate=VALUES(artistHourlyRate), bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
      [
        j["_id"], LAMBARRI_DB_ID, LAMBARRI_BUBBLE_ID,
        arr1(j["client company"]) ?? null,
        j["description"] ?? null,
        j["Slug"] ?? null,
        j["Request Status"] ?? "Active",
        j["Status"] ?? null,
        j["DateType"] ?? null,
        parseDate(j["Start date"] ?? j["Date"]),
        parseDate(j["End date"] ?? j["End Date"]),
        loc.address ?? null, loc.lat ?? null, loc.lng ?? null,
        parseBoolean(j["is hourly?"]) ?? 0,
        parseBoolean(j["open rate?"]) ?? 0,
        parseFloat2(j["artist hourly rate"]),
        parseFloat2(j["client hourly rate"]),
        parseBoolean(j["direct?"]) ?? 0,
        parseBoolean(j["sent to network?"]) ?? 0,
        parseBoolean(j["tranportation?"]) ?? 0,
        parseBoolean(j["converted?"]) ?? 0,
        arr1(j["master service type"]) ?? null,
        j["client email"] ?? null,
        parseDate(j["Created Date"]), parseDate(j["Modified Date"]),
      ]
    );
    const [[dbJob]] = await db.execute("SELECT id FROM jobs WHERE bubbleId = ?", [j["_id"]]);
    if (dbJob) { jobBubbleIdToDbId[j["_id"]] = dbJob.id; jobsInserted++; }
  } catch (err) {
    console.error(`\n  ❌ Job ${j["_id"]}: ${err.message}`);
  }
}
console.log(`✅ Jobs: ${jobsInserted}/${jobs.length} upserted`);

// ── 3. Seed Interested Artists ─────────────────────────────────────────────────
console.log("\n📋 Step 3: Fetching Lambarri interested artists...");
const interestedArtists = await fetchAllBubbleRecords("interested-artist", [
  { key: "Client", constraint_type: "equals", value: LAMBARRI_BUBBLE_ID },
]);
console.log(`\n  Found ${interestedArtists.length} interested artists`);

const artistBubbleIds = new Set();
let iaInserted = 0;
const iaBubbleIdToDbId = {};

for (const ia of interestedArtists) {
  const artistBubbleId = arr1(ia["Artist"]);
  const jobBubbleId = arr1(ia["Request"]);
  if (artistBubbleId) artistBubbleIds.add(artistBubbleId);
  const jobDbId = jobBubbleId ? jobBubbleIdToDbId[jobBubbleId] : null;

  try {
    await db.execute(
      `INSERT INTO interested_artists (
        bubbleId, jobId, bubbleRequestId, bubbleArtistId, clientUserId, bubbleClientId,
        bubbleBookingId, status, converted,
        isHourlyRate, artistHourlyRate, clientHourlyRate, artistFlatRate, clientFlatRate,
        totalHours, startDate, endDate, message,
        bubbleCreatedAt, bubbleModifiedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        status=VALUES(status), converted=VALUES(converted),
        artistHourlyRate=VALUES(artistHourlyRate), clientHourlyRate=VALUES(clientHourlyRate),
        bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
      [
        ia["_id"], jobDbId ?? null, jobBubbleId ?? null,
        artistBubbleId ?? null, LAMBARRI_DB_ID, LAMBARRI_BUBBLE_ID,
        arr1(ia["Booking"]) ?? null,
        ia["Status"] ?? "Interested",
        parseBoolean(ia["Converted?"]) ?? 0,
        parseBoolean(ia["is hourly rate?"]) ?? 0,
        parseFloat2(ia["Artist Hourly Rate"]),
        parseFloat2(ia["Client Hourly Rate"]),
        parseFloat2(ia["Artist Flat Rate"]),
        parseFloat2(ia["Client Flat Rate"]),
        parseFloat2(ia["Total Hours"]),
        parseDate(ia["Start Date"]),
        parseDate(ia["End Date"]),
        ia["Message"] ?? null,
        parseDate(ia["Created Date"]), parseDate(ia["Modified Date"]),
      ]
    );
    const [[dbIa]] = await db.execute("SELECT id FROM interested_artists WHERE bubbleId = ?", [ia["_id"]]);
    if (dbIa) { iaBubbleIdToDbId[ia["_id"]] = dbIa.id; iaInserted++; }
  } catch (err) {
    console.error(`\n  ❌ IA ${ia["_id"]}: ${err.message}`);
  }
}
console.log(`✅ Interested artists: ${iaInserted}/${interestedArtists.length} upserted`);

// ── 4. Seed Bookings ───────────────────────────────────────────────────────────
console.log("\n📋 Step 4: Fetching Lambarri bookings...");
const bookings = await fetchAllBubbleRecords("booking", [
  { key: "Client", constraint_type: "equals", value: LAMBARRI_BUBBLE_ID },
]);
console.log(`\n  Found ${bookings.length} bookings`);

let bookingsInserted = 0;
const bookingBubbleIdToDbId = {};

for (const b of bookings) {
  const artistBubbleId = arr1(b["Artist"]);
  const jobBubbleId = arr1(b["Request"]);
  const iaBubbleId = arr1(b["Interested Artist"]);
  if (artistBubbleId) artistBubbleIds.add(artistBubbleId);

  const jobDbId = jobBubbleId ? jobBubbleIdToDbId[jobBubbleId] : null;
  const iaDbId = iaBubbleId ? iaBubbleIdToDbId[iaBubbleId] : null;
  const loc = b["Location"] ?? {};

  try {
    await db.execute(
      `INSERT INTO bookings (
        bubbleId, clientUserId, bubbleClientId, jobId, bubbleRequestId,
        interestedArtistId, bubbleInterestedArtistId, bubbleArtistId,
        bookingStatus, paymentStatus,
        clientRate, artistRate, totalClientRate, totalArtistRate,
        grossProfit, stripeFee, postFeeRevenue,
        startDate, endDate,
        locationAddress, locationLat, locationLng,
        description, addedToSpreadsheet, deleted,
        bubbleCreatedAt, bubbleModifiedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        bookingStatus=VALUES(bookingStatus), paymentStatus=VALUES(paymentStatus),
        clientRate=VALUES(clientRate), artistRate=VALUES(artistRate),
        totalClientRate=VALUES(totalClientRate), totalArtistRate=VALUES(totalArtistRate),
        grossProfit=VALUES(grossProfit), bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
      [
        b["_id"], LAMBARRI_DB_ID, LAMBARRI_BUBBLE_ID,
        jobDbId ?? null, jobBubbleId ?? null,
        iaDbId ?? null, iaBubbleId ?? null,
        artistBubbleId ?? null,
        b["_Option_Booking_Status"] ?? b["Booking Status"] ?? "Confirmed",
        b["_Option_Payment_Status"] ?? b["Payment Status"] ?? "Unpaid",
        parseFloat2(b["Client Rate"]),
        parseFloat2(b["Artist Rate"]),
        parseFloat2(b["Total Client Rate (Client Rate + Reimbursements)"]),
        parseFloat2(b["Total Artist Rate (Artist Rate + Reimbursements)"]),
        parseFloat2(b["Gross Profit"]),
        parseFloat2(b["stripe fee"]),
        parseFloat2(b["Post Fee Revenue"]),
        parseDate(b["Start date"] ?? b["Start Date"]),
        parseDate(b["End date"] ?? b["End Date"]),
        loc.address ?? null, loc.lat ?? null, loc.lng ?? null,
        b["Description"] ?? null,
        parseBoolean(b["Added to Spreadsheet?"]) ?? 0,
        parseBoolean(b["deleted?"]) ?? 0,
        parseDate(b["Created Date"]), parseDate(b["Modified Date"]),
      ]
    );
    const [[dbB]] = await db.execute("SELECT id FROM bookings WHERE bubbleId = ?", [b["_id"]]);
    if (dbB) { bookingBubbleIdToDbId[b["_id"]] = dbB.id; bookingsInserted++; }
  } catch (err) {
    console.error(`\n  ❌ Booking ${b["_id"]}: ${err.message}`);
  }
}
console.log(`✅ Bookings: ${bookingsInserted}/${bookings.length} upserted`);

// ── 5. Seed Payments ───────────────────────────────────────────────────────────
console.log("\n📋 Step 5: Fetching Lambarri payments...");
const payments = await fetchAllBubbleRecords("payment", [
  { key: "Client", constraint_type: "equals", value: LAMBARRI_BUBBLE_ID },
]);
console.log(`\n  Found ${payments.length} payments`);

let paymentsInserted = 0;
for (const p of payments) {
  const bookingBubbleId = arr1(p["Booking"]);
  const bookingDbId = bookingBubbleId ? bookingBubbleIdToDbId[bookingBubbleId] : null;

  try {
    await db.execute(
      `INSERT INTO payments (
        bubbleId, clientUserId, bookingId, bubbleBookingId,
        stripeId, stripeStatus, status,
        stripeAmount, stripeApplicationFee, stripeApplicationFeeAmount,
        stripeCardBrand, stripeCardLast4, stripeCardName,
        stripeDescription, stripeReceiptUrl,
        paymentDate, bubbleCreatedAt, bubbleModifiedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        status=VALUES(status), stripeStatus=VALUES(stripeStatus),
        stripeAmount=VALUES(stripeAmount),
        stripeApplicationFeeAmount=VALUES(stripeApplicationFeeAmount),
        bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
      [
        p["_id"], LAMBARRI_DB_ID, bookingDbId ?? null, bookingBubbleId ?? null,
        p["Stripe ID"] ?? null,
        p["Stripe Status"] ?? null,
        p["Status"] ?? null,
        parseFloat2(p["Stripe Amount"]),
        parseFloat2(p["Stripe Application Fee"]),
        parseFloat2(p["Stripe Application Fee Amount"]),
        p["Stripe Card Brand"] ?? null,
        p["Stripe Card Last 4"] ?? null,
        p["Stripe Card Name"] ?? null,
        p["Stripe Description"] ?? null,
        p["Stripe Receipt URL"] ?? null,
        parseDate(p["Payment Date"] ?? p["Created Date"]),
        parseDate(p["Created Date"]), parseDate(p["Modified Date"]),
      ]
    );
    paymentsInserted++;
  } catch (err) {
    console.error(`\n  ❌ Payment ${p["_id"]}: ${err.message}`);
  }
}
console.log(`✅ Payments: ${paymentsInserted}/${payments.length} upserted`);

// ── 6. Seed Artist Users ───────────────────────────────────────────────────────
console.log(`\n📋 Step 6: Fetching ${artistBubbleIds.size} unique artist user records...`);
const artistIdsArr = [...artistBubbleIds];
let artistsUpserted = 0;
const artistBubbleToDbId = {};

for (let i = 0; i < artistIdsArr.length; i += 10) {
  const batch = artistIdsArr.slice(i, i + 10);
  await Promise.all(batch.map(async (bubbleId) => {
    try {
      const resp = await fetch(`${BUBBLE_API_BASE}/user/${bubbleId}`, {
        headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
      });
      if (!resp.ok) return;
      const au = (await resp.json()).response;
      if (!au) return;

      const apic = au["Profile Picture"];
      const apicUrl = apic ? (apic.startsWith("//") ? "https:" + apic : apic) : null;

      await db.execute(
        `INSERT INTO users (
          openId, bubbleId, email, firstName, lastName, name, slug, profilePicture,
          userRole, pronouns, masterArtistTypes, artistServices, artistDisciplines,
          location, artswrkPro, artswrkBasic,
          bubbleCreatedAt, bubbleModifiedAt, lastSignedIn
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
        ON DUPLICATE KEY UPDATE
          firstName=VALUES(firstName), lastName=VALUES(lastName),
          name=VALUES(name), slug=VALUES(slug), profilePicture=VALUES(profilePicture),
          userRole=VALUES(userRole), pronouns=VALUES(pronouns),
          masterArtistTypes=VALUES(masterArtistTypes),
          artistServices=VALUES(artistServices), artistDisciplines=VALUES(artistDisciplines),
          location=VALUES(location), artswrkPro=VALUES(artswrkPro),
          artswrkBasic=VALUES(artswrkBasic), bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          `bubble_${bubbleId}`,
          bubbleId,
          au["authentication"]?.email?.email ?? `${bubbleId}@artswrk.com`,
          au["First Name"] ?? null, au["Last Name"] ?? null,
          au["Full Name"] ?? null, au["Slug"] ?? null, apicUrl,
          "Artist", au["Pronouns"] ?? null,
          JSON.stringify(au["Master Artist Types"] ?? []),
          JSON.stringify(au["Artist Services"] ?? []),
          JSON.stringify(au["Artist Disciplines"] ?? []),
          au["Location"] ? JSON.stringify(au["Location"]) : null,
          parseBoolean(au["Artswrk PRO"]) ?? 0,
          parseBoolean(au["Artswrk Basic"]) ?? 0,
          parseDate(au["Created Date"]), parseDate(au["Modified Date"]),
        ]
      );

      const [[dbUser]] = await db.execute("SELECT id FROM users WHERE bubbleId = ?", [bubbleId]);
      if (dbUser) { artistBubbleToDbId[bubbleId] = dbUser.id; artistsUpserted++; }
    } catch (err) {
      console.error(`\n  ❌ Artist ${bubbleId}: ${err.message}`);
    }
  }));
  await new Promise((r) => setTimeout(r, 300));
  process.stdout.write(`  Progress: ${Math.min(i + 10, artistIdsArr.length)}/${artistIdsArr.length}\r`);
}
console.log(`\n✅ Artist users: ${artistsUpserted}/${artistIdsArr.length} upserted`);

// ── 7. Back-fill artistUserId FKs ─────────────────────────────────────────────
console.log("\n📋 Step 7: Back-filling artistUserId FKs...");
let iaFkUpdated = 0, bookingFkUpdated = 0;

for (const [bubbleId, dbId] of Object.entries(artistBubbleToDbId)) {
  const [r1] = await db.execute(
    "UPDATE interested_artists SET artistUserId = ? WHERE bubbleArtistId = ? AND bubbleClientId = ?",
    [dbId, bubbleId, LAMBARRI_BUBBLE_ID]
  );
  iaFkUpdated += r1.affectedRows;

  const [r2] = await db.execute(
    "UPDATE bookings SET artistUserId = ? WHERE bubbleArtistId = ? AND bubbleClientId = ?",
    [dbId, bubbleId, LAMBARRI_BUBBLE_ID]
  );
  bookingFkUpdated += r2.affectedRows;
}
console.log(`✅ FK back-fill: ${iaFkUpdated} interested_artists, ${bookingFkUpdated} bookings updated`);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log("\n🎉 Lambarri seed complete!");
console.log(`   User:               Alexa S. / Lambarri Dance Arts (DB id: ${LAMBARRI_DB_ID})`);
console.log(`   Jobs:               ${jobsInserted}`);
console.log(`   Interested Artists: ${iaInserted}`);
console.log(`   Bookings:           ${bookingsInserted}`);
console.log(`   Payments:           ${paymentsInserted}`);
console.log(`   Artist users:       ${artistsUpserted}`);

await db.end();
