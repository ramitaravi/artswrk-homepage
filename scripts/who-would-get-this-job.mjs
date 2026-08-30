/**
 * Shows one job and the exact list of artists who would receive it, with the
 * reason each one matched. Read-only: sends nothing, changes nothing.
 *
 *   npx tsx scripts/who-would-get-this-job.mjs <jobId>
 */
import "dotenv/config";
import mysql from "mysql2/promise";
const { findMatchingArtists } = await import("../server/jobAlerts/matching.ts");
const { formatWhen, formatRate, formatLocation, jobTitle, toPublicJobUrl } =
  await import("../server/jobAlerts/format.ts");

const jobId = Number(process.argv[2] || 2343848);
const c = await mysql.createConnection(process.env.DATABASE_URL);

const [[job]] = await c.query(`
  SELECT j.*, m.name AS svc, a.name AS artistType,
    COALESCE(cc.name, u.clientCompanyName,
      NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client
  FROM jobs j
  LEFT JOIN users u ON j.clientUserId=u.id
  LEFT JOIN client_companies cc ON j.clientCompanyId=cc.id
  LEFT JOIN master_service_types m ON m.bubbleId=j.masterServiceTypeId
  LEFT JOIN master_artist_types a ON a.bubbleId=j.bubbleArtistTypeId
  WHERE j.id=?`, [jobId]);
if (!job) { console.log("No job with that id."); process.exit(0); }

const line = "─".repeat(78);
console.log(`\n${line}\nTHE JOB\n${line}`);
console.log(`  Title        ${jobTitle(job)}`);
console.log(`  Type of work ${job.svc ?? "(none)"}${job.artistType ? `   (under ${job.artistType})` : ""}`);
console.log(`  Posted by    ${job.client ?? "(unknown)"}`);
console.log(`  When         ${formatWhen(job.startDate && new Date(job.startDate), job.endDate && new Date(job.endDate), job.dateType) ?? "—"}`);
console.log(`  Where        ${formatLocation(job.locationAddress, job.locationCity, job.locationState) ?? "—"}`);
console.log(`  Rate         ${formatRate(job) ?? "—"}`);
console.log(`  Link         ${toPublicJobUrl(process.env.VITE_APP_URL || "https://app.artswrk.com", job)}`);

const lat = job.locationLat != null ? Number(job.locationLat) : null;
const lng = job.locationLng != null ? Number(job.locationLng) : null;
const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

const { artists } = await findMatchingArtists({
  id: job.id, isPremium: false,
  masterServiceTypeId: job.masterServiceTypeId ?? null,
  lat: hasCoords ? lat : null, lng: hasCoords ? lng : null,
  isRemote: !hasCoords, ownerUserId: job.clientUserId ?? null,
});

const ids = artists.map(a => a.userId);
let byId = new Map();
if (ids.length) {
  const [rows] = await c.query(
    `SELECT id, firstName, lastName, name, location, planTier FROM users WHERE id IN (${ids.map(()=>"?").join(",")})`, ids);
  byId = new Map(rows.map(r => [r.id, r]));
}

console.log(`\n${line}\nWOULD GO TO ${artists.length} ARTISTS\n${line}`);
console.log(`  ${"NAME".padEnd(24)} ${"TIER".padEnd(7)} ${"MILES".padStart(6)}  WHERE`);
console.log(`  ${"-".repeat(74)}`);
artists.sort((a,b)=>(a.distance??999)-(b.distance??999));
for (const a of artists) {
  const u = byId.get(a.userId) ?? {};
  const nm = (u.firstName ? `${u.firstName} ${u.lastName ?? ""}` : u.name || "(no name)").trim();
  const tier = a.isPro ? "PRO" : (u.planTier === "artist_basic" ? "Basic" : "Free");
  const mi = a.distance == null ? "remote" : a.distance.toFixed(1);
  console.log(`  ${nm.slice(0,23).padEnd(24)} ${tier.padEnd(7)} ${String(mi).padStart(6)}  ${(u.location??"").slice(0,32)}`);
}
const pro = artists.filter(a=>a.isPro).length;
console.log(`\n  ${artists.length} artists · ${pro} PRO · ${artists.length-pro} Free/Basic`);
console.log(`  Each gets ONE email containing this job (plus anything else matching them that day).`);
console.log(`\n  Nothing was sent. This is a read-only preview.\n`);
await c.end();
process.exit(0);
