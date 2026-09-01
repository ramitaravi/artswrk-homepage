/**
 * One-time catch-up import from manually-exported Bubble CSVs (2026-09-01).
 * Bubble's Data API is no longer reachable at artswrk.com post-DNS-flip, so
 * this reads CSV exports instead of hitting the API like scripts/sync-all.mjs.
 *
 * IMPORTANT difference from sync-all.mjs: Bubble's CSV export renders USER
 * relationships as email addresses (not Bubble record ids), while non-user
 * relationships (request, booking, premiumjob, Interested Artist) still export
 * as raw Bubble ids. So user links resolve by email, everything else by id.
 *
 * INSERT-ONLY, never UPDATE: rows whose Bubble "unique id" already exists
 * locally are skipped entirely. This run only adds what's missing and never
 * overwrites anything a real user or a later sync already wrote locally.
 *
 * Usage:
 *   node scripts/import-bubble-csv-2026-09-01.mjs --dry-run   # report only
 *   node scripts/import-bubble-csv-2026-09-01.mjs             # apply
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");

const D = "/Users/ramitaravi/Downloads";
const FILES = {
  users: `${D}/export_All-Users-modified--_2026-09-01_03-44-57.csv`,
  requests: `${D}/export_All-Requests-modified_2026-09-01_03-45-47.csv`,
  premiumJobs: `${D}/export_All-Premium-Jobs-modified_2026-09-01_03-53-44.csv`,
  interestedArtists: `${D}/export_All-Interested-Artists-modified_2026-09-01_03-49-13.csv`,
  bookings: `${D}/export_All-Bookings-modified_2026-09-01_03-47-26.csv`,
  messages: `${D}/export_All-Messages-modified_2026-09-01_03-50-20.csv`,
};

const loadCsv = (p) =>
  parse(fs.readFileSync(p, "utf8"), { columns: true, skip_empty_lines: true, relax_column_count: true });

const yesNo = (v) => (v === "yes" ? 1 : 0);
const norm = (v) => (v ? String(v).trim().toLowerCase() : null);

// Bubble exports wall-clock times in a UTC-8 timezone while the DB stores true
// UTC — verified against 26 already-imported rows across bookings/jobs/users,
// every one of which sat exactly +4h from a naive local (UTC-4) parse. Parsing
// the components explicitly keeps this correct regardless of the machine's own
// timezone, which a bare `new Date(str)` would silently fold in.
const CSV_TZ_OFFSET_HOURS = 8;
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function safeDate(val) {
  if (!val) return null;
  const m = String(val).trim().match(/^(\w{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) (am|pm)$/i);
  if (!m) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, mon, day, year, hourRaw, min, ampm] = m;
  if (!(mon in MONTHS)) return null;
  let hour = Number(hourRaw) % 12;
  if (ampm.toLowerCase() === "pm") hour += 12;
  return new Date(Date.UTC(Number(year), MONTHS[mon], Number(day), hour + CSV_TZ_OFFSET_HOURS, Number(min)));
}

function safeNum(val) {
  if (val == null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log(`Connected. ${DRY_RUN ? "[DRY RUN — no writes]" : "[APPLYING]"}\n`);

  const report = {};

  // ── Users ────────────────────────────────────────────────────────────────
  {
    const rows = loadCsv(FILES.users);
    const [existingById] = await conn.execute("SELECT bubbleId FROM users WHERE bubbleId IS NOT NULL");
    const byId = new Set(existingById.map((r) => r.bubbleId));
    const [existingByEmail] = await conn.execute("SELECT email FROM users WHERE email IS NOT NULL");
    const byEmail = new Set(existingByEmail.map((r) => norm(r.email)));

    let inserted = 0, skippedExisting = 0, skippedDeleted = 0, skippedDupEmail = 0, skippedNoEmail = 0;

    for (const r of rows) {
      const bubbleId = r["unique id"];
      if (!bubbleId) continue;
      if (byId.has(bubbleId)) { skippedExisting++; continue; }
      if (r["Deleted?"] === "yes") { skippedDeleted++; continue; }

      // Bubble's built-in `email` is the field every other export joins on.
      const email = r["email"] || r["Email Address"] || null;
      if (!email) { skippedNoEmail++; continue; }
      // A different Bubble id with an email we already hold is the same person
      // under a duplicate Bubble record — never create a second local account.
      if (byEmail.has(norm(email))) { skippedDupEmail++; continue; }

      const firstName = r["First Name"] || null;
      const lastName = r["Last Name"] || null;
      const name = firstName && lastName ? `${firstName} ${lastName}` : firstName ?? lastName ?? email;
      const userRole = r["User Role"] === "Client" || r["User Role"] === "Artist" ? r["User Role"] : null;

      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO users (
            openId, bubbleId, email, firstName, lastName, name,
            profilePicture, userRole, slug, location, bio,
            instagram, website, portfolio, phoneNumber, pronouns,
            clientCompanyName, clientPremium, loginMethod,
            artistStripeAccountId, artistStripeReturnCode,
            clientStripeCustomerId, clientStripeCardId,
            bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `bubble_${bubbleId}`, bubbleId, email, firstName, lastName, name,
            r["Profile Picture"] || null, userRole, r["Slug"] || null,
            r["Location"] || null, r["Bio"] || null,
            r["Instagram"] || null, r["Website"] || null, r["Portfolio"] || null,
            r["Phone Number"] || null, r["Pronouns"] || null,
            r["Client Company Name"] || null, yesNo(r["Client Premium"]), "bubble",
            r["Artist Stripe Account ID"] || null, r["Artist Stripe Return Code"] || null,
            r["Client Stripe Customer ID"] || null, r["Client Stripe Card ID"] || null,
            safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
          ]
        );
      }
      byId.add(bubbleId);
      byEmail.add(norm(email));
      inserted++;
    }
    report.users = { csvRows: rows.length, inserted, skippedExisting, skippedDeleted, skippedDupEmail, skippedNoEmail };
    console.log(`Users: ${rows.length} in CSV → ${inserted} new`);
    console.log(`  skipped: ${skippedExisting} already present (by id), ${skippedDupEmail} email already present, ${skippedDeleted} deleted, ${skippedNoEmail} no email`);
  }

  // Lookup maps — CSV user relations are EMAILS, so email is the join key.
  const [userRows] = await conn.execute("SELECT id, bubbleId, email FROM users");
  const userByEmail = new Map();
  for (const u of userRows) if (u.email) userByEmail.set(norm(u.email), u.id);
  const userIdByBubbleId = new Map();
  for (const u of userRows) if (u.bubbleId) userIdByBubbleId.set(u.bubbleId, u.id);
  const resolveUser = (emailVal) => (emailVal ? userByEmail.get(norm(emailVal)) ?? null : null);

  // ── Premium Jobs ─────────────────────────────────────────────────────────
  {
    const rows = loadCsv(FILES.premiumJobs);
    const [existing] = await conn.execute("SELECT bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL");
    const existingSet = new Set(existing.map((r) => r.bubbleId));
    let inserted = 0, skippedExisting = 0;

    for (const r of rows) {
      const bubbleId = r["unique id"];
      if (!bubbleId) continue;
      if (existingSet.has(bubbleId)) { skippedExisting++; continue; }

      // Creator exports as "(App admin)" for these, so there's no user to link.
      const createdByUserId = resolveUser(r["Creator"]);
      const logo = r.logo ? (r.logo.startsWith("//") ? `https:${r.logo}` : r.logo) : null;

      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO premium_jobs (
            bubbleId, company, logo, createdByUserId, bubbleClientCompanyId,
            serviceType, category, description, budget, location, tag, slug,
            applyDirect, applyEmail, applyLink, workFromAnywhere, featured, status,
            bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bubbleId, r.Company || null, logo,
            createdByUserId, r["Client-Company"] || null,
            r["Service Type"] || null, r.Category || null, r.Description || null,
            r.Budget || null, r.Location || null, r.Tag || null, r.Slug || null,
            yesNo(r["Apply Direct?"]), r.email || null, r.link || null,
            yesNo(r["Work From Anywhere?"]), yesNo(r.featured), r.Status || "Active",
            safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
          ]
        );
      }
      existingSet.add(bubbleId);
      inserted++;
    }
    report.premiumJobs = { csvRows: rows.length, inserted, skippedExisting };
    console.log(`Premium Jobs: ${rows.length} in CSV → ${inserted} new, ${skippedExisting} already present`);
  }

  const [pjRows] = await conn.execute("SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IS NOT NULL");
  const premiumJobMap = new Map(pjRows.map((r) => [r.bubbleId, r.id]));

  // ── Jobs (Requests) ──────────────────────────────────────────────────────
  {
    const rows = loadCsv(FILES.requests);
    const [existing] = await conn.execute("SELECT bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
    const existingSet = new Set(existing.map((r) => r.bubbleId));
    let inserted = 0, skippedExisting = 0;

    for (const r of rows) {
      const bubbleId = r["unique id"];
      if (!bubbleId) continue;
      if (existingSet.has(bubbleId)) { skippedExisting++; continue; }

      // `client` is the hirer this job belongs to; `Creator` is often an admin
      // who posted it on their behalf, so prefer client and fall back.
      const clientUserId = resolveUser(r["client"]) ?? resolveUser(r["client email"]) ?? resolveUser(r["Creator"]);

      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO jobs (
            bubbleId, clientUserId,
            description, title, slug, requestStatus, status,
            dateType, dateDetails, startDate, endDate,
            locationAddress,
            isHourly, openRate, artistHourlyRate, clientHourlyRate,
            artistFlatRate, clientFlatRate, hours, rateType,
            ages, direct, sentToNetwork, transportation, transportationDetails,
            converted, sameDay, unlocked, outreachStatus,
            networkStatus, clientEmail,
            bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bubbleId, clientUserId,
            r.description || null, r["Job Title"] || null, r.Slug || null,
            r["Request Status"] || null, r["Status"] || r["Request Status"] || null,
            r.DateType || null, r["date details"] || null,
            safeDate(r["start date"]), safeDate(r["end date"]),
            r.location || null,
            yesNo(r["is hourly?"]), yesNo(r["open rate?"]),
            safeNum(r["artist hourly rate"]), safeNum(r["client hourly rate"]),
            safeNum(r["artist flat rate"]), safeNum(r["client flat rate"]),
            safeNum(r.hours), r["option_rateType"] || null,
            r.ages || null, yesNo(r["direct?"]), yesNo(r["sent to network?"]),
            yesNo(r["tranportation?"]), r["transportation details"] || null,
            yesNo(r["converted?"]), yesNo(r["sameDay?"]), yesNo(r["unlock?"]),
            r["outreach status"] || null,
            // Never let a backfilled job enter the job-alert queue.
            "suppressed",
            r["client email"] || null,
            safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
          ]
        );
      }
      existingSet.add(bubbleId);
      inserted++;
    }
    report.jobs = { csvRows: rows.length, inserted, skippedExisting };
    console.log(`Jobs (Requests): ${rows.length} in CSV → ${inserted} new, ${skippedExisting} already present`);
  }

  const [jobRows] = await conn.execute("SELECT id, bubbleId FROM jobs WHERE bubbleId IS NOT NULL");
  const jobMap = new Map(jobRows.map((r) => [r.bubbleId, r.id]));

  // ── Interested Artists (standard vs premium — mutually exclusive) ────────
  {
    const rows = loadCsv(FILES.interestedArtists);
    const [existingStd] = await conn.execute("SELECT bubbleId FROM interested_artists WHERE bubbleId IS NOT NULL");
    const stdSet = new Set(existingStd.map((r) => r.bubbleId));
    const [existingPrem] = await conn.execute(
      "SELECT bubbleInterestedArtistId FROM premium_job_interested_artists WHERE bubbleInterestedArtistId IS NOT NULL"
    );
    const premSet = new Set(existingPrem.map((r) => r.bubbleInterestedArtistId));

    let stdInserted = 0, stdSkipped = 0, stdNoJob = 0;
    let premInserted = 0, premSkipped = 0, premNoJob = 0;
    let neither = 0;

    for (const r of rows) {
      const bubbleId = r["unique id"];
      if (!bubbleId) continue;

      const artistUserId = resolveUser(r.artist);
      const clientUserId = resolveUser(r.client);

      if (r.premiumjob) {
        if (premSet.has(bubbleId)) { premSkipped++; continue; }
        const premiumJobId = premiumJobMap.get(r.premiumjob) ?? null;
        if (!premiumJobId) { premNoJob++; continue; }

        if (!DRY_RUN) {
          await conn.execute(
            `INSERT INTO premium_job_interested_artists (
              premiumJobId, bubblePremiumJobId,
              artistUserId, bubbleInterestedArtistId,
              message, rate, resumeLink, status,
              bubbleCreatedAt, bubbleModifiedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              premiumJobId, r.premiumjob,
              artistUserId, bubbleId,
              (r.message || "").trim() || null,
              (r["premium job rate"] || "").trim() || null,
              (r.link || "").trim() || null,
              (r.status_interestedartists || "").trim() || null,
              safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
            ]
          );
        }
        premSet.add(bubbleId);
        premInserted++;
      } else if (r.request) {
        if (stdSet.has(bubbleId)) { stdSkipped++; continue; }
        const jobId = jobMap.get(r.request) ?? null;
        if (!jobId) { stdNoJob++; continue; }

        if (!DRY_RUN) {
          await conn.execute(
            `INSERT INTO interested_artists (
              bubbleId, jobId, bubbleRequestId,
              artistUserId, clientUserId, bubbleBookingId,
              status, converted,
              isHourlyRate, artistHourlyRate, clientHourlyRate,
              artistFlatRate, clientFlatRate, totalHours,
              startDate, endDate, resumeLink, message,
              bubbleCreatedAt, bubbleModifiedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              bubbleId, jobId, r.request,
              artistUserId, clientUserId, r.booking || null,
              r.status_interestedartists || null, yesNo(r["converted?"]),
              yesNo(r["is hourly rate?"]),
              safeNum(r["artist hourly rate"]), safeNum(r["client hourly rate"]),
              safeNum(r["artist flat rate"]), safeNum(r["client flat rate"]),
              safeNum(r["total hours"]),
              safeDate(r["start date"]), safeDate(r["end date"]),
              r.link || null, r.message || null,
              safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
            ]
          );
        }
        stdSet.add(bubbleId);
        stdInserted++;
      } else {
        neither++;
      }
    }
    report.interestedArtists = { csvRows: rows.length, stdInserted, stdSkipped, stdNoJob, premInserted, premSkipped, premNoJob, neither };
    console.log(`Interested Artists: ${rows.length} in CSV`);
    console.log(`  Standard: ${stdInserted} new, ${stdSkipped} already present, ${stdNoJob} skipped (parent job not found)`);
    console.log(`  Premium:  ${premInserted} new, ${premSkipped} already present, ${premNoJob} skipped (parent premium job not found)`);
    if (neither) console.log(`  ${neither} row(s) linked to neither a request nor a premium job — skipped`);
  }

  const [iaRows] = await conn.execute("SELECT id, bubbleId FROM interested_artists WHERE bubbleId IS NOT NULL");
  const iaMap = new Map(iaRows.map((r) => [r.bubbleId, r.id]));

  // ── Bookings ─────────────────────────────────────────────────────────────
  {
    const rows = loadCsv(FILES.bookings);
    const [existing] = await conn.execute("SELECT bubbleId FROM bookings WHERE bubbleId IS NOT NULL");
    const existingSet = new Set(existing.map((r) => r.bubbleId));
    let inserted = 0, skippedExisting = 0, skippedDeleted = 0;

    for (const r of rows) {
      const bubbleId = r["unique id"];
      if (!bubbleId) continue;
      if (existingSet.has(bubbleId)) { skippedExisting++; continue; }
      if (r["deleted?"] === "yes") { skippedDeleted++; continue; }

      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO bookings (
            bubbleId, jobId, bubbleRequestId,
            interestedArtistId, bubbleInterestedArtistId,
            clientUserId, artistUserId,
            bookingStatus, paymentStatus,
            clientRate, artistRate, totalClientRate, totalArtistRate,
            grossProfit, stripeFee, postFeeRevenue,
            hours, externalPayment,
            startDate, endDate, locationAddress,
            bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bubbleId,
            r.Request ? (jobMap.get(r.Request) ?? null) : null, r.Request || null,
            r["Interested Artist"] ? (iaMap.get(r["Interested Artist"]) ?? null) : null,
            r["Interested Artist"] || null,
            resolveUser(r.Client), resolveUser(r.Artist),
            r._Option_Booking_Status || null, r._Option_Payment_Status || null,
            safeNum(r["Client Rate"]), safeNum(r["Artist Rate"]),
            safeNum(r["Total Client Rate (Client Rate + Reimbursements)"]),
            safeNum(r["Total Artist Rate (Artist Rate + Reimbursements)"]),
            safeNum(r["Gross Profit"]), safeNum(r["stripe fee"]), safeNum(r["Post Fee Revenue"]),
            safeNum(r.hours), yesNo(r["external payment?"]),
            safeDate(r["Start date"]), safeDate(r["End date"]), r.Location || null,
            safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
          ]
        );
      }
      existingSet.add(bubbleId);
      inserted++;
    }
    report.bookings = { csvRows: rows.length, inserted, skippedExisting, skippedDeleted };
    console.log(`Bookings: ${rows.length} in CSV → ${inserted} new, ${skippedExisting} already present, ${skippedDeleted} deleted`);
  }

  // ── Messages ─────────────────────────────────────────────────────────────
  // This export carries no unique id, and its `conversation` column is an
  // email rather than a conversation id — and one artist email can own many
  // conversations, so that email does NOT identify a thread. Two consequences:
  //   1. Dedup is on message content alone (a conversation-scoped key would
  //      miss existing rows and re-insert the whole file).
  //   2. A row is only inserted when its email maps to exactly ONE
  //      conversation. Guessing would file private message content into a
  //      thread the wrong client can read, so ambiguous rows are reported
  //      and left out instead.
  {
    const rows = loadCsv(FILES.messages);
    const [convoRows] = await conn.execute(
      `SELECT c.id, ua.email AS artistEmail, uc.email AS clientEmail
       FROM conversations c
       LEFT JOIN users ua ON ua.id = c.artistUserId
       LEFT JOIN users uc ON uc.id = c.clientUserId`
    );
    const convosByArtistEmail = new Map();
    // Both participants together do identify a thread, where the artist alone
    // does not — when the sender is the client, that pins it exactly.
    const convoByPair = new Map();
    for (const c of convoRows) {
      if (!c.artistEmail) continue;
      const k = norm(c.artistEmail);
      if (!convosByArtistEmail.has(k)) convosByArtistEmail.set(k, []);
      convosByArtistEmail.get(k).push(c.id);
      if (c.clientEmail) {
        const pk = `${k}|${norm(c.clientEmail)}`;
        if (!convoByPair.has(pk)) convoByPair.set(pk, []);
        convoByPair.get(pk).push(c.id);
      }
    }

    const [existingMsgs] = await conn.execute("SELECT content FROM messages");
    const seen = new Set(existingMsgs.map((m) => (m.content || "").trim()));

    let inserted = 0, skippedDup = 0, skippedNoConvo = 0, skippedAmbiguous = 0;
    const unplaced = [];

    for (const r of rows) {
      const content = (r.content || "").trim();
      if (!content) continue;
      if (seen.has(content)) { skippedDup++; continue; }

      const artistKey = norm(r.conversation);
      const senderKey = norm(r["sent by"]);
      // When the client sent it, artist+client pins the thread exactly.
      const pairMatch =
        senderKey && artistKey && senderKey !== artistKey
          ? convoByPair.get(`${artistKey}|${senderKey}`) ?? []
          : [];
      const candidates = pairMatch.length === 1 ? pairMatch : convosByArtistEmail.get(artistKey) ?? [];
      if (candidates.length === 0) {
        skippedNoConvo++;
        unplaced.push({ reason: "no conversation", convo: r.conversation || "(blank)", sentBy: r["sent by"] || "(system)", date: r["Creation Date"], preview: content.slice(0, 60) });
        continue;
      }
      if (candidates.length > 1) {
        skippedAmbiguous++;
        unplaced.push({ reason: `${candidates.length} possible conversations`, convo: r.conversation, sentBy: r["sent by"] || "(system)", date: r["Creation Date"], preview: content.slice(0, 60) });
        continue;
      }

      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO messages (
            conversationId, senderUserId, content, bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            candidates[0], resolveUser(r["sent by"]),
            r.content || null, safeDate(r["Creation Date"]), safeDate(r["Modified Date"]),
          ]
        );
      }
      seen.add(content);
      inserted++;
    }
    report.messages = { csvRows: rows.length, inserted, skippedDup, skippedNoConvo, skippedAmbiguous };
    console.log(`Messages: ${rows.length} in CSV → ${inserted} new, ${skippedDup} already present`);
    console.log(`  ${skippedNoConvo} skipped (no conversation), ${skippedAmbiguous} skipped (ambiguous conversation)`);
    if (unplaced.length) {
      console.log("  Not imported — needs manual placement:");
      unplaced.forEach((u) => console.log(`    [${u.reason}] ${u.date} from ${u.sentBy} → ${u.convo}: "${u.preview}"`));
    }
  }

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(report, null, 2));
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
