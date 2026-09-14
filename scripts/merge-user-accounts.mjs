/**
 * Merges one duplicate account into another — for a person who ended up with
 * two user rows (say a Bubble-migrated account and a second one on the same
 * email), where login and password reset can drop them into the empty one.
 *
 *   node scripts/merge-user-accounts.mjs --keep <userId> --from <userId>           # preview, changes nothing
 *   node scripts/merge-user-accounts.mjs --keep <userId> --from <userId> --apply   # do it, in one transaction
 *   node scripts/merge-user-accounts.mjs --keep <userId> --from-email <email>      # find the duplicate by email
 *
 * KEEP is the account that stays — normally the one with the profile, Stripe
 * customer and PRO. FROM is the duplicate. Everything attached to FROM
 * (applications, bookings, messages, payments, saved artists, settings) moves
 * to KEEP. Unlike merge-and-remove-duplicate-accounts-2026-08-29.mjs, nothing
 * the person did is deleted; the only rows removed are exact duplicates of
 * something KEEP already has, and conversations emptied by moving their
 * messages into KEEP's thread with the same person.
 *
 * FROM is retired, not deleted: email, password, slug, Stripe and plan fields
 * are cleared, its bubbleId moves to KEEP if KEEP has none, and its openId is
 * changed so any session still signed into it ends. The row stays so anything
 * this script doesn't know about still points at a real id.
 *
 * KEEP gets FROM's password when FROM was signed into more recently — that is
 * the password the person is using now.
 *
 * Refuses when either account is an admin, when both have their own Stripe
 * subscription (check Stripe for a double charge first), or when a move would
 * break a uniqueness rule it can't settle on its own.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import os from "os";
import path from "path";

const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };
const KEEP = Number(arg("--keep"));
let FROM = Number(arg("--from"));
const FROM_EMAIL = arg("--from-email");
const APPLY = process.argv.includes("--apply");

const validId = (n) => Number.isInteger(n) && n > 0;
if (!validId(KEEP) || (!FROM_EMAIL && !validId(FROM)) || KEEP === FROM) {
  console.error([
    "Usage:",
    "  node scripts/merge-user-accounts.mjs --keep <userId> --from <userId> [--apply]",
    "  node scripts/merge-user-accounts.mjs --keep <userId> --from-email <email> [--apply]",
    "Use real account numbers, e.g. --keep 781359.",
  ].join("\n"));
  process.exit(1);
}

/** Columns that point at users.id and can simply be re-pointed. */
const SIMPLE_REFS = [
  ["acquisition_leads", "convertedUserId"],
  ["acquisition_sessions", "createdByUserId"],
  ["artist_experiences", "artistUserId"],
  ["artist_resumes", "artistUserId"],
  ["artist_reviews", "artistUserId"],
  ["artist_reviews", "clientUserId"],
  ["artist_service_categories", "artistUserId"],
  ["bookings", "artistUserId"],
  ["bookings", "clientUserId"],
  ["client_company_memberships", "userId"],
  ["client_job_unlocks", "clientUserId"],
  ["enterprise_job_unlocks", "clientUserId"],
  ["eoy_email_snapshots", "artistUserId"],
  ["interested_artists", "artistUserId"],
  ["interested_artists", "clientUserId"],
  ["jobs", "clientUserId"],
  ["leads_contacts", "artswrkUserId"],
  ["messages", "senderUserId"],
  ["payments", "clientUserId"],
  ["premium_job_interested_artists", "artistUserId"],
  ["premium_jobs", "createdByUserId"],
  ["referrals", "invitedUserId"],
  ["referrals", "referrerUserId"],
  ["reimbursements", "artistUserId"],
  ["saved_artists", "artistUserId"],
  ["saved_artists", "clientUserId"],
  ["user_affiliations", "artistUserId"],
];

/** Duplicates KEEP already has, removed before re-pointing so nothing doubles up. */
const DEDUPES = [
  { label: "saved_artists (same artist already saved)", table: "saved_artists",
    join: "k.clientUserId = ? AND k.artistUserId = f.artistUserId", where: "f.clientUserId = ?" },
  { label: "saved_artists (already saved by the same client)", table: "saved_artists",
    join: "k.artistUserId = ? AND k.clientUserId = f.clientUserId", where: "f.artistUserId = ?" },
  { label: "user_affiliations (same affiliation)", table: "user_affiliations",
    join: "k.artistUserId = ? AND k.affiliationId = f.affiliationId", where: "f.artistUserId = ?" },
  { label: "email_send_log (same job already logged)", table: "email_send_log",
    join: "k.userId = ? AND k.jobId <=> f.jobId AND k.premiumJobId <=> f.premiumJobId", where: "f.userId = ?" },
];

const PROFILE_FIELDS = [
  "email", "firstName", "lastName", "name", "slug", "profilePicture", "phoneNumber", "bio", "pronouns",
  "artistDisciplines", "artistServices", "masterServiceType", "masterArtistTypes", "masterStyles",
  "artistExperiences", "location", "locationLat", "locationLng", "locationCity", "locationState",
  "locationCountry", "locationPlaceId", "portfolio", "website", "instagram", "tiktok", "youtube",
  "resumes", "videos", "mediaPhotos", "resumeFiles", "tagline", "credits", "workTypes",
  "clientCompanyName", "hiringCategory", "businessType", "businessOrIndividual", "artistBusinessName",
  "artistTransportationAccommodation", "optionAvailability",
  "artistStripeAccountId", "artistStripeReturnCode", "artistStripeProductId", "artistStripeDateCreated",
];
const SUBSCRIPTION_IDS = ["stripeSubscriptionId", "clientSubscriptionId", "enterpriseStripeSubscriptionId"];
const SUBSCRIPTION_BUNDLE = [
  "planTier", "stripeCustomerId", "stripeSubscriptionId", "stripePriceId",
  "artswrkPro", "artswrkBasic", "clientPremium", "enterprise", "enterprisePlan",
  "enterpriseStripeCustomerId", "enterpriseStripeSubscriptionId", "enterpriseSubInterval",
  "clientStripeCustomerId", "clientStripeCardId", "clientSubscriptionId",
];
const CUSTOMER_IDS = ["stripeCustomerId", "clientStripeCustomerId", "clientStripeCardId", "enterpriseStripeCustomerId"];
const PLAN_FLAGS = ["artswrkPro", "artswrkBasic", "clientPremium", "enterprise"];

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z" });
const q = async (sql, params = []) => (await conn.query(sql, params))[0];

const columnCache = new Map();
async function columnsOf(table) {
  if (!columnCache.has(table)) {
    const rows = await q(
      "SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [table],
    );
    columnCache.set(table, new Set(rows.map((r) => r.c)));
  }
  return columnCache.get(table);
}
const has = async (table, column) => (await columnsOf(table)).has(column);
const blank = (v) => v === null || v === undefined || v === "";
const paidTier = (t) => !!t && !/_free$|_on_demand$/.test(t);

try {
  if (FROM_EMAIL) {
    const email = FROM_EMAIL.trim().toLowerCase();
    const matches = await q("SELECT id FROM users WHERE LOWER(email) = ?", [email]);
    if (matches.length !== 1) {
      console.error(matches.length
        ? `More than one account uses ${email} (ids ${matches.map((m) => m.id).join(", ")}). Pass --from <id> instead. Nothing changed.`
        : `No account uses ${email}. Nothing changed.`);
      process.exit(1);
    }
    FROM = Number(matches[0].id);
    if (FROM === KEEP) {
      console.error(`${email} already belongs to account ${KEEP}. Nothing to merge.`);
      process.exit(1);
    }
    console.log(`Found account ${FROM} for ${email}.\n`);
  }

  const [keep] = await q("SELECT * FROM users WHERE id = ?", [KEEP]);
  const [from] = await q("SELECT * FROM users WHERE id = ?", [FROM]);
  if (!keep || !from) {
    console.error(`No user with id ${!keep ? KEEP : FROM}. Nothing changed.`);
    process.exit(1);
  }

  const blockers = [];
  if (keep.role === "admin" || from.role === "admin") blockers.push("One of these accounts is an admin.");
  if (String(keep.openId).startsWith("merged_") || String(from.openId).startsWith("merged_")) {
    blockers.push("One of these accounts has already been merged.");
  }
  if ((await has("users", "deactivatedAt")) && (keep.deactivatedAt || from.deactivatedAt)) {
    blockers.push("One of these accounts is deactivated.");
  }
  for (const f of SUBSCRIPTION_IDS) {
    if (keep[f] && from[f] && keep[f] !== from[f]) {
      blockers.push(`Both accounts have their own ${f} (${keep[f]} and ${from[f]}). Check Stripe for a double charge and cancel one first.`);
    }
  }

  // ── Plan the KEEP row's updates ──────────────────────────────────────────
  const userCols = await columnsOf("users");
  const keepUpdates = {};
  for (const f of PROFILE_FIELDS) {
    if (userCols.has(f) && blank(keep[f]) && !blank(from[f])) keepUpdates[f] = from[f];
  }
  if (blank(keep.bubbleId) && !blank(from.bubbleId)) {
    keepUpdates.bubbleId = from.bubbleId;
    keepUpdates.bubbleSourcePresent = from.bubbleSourcePresent;
  }

  const keepHasSub = SUBSCRIPTION_IDS.some((f) => !blank(keep[f]));
  const fromHasSub = SUBSCRIPTION_IDS.some((f) => !blank(from[f]));
  if (!keepHasSub && fromHasSub) {
    // Take the whole bundle from one row, so IDs from two Stripe customers never mix.
    for (const f of SUBSCRIPTION_BUNDLE) if (userCols.has(f) && !blank(from[f])) keepUpdates[f] = from[f];
  } else {
    for (const f of CUSTOMER_IDS) if (blank(keep[f]) && !blank(from[f])) keepUpdates[f] = from[f];
    for (const f of PLAN_FLAGS) if (!keep[f] && from[f]) keepUpdates[f] = from[f];
    if (!paidTier(keep.planTier) && paidTier(from.planTier)) keepUpdates.planTier = from.planTier;
  }

  const fromSignedInLater = new Date(from.lastSignedIn) > new Date(keep.lastSignedIn);
  if (!blank(from.passwordHash) && (blank(keep.passwordHash) || fromSignedInLater)) {
    keepUpdates.passwordHash = from.passwordHash;
    keepUpdates.passwordIsTemporary = from.passwordIsTemporary;
  }
  if (fromSignedInLater) keepUpdates.lastSignedIn = from.lastSignedIn;
  if ((from.onboardingStep ?? 0) > (keep.onboardingStep ?? 0)) keepUpdates.onboardingStep = from.onboardingStep;
  if (!keep.userSignedUp && from.userSignedUp) keepUpdates.userSignedUp = from.userSignedUp;

  const retire = {
    email: null, passwordHash: null, slug: null, bubbleId: null, bubbleSourcePresent: 0,
    openId: `merged_${FROM}_into_${KEEP}`,
    stripeCustomerId: null, stripeSubscriptionId: null, stripePriceId: null,
    clientStripeCustomerId: null, clientStripeCardId: null, clientSubscriptionId: null,
    enterpriseStripeCustomerId: null, enterpriseStripeSubscriptionId: null,
    artistStripeAccountId: null, artistStripeProductId: null,
    artswrkPro: 0, artswrkBasic: 0, clientPremium: 0, enterprise: 0, enterprisePlan: null, planTier: null,
    priorityList: 0, source: `merged into user ${KEEP}`,
    deactivatedAt: new Date(), deactivatedBy: "merge-user-accounts script",
  };
  for (const f of Object.keys(retire)) if (!userCols.has(f)) delete retire[f];

  // ── Count what moves ─────────────────────────────────────────────────────
  const moves = [];
  for (const [table, column] of SIMPLE_REFS) {
    if (!(await has(table, column))) continue;
    const [{ n }] = await q(`SELECT COUNT(*) n FROM \`${table}\` WHERE \`${column}\` = ?`, [FROM]);
    if (Number(n)) moves.push({ table, column, n: Number(n) });
  }

  const dedupes = [];
  for (const d of DEDUPES) {
    if (!(await columnsOf(d.table)).size) continue;
    const [{ n }] = await q(
      `SELECT COUNT(*) n FROM \`${d.table}\` f JOIN \`${d.table}\` k ON ${d.join} WHERE ${d.where}`, [KEEP, FROM],
    );
    if (Number(n)) dedupes.push({ ...d, n: Number(n) });
  }

  const hasSettings = (await columnsOf("user_notification_settings")).size > 0;
  const [fromSettings] = hasSettings ? await q("SELECT userId FROM user_notification_settings WHERE userId = ?", [FROM]) : [];
  const [keepSettings] = hasSettings ? await q("SELECT userId FROM user_notification_settings WHERE userId = ?", [KEEP]) : [];

  const companyConflicts = (await columnsOf("client_companies")).size
    ? await q(
      `SELECT f.id, f.name FROM client_companies f
       JOIN client_companies k ON k.ownerUserId = ? AND k.name = f.name
       WHERE f.ownerUserId = ?`, [KEEP, FROM])
    : [];
  for (const c of companyConflicts) {
    blockers.push(`Both accounts own a client company named "${c.name}" (id ${c.id}). Rename or merge it first.`);
  }
  const [{ n: companyCount }] = (await columnsOf("client_companies")).size
    ? await q("SELECT COUNT(*) n FROM client_companies WHERE ownerUserId = ?", [FROM])
    : [{ n: 0 }];

  const fromConvs = await q(
    "SELECT id, clientUserId, artistUserId, lastMessageDate, unreadCount FROM conversations WHERE clientUserId = ? OR artistUserId = ?",
    [FROM, FROM],
  );
  const convPlan = [];
  for (const c of fromConvs) {
    const asClient = c.clientUserId === FROM;
    const other = asClient ? c.artistUserId : c.clientUserId;
    if (other === KEEP) { blockers.push(`Conversation ${c.id} is between the two accounts themselves. Resolve it by hand.`); continue; }
    const [match] = await q(
      asClient
        ? "SELECT id FROM conversations WHERE clientUserId = ? AND artistUserId = ? LIMIT 1"
        : "SELECT id FROM conversations WHERE artistUserId = ? AND clientUserId = ? LIMIT 1",
      [KEEP, other],
    );
    convPlan.push({ conv: c, into: match?.id ?? null });
  }
  const convRefTables = (await q(
    "SELECT DISTINCT TABLE_NAME t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'conversationId' AND TABLE_NAME <> 'conversations'",
  )).map((r) => r.t);

  // ── Preview ──────────────────────────────────────────────────────────────
  const summary = (u) => ({
    id: u.id, email: u.email, name: u.name, bubbleId: u.bubbleId, bubbleSourcePresent: !!u.bubbleSourcePresent,
    hasPassword: !blank(u.passwordHash), lastSignedIn: u.lastSignedIn, planTier: u.planTier, artswrkPro: !!u.artswrkPro,
    stripeCustomerId: u.stripeCustomerId, stripeSubscriptionId: u.stripeSubscriptionId, slug: u.slug,
    hasBio: !blank(u.bio), hasPhoto: !blank(u.profilePicture),
  });
  console.log(APPLY ? "MERGING" : "PREVIEW — nothing will change (add --apply to merge)");
  console.log("\nKEEP"); console.table([summary(keep)]);
  console.log("FROM (duplicate, will be retired)"); console.table([summary(from)]);

  console.log("\nFields copied onto KEEP:");
  const shown = Object.entries(keepUpdates).map(([f, v]) => [f, f === "passwordHash" ? "(FROM's password — signed in more recently)" : v]);
  console.log(shown.length ? shown.map(([f, v]) => `  ${f}: ${v instanceof Date ? v.toISOString() : v}`).join("\n") : "  (none)");

  console.log("\nRecords moving from FROM to KEEP:");
  console.log(moves.length ? moves.map((m) => `  ${m.table}.${m.column}: ${m.n}`).join("\n") : "  (none)");
  if (Number(companyCount)) console.log(`  client_companies.ownerUserId: ${companyCount}`);
  if (fromSettings) console.log(`  user_notification_settings: ${keepSettings ? "KEEP already has settings — FROM's are dropped" : "moved"}`);
  for (const p of convPlan) {
    console.log(p.into
      ? `  conversation ${p.conv.id}: messages move into KEEP's existing thread ${p.into} with the same person, then the empty thread is removed`
      : `  conversation ${p.conv.id}: moves to KEEP`);
  }
  if (dedupes.length) {
    console.log("\nExact duplicates of what KEEP already has (removed, not moved):");
    console.log(dedupes.map((d) => `  ${d.label}: ${d.n}`).join("\n"));
  }
  const [{ n: resetTokens }] = await q("SELECT COUNT(*) n FROM password_reset_tokens WHERE userId = ?", [FROM]);
  if (Number(resetTokens)) console.log(`\nFROM's unused password reset links removed: ${resetTokens}`);

  console.log("\nFROM is then retired: email, password, slug, Stripe and plan fields cleared; login id changed to end its sessions.");

  if (blockers.length) {
    console.log("\nCan't merge these accounts yet:");
    console.log(blockers.map((b) => `  ✗ ${b}`).join("\n"));
    process.exit(1);
  }
  if (!APPLY) {
    console.log("\nLooks mergeable. Re-run with --apply to merge.");
    process.exit(0);
  }

  // ── Apply, all or nothing ────────────────────────────────────────────────
  const record = { keep: KEEP, from: FROM, at: new Date().toISOString(), keepBefore: keep, fromBefore: from, moved: {} };
  await conn.beginTransaction();

  for (const p of convPlan) {
    if (p.into) {
      for (const t of convRefTables) {
        await q(`UPDATE \`${t}\` SET conversationId = ? WHERE conversationId = ?`, [p.into, p.conv.id]);
      }
      await q(
        `UPDATE conversations
         SET lastMessageDate = GREATEST(COALESCE(lastMessageDate, ?), COALESCE(?, lastMessageDate)),
             unreadCount = COALESCE(unreadCount, 0) + ?
         WHERE id = ?`,
        [p.conv.lastMessageDate, p.conv.lastMessageDate, Number(p.conv.unreadCount ?? 0), p.into],
      );
      await q("DELETE FROM conversations WHERE id = ?", [p.conv.id]);
    } else {
      await q(
        `UPDATE conversations
         SET clientUserId = IF(clientUserId = ?, ?, clientUserId), artistUserId = IF(artistUserId = ?, ?, artistUserId)
         WHERE id = ?`,
        [FROM, KEEP, FROM, KEEP, p.conv.id],
      );
    }
  }
  record.moved.conversations = convPlan.map((p) => ({ id: p.conv.id, mergedInto: p.into }));

  for (const d of dedupes) {
    await q(`DELETE f FROM \`${d.table}\` f JOIN \`${d.table}\` k ON ${d.join} WHERE ${d.where}`, [KEEP, FROM]);
  }
  if (fromSettings) {
    if (keepSettings) await q("DELETE FROM user_notification_settings WHERE userId = ?", [FROM]);
    else await q("UPDATE user_notification_settings SET userId = ? WHERE userId = ?", [KEEP, FROM]);
  }
  await q("DELETE FROM password_reset_tokens WHERE userId = ?", [FROM]);

  for (const m of moves) {
    if (await has(m.table, "id")) {
      record.moved[`${m.table}.${m.column}`] = (await q(`SELECT id FROM \`${m.table}\` WHERE \`${m.column}\` = ?`, [FROM])).map((r) => r.id);
    }
    await q(`UPDATE \`${m.table}\` SET \`${m.column}\` = ? WHERE \`${m.column}\` = ?`, [KEEP, FROM]);
  }
  if (Number(companyCount)) {
    record.moved["client_companies.ownerUserId"] = (await q("SELECT id FROM client_companies WHERE ownerUserId = ?", [FROM])).map((r) => r.id);
    await q("UPDATE client_companies SET ownerUserId = ? WHERE ownerUserId = ?", [KEEP, FROM]);
  }

  // Retire FROM before updating KEEP, so no moment has both rows holding the same bubbleId or email.
  const setClause = (obj) => Object.keys(obj).map((f) => `\`${f}\` = ?`).join(", ");
  await q(`UPDATE users SET ${setClause(retire)} WHERE id = ?`, [...Object.values(retire), FROM]);
  if (Object.keys(keepUpdates).length) {
    await q(`UPDATE users SET ${setClause(keepUpdates)} WHERE id = ?`, [...Object.values(keepUpdates), KEEP]);
  }

  await conn.commit();

  const logPath = path.join(os.homedir(), "Downloads", `artswrk-merge-user-${FROM}-into-${KEEP}-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(record, null, 2));

  const [after] = await q("SELECT * FROM users WHERE id = ?", [KEEP]);
  console.log("\nMerged. KEEP now:"); console.table([summary(after)]);
  const left = [];
  for (const [table, column] of SIMPLE_REFS) {
    if (!(await has(table, column))) continue;
    const [{ n }] = await q(`SELECT COUNT(*) n FROM \`${table}\` WHERE \`${column}\` = ?`, [FROM]);
    if (Number(n)) left.push(`${table}.${column}: ${n}`);
  }
  console.log(left.length ? `Still pointing at FROM (unexpected): ${left.join(", ")}` : "Nothing points at FROM any more.");
  console.log(`\nBefore/after record for undo: ${logPath}`);
} catch (err) {
  try { await conn.rollback(); } catch {}
  console.error(`\nFailed — ${APPLY ? "rolled back, nothing changed" : "nothing changed"}: ${err.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
