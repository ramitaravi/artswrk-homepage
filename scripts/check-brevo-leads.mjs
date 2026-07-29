/**
 * check-brevo-leads.mjs
 *
 * Reads the Ensemble CSV, extracts unique emails, checks each against
 * Brevo, and writes two output files:
 *   - scripts/output/leads_already_in_brevo.csv  (existing + their list IDs)
 *   - scripts/output/leads_new_to_brevo.csv       (not yet in Brevo — ready to import)
 *
 * Usage:
 *   BREVO_API_KEY=xkeysib-... node scripts/check-brevo-leads.mjs
 */

import https from "https";
import fs from "fs";
import path from "path";
import { createReadStream, mkdirSync } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSV_PATH = path.resolve(
  "/Users/ramitaravi/Downloads/[MASTER] Ensemble 2026_ B2B _ Events Lead Lists - REVEL _ S7-10 STUDIOS (1).csv"
);
const OUT_DIR = path.join(__dirname, "output");
const OUT_EXISTING = path.join(OUT_DIR, "leads_already_in_brevo.csv");
const OUT_NEW = path.join(OUT_DIR, "leads_new_to_brevo.csv");

const BREVO_KEY = process.env.BREVO_API_KEY;
if (!BREVO_KEY) {
  console.error("❌  BREVO_API_KEY is not set. Run with:\n   BREVO_API_KEY=xkeysib-... node scripts/check-brevo-leads.mjs");
  process.exit(1);
}

// ─── Brevo lookup ─────────────────────────────────────────────────────────────

function brevoGet(emailOrPath) {
  return new Promise((resolve, reject) => {
    const apiPath = emailOrPath.startsWith("/")
      ? emailOrPath
      : `/v3/contacts/${encodeURIComponent(emailOrPath)}`;
    const options = {
      hostname: "api.brevo.com",
      path: apiPath,
      method: "GET",
      headers: {
        "api-key": BREVO_KEY,
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function checkEmail(email) {
  try {
    const { status, data } = await brevoGet(email);
    if (status === 200) {
      const contact = JSON.parse(data);
      return { exists: true, listIds: contact.listIds ?? [], blacklisted: contact.emailBlacklisted };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

async function parseCSV() {
  const rows = [];
  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!headers) { headers = line.split(",").map(h => h.trim().replace(/^"|"$/g, "")); continue; }
    // Simple CSV split (handles basic quoted fields)
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? "").trim(); });
    if (row.EMAIL) rows.push(row);
  }
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📂  Reading CSV…");
  const rows = await parseCSV();

  // Deduplicate: keep first occurrence per email (preserves all metadata)
  const seen = new Map();
  for (const row of rows) {
    const email = row.EMAIL.toLowerCase();
    if (!seen.has(email)) seen.set(email, row);
  }
  const unique = [...seen.values()];
  console.log(`📊  ${rows.length} total rows → ${unique.length} unique emails\n`);

  mkdirSync(OUT_DIR, { recursive: true });

  const existing = [];
  const newContacts = [];
  const CONCURRENCY = 8;

  let done = 0;
  const total = unique.length;

  // Process in batches
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (row) => {
        const result = await checkEmail(row.EMAIL);
        return { row, result };
      })
    );
    for (const { row, result } of results) {
      if (result.exists) {
        existing.push({ ...row, brevo_list_ids: result.listIds.join("|"), blacklisted: result.blacklisted ? "yes" : "no" });
      } else {
        newContacts.push(row);
      }
    }
    done += batch.length;
    process.stdout.write(`\r  Checked ${done}/${total} emails…`);
  }
  console.log("\n");

  // ─── Write existing contacts CSV ──────────────────────────────────────────
  const existingHeaders = ["EMAIL", "STUDIO", "FIRST NAME", "LAST NAME", "CITY", "ST", "EVENT", "TYPE", "brevo_list_ids", "blacklisted"];
  const existingLines = [
    existingHeaders.join(","),
    ...existing.map(r => existingHeaders.map(h => `"${(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  fs.writeFileSync(OUT_EXISTING, existingLines.join("\n"));

  // ─── Write new contacts CSV ───────────────────────────────────────────────
  const newHeaders = ["EMAIL", "STUDIO", "FIRST NAME", "LAST NAME", "CITY", "ST", "PHONE 1", "WEBSITE", "EVENT", "TYPE"];
  const newLines = [
    newHeaders.join(","),
    ...newContacts.map(r => newHeaders.map(h => `"${(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  fs.writeFileSync(OUT_NEW, newLines.join("\n"));

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅  Already in Brevo : ${existing.length.toString().padStart(5)} contacts → ${OUT_EXISTING}`);
  console.log(`🆕  New (not in Brevo): ${newContacts.length.toString().padStart(5)} contacts → ${OUT_NEW}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (existing.length > 0) {
    // Show breakdown of blacklisted
    const blacklisted = existing.filter(r => r.blacklisted === "yes").length;
    if (blacklisted > 0) console.log(`⚠️   ${blacklisted} existing contacts are blacklisted (unsubscribed)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
