/**
 * Brings one person's history over from Bubble when it's missing on the new
 * site: their job applications (regular and PRO), conversations, and the
 * messages in them. Built for accounts whose history was lost in the Aug 29
 * duplicate cleanup or never synced, where the account itself is fine.
 *
 *   node scripts/restore-bubble-user-history.mjs --user <userId>            # preview, changes nothing
 *   node scripts/restore-bubble-user-history.mjs --user <userId> --apply    # add what's missing, one transaction
 *
 * The account must already carry its Bubble id (users.bubbleId). Everything is
 * matched on Bubble ids, so re-running is safe.
 *
 * Adds only. Nothing already on the site is overwritten or deleted. The one
 * change to an existing row: a record that points at an account which no longer
 * exists (a duplicate removed on Aug 29) is re-pointed at this account.
 *
 * Bubble Data API root comes from BUBBLE_API_BASE, defaulting to
 * https://app.artswrk.com/api/1.1/obj — artswrk.com now serves the new site.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };
const USER = Number(arg("--user"));
const APPLY = process.argv.includes("--apply");
const BUBBLE_BASE = process.env.BUBBLE_API_BASE || "https://app.artswrk.com/api/1.1/obj";

if (!Number.isInteger(USER) || USER <= 0) {
  console.error("Usage: node scripts/restore-bubble-user-history.mjs --user <userId> [--apply]\nUse the real account number, e.g. --user 781359.");
  process.exit(1);
}
if (!process.env.BUBBLE_API_KEY) {
  console.error("BUBBLE_API_KEY isn't set in .env. Nothing changed.");
  process.exit(1);
}

const safeDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const trimOrNull = (v) => (typeof v === "string" ? v.trim() || null : v ?? null);

async function bubbleAll(type, constraints) {
  const out = [];
  let cursor = 0;
  while (true) {
    const c = encodeURIComponent(JSON.stringify(constraints));
    const res = await fetch(`${BUBBLE_BASE}/${encodeURIComponent(type)}?constraints=${c}&limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${process.env.BUBBLE_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Bubble ${type} returned HTTP ${res.status}`);
    const body = await res.json();
    const batch = body?.response?.results ?? [];
    out.push(...batch);
    if (!body?.response?.remaining) break;
    cursor += batch.length;
  }
  return out;
}

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z" });
const q = async (sql, params = []) => (await conn.query(sql, params))[0];

try {
  const [user] = await q("SELECT id, bubbleId, name, openId FROM users WHERE id = ?", [USER]);
  if (!user) { console.error(`No user with id ${USER}. Nothing changed.`); process.exit(1); }
  if (!user.bubbleId) { console.error(`Account ${USER} has no Bubble id, so there's nothing to match on. Nothing changed.`); process.exit(1); }
  const BID = user.bubbleId;
  console.log(`${APPLY ? "RESTORING" : "PREVIEW — nothing will change (add --apply to restore)"}`);
  console.log(`Account ${USER} (${user.name ?? "no name"}), Bubble id ${BID}\nBubble API: ${BUBBLE_BASE}\n`);

  // ── Pull from Bubble ─────────────────────────────────────────────────────
  const apps = await bubbleAll("interested artists", [{ key: "artist", constraint_type: "equals", value: BID }]);
  const convos = [
    ...await bubbleAll("conversation", [{ key: "artist", constraint_type: "equals", value: BID }]),
    ...await bubbleAll("conversation", [{ key: "client", constraint_type: "equals", value: BID }]),
  ].filter((c, i, all) => all.findIndex((x) => x._id === c._id) === i);
  const messagesByConvo = new Map();
  for (const c of convos) {
    messagesByConvo.set(c._id, await bubbleAll("message", [{ key: "conversation", constraint_type: "equals", value: c._id }]));
  }

  // ── Local lookups by Bubble id ───────────────────────────────────────────
  const idsOf = (rows, key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))];
  const mapBy = async (sql, ids, key = "bubbleId") => {
    if (!ids.length) return new Map();
    const rows = await q(sql, [ids]);
    return new Map(rows.map((r) => [r[key], r]));
  };

  // Counterparts: several local rows can share a Bubble id — prefer the one live in Bubble, skip retired merges.
  const counterpartIds = [...new Set([
    ...idsOf(apps, "client"),
    ...convos.flatMap((c) => [c.client, c.artist]),
    ...[...messagesByConvo.values()].flat().map((m) => m["sent by"]),
  ].filter((id) => id && id !== BID))];
  const userRows = counterpartIds.length
    ? await q(
      `SELECT id, bubbleId FROM users WHERE bubbleId IN (?) AND openId NOT LIKE 'merged\\_%'
       ORDER BY bubbleSourcePresent DESC, id ASC`, [counterpartIds])
    : [];
  const localUser = new Map([[BID, USER]]);
  for (const r of userRows) if (!localUser.has(r.bubbleId)) localUser.set(r.bubbleId, r.id);

  const jobs = await mapBy("SELECT id, bubbleId FROM jobs WHERE bubbleId IN (?)", idsOf(apps.filter((a) => !a.premiumjob), "request"));
  const proJobs = await mapBy("SELECT id, bubbleId FROM premium_jobs WHERE bubbleId IN (?)", idsOf(apps, "premiumjob"));
  const existingApps = await mapBy("SELECT id, bubbleId, artistUserId FROM interested_artists WHERE bubbleId IN (?)", idsOf(apps, "_id"));
  const existingProApps = await mapBy(
    "SELECT id, bubbleInterestedArtistId, artistUserId FROM premium_job_interested_artists WHERE bubbleInterestedArtistId IN (?)",
    idsOf(apps.filter((a) => a.premiumjob), "_id"), "bubbleInterestedArtistId");
  const existingConvos = await mapBy("SELECT id, bubbleId, artistUserId, clientUserId FROM conversations WHERE bubbleId IN (?)", idsOf(convos, "_id"));
  const allMessages = [...messagesByConvo.values()].flat();
  const existingMessages = await mapBy("SELECT id, bubbleId FROM messages WHERE bubbleId IN (?)", idsOf(allMessages, "_id"));

  const liveUserIds = new Set((await q(
    "SELECT id FROM users WHERE id IN (?)",
    [[...new Set([...existingApps.values(), ...existingProApps.values()].map((r) => r.artistUserId).filter(Boolean)), 0]],
  )).map((r) => r.id));

  // ── Plan ─────────────────────────────────────────────────────────────────
  const plan = { appsAdd: [], appsRepoint: [], appsHave: 0, appsSkip: [], convosAdd: [], convosHave: 0, convosSkip: [], msgsAdd: [], msgsHave: 0, msgsSkip: 0 };

  for (const a of apps) {
    const when = a["Created Date"]?.slice(0, 10);
    if (a.premiumjob) {
      const have = existingProApps.get(a._id);
      if (have) {
        if (have.artistUserId !== USER && !liveUserIds.has(have.artistUserId)) plan.appsRepoint.push({ table: "premium_job_interested_artists", id: have.id, when });
        else plan.appsHave++;
      } else if (proJobs.has(a.premiumjob)) plan.appsAdd.push({ a, pro: true, when });
      else plan.appsSkip.push(`PRO application from ${when}: that PRO job isn't on the new site`);
    } else {
      const have = existingApps.get(a._id);
      if (have) {
        if (have.artistUserId !== USER && !liveUserIds.has(have.artistUserId)) plan.appsRepoint.push({ table: "interested_artists", id: have.id, when });
        else plan.appsHave++;
      } else if (a.request && jobs.has(a.request)) plan.appsAdd.push({ a, pro: false, when });
      else plan.appsSkip.push(`Application from ${when}: that job isn't on the new site`);
    }
  }

  const convoLocalId = new Map();
  for (const c of convos) {
    const have = existingConvos.get(c._id);
    if (have) { plan.convosHave++; convoLocalId.set(c._id, have.id); continue; }
    const artistUserId = c.artist ? localUser.get(c.artist) : null;
    const clientUserId = c.client ? localUser.get(c.client) : null;
    if (!artistUserId || !clientUserId) {
      plan.convosSkip.push(`Conversation from ${c["Created Date"]?.slice(0, 10)}: the other person isn't on the new site`);
      continue;
    }
    plan.convosAdd.push({ c, artistUserId, clientUserId });
  }

  for (const c of convos) {
    const willExist = existingConvos.has(c._id) || plan.convosAdd.some((p) => p.c._id === c._id);
    for (const m of messagesByConvo.get(c._id) ?? []) {
      if (existingMessages.has(m._id)) { plan.msgsHave++; continue; }
      if (!willExist) { plan.msgsSkip++; continue; }
      plan.msgsAdd.push({ m, convoBubbleId: c._id });
    }
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  console.log(`In Bubble: ${apps.length} applications, ${convos.length} conversations, ${allMessages.length} messages.\n`);
  console.log(`Applications: ${plan.appsHave} already here, ${plan.appsAdd.length} to add, ${plan.appsRepoint.length} to re-attach, ${plan.appsSkip.length} can't add`);
  for (const p of plan.appsAdd) console.log(`  + ${p.pro ? "PRO " : ""}application from ${p.when}`);
  for (const p of plan.appsRepoint) console.log(`  ↺ application from ${p.when} points at a removed account — re-attach`);
  for (const s of plan.appsSkip) console.log(`  ✗ ${s}`);
  console.log(`Conversations: ${plan.convosHave} already here, ${plan.convosAdd.length} to add, ${plan.convosSkip.length} can't add`);
  for (const s of plan.convosSkip) console.log(`  ✗ ${s}`);
  console.log(`Messages: ${plan.msgsHave} already here, ${plan.msgsAdd.length} to add${plan.msgsSkip ? `, ${plan.msgsSkip} skipped (their conversation can't be added)` : ""}`);

  const work = plan.appsAdd.length + plan.appsRepoint.length + plan.convosAdd.length + plan.msgsAdd.length;
  if (!APPLY) {
    console.log(work ? "\nRe-run with --apply to restore." : "\nNothing missing — no changes needed.");
    process.exit(0);
  }
  if (!work) { console.log("\nNothing missing — no changes made."); process.exit(0); }

  // ── Apply, all or nothing ────────────────────────────────────────────────
  await conn.beginTransaction();

  for (const { a, pro } of plan.appsAdd) {
    if (pro) {
      await q(
        `INSERT INTO premium_job_interested_artists
           (premiumJobId, bubblePremiumJobId, artistUserId, bubbleArtistId, bubbleInterestedArtistId, message, rate, resumeLink, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [proJobs.get(a.premiumjob).id, a.premiumjob, USER, BID, a._id,
          trimOrNull(a.message), trimOrNull(a.rate), trimOrNull(a.link), trimOrNull(a.status_interestedartists)],
      );
    } else {
      await q(
        `INSERT INTO interested_artists (
           bubbleId, jobId, bubbleRequestId, artistUserId, bubbleArtistId, clientUserId, bubbleClientId,
           bubbleServiceId, bubbleBookingId, status, converted, isHourlyRate, artistHourlyRate, clientHourlyRate,
           artistFlatRate, clientFlatRate, totalHours, startDate, endDate, resumeLink, message, bubbleCreatedAt, bubbleModifiedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [a._id, jobs.get(a.request).id, a.request, USER, BID, a.client ? localUser.get(a.client) ?? null : null, a.client ?? null,
          a.service ?? null, a.booking ?? null, a.status_interestedartists ?? null, a["converted?"] ? 1 : 0,
          a["is hourly rate?"] ? 1 : 0, a["artist hourly rate"] ?? null, a["client hourly rate"] ?? null,
          a["artist flat rate"] ?? null, a["client flat rate"] ?? null, a["total hours"] ?? null,
          safeDate(a["start date"]), safeDate(a["end date"]), a.link ?? null, a.message ?? null,
          safeDate(a["Created Date"]), safeDate(a["Modified Date"])],
      );
    }
  }
  for (const r of plan.appsRepoint) {
    await q(`UPDATE \`${r.table}\` SET artistUserId = ? WHERE id = ?`, [USER, r.id]);
  }

  for (const { c, artistUserId, clientUserId } of plan.convosAdd) {
    await q(
      `INSERT INTO conversations (
         bubbleId, clientUserId, bubbleClientId, artistUserId, bubbleArtistId,
         bubbleLastMessageId, lastMessageDate, unreadCount, bubbleCreatedAt, bubbleModifiedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [c._id, clientUserId, c.client, artistUserId, c.artist, c["last message"] ?? null,
        safeDate(c["last message date"]), safeDate(c["Created Date"]), safeDate(c["Modified Date"])],
    );
    const [row] = await q("SELECT id FROM conversations WHERE bubbleId = ? ORDER BY id DESC LIMIT 1", [c._id]);
    convoLocalId.set(c._id, row.id);
  }

  for (const { m, convoBubbleId } of plan.msgsAdd) {
    await q(
      `INSERT INTO messages (
         bubbleId, conversationId, bubbleConversationId, senderUserId, bubbleSentById, content, isSystem, bubbleCreatedAt, bubbleModifiedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m._id, convoLocalId.get(convoBubbleId), convoBubbleId,
        m["sent by"] ? localUser.get(m["sent by"]) ?? null : null, m["sent by"] ?? null,
        m.message ?? m.content ?? null, m["is system?"] ? 1 : 0,
        safeDate(m["Created Date"]), safeDate(m["Modified Date"])],
    );
  }

  await conn.commit();
  console.log(`\nRestored: ${plan.appsAdd.length} applications added, ${plan.appsRepoint.length} re-attached, ${plan.convosAdd.length} conversations, ${plan.msgsAdd.length} messages.`);
} catch (err) {
  try { await conn.rollback(); } catch {}
  console.error(`\nFailed — ${APPLY ? "rolled back, nothing changed" : "nothing changed"}: ${err.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
