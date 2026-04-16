/**
 * Migration: Conversations
 * Pulls all records from Bubble's "conversation" type → `conversations` table.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-conversations.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubbleConversation {
  _id: string;
  "Client"?: string;            // Bubble user ID of the hirer
  "Artist"?: string;            // Bubble user ID of the artist
  "Last Message"?: string;      // Bubble message record ID
  "Last Message Date"?: string;
  "Unread Count"?: number;
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

  console.log("Fetching conversations from Bubble...");
  const records = await fetchAllRecords<BubbleConversation>(
    "conversation",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} conversations`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const clientUserId = r["Client"] ? (bubbleToUserId[r["Client"]] ?? null) : null;
    const artistUserId = r["Artist"] ? (bubbleToUserId[r["Artist"]] ?? null) : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO conversations
           (bubbleId, clientUserId, bubbleClientId, artistUserId, bubbleArtistId,
            bubbleLastMessageId, lastMessageDate, unreadCount,
            bubbleCreatedAt, bubbleModifiedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           clientUserId=VALUES(clientUserId),
           artistUserId=VALUES(artistUserId),
           bubbleLastMessageId=VALUES(bubbleLastMessageId),
           lastMessageDate=VALUES(lastMessageDate),
           unreadCount=VALUES(unreadCount),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          clientUserId,
          r["Client"] ?? null,
          artistUserId,
          r["Artist"] ?? null,
          r["Last Message"] ?? null,
          r["Last Message Date"] ? new Date(r["Last Message Date"]) : null,
          r["Unread Count"] ?? 0,
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on conversation ${r._id}:`, e.message);
      errors++;
    }

    if ((inserted + updated + errors) % 500 === 0)
      process.stdout.write(`\r  Processed ${inserted + updated + errors} / ${records.length}`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
