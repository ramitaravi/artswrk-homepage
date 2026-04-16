/**
 * Migration: Messages
 * Pulls all 14,126 records from Bubble's "message" type → `messages` table.
 *
 * Bubble fields:
 *   _id, conversation, content, sent by, Created Date, Modified Date
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-messages.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleMessage {
  _id: string;
  "conversation"?: string;   // Bubble conversation record ID
  "content"?: string;
  "sent by"?: string;        // Bubble user ID of sender
  "Created Date"?: string;
  "Modified Date"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  // Build bubbleId → conversationId lookup
  const [convRows] = await conn.execute(
    "SELECT id, bubbleId FROM conversations WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToConvId: Record<string, number> = {};
  for (const c of convRows) bubbleToConvId[c.bubbleId] = c.id;
  console.log(`Loaded ${Object.keys(bubbleToConvId).length} conversation mappings`);

  console.log("Fetching messages from Bubble...");
  const records = await fetchAllRecords<BubbleMessage>(
    "message",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} messages`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const senderUserId    = r["sent by"]      ? (bubbleToUserId[r["sent by"]] ?? null)        : null;
    const conversationId  = r["conversation"] ? (bubbleToConvId[r["conversation"]] ?? null)   : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO messages
           (bubbleId, conversationId, bubbleConversationId,
            senderUserId, bubbleSentById,
            content, bubbleCreatedAt, bubbleModifiedAt)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           conversationId=VALUES(conversationId),
           senderUserId=VALUES(senderUserId),
           content=VALUES(content),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          conversationId,
          r["conversation"] ?? null,
          senderUserId,
          r["sent by"] ?? null,
          r["content"] ?? null,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on message ${r._id}:`, e.message);
      errors++;
    }

    if ((inserted + updated + errors) % 1000 === 0)
      process.stdout.write(`\r  Processed ${inserted + updated + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
