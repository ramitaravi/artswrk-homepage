/**
 * Renders the job alert emails to HTML files using REAL rows from the database.
 * Sends nothing, touches nothing, needs no env flags — it only reads.
 *
 *   npx tsx scripts/preview-job-alert-emails.mjs
 *
 * Writes to ./email-previews/ : the digest as a free artist sees it, as a PRO
 * member sees it, and a last-minute email. Open them in a browser.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

const { renderDigest, renderLastMinute } = await import("../server/jobAlerts/templates.ts");
const { toJobCard, toProCard, formatWhen, formatRate, formatLocation, jobTitle } =
  await import("../server/jobAlerts/format.ts");
const { excerpt } = await import("../server/jobAlerts/templates.ts");

const APP = process.env.VITE_APP_URL || "https://app.artswrk.com";
const OUT = path.resolve("email-previews");
fs.mkdirSync(OUT, { recursive: true });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [jobs] = await conn.query(`
  SELECT j.id, j.title, j.description, j.startDate, j.endDate, j.dateType,
         j.locationAddress, j.locationCity, j.locationState,
         j.isHourly, j.openRate, j.clientHourlyRate, j.clientFlatRate, j.hours,
         j.transportation, j.transportationDetails, m.name AS svc,
         COALESCE(cc.name, u.clientCompanyName,
           NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client
  FROM jobs j
  LEFT JOIN users u ON j.clientUserId = u.id
  LEFT JOIN client_companies cc ON j.clientCompanyId = cc.id
  LEFT JOIN master_service_types m ON m.bubbleId = j.masterServiceTypeId
  WHERE j.requestStatus = 'Active' AND j.description IS NOT NULL AND j.description <> ''
  ORDER BY j.startDate IS NULL, j.startDate DESC
  LIMIT 12`);

const [pro] = await conn.query(`
  SELECT id, serviceType, company, location, budget, workFromAnywhere, description
  FROM premium_jobs WHERE status='Active' AND serviceType IS NOT NULL
  ORDER BY id DESC LIMIT 5`);

await conn.end();

const cards = jobs.slice(0, 10).map((r) => toJobCard(r, APP));
const proCards = pro.map((r) => toProCard(r, APP));

const base = {
  firstName: "Ramita",
  jobs: cards,
  totalMatchCount: jobs.length,
  proJobs: proCards,
  // Public browse page, not /app/jobs — that one is behind the auth wrapper
  // and would bounce a logged-out recipient to login, same as the card links did.
  jobsUrl: `${APP}/jobs`,
  preferencesUrl: `${APP}/app/settings/notifications`,
  unsubscribeUrl: `${APP}/unsubscribe?token=EXAMPLE`,
};

const free = renderDigest({ ...base, isProMember: false });
const proV = renderDigest({ ...base, isProMember: true });

// A "last minute" preview must use a job that actually starts soon, otherwise
// the subject line reads "LAST MINUTE ... Apr 2027" and looks broken.
const now = Date.now();
const lm = jobs.filter(j => j.startDate && new Date(j.startDate) > now)
               .sort((a,b) => new Date(a.startDate) - new Date(b.startDate))[0] || jobs[0];
const last = renderLastMinute({
  firstName: "Ramita",
  serviceName: lm.svc || jobTitle(lm),
  title: jobTitle(lm),
  client: lm.client || null,
  whenLabel: formatWhen(lm.startDate ? new Date(lm.startDate) : null,
                        lm.endDate ? new Date(lm.endDate) : null, lm.dateType) || "Starting soon",
  location: formatLocation(lm.locationAddress, lm.locationCity, lm.locationState),
  transportationNote: lm.transportation ? (lm.transportationDetails || "Travel reimbursed") : null,
  rateLabel: formatRate(lm),
  excerpt: excerpt(lm.description),
  applyUrl: `${APP}/app/jobs/${lm.id}`,
  preferencesUrl: base.preferencesUrl,
  unsubscribeUrl: base.unsubscribeUrl,
});

const write = (name, r) => {
  fs.writeFileSync(path.join(OUT, name), r.html);
  console.log(`  ${name}\n     subject: ${r.subject}`);
};
console.log(`rendered from ${jobs.length} real active jobs + ${pro.length} real PRO jobs\n`);
write("digest-free-artist.html", free);
write("digest-pro-member.html", proV);
write("last-minute.html", last);
console.log(`\nopen: ${OUT}`);
