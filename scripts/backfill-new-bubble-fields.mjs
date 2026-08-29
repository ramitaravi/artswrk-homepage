/**
 * One-off backfill for the 6 fields just added to the schema, populated
 * 1:1 from the Bubble full export by bubbleId match. Purely additive —
 * only fills a field if it's currently empty, never overwrites.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import { parse } from "csv-parse/sync";
dotenv.config();

function truthy(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

const raw = fs.readFileSync("/Users/ramitaravi/Downloads/Artswrk Clients - Clean Pull Aug 28 - bubble_users_FULL_export.csv", "utf-8");
const bubbleRows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
const byBubbleId = new Map(bubbleRows.map((r) => [r["_id"], r]));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [dbRows] = await conn.execute(
  `SELECT id, bubbleId, masterServiceType, addedByAdmin, source, unsubscribe, artistStripeAccountType, stripeProductId
   FROM users WHERE bubbleId IS NOT NULL`
);

console.log(`Checking ${dbRows.length} DB rows against ${bubbleRows.length} Bubble rows...\n`);

const counts = { masterServiceType: 0, addedByAdmin: 0, source: 0, unsubscribe: 0, artistStripeAccountType: 0, stripeProductId: 0 };

for (const row of dbRows) {
  const b = byBubbleId.get(row.bubbleId);
  if (!b) continue;

  const updates = {};

  const svc = (b["List of Master Services"] || "").trim();
  if (svc && svc !== "[]" && !row.masterServiceType) updates.masterServiceType = svc;

  if (row.addedByAdmin == null || row.addedByAdmin === 0) {
    if (truthy(b["Added by admin?"])) updates.addedByAdmin = 1;
  }

  const src = (b["source"] || "").trim();
  if (src && !row.source) updates.source = src;

  if (row.unsubscribe == null || row.unsubscribe === 0) {
    if (truthy(b["unsubscribe"])) updates.unsubscribe = 1;
  }

  const acctType = (b["Artist Stripe Account Type"] || "").trim();
  if (acctType && !row.artistStripeAccountType) updates.artistStripeAccountType = acctType;

  const prodId = (b["Stripe product ID"] || "").trim();
  if (prodId && !row.stripeProductId) updates.stripeProductId = prodId;

  if (Object.keys(updates).length === 0) continue;

  const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(", ");
  await conn.execute(`UPDATE users SET ${setClause} WHERE id = ?`, [...Object.values(updates), row.id]);

  for (const k of Object.keys(updates)) counts[k]++;
}

console.log("Fields populated:");
console.table(counts);

await conn.end();
