/**
 * Creates the 2026–27 recurring class bookings in class-bookings-2026-09-14.data.mjs.
 * One weekly admin booking per artist per class day. Each week's "Complete Your
 * Booking" reminder is set for the end of that day's last class, Eastern. Artist
 * and studio see the same hourly rate; each booking stores its scheduled hours
 * so every week shows a placeholder estimate (rate × hours + the studio's 5%
 * processing fee) until the artist submits real hours and reimbursements.
 *
 *   npx tsx scripts/create-class-bookings-2026-09-14.mjs                      # preview, changes nothing
 *   npx tsx scripts/create-class-bookings-2026-09-14.mjs --apply              # create READY rows, no emails
 *   ... --apply --email-artists                                               # create, then email each artist once
 *   ... --email-only                                                          # email artists for rows already created
 *   ... --only 2,3                                                            # limit to specific rows
 *   ... --confirm-held                                                        # include rows on hold
 *
 * Skips a row when an admin booking already exists for the same artist, client
 * and first class date, so re-running is safe. Emails are grouped: one per
 * artist, listing all of that artist's rows in the run.
 */
import "dotenv/config";
import { computeAdminPeriods, createAdminBooking, getDb } from "../server/db.ts";
import { sendRecurringClassesAddedEmail } from "../server/email.ts";
import { utcDateString } from "../shared/adminBookingSchedule.ts";
import { CLASS_BOOKINGS, reminderTimeFor, hoursFor, fmtTime } from "./class-bookings-2026-09-14.data.mjs";

const APPLY = process.argv.includes("--apply");
const EMAIL_ARTISTS = process.argv.includes("--email-artists");
const EMAIL_ONLY = process.argv.includes("--email-only");
const CONFIRM_HELD = process.argv.includes("--confirm-held");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx === -1 ? null : new Set(process.argv[onlyIdx + 1].split(",").map(Number));

if (EMAIL_ARTISTS && !APPLY) {
  console.error("--email-artists only works with --apply (it emails for bookings created in that run). Use --email-only for existing bookings.");
  process.exit(1);
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtEt = (d) => d.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const db = await getDb();
if (!db) { console.error("No database connection (DATABASE_URL). Nothing changed."); process.exit(1); }
const rowsOf = (r) => (Array.isArray(r) ? (Array.isArray(r[0]) ? r[0] : r) : []);
const q = async (sql) => rowsOf(await db.execute(sql));

const ids = (key) => [...new Set(CLASS_BOOKINGS.map((b) => b[key]))].join(",");
const companies = new Map((await q(`SELECT id, ownerUserId, name, locationAddress, locationLat, locationLng, locationCity, locationState, locationPlaceId FROM client_companies WHERE id IN (${ids("company")})`)).map((r) => [r.id, r]));
const people = new Map((await q(`SELECT id, firstName, lastName, email, userRole, artistStripeAccountId IS NOT NULL AS stripe FROM users WHERE id IN (${ids("artist")},${ids("client")})`)).map((r) => [r.id, r]));

const plans = [];
for (const b of CLASS_BOOKINGS) {
  if (ONLY && !ONLY.has(b.n)) continue;
  const problems = [];
  const company = companies.get(b.company);
  const artist = people.get(b.artist);
  if (!company) problems.push(`company #${b.company} not found`);
  else if (company.ownerUserId !== b.client) problems.push(`company #${b.company} belongs to #${company.ownerUserId}, not client #${b.client}`);
  if (!artist) problems.push(`artist #${b.artist} not found`);
  else if (artist.userRole !== "Artist") problems.push(`#${b.artist} is not an artist`);
  if (!people.get(b.client)) problems.push(`client #${b.client} not found`);
  const firstDay = new Date(`${b.first}T00:00:00Z`);
  if (DAYS[firstDay.getUTCDay()] !== b.day) problems.push(`${b.first} is a ${DAYS[firstDay.getUTCDay()]}, not a ${b.day}`);

  const reminderTime = reminderTimeFor(b);
  const hours = hoursFor(b);
  const periods = computeAdminPeriods(firstDay, new Date(`${b.end}T00:00:00Z`), true, "weekly", reminderTime);
  const existing = await q(`SELECT id FROM bookings WHERE isAdminBooking = 1 AND artistUserId = ${b.artist} AND clientUserId = ${b.client} AND DATE(startDate) = '${b.first}' LIMIT 1`);
  const description = [
    `${company?.name ?? "Studio"} · ${b.day}s`,
    ...b.classes.map(([s, e, name]) => `${fmtTime(s)}–${fmtTime(e)} ${name}`),
    `${hours} hrs per class day · $${b.rate}/hr`,
  ].join("\n");

  const status = problems.length ? "PROBLEM"
    : existing.length ? `EXISTS #${existing[0].id}`
    : b.hold && !CONFIRM_HELD ? "ON HOLD"
    : "READY";
  plans.push({ b, company, artist, reminderTime, hours, periods, description, problems, status });
}

console.log(APPLY ? "CREATING" : EMAIL_ONLY ? "EMAILING ARTISTS for existing bookings" : "PREVIEW — nothing will change (add --apply to create)");
console.table(plans.map((p) => ({
  "#": p.b.n,
  studio: p.company?.name ?? "?",
  artist: p.b.artistName,
  day: p.b.day.slice(0, 3),
  firstClass: p.periods.length ? utcDateString(p.periods[0].start) : "—",
  lastClass: p.periods.length ? utcDateString(p.periods[p.periods.length - 1].start) : "—",
  weeks: p.periods.length,
  hours: p.hours,
  rate: `$${p.b.rate}/hr`,
  firstReminderET: p.periods.length ? fmtEt(p.periods[0].notifyAt) : "—",
  status: p.status,
})));
for (const p of plans) {
  if (p.problems.length) console.log(`  #${p.b.n}: ${p.problems.join("; ")}`);
  if (p.status === "ON HOLD") console.log(`  #${p.b.n} on hold: ${p.b.hold} Re-run with --confirm-held once confirmed.`);
}

async function emailArtists(rows) {
  const byArtist = new Map();
  for (const p of rows) {
    if (!byArtist.has(p.b.artist)) byArtist.set(p.b.artist, []);
    byArtist.get(p.b.artist).push(p);
  }
  for (const [artistId, list] of byArtist) {
    const artist = people.get(artistId);
    if (!artist?.email) { console.log(`  ✗ ${list[0].b.artistName}: no email on file, not sent`); continue; }
    await sendRecurringClassesAddedEmail({
      to: artist.email,
      firstName: artist.firstName ?? list[0].b.artistName.split(" ")[0],
      schedules: list.map((p) => ({
        studio: p.company.name,
        location: p.company.locationAddress ?? null,
        day: p.b.day,
        firstDate: utcDateString(p.periods[0].start),
        lastDate: utcDateString(p.periods[p.periods.length - 1].start),
        ratePerHour: p.b.rate,
        hours: p.hours,
        classes: p.b.classes.map(([start, end, name]) => ({ start, end, name })),
      })),
    });
    console.log(`  ✉ ${list[0].b.artistName}: sent (${list.length} schedule${list.length === 1 ? "" : "s"})`);
  }
}

if (EMAIL_ONLY) {
  const existingRows = plans.filter((p) => p.status.startsWith("EXISTS"));
  if (!existingRows.length) { console.log("\nNo existing bookings to email about."); process.exit(0); }
  await emailArtists(existingRows);
  process.exit(0);
}

if (!APPLY) {
  console.log("\nExample description (#" + (plans[0]?.b.n ?? "") + "):\n" + (plans[0]?.description ?? ""));
  process.exit(0);
}

const created = [];
for (const p of plans.filter((x) => x.status === "READY")) {
  const c = p.company;
  const id = await createAdminBooking({
    artistUserId: p.b.artist,
    clientUserId: p.b.client,
    artistRateDollars: p.b.rate,
    clientRateDollars: p.b.rate,
    startDate: new Date(`${p.b.first}T00:00:00Z`),
    endDate: new Date(`${p.b.end}T00:00:00Z`),
    isRecurring: true,
    recurringCadence: "weekly",
    locationAddress: c.locationAddress ?? null,
    locationLat: c.locationLat ?? null,
    locationLng: c.locationLng ?? null,
    locationCity: c.locationCity ?? null,
    locationState: c.locationState ?? null,
    locationPlaceId: c.locationPlaceId ?? null,
    description: p.description,
    reminderTime: p.reminderTime,
    hours: p.hours,
  });
  console.log(`  ✓ #${p.b.n} ${c.name} · ${p.b.artistName} · ${p.b.day}s → booking ${id} (${p.periods.length} weeks)`);
  created.push(p);
}
console.log(`\nCreated ${created.length} booking(s).`);

if (EMAIL_ARTISTS && created.length) await emailArtists(created);
else console.log("No emails were sent.");
process.exit(0);
