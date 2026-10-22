#!/usr/bin/env node
/**
 * Stripe as the source of truth for subscriptions.
 *
 * Reads live subscriptions from Stripe and compares them against what our
 * users table claims, so we can see exactly which of our rows are wrong.
 *
 * The key is passed on the command line and never written anywhere:
 *
 *   STRIPE_SECRET_KEY=rk_live_... node scripts/stripe-subscription-truth.mjs
 *
 * Use a RESTRICTED key (rk_live_) with read-only scopes on Subscriptions,
 * Customers and Balance transactions. A full sk_live_ secret key is not
 * needed for this and should not be used.
 *
 * Read-only: this script never writes to Stripe or to the database.
 * Pass --write-report to also save a markdown report under docs/.
 */
import Stripe from "stripe";
import mysql from "mysql2/promise";
import fs from "node:fs";
import "dotenv/config";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Set STRIPE_SECRET_KEY on the command line. See the header of this file.");
  process.exit(1);
}
const LIVE = KEY.startsWith("sk_live_") || KEY.startsWith("rk_live_");
if (!LIVE) {
  console.error(`\n  This is a TEST key (${KEY.slice(0, 8)}…).`);
  console.error("  Test keys cannot see live subscriptions. Re-run with a live restricted key.\n");
  process.exit(1);
}
if (KEY.startsWith("sk_live_")) {
  console.warn("  NOTE: that is a full secret key. A restricted read-only key (rk_live_) is safer here.\n");
}

const stripe = new Stripe(KEY, { apiVersion: "2026-03-25.dahlia" });
const money = (c) => `$${(c / 100).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);

/* ---------- 1. Stripe: every subscription, all statuses ---------- */
console.log("Reading subscriptions from Stripe…");
const subs = [];
for await (const s of stripe.subscriptions.list({
  status: "all",
  limit: 100,
  expand: ["data.customer", "data.items.data.price.product"],
})) subs.push(s);
console.log(`  ${subs.length} subscription objects in Stripe\n`);

const monthlyCents = (item) => {
  const p = item?.price;
  const gross = (p?.unit_amount ?? 0) * (item?.quantity ?? 1);
  const iv = p?.recurring?.interval, n = p?.recurring?.interval_count ?? 1;
  if (iv === "year") return Math.round(gross / (12 * n));
  if (iv === "week") return Math.round((gross * 52) / (12 * n));
  if (iv === "day") return Math.round((gross * 365) / (12 * n));
  return Math.round(gross / n);
};

const byStatus = {}, byProduct = {};
let mrr = 0;
const activeIds = new Set();
const emailOf = new Map();

for (const s of subs) {
  byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  const item = s.items?.data?.[0];
  const prod = item?.price?.product;
  const label = (typeof prod === "object" ? prod?.name : null)
    ?? item?.price?.nickname ?? "Unnamed plan";
  const m = monthlyCents(item);
  byProduct[label] ??= { total: 0, active: 0, mrrCents: 0 };
  byProduct[label].total += 1;
  if (s.status === "active" || s.status === "trialing") {
    byProduct[label].active += 1;
    byProduct[label].mrrCents += m;
    mrr += m;
    activeIds.add(s.id);
  }
  const email = (typeof s.customer === "object" ? s.customer?.email : null) ?? null;
  if (email) emailOf.set(s.id, email.toLowerCase());
}

console.log("STRIPE — THE SOURCE OF TRUTH");
console.log("─".repeat(62));
console.log(`  Active + trialing : ${activeIds.size}`);
console.log(`  MRR               : ${money(mrr)}`);
console.log(`  Annualised        : ${money(mrr * 12)}\n`);
console.log("  By status:");
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${pad(k, 22)} ${v}`);
}
console.log("\n  By plan:");
console.log(`    ${pad("PLAN", 34)} ${pad("ACTIVE", 8)} ${pad("ALL", 6)} MRR`);
for (const [k, v] of Object.entries(byProduct).sort((a, b) => b[1].mrrCents - a[1].mrrCents)) {
  console.log(`    ${pad(k.slice(0, 33), 34)} ${pad(v.active, 8)} ${pad(v.total, 6)} ${money(v.mrrCents)}`);
}

/* ---------- 2. Our database, for comparison ---------- */
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });
const [[db]] = await c.query(`
  SELECT SUM(artswrkPro = 1) flaggedPro,
         SUM(planTier = 'artist_pro') tierPro,
         SUM(artswrkBasic = 1) flaggedBasic,
         SUM(planTier = 'artist_basic') tierBasic,
         SUM(clientPremium = 1) flaggedClientPremium
  FROM users`);

console.log("\n\nOUR DATABASE — WHAT WE CLAIM");
console.log("─".repeat(62));
console.log(`  artswrkPro flag     : ${db.flaggedPro}`);
console.log(`  planTier artist_pro : ${db.tierPro}`);
console.log(`  artswrkBasic flag   : ${db.flaggedBasic}`);
console.log(`  planTier basic      : ${db.tierBasic}`);
console.log(`  clientPremium flag  : ${db.flaggedClientPremium}`);
console.log(`\n  Stripe says ${activeIds.size} subscriptions are actually active.`);

/* ---------- 3. Match Stripe subscriptions to our rows ---------- */
// A subscription id can be in either column; the Bubble migration put many
// artist ids into clientSubscriptionId. Check both before calling it missing.
const ids = [...activeIds];
const found = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const ph = chunk.map(() => "?").join(",");
  const [rows] = await c.query(
    `SELECT id, email, planTier, artswrkPro, artswrkBasic, clientPremium,
            stripeSubscriptionId, clientSubscriptionId
     FROM users
     WHERE stripeSubscriptionId IN (${ph}) OR clientSubscriptionId IN (${ph})`,
    [...chunk, ...chunk],
  );
  for (const r of rows) {
    if (r.stripeSubscriptionId && activeIds.has(r.stripeSubscriptionId)) found.set(r.stripeSubscriptionId, r);
    if (r.clientSubscriptionId && activeIds.has(r.clientSubscriptionId)) found.set(r.clientSubscriptionId, r);
  }
}

const unmatched = ids.filter((id) => !found.has(id));
let wrongColumn = 0, notFlagged = 0;
for (const [id, r] of found) {
  if (r.clientSubscriptionId === id && String(r.planTier ?? "").startsWith("artist_")) wrongColumn += 1;
  if (!r.artswrkPro && !r.artswrkBasic && !r.clientPremium) notFlagged += 1;
}

// Paying Stripe but we show them as free.
const [[ghost]] = await c.query(
  `SELECT COUNT(*) n FROM users WHERE planTier = 'artist_free' AND artswrkPro = 0
     AND (stripeSubscriptionId IS NOT NULL OR clientSubscriptionId IS NOT NULL)`);

console.log("\n\nTHE GAP — ROWS THAT NEED REPAIR");
console.log("─".repeat(62));
console.log(`  Active in Stripe, matched to a user     : ${found.size}`);
console.log(`  Active in Stripe, NO matching user row  : ${unmatched.length}`);
console.log(`  Matched, but id is in the wrong column  : ${wrongColumn}`);
console.log(`  Matched, but no paid flag set on them   : ${notFlagged}   <- these get PRO for free`);
console.log(`  Marked free but still holding a sub id  : ${ghost.n}`);

if (unmatched.length) {
  console.log("\n  Active Stripe subscriptions we cannot place (first 20):");
  for (const id of unmatched.slice(0, 20)) {
    console.log(`    ${pad(id, 32)} ${emailOf.get(id) ?? "(no customer email)"}`);
  }
  if (unmatched.length > 20) console.log(`    … and ${unmatched.length - 20} more`);
}

/* ---------- 4. Money actually moved ---------- */
console.log("\n\nSTRIPE BALANCE & RECENT MONEY (last 90 days)");
console.log("─".repeat(62));
const bal = await stripe.balance.retrieve();
for (const a of bal.available) {
  console.log(`  Available: ${money(a.amount)} ${a.currency.toUpperCase()}`);
}
for (const p of bal.pending) {
  console.log(`  Pending:   ${money(p.amount)} ${p.currency.toUpperCase()}`);
}

const since = Math.floor(Date.now() / 1000) - 90 * 86400;
const tally = {};
for await (const t of stripe.balanceTransactions.list({ created: { gte: since }, limit: 100 })) {
  tally[t.type] ??= { n: 0, gross: 0, fees: 0, net: 0 };
  tally[t.type].n += 1;
  tally[t.type].gross += t.amount;
  tally[t.type].fees += t.fee;
  tally[t.type].net += t.net;
}
console.log(`\n  ${pad("TYPE", 24)} ${pad("COUNT", 7)} ${pad("GROSS", 14)} ${pad("FEES", 12)} NET`);
for (const [k, v] of Object.entries(tally).sort((a, b) => Math.abs(b[1].gross) - Math.abs(a[1].gross))) {
  console.log(`  ${pad(k, 24)} ${pad(v.n, 7)} ${pad(money(v.gross), 14)} ${pad(money(v.fees), 12)} ${money(v.net)}`);
}

if (process.argv.includes("--write-report")) {
  const out = `docs/stripe-subscription-truth-${new Date().toISOString().slice(0, 10)}.md`;
  fs.writeFileSync(out, [
    `# Stripe subscription truth — ${new Date().toISOString().slice(0, 10)}`,
    ``, `Read-only snapshot. Stripe is the source of truth.`, ``,
    `## Stripe`, `- Active + trialing: **${activeIds.size}**`,
    `- MRR: **${money(mrr)}** (${money(mrr * 12)}/yr)`, ``,
    `| Plan | Active | All | MRR |`, `|---|---|---|---|`,
    ...Object.entries(byProduct).sort((a, b) => b[1].mrrCents - a[1].mrrCents)
      .map(([k, v]) => `| ${k} | ${v.active} | ${v.total} | ${money(v.mrrCents)} |`),
    ``, `## Our database claims`,
    `| Column | Count |`, `|---|---|`,
    `| artswrkPro flag | ${db.flaggedPro} |`,
    `| planTier = artist_pro | ${db.tierPro} |`,
    `| artswrkBasic flag | ${db.flaggedBasic} |`,
    `| clientPremium flag | ${db.flaggedClientPremium} |`,
    ``, `## Gap`,
    `| Issue | Rows |`, `|---|---|`,
    `| Active in Stripe, matched to a user | ${found.size} |`,
    `| Active in Stripe, no matching user row | ${unmatched.length} |`,
    `| Subscription id in the wrong column | ${wrongColumn} |`,
    `| Matched but no paid flag (getting PRO free) | ${notFlagged} |`,
    `| Marked free but still holding a sub id | ${ghost.n} |`,
    ``,
  ].join("\n"));
  console.log(`\nReport written to ${out}`);
}

await c.end();
console.log("");
