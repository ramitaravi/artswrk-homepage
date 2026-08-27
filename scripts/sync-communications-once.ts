import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleRow = Record<string, unknown> & { _id: string };

export function communicationText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function unreadMessages(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function readBubbleToken(): string {
  if (process.env.BUBBLE_API_KEY) return process.env.BUBBLE_API_KEY;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(root, "scripts/sync-all.mjs"), "utf8");
  const fallback = source.match(/BUBBLE_API_KEY\s*=\s*process\.env\.BUBBLE_API_KEY\s*\|\|\s*"([^"]+)"/)?.[1];
  if (!fallback) throw new Error("Bubble API credential is unavailable");
  return fallback;
}

async function fetchType(token: string, type: string): Promise<BubbleRow[]> {
  const rows: BubbleRow[] = [];
  let cursor = 0;
  const base = `https://artswrk.com/version-live/api/1.1/obj/${encodeURIComponent(type)}`;
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble ${type} API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleRow[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rFetched ${rows.length} Bubble ${type} rows`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

const CONVERSATION_COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "bubbleCreatedById", "clientUserId", "bubbleClientId",
  "artistUserId", "bubbleArtistId", "bubbleLastMessageId", "lastMessageDate", "unreadCount",
  "createdAt", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

const MESSAGE_COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "bubbleCreatedById", "conversationId", "bubbleConversationId",
  "senderUserId", "bubbleSentById", "content", "isSystem", "createdAt", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

function upsertSql(table: string, columns: readonly string[]): string {
  const columnSql = columns.map((column) => `\`${column}\``).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns.slice(1).map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(", ");
  return `INSERT INTO ${table} (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const token = readBubbleToken();
  const conversations = await fetchType(token, "conversation");
  const messages = await fetchType(token, "message");
  const conversationIds = new Set(conversations.map((row) => row._id));
  const messageIds = new Set(messages.map((row) => row._id));
  if (!conversations.length || conversationIds.size !== conversations.length || !messages.length || messageIds.size !== messages.length) {
    throw new Error("Bubble communication source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM users WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [existingConversationRows] = await conn.execute<RowDataPacket[]>("SELECT bubbleId FROM conversations WHERE bubbleId IS NOT NULL");
  const [existingMessageRows] = await conn.execute<RowDataPacket[]>("SELECT bubbleId FROM messages WHERE bubbleId IS NOT NULL");
  const existingConversationIds = new Set(existingConversationRows.map((row) => String(row.bubbleId)));
  const existingMessageIds = new Set(existingMessageRows.map((row) => String(row.bubbleId)));

  const planned = {
    sourceConversations: conversations.length,
    updateConversations: conversations.filter((row) => existingConversationIds.has(row._id)).length,
    insertConversations: conversations.filter((row) => !existingConversationIds.has(row._id)).length,
    unresolvedConversationClients: conversations.filter((row) => row.client && !userMap.has(String(row.client))).length,
    unresolvedConversationArtists: conversations.filter((row) => row.artist && !userMap.has(String(row.artist))).length,
    sourceMessages: messages.length,
    updateMessages: messages.filter((row) => existingMessageIds.has(row._id)).length,
    insertMessages: messages.filter((row) => !existingMessageIds.has(row._id)).length,
    sourceMessagesWithoutConversation: messages.filter((row) => !row.conversation).length,
    messagesReferencingMissingConversation: messages.filter((row) => row.conversation && !conversationIds.has(String(row.conversation))).length,
    unresolvedMessageSenders: messages.filter((row) => row["sent by"] && !userMap.has(String(row["sent by"]))).length,
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  const conversationSql = upsertSql("conversations", CONVERSATION_COLUMNS);
  const messageSql = upsertSql("messages", MESSAGE_COLUMNS);

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE conversations SET bubbleSourcePresent = 0");
    await conn.execute("UPDATE messages SET bubbleSourcePresent = 0");

    let processed = 0;
    for (const conversation of conversations) {
      const clientBubbleId = communicationText(conversation.client, 64);
      const artistBubbleId = communicationText(conversation.artist, 64);
      const createdAt = safeDate(conversation["Created Date"]);
      await conn.execute(conversationSql, [
        conversation._id,
        1,
        communicationText(conversation["Created By"], 64),
        clientBubbleId ? userMap.get(clientBubbleId) ?? null : null,
        clientBubbleId,
        artistBubbleId ? userMap.get(artistBubbleId) ?? null : null,
        artistBubbleId,
        communicationText(conversation["last message"], 64),
        safeDate(conversation["last message date"]),
        unreadMessages(conversation["unread messages"]),
        createdAt ?? new Date(),
        createdAt,
        safeDate(conversation["Modified Date"]),
      ]);
      processed += 1;
      if (processed % 500 === 0) process.stdout.write(`\rApplied ${processed}/${conversations.length} conversations`);
    }
    process.stdout.write("\n");

    const [conversationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT id, bubbleId FROM conversations WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
    `);
    const conversationMap = new Map(conversationRows.map((row) => [String(row.bubbleId), Number(row.id)]));

    processed = 0;
    for (const message of messages) {
      const conversationBubbleId = communicationText(message.conversation, 64);
      const senderBubbleId = communicationText(message["sent by"], 64);
      const createdAt = safeDate(message["Created Date"]);
      await conn.execute(messageSql, [
        message._id,
        1,
        communicationText(message["Created By"], 64),
        conversationBubbleId ? conversationMap.get(conversationBubbleId) ?? null : null,
        conversationBubbleId,
        senderBubbleId ? userMap.get(senderBubbleId) ?? null : null,
        senderBubbleId,
        message.content ?? null,
        0,
        createdAt ?? new Date(),
        createdAt,
        safeDate(message["Modified Date"]),
      ]);
      processed += 1;
      if (processed % 1000 === 0) process.stdout.write(`\rApplied ${processed}/${messages.length} messages`);
    }
    process.stdout.write("\n");

    const [conversationValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(clientUserId IS NOT NULL) AS resolvedClients, SUM(artistUserId IS NOT NULL) AS resolvedArtists,
             SUM(bubbleLastMessageId IS NOT NULL) AS withLastMessage
      FROM conversations WHERE bubbleSourcePresent = 1
    `);
    const [messageValidationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(conversationId IS NOT NULL) AS resolvedConversations, SUM(senderUserId IS NOT NULL) AS resolvedSenders,
             MIN(bubbleCreatedAt) AS earliestCreatedAt, MAX(bubbleCreatedAt) AS latestCreatedAt
      FROM messages WHERE bubbleSourcePresent = 1
    `);
    const validation = { conversations: conversationValidationRows[0], messages: messageValidationRows[0] };
    if (
      Number(validation.conversations.liveRows) !== conversations.length ||
      Number(validation.conversations.distinctBubbleIds) !== conversationIds.size ||
      Number(validation.messages.liveRows) !== messages.length ||
      Number(validation.messages.distinctBubbleIds) !== messageIds.size
    ) {
      throw new Error(`Communication validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/communications-sync-${timestamp}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`REPORT=${outputPath}`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
