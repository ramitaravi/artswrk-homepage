/**
 * Merges duplicate client companies — the same owner with several companies
 * whose names match ignoring case, spacing and curly vs straight apostrophes
 * (posting a PRO job used to add a new one every time, e.g. six
 * "That's Entertainment" rows for one enterprise client).
 *
 *   node scripts/merge-duplicate-client-companies-2026-09-14.mjs                 # preview, every owner
 *   node scripts/merge-duplicate-client-companies-2026-09-14.mjs --owner <userId> # preview, one owner
 *   ... --owner <userId> --apply                                                  # merge one owner, one transaction
 *   ... --all --apply                                                             # merge every owner (must be explicit)
 *
 * --apply saves an undo record of every changed or deleted row to ~/Downloads first.
 *
 * Per group it keeps one company (the one linked to Bubble, else the one with a
 * logo, else the oldest), fills its blank details from the others, re-points
 * jobs and company memberships at it, then removes the now-unused duplicates.
 * PRO jobs link to a company by name, so they need no change.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import os from "os";
import path from "path";

const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };
const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const OWNER = arg("--owner") ? Number(arg("--owner")) : null;
if (arg("--owner") && (!Number.isInteger(OWNER) || OWNER <= 0)) {
  console.error("--owner must be a real account number, e.g. --owner 82530015");
  process.exit(1);
}
// Merging across every client must be asked for explicitly — a mistyped or
// dropped --owner must never widen an --apply to the whole table.
if (APPLY && !OWNER && !ALL) {
  console.error("Refusing to merge every client's companies. Use --owner <userId> for one client, or add --all to merge across all clients. Nothing changed.");
  process.exit(1);
}

const normalize = (name) => String(name ?? "")
  .normalize("NFKC").replace(/[‘’‛′`´]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const blank = (v) => v === null || v === undefined || v === "";
const FILL = ["logo", "bubbleClientCompanyId", "website", "description", "locationAddress", "locationLat",
  "locationLng", "locationCity", "locationState", "locationPlaceId", "transportDetails"];

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z" });
const q = async (sql, params = []) => (await conn.query(sql, params))[0];

try {
  const companies = await q(
    `SELECT * FROM client_companies ${OWNER ? "WHERE ownerUserId = ?" : ""} ORDER BY ownerUserId, id`,
    OWNER ? [OWNER] : [],
  );

  const groups = new Map();
  for (const c of companies) {
    if (!c.ownerUserId || blank(c.name)) continue;
    const key = `${c.ownerUserId}|${normalize(c.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);

  const plans = [];
  for (const g of dupGroups) {
    const sorted = [...g].sort((a, b) =>
      (blank(b.bubbleClientCompanyId) ? 0 : 1) - (blank(a.bubbleClientCompanyId) ? 0 : 1)
      || (blank(b.logo) ? 0 : 1) - (blank(a.logo) ? 0 : 1)
      || a.id - b.id);
    const keep = sorted[0];
    const drop = sorted.slice(1);
    const fill = {};
    for (const f of FILL) {
      if (!(f in keep) || !blank(keep[f])) continue;
      const donor = drop.find((d) => !blank(d[f]));
      if (donor) fill[f] = donor[f];
    }
    const dropIds = drop.map((d) => d.id);
    const [{ n: jobCount }] = await q("SELECT COUNT(*) n FROM jobs WHERE clientCompanyId IN (?)", [dropIds]);
    const [{ n: memberCount }] = await q("SELECT COUNT(*) n FROM client_company_memberships WHERE clientCompanyId IN (?)", [dropIds]);
    plans.push({ keep, dropIds, fill, jobCount: Number(jobCount), memberCount: Number(memberCount) });
  }

  console.log(APPLY ? "MERGING" : "PREVIEW — nothing will change (add --apply to merge)");
  console.log(`\nDuplicate company groups: ${plans.length}${OWNER ? ` (owner ${OWNER})` : ""}`);
  for (const p of plans.slice(0, 25)) {
    console.log(`  owner ${p.keep.ownerUserId} · "${p.keep.name}": keep #${p.keep.id}, merge ${p.dropIds.length} (#${p.dropIds.join(", #")})`
      + ` · ${p.jobCount} job(s), ${p.memberCount} membership(s) re-pointed`
      + (Object.keys(p.fill).length ? ` · fills ${Object.keys(p.fill).join(", ")}` : ""));
  }
  if (plans.length > 25) console.log(`  …and ${plans.length - 25} more`);

  if (!APPLY || !plans.length) {
    console.log(plans.length ? "\nRe-run with --apply to merge." : "\nNo duplicates found.");
    process.exit(0);
  }

  // Undo record first: every row this run will change or delete, saved before
  // anything is written, so a merge can be reversed without a database backup.
  const undo = { at: new Date().toISOString(), scope: OWNER ? { owner: OWNER } : "all", groups: [] };
  for (const p of plans) {
    undo.groups.push({
      keepBefore: p.keep,
      fillApplied: p.fill,
      droppedCompanies: await q("SELECT * FROM client_companies WHERE id IN (?)", [p.dropIds]),
      jobsRepointed: await q("SELECT id, clientCompanyId FROM jobs WHERE clientCompanyId IN (?)", [p.dropIds]),
      memberships: await q("SELECT * FROM client_company_memberships WHERE clientCompanyId IN (?)", [p.dropIds]),
    });
  }
  const undoPath = path.join(os.homedir(), "Downloads", `artswrk-company-merge-${Date.now()}.json`);
  fs.writeFileSync(undoPath, JSON.stringify(undo, null, 2));
  console.log(`\nUndo record saved: ${undoPath}`);

  await conn.beginTransaction();
  for (const p of plans) {
    if (Object.keys(p.fill).length) {
      const cols = Object.keys(p.fill);
      await q(`UPDATE client_companies SET ${cols.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`, [...cols.map((c) => p.fill[c]), p.keep.id]);
    }
    await q("UPDATE jobs SET clientCompanyId = ? WHERE clientCompanyId IN (?)", [p.keep.id, p.dropIds]);
    // Memberships are unique per (company, Bubble user): drop ones the kept company already has.
    await q(
      `DELETE m FROM client_company_memberships m
       JOIN client_company_memberships k ON k.clientCompanyId = ? AND k.bubbleUserId <=> m.bubbleUserId
       WHERE m.clientCompanyId IN (?)`, [p.keep.id, p.dropIds]);
    await q("UPDATE client_company_memberships SET clientCompanyId = ? WHERE clientCompanyId IN (?)", [p.keep.id, p.dropIds]);
    await q("DELETE FROM client_companies WHERE id IN (?)", [p.dropIds]);
  }
  await conn.commit();
  console.log(`\nMerged ${plans.length} group(s); removed ${plans.reduce((n, p) => n + p.dropIds.length, 0)} duplicate companies.`);
} catch (err) {
  try { await conn.rollback(); } catch {}
  console.error(`\nFailed — ${APPLY ? "rolled back, nothing changed" : "nothing changed"}: ${err.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
