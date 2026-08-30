/**
 * Renders the exact email a given job would produce. Read-only.
 *   npx tsx scripts/preview-one-job-email.mjs <jobId>
 */
import "dotenv/config"; import mysql from "mysql2/promise"; import fs from "fs"; import path from "path";
const { renderLastMinute, renderDigest, excerpt } = await import("../server/jobAlerts/templates.ts");
const { formatWhen, formatRate, formatLocation, jobTitle, toPublicJobUrl, toJobCard } =
  await import("../server/jobAlerts/format.ts");
const { unsubscribeUrl } = await import("../server/jobAlerts/unsubscribe.ts");

const jobId = Number(process.argv[2]);
const APP = process.env.VITE_APP_URL || "https://app.artswrk.com";
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [[j]] = await c.query(`
  SELECT j.*, m.name AS svc,
    COALESCE(cc.name, u.clientCompanyName,
      NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client
  FROM jobs j LEFT JOIN users u ON j.clientUserId=u.id
  LEFT JOIN client_companies cc ON j.clientCompanyId=cc.id
  LEFT JOIN master_service_types m ON m.bubbleId=j.masterServiceTypeId
  WHERE j.id=?`, [jobId]);
await c.end();
if (!j) { console.log("no such job"); process.exit(0); }

const OUT = path.resolve("email-previews"); fs.mkdirSync(OUT, { recursive: true });
const common = { preferencesUrl: `${APP}/app/settings?section=notifications`,
                 unsubscribeUrl: unsubscribeUrl(APP, 999999) };

const lm = renderLastMinute({
  firstName: "Marisa",
  serviceName: j.svc || jobTitle(j),
  title: jobTitle(j),
  client: j.client || null,
  whenLabel: formatWhen(j.startDate && new Date(j.startDate), j.endDate && new Date(j.endDate), j.dateType) || "Starting soon",
  location: formatLocation(j.locationAddress, j.locationCity, j.locationState),
  transportationNote: j.transportation ? (j.transportationDetails || "Travel reimbursed") : null,
  rateLabel: formatRate(j),
  excerpt: excerpt(j.description),
  applyUrl: toPublicJobUrl(APP, j),
  ...common,
});
fs.writeFileSync(path.join(OUT, `job-${jobId}-lastminute.html`), lm.html);

const dg = renderDigest({
  firstName: "Marisa", jobs: [toJobCard(j, APP)], totalMatchCount: 1,
  proJobs: [], isProMember: false, jobsUrl: `${APP}/jobs`, ...common,
});
fs.writeFileSync(path.join(OUT, `job-${jobId}-digest.html`), dg.html);

console.log(`LAST-MINUTE  subject: ${lm.subject}`);
console.log(`DIGEST       subject: ${dg.subject}`);
console.log(`\nwritten to email-previews/job-${jobId}-*.html`);
process.exit(0);
