/** Renders the same output the admin preview returns. Reads only; sends nothing. */
import "dotenv/config";
import mysql from "mysql2/promise";
const { renderLastMinute, renderDigest, excerpt } = await import("../server/jobAlerts/templates.ts");
const { toJobCard, formatWhen, formatRate, formatLocation, jobTitle } = await import("../server/jobAlerts/format.ts");

const APP = "https://artswrk.com";
const c = await mysql.createConnection(process.env.DATABASE_URL);
const COLS = `j.id, j.title, j.description, j.startDate, j.endDate, j.dateType,
  j.locationAddress, j.locationCity, j.locationState, j.isHourly, j.openRate,
  j.clientHourlyRate, j.clientFlatRate, j.hours, j.transportation, j.transportationDetails,
  m.name AS svc, COALESCE(cc.name, u.clientCompanyName) AS client`;
const JOINS = `FROM jobs j LEFT JOIN users u ON j.clientUserId=u.id
  LEFT JOIN client_companies cc ON j.clientCompanyId=cc.id
  LEFT JOIN master_service_types m ON m.bubbleId=j.masterServiceTypeId`;

const [[j]] = await c.query(`SELECT ${COLS} ${JOINS} WHERE j.id=2880001`);
const lm = renderLastMinute({
  firstName: "there", serviceName: j.svc || jobTitle(j), title: jobTitle(j), client: j.client || null,
  whenLabel: formatWhen(j.startDate ? new Date(j.startDate) : null, j.endDate ? new Date(j.endDate) : null, j.dateType) || "Starting soon",
  location: formatLocation(j.locationAddress, j.locationCity, j.locationState),
  transportationNote: j.transportation ? (j.transportationDetails || "Travel reimbursed") : null,
  rateLabel: formatRate(j), excerpt: excerpt(j.description),
  applyUrl: `${APP}/app/jobs/${j.id}`, preferencesUrl: `${APP}/app/settings`, unsubscribeUrl: `${APP}/unsubscribe?token=PREVIEW`,
});
console.log("LAST-MINUTE preview");
console.log("  subject:", lm.subject);
console.log("  body   :", lm.html.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim().slice(0,260));

const [queued] = await c.query(`SELECT ${COLS} ${JOINS} WHERE j.networkStatus='pending' AND j.requestStatus='Active' ORDER BY j.createdAt DESC LIMIT 10`);
const dg = renderDigest({
  firstName: "there", jobs: queued.map(r => toJobCard(r, APP)), totalMatchCount: queued.length,
  proJobs: [], jobsUrl: `${APP}/jobs`, preferencesUrl: `${APP}/app/settings`,
  unsubscribeUrl: `${APP}/unsubscribe?token=PREVIEW`, isProMember: false,
});
console.log("\nDIGEST preview");
console.log("  subject:", dg.subject);
console.log("  jobs in it:", queued.length);
console.log("  titles:", queued.map(r => r.title).join(" | "));
await c.end();
process.exit(0);
