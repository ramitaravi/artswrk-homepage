/**
 * For the N most recently posted active jobs: how many artists would receive
 * each one, and who. Read-only — sends nothing, changes nothing.
 *
 *   npx tsx scripts/who-would-get-recent-jobs.mjs [count]
 *
 * Also writes recent-jobs-recipients.csv (one row per artist per job).
 *
 * The important number is at the bottom: because the digest batches, an artist
 * who matches four of these jobs gets ONE email containing four jobs, not four
 * emails. Per-job counts add up to far more than the emails actually sent.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
const { findMatchingArtists } = await import("../server/jobAlerts/matching.ts");
const { formatLocation, jobTitle } = await import("../server/jobAlerts/format.ts");

const N = Number(process.argv[2] || 10);
const c = await mysql.createConnection(process.env.DATABASE_URL);

const [jobs] = await c.query(`
  SELECT j.id, j.title, j.description, j.locationAddress, j.locationCity, j.locationState,
         j.locationLat, j.locationLng, j.masterServiceTypeId, j.clientUserId,
         j.createdAt, j.bubbleCreatedAt, m.name AS svc
  FROM jobs j
  LEFT JOIN master_service_types m ON m.bubbleId = j.masterServiceTypeId
  WHERE j.requestStatus = 'Active'
  ORDER BY COALESCE(j.bubbleCreatedAt, j.createdAt) DESC
  LIMIT ${N}`);

const union = new Map();          // userId -> {name,email,tier,jobs:[]}
const rows = [];
const line = "─".repeat(96);

console.log(`\n${line}\n  THE ${jobs.length} MOST RECENTLY POSTED ACTIVE JOBS\n${line}`);

for (const j of jobs) {
  const lat = j.locationLat != null ? Number(j.locationLat) : null;
  const lng = j.locationLng != null ? Number(j.locationLng) : null;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const { artists } = await findMatchingArtists({
    id: j.id, isPremium: false,
    masterServiceTypeId: j.masterServiceTypeId ?? null,
    lat: hasCoords ? lat : null, lng: hasCoords ? lng : null,
    isRemote: !hasCoords, ownerUserId: j.clientUserId ?? null,
  });

  let byId = new Map();
  if (artists.length) {
    const ids = artists.map(a => a.userId);
    const [us] = await c.query(
      `SELECT id, firstName, lastName, name, email, location, planTier
       FROM users WHERE id IN (${ids.map(()=>"?").join(",")})`, ids);
    byId = new Map(us.map(u => [u.id, u]));
  }

  const where = formatLocation(j.locationAddress, j.locationCity, j.locationState) ?? "—";
  const why = !j.masterServiceTypeId ? "  ⚠ no service type — matches nobody"
            : !hasCoords ? "  (remote — service type only)" : "";
  console.log(`\n  #${j.id}  ${jobTitle(j).slice(0,44)}`);
  console.log(`     ${(j.svc ?? "(no type)").padEnd(22)} ${where.padEnd(26)} → ${String(artists.length).padStart(5)} artists${why}`);

  const sample = [...artists].sort((a,b)=>(a.distance??999)-(b.distance??999)).slice(0,5);
  for (const a of sample) {
    const u = byId.get(a.userId) ?? {};
    const nm = (u.firstName ? `${u.firstName} ${u.lastName ?? ""}` : u.name || "(no name)").trim();
    console.log(`        ${nm.slice(0,26).padEnd(28)} ${a.distance==null?"remote":a.distance.toFixed(0)+" mi"}`);
  }
  if (artists.length > 5) console.log(`        … and ${artists.length - 5} more`);

  for (const a of artists) {
    const u = byId.get(a.userId) ?? {};
    const nm = (u.firstName ? `${u.firstName} ${u.lastName ?? ""}` : u.name || "").trim();
    rows.push({ jobId: j.id, jobTitle: jobTitle(j), serviceType: j.svc ?? "", jobLocation: where,
      artistId: a.userId, artistName: nm, email: a.email,
      tier: a.isPro ? "PRO" : (u.planTier === "artist_basic" ? "Basic" : "Free"),
      artistLocation: u.location ?? "", miles: a.distance == null ? "remote" : a.distance.toFixed(1) });
    if (!union.has(a.userId)) union.set(a.userId, { nm, email: a.email, isPro: a.isPro, jobs: [] });
    union.get(a.userId).jobs.push(j.id);
  }
}

const esc = v => { const s = v==null?"":String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
if (rows.length) {
  const cols = Object.keys(rows[0]);
  fs.writeFileSync("recent-jobs-recipients.csv",
    [cols.join(","), ...rows.map(r => cols.map(k => esc(r[k])).join(","))].join("\n"));
}

const totalPerJob = rows.length;
const distinct = union.size;
const multi = [...union.values()].filter(u => u.jobs.length > 1).length;
console.log(`\n${line}\n  IF ALL ${jobs.length} WENT OUT IN ONE DIGEST\n${line}`);
console.log(`  Job-to-artist matches in total .... ${totalPerJob.toLocaleString()}`);
console.log(`  Distinct artists ................. ${distinct.toLocaleString()}   ← this many EMAILS`);
console.log(`  Getting more than one job ........ ${multi.toLocaleString()} (batched into a single email each)`);
console.log(`  PRO members ...................... ${[...union.values()].filter(u=>u.isPro).length.toLocaleString()}`);
const busiest = [...union.values()].sort((a,b)=>b.jobs.length-a.jobs.length).slice(0,5);
console.log(`\n  Busiest inboxes:`);
for (const u of busiest) console.log(`     ${(u.nm||u.email).slice(0,28).padEnd(30)} ${u.jobs.length} jobs in one email`);
console.log(`\n  Full list written to recent-jobs-recipients.csv (${rows.length.toLocaleString()} rows)`);
console.log(`  Nothing was sent.\n`);
await c.end();
process.exit(0);
