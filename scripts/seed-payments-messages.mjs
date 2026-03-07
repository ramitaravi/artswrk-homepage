/**
 * Seed script: Pull payments, conversations, and messages for Nick's account
 * from Bubble and insert them into the local database.
 *
 * Run with: node scripts/seed-payments-messages.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BUBBLE_API_BASE = "https://artswrk.com/version-test/api/1.1/obj";
const BUBBLE_API_KEY = "12172ddf5b3c42d8a4936d57afe0f029";
const NICK_BUBBLE_ID = "1659533883431x527826980339748400";

// ─── Bubble fetch helper ──────────────────────────────────────────────────────
async function fetchBubble(dataType, constraints = [], cursor = 0, limit = 100) {
  const params = new URLSearchParams({
    limit: String(limit),
    cursor: String(cursor),
  });
  if (constraints.length > 0) {
    params.set("constraints", JSON.stringify(constraints));
  }
  const url = `${BUBBLE_API_BASE}/${encodeURIComponent(dataType)}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BUBBLE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Bubble API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllBubble(dataType, constraints = []) {
  const records = [];
  let cursor = 0;
  while (true) {
    const data = await fetchBubble(dataType, constraints, cursor);
    const batch = data.response.results;
    records.push(...batch);
    const remaining = data.response.remaining ?? 0;
    if (!remaining || !batch.length) break;
    cursor += 100;
    await new Promise((r) => setTimeout(r, 150));
  }
  return records;
}

async function fetchBubbleByIds(dataType, key, ids, batchSize = 10) {
  const records = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const data = await fetchBubble(dataType, [
      { key, constraint_type: "in", value: batch },
    ]);
    records.push(...data.response.results);
    await new Promise((r) => setTimeout(r, 150));
  }
  return records;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // ── 1. Get Nick's local user ID ──────────────────────────────────────────────
  const [[nickUser]] = await conn.execute(
    "SELECT id FROM users WHERE bubbleId = ?",
    [NICK_BUBBLE_ID]
  );
  if (!nickUser) throw new Error("Nick's user record not found in DB");
  const nickUserId = nickUser.id;
  console.log(`Nick's local user ID: ${nickUserId}`);

  // ── 2. Get all booking Bubble IDs from DB ────────────────────────────────────
  const [bookingRows] = await conn.execute(
    "SELECT id, bubbleId, bubbleArtistId FROM bookings"
  );
  const bookingByBubbleId = {};
  for (const b of bookingRows) {
    bookingByBubbleId[b.bubbleId] = b;
  }
  const bookingBubbleIds = Object.keys(bookingByBubbleId);
  console.log(`Nick's bookings in DB: ${bookingBubbleIds.length}`);

  // ── 3. Get all artist user records from DB ───────────────────────────────────
  const [artistRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE userRole = 'Artist'"
  );
  const artistByBubbleId = {};
  for (const a of artistRows) {
    artistByBubbleId[a.bubbleId] = a.id;
  }
  console.log(`Artist users in DB: ${Object.keys(artistByBubbleId).length}`);

  // ── 4. Seed Payments ─────────────────────────────────────────────────────────
  console.log("\n=== Seeding Payments ===");
  const bubblePayments = await fetchBubbleByIds("payment", "Booking", bookingBubbleIds);
  console.log(`Fetched ${bubblePayments.length} payments from Bubble`);

  let payInserted = 0, payUpdated = 0;
  for (const p of bubblePayments) {
    const booking = bookingByBubbleId[p.Booking];
    const bookingId = booking?.id ?? null;
    const bubbleBookingId = p.Booking ?? null;

    const paymentDate = p.Date ? new Date(p.Date) : null;
    const bubbleCreatedAt = p["Created Date"] ? new Date(p["Created Date"]) : null;
    const bubbleModifiedAt = p["Modified Date"] ? new Date(p["Modified Date"]) : null;

    const [existing] = await conn.execute(
      "SELECT id FROM payments WHERE bubbleId = ?",
      [p._id]
    );

    if (existing.length > 0) {
      await conn.execute(
        `UPDATE payments SET
          bookingId = ?, bubbleBookingId = ?, clientUserId = ?,
          stripeId = ?, stripeStatus = ?, status = ?,
          stripeAmount = ?, stripeApplicationFee = ?, stripeApplicationFeeAmount = ?,
          stripeCardBrand = ?, stripeCardLast4 = ?, stripeCardName = ?,
          stripeDescription = ?, stripeReceiptUrl = ?, stripeRefundUrl = ?,
          paymentDate = ?, bubbleCreatedAt = ?, bubbleModifiedAt = ?
        WHERE bubbleId = ?`,
        [
          bookingId, bubbleBookingId, nickUserId,
          p["Stripe ID"] ?? null, p["Stripe Status"] ?? null, p.Status ?? null,
          p["Stripe Amount"] ?? null, p["Stripe Application Fee"] ?? null,
          p["Stripe Application Fee Amount"] ? parseInt(p["Stripe Application Fee Amount"]) : null,
          p["Stripe Card Brand"] ?? null, p["Stripe Card Last 4"] ?? null, p["Stripe Card Name"] ?? null,
          p["Stripe Description"] ?? null, p["Stripe Receipt URL"] ?? null, p["Stripe Refund URL"] ?? null,
          paymentDate, bubbleCreatedAt, bubbleModifiedAt,
          p._id,
        ]
      );
      payUpdated++;
    } else {
      await conn.execute(
        `INSERT INTO payments (
          bubbleId, bookingId, bubbleBookingId, clientUserId,
          stripeId, stripeStatus, status,
          stripeAmount, stripeApplicationFee, stripeApplicationFeeAmount,
          stripeCardBrand, stripeCardLast4, stripeCardName,
          stripeDescription, stripeReceiptUrl, stripeRefundUrl,
          paymentDate, bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p._id, bookingId, bubbleBookingId, nickUserId,
          p["Stripe ID"] ?? null, p["Stripe Status"] ?? null, p.Status ?? null,
          p["Stripe Amount"] ?? null, p["Stripe Application Fee"] ?? null,
          p["Stripe Application Fee Amount"] ? parseInt(p["Stripe Application Fee Amount"]) : null,
          p["Stripe Card Brand"] ?? null, p["Stripe Card Last 4"] ?? null, p["Stripe Card Name"] ?? null,
          p["Stripe Description"] ?? null, p["Stripe Receipt URL"] ?? null, p["Stripe Refund URL"] ?? null,
          paymentDate, bubbleCreatedAt, bubbleModifiedAt,
        ]
      );
      payInserted++;
    }
  }
  console.log(`Payments: ${payInserted} inserted, ${payUpdated} updated`);

  // ── 5. Seed Conversations ────────────────────────────────────────────────────
  console.log("\n=== Seeding Conversations ===");
  const bubbleConvos = await fetchAllBubble("conversation", [
    { key: "client", constraint_type: "equals", value: NICK_BUBBLE_ID },
  ]);
  console.log(`Fetched ${bubbleConvos.length} conversations from Bubble`);

  let convoInserted = 0, convoUpdated = 0;
  const convoByBubbleId = {};

  for (const c of bubbleConvos) {
    const artistUserId = c.artist ? (artistByBubbleId[c.artist] ?? null) : null;
    const lastMessageDate = c["last message date"] ? new Date(c["last message date"]) : null;
    const unreadCount = Array.isArray(c["unread messages"]) ? c["unread messages"].length : 0;
    const bubbleCreatedAt = c["Created Date"] ? new Date(c["Created Date"]) : null;
    const bubbleModifiedAt = c["Modified Date"] ? new Date(c["Modified Date"]) : null;

    const [existing] = await conn.execute(
      "SELECT id FROM conversations WHERE bubbleId = ?",
      [c._id]
    );

    let localId;
    if (existing.length > 0) {
      await conn.execute(
        `UPDATE conversations SET
          clientUserId = ?, bubbleClientId = ?,
          artistUserId = ?, bubbleArtistId = ?,
          bubbleLastMessageId = ?, lastMessageDate = ?, unreadCount = ?,
          bubbleCreatedAt = ?, bubbleModifiedAt = ?
        WHERE bubbleId = ?`,
        [
          nickUserId, NICK_BUBBLE_ID,
          artistUserId, c.artist ?? null,
          c["last message"] ?? null, lastMessageDate, unreadCount,
          bubbleCreatedAt, bubbleModifiedAt,
          c._id,
        ]
      );
      localId = existing[0].id;
      convoUpdated++;
    } else {
      const [result] = await conn.execute(
        `INSERT INTO conversations (
          bubbleId, clientUserId, bubbleClientId,
          artistUserId, bubbleArtistId,
          bubbleLastMessageId, lastMessageDate, unreadCount,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c._id, nickUserId, NICK_BUBBLE_ID,
          artistUserId, c.artist ?? null,
          c["last message"] ?? null, lastMessageDate, unreadCount,
          bubbleCreatedAt, bubbleModifiedAt,
        ]
      );
      localId = result.insertId;
      convoInserted++;
    }
    convoByBubbleId[c._id] = localId;
  }
  console.log(`Conversations: ${convoInserted} inserted, ${convoUpdated} updated`);

  // ── 6. Seed Messages ─────────────────────────────────────────────────────────
  console.log("\n=== Seeding Messages ===");
  const convoIds = Object.keys(convoByBubbleId);
  const bubbleMessages = await fetchBubbleByIds("message", "conversation", convoIds);
  console.log(`Fetched ${bubbleMessages.length} messages from Bubble`);

  // Build a user lookup for all users (to resolve sender IDs)
  const [allUsers] = await conn.execute("SELECT id, bubbleId FROM users");
  const userByBubbleId = {};
  for (const u of allUsers) {
    userByBubbleId[u.bubbleId] = u.id;
  }

  let msgInserted = 0, msgUpdated = 0;
  for (const m of bubbleMessages) {
    const conversationId = convoByBubbleId[m.conversation] ?? null;
    const senderUserId = m["sent by"] ? (userByBubbleId[m["sent by"]] ?? null) : null;
    const isSystem = !m["sent by"]; // system messages have no "sent by"
    const bubbleCreatedAt = m["Created Date"] ? new Date(m["Created Date"]) : null;
    const bubbleModifiedAt = m["Modified Date"] ? new Date(m["Modified Date"]) : null;

    const [existing] = await conn.execute(
      "SELECT id FROM messages WHERE bubbleId = ?",
      [m._id]
    );

    if (existing.length > 0) {
      await conn.execute(
        `UPDATE messages SET
          conversationId = ?, bubbleConversationId = ?,
          senderUserId = ?, bubbleSentById = ?,
          content = ?, isSystem = ?,
          bubbleCreatedAt = ?, bubbleModifiedAt = ?
        WHERE bubbleId = ?`,
        [
          conversationId, m.conversation ?? null,
          senderUserId, m["sent by"] ?? null,
          m.content ?? null, isSystem ? 1 : 0,
          bubbleCreatedAt, bubbleModifiedAt,
          m._id,
        ]
      );
      msgUpdated++;
    } else {
      await conn.execute(
        `INSERT INTO messages (
          bubbleId, conversationId, bubbleConversationId,
          senderUserId, bubbleSentById,
          content, isSystem,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m._id, conversationId, m.conversation ?? null,
          senderUserId, m["sent by"] ?? null,
          m.content ?? null, isSystem ? 1 : 0,
          bubbleCreatedAt, bubbleModifiedAt,
        ]
      );
      msgInserted++;
    }
  }
  console.log(`Messages: ${msgInserted} inserted, ${msgUpdated} updated`);

  // ── 7. Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== Summary ===");
  const [[{ payCount }]] = await conn.execute("SELECT COUNT(*) as payCount FROM payments WHERE clientUserId = ?", [nickUserId]);
  const [[{ convoCount }]] = await conn.execute("SELECT COUNT(*) as convoCount FROM conversations WHERE clientUserId = ?", [nickUserId]);
  const [[{ msgCount }]] = await conn.execute(
    `SELECT COUNT(*) as msgCount FROM messages m
     JOIN conversations c ON m.conversationId = c.id
     WHERE c.clientUserId = ?`,
    [nickUserId]
  );
  console.log(`✓ Payments in DB: ${payCount}`);
  console.log(`✓ Conversations in DB: ${convoCount}`);
  console.log(`✓ Messages in DB: ${msgCount}`);

  // Check artist linkage
  const [[{ linked }]] = await conn.execute(
    "SELECT COUNT(*) as linked FROM conversations WHERE clientUserId = ? AND artistUserId IS NOT NULL",
    [nickUserId]
  );
  console.log(`✓ Conversations with artist linked: ${linked}/${convoCount}`);

} finally {
  await conn.end();
}
