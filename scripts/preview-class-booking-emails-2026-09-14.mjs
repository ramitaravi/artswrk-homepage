/**
 * Renders the "Your weekly classes are set up" email for each artist in
 * class-bookings-2026-09-14.data.mjs WITHOUT sending: the SendGrid client and
 * fetch are both intercepted, and every draft is addressed to a placeholder.
 *
 *   npx tsx scripts/preview-class-booking-emails-2026-09-14.mjs <outDir>
 *
 * Writes one HTML file per artist plus drafts.json (subject, cc, file, rows).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const outDir = process.argv[2];
if (!outDir) { console.error("Usage: npx tsx scripts/preview-class-booking-emails-2026-09-14.mjs <outDir>"); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

// Intercept every delivery path before the email module loads.
const repoRequire = createRequire(import.meta.url);
const sgMail = (await import(pathToFileURL(repoRequire.resolve("@sendgrid/mail")).href)).default;
const captured = [];
sgMail.send = async (msg) => { captured.push(msg); return [{ statusCode: 202, headers: {} }, {}]; };
globalThis.fetch = async () => { throw new Error("network blocked in email preview"); };
process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "SG.preview-not-a-real-key";

const { sendRecurringClassesAddedEmail } = await import("../server/email.ts");
const { computeAdminPeriods, getDb } = await import("../server/db.ts");
const { utcDateString } = await import("../shared/adminBookingSchedule.ts");
const { CLASS_BOOKINGS, reminderTimeFor, hoursFor } = await import("./class-bookings-2026-09-14.data.mjs");

// Real studio names/addresses and artist first names; no artist emails are read.
const db = await getDb();
const rowsOf = (r) => (Array.isArray(r) ? (Array.isArray(r[0]) ? r[0] : r) : []);
const companyIds = [...new Set(CLASS_BOOKINGS.map((b) => b.company))].join(",");
const artistIds = [...new Set(CLASS_BOOKINGS.map((b) => b.artist))].join(",");
const companies = new Map(rowsOf(await db.execute(`SELECT id, name, locationAddress FROM client_companies WHERE id IN (${companyIds})`)).map((r) => [r.id, r]));
const firstNames = new Map(rowsOf(await db.execute(`SELECT id, firstName FROM users WHERE id IN (${artistIds})`)).map((r) => [r.id, r.firstName]));

const byArtist = new Map();
for (const b of CLASS_BOOKINGS) {
  if (!byArtist.has(b.artist)) byArtist.set(b.artist, []);
  byArtist.get(b.artist).push(b);
}

const drafts = [];
for (const [artistId, rows] of byArtist) {
  const before = captured.length;
  await sendRecurringClassesAddedEmail({
    to: "artist-preview@example.com",
    firstName: firstNames.get(artistId) ?? rows[0].artistName.split(" ")[0],
    schedules: rows.map((b) => {
      const periods = computeAdminPeriods(new Date(`${b.first}T00:00:00Z`), new Date(`${b.end}T00:00:00Z`), true, "weekly", reminderTimeFor(b));
      const company = companies.get(b.company);
      return {
        studio: company?.name ?? "Studio",
        location: company?.locationAddress ?? null,
        day: b.day,
        firstDate: utcDateString(periods[0].start),
        lastDate: utcDateString(periods[periods.length - 1].start),
        ratePerHour: b.rate,
        hours: hoursFor(b),
        classes: b.classes.map(([start, end, name]) => ({ start, end, name })),
      };
    }),
  });
  const msg = captured[before];
  if (!msg) { console.log(`  ✗ ${rows[0].artistName}: nothing rendered`); continue; }
  const file = `${rows[0].artistName.toLowerCase().replace(/[^a-z]+/g, "-")}.html`;
  fs.writeFileSync(path.join(outDir, file), msg.html);
  drafts.push({ artist: rows[0].artistName, rows: rows.map((r) => r.n), held: rows.some((r) => r.hold), subject: msg.subject, cc: msg.cc, file });
  console.log(`  ✓ ${rows[0].artistName}: ${msg.subject} (${rows.length} schedule${rows.length === 1 ? "" : "s"})`);
}
fs.writeFileSync(path.join(outDir, "drafts.json"), JSON.stringify(drafts, null, 2));
console.log(`\n${drafts.length} drafts written to ${outDir}. Nothing was sent.`);
process.exit(0);
