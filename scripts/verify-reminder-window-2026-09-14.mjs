/**
 * Verifies that reminder emails only ever go out on the day of the booking.
 * Read-only: runs SELECTs, sends nothing, marks nothing.
 *
 *   npx tsx scripts/verify-reminder-window-2026-09-14.mjs
 *
 * Part 1 runs the exact SQL conditions the sweep uses against sample rows built
 * inside the query (no real bookings involved) and checks every expected answer.
 * Part 2 runs the real sweep queries against the real schedule at simulated
 * times and checks nothing from an earlier day would be emailed.
 * Exits 1 on any failure.
 */
import "dotenv/config";
import { getDb, getDuePeriodReminders } from "../server/db.ts";
import { getDueCompletionReminders } from "../server/bookingReminders.ts";
import { reminderWindow, completionReminderDueSql, periodReminderDueSql, periodReminderIsTodaySql, easternDateString } from "../server/reminderWindow.ts";

const db = await getDb();
const q = async (sql) => (await db.execute(sql))[0];
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}`); if (!ok) failures++; };
// mysql2 reads DATETIME values as this machine's local time; the stored values are UTC.
const asUtc = (d) => { const x = new Date(d); return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), x.getMinutes(), x.getSeconds())); };
const et = (d) => asUtc(d).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The comparisons below treat stored times as UTC; confirm the session agrees.
const [{ dbNow }] = await q(`SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') dbNow`);
const drift = Math.abs(new Date(dbNow.replace(" ", "T") + "Z").getTime() - Date.now());
check(drift < 120_000, `database clock is UTC (db ${dbNow}, drift ${Math.round(drift / 1000)}s)`);

console.log("\nPART 1 — one-time bookings, sample rows, as of Tue Sep 15 5:06 PM ET");
const sample = (rows) => rows.map(([id, ts], i) => `${i ? "UNION ALL " : ""}SELECT ${id} AS id, CAST('${ts}' AS DATETIME) AS startDate`).join(" ");
const oneTimeCases = [
  // [id, stored UTC start, should remind now?, description]
  [1, "2026-09-15 21:15:00", true, "today 5:15 PM ET — inside the 10-minute lead"],
  [2, "2026-09-15 21:30:00", false, "today 5:30 PM ET — too early (more than 10 min away)"],
  [3, "2026-09-15 13:00:00", true, "today 9:00 AM ET — earlier today, not yet reminded"],
  [4, "2026-09-15 00:00:00", true, "today, date only"],
  [5, "2026-09-14 21:15:00", false, "yesterday 5:15 PM ET"],
  [6, "2026-09-15 03:30:00", false, "yesterday 11:30 PM ET (already Sep 15 in UTC)"],
  [7, "2026-09-14 00:00:00", false, "yesterday, date only"],
  [8, "2026-09-16 13:00:00", false, "tomorrow 9:00 AM ET"],
  [9, "2026-09-16 00:00:00", false, "tomorrow, date only"],
  [10, "2023-03-02 22:00:00", false, "a 2023 booking"],
  [11, "2021-01-09 00:00:00", false, "a 2021 booking, date only"],
];
const tue = reminderWindow(new Date("2026-09-15T21:06:00Z"));
const hit = new Set((await q(`SELECT id FROM (${sample(oneTimeCases)}) b WHERE ${completionReminderDueSql(tue)}`)).map((r) => Number(r.id)));
for (const [id, , expected, label] of oneTimeCases) check(hit.has(id) === expected, `${expected ? "reminds " : "skips   "} ${label}`);

console.log("\nPART 1 — late at night, as of Tue Sep 15 11:55 PM ET");
const late = reminderWindow(new Date("2026-09-16T03:55:00Z"));
const lateCases = [
  [21, "2026-09-16 03:59:00", true, "today 11:59 PM ET (Sep 16 in UTC)"],
  [22, "2026-09-16 00:00:00", false, "tomorrow, date only (already Sep 16 in UTC)"],
  [23, "2026-09-15 00:00:00", true, "today, date only"],
];
const lateHit = new Set((await q(`SELECT id FROM (${sample(lateCases)}) b WHERE ${completionReminderDueSql(late)}`)).map((r) => Number(r.id)));
for (const [id, , expected, label] of lateCases) check(lateHit.has(id) === expected, `${expected ? "reminds " : "skips   "} ${label}`);

console.log("\nPART 1 — weekly class reminders, sample rows, as of Tue Sep 15 5:06 PM ET");
const weekCases = [
  // [id, notifyArtistAt UTC, due?, emailed?, description]
  [31, "2026-09-15 21:05:00", true, true, "today 5:05 PM ET — email"],
  [32, "2026-09-15 22:00:00", false, false, "today 6:00 PM ET — not yet"],
  [33, "2026-09-14 21:05:00", true, false, "yesterday 5:05 PM ET — open the week, no email"],
  [34, "2026-09-15 03:50:00", true, false, "yesterday 11:50 PM ET — open the week, no email"],
  [35, "2025-10-06 21:05:00", true, false, "last year — open the week, no email"],
];
const weekRows = `${weekCases.map(([id, ts], i) => `${i ? "UNION ALL " : ""}SELECT ${id} AS id, CAST('${ts}' AS DATETIME) AS notifyArtistAt`).join(" ")}`;
const weekHit = new Map((await q(`SELECT id, ${periodReminderIsTodaySql(tue)} AS recent FROM (${weekRows}) bp WHERE ${periodReminderDueSql(tue)}`)).map((r) => [Number(r.id), Number(r.recent)]));
for (const [id, , due, emailed, label] of weekCases) {
  const ok = due ? weekHit.has(id) && (weekHit.get(id) === 1) === emailed : !weekHit.has(id);
  check(ok, label);
}

console.log("\nPART 2 — the real schedule at simulated times (nothing is sent or marked)");
const times = [
  ["now", new Date()],
  ["Tue Sep 15, 5:00 PM ET", new Date("2026-09-15T21:00:00Z")],
  ["Tue Sep 15, 5:06 PM ET", new Date("2026-09-15T21:06:00Z")],
  ["Wed Sep 16, 12:05 AM ET", new Date("2026-09-16T04:05:00Z")],
  ["Wed Sep 16, 4:25 PM ET", new Date("2026-09-16T20:25:00Z")],
  ["Thu Sep 17, 5:25 PM ET", new Date("2026-09-17T21:25:00Z")],
  ["Sat Sep 19, 12:40 PM ET", new Date("2026-09-19T16:40:00Z")],
  ["Mon Sep 21, 5:10 PM ET", new Date("2026-09-21T21:10:00Z")],
  ["Wed Sep 23, 3:25 PM ET", new Date("2026-09-23T19:25:00Z")],
];
const artistOfBooking = new Map((await q(`SELECT b.id, TRIM(CONCAT(COALESCE(a.firstName,''),' ',COALESCE(a.lastName,''))) name FROM bookings b JOIN users a ON a.id=b.artistUserId WHERE b.id IN (SELECT DISTINCT bookingId FROM booking_periods WHERE artistNotifiedAt IS NULL)`)).map((r) => [Number(r.id), r.name]));
for (const [label, at] of times) {
  const day = easternDateString(at);
  const oneTime = await getDueCompletionReminders(at);
  const weeks = await getDuePeriodReminders(at);
  const emailed = weeks.filter((w) => Number(w.recent));
  const silent = weeks.filter((w) => !Number(w.recent));
  console.log(`\n  ${label}: ${oneTime.length} one-time · ${emailed.length} weekly emailed · ${silent.length} weekly opened silently`);
  for (const w of emailed) console.log(`      ✉ ${artistOfBooking.get(Number(w.bookingId)) ?? "?"} · booking ${w.bookingId} · class ${et(w.notifyArtistAt)}`);
  check(emailed.every((w) => easternDateString(asUtc(w.notifyArtistAt)) === day), `every weekly email at "${label}" is for that day`);
  check(silent.every((w) => easternDateString(asUtc(w.notifyArtistAt)) < day), `every week opened without email at "${label}" is from an earlier day`);
  const ids = oneTime.map((b) => b.id);
  const rows = ids.length ? await q(`SELECT id, DATE_FORMAT(startDate, '%Y-%m-%d %H:%i:%s') s, bookingStatus, paymentStatus FROM bookings WHERE id IN (${ids.join(",")})`) : [];
  for (const b of rows) console.log(`      ✉ one-time booking ${b.id} · starts ${b.s} UTC · ${b.bookingStatus}/${b.paymentStatus}`);
  const bookingDay = (s) => (s.endsWith("00:00:00") ? s.slice(0, 10) : easternDateString(new Date(s.replace(" ", "T") + "Z")));
  check(rows.every((b) => bookingDay(b.s) === day), `no one-time reminder at "${label}" is for another day`);
  check(rows.every((b) => b.bookingStatus !== "Completed" && b.paymentStatus !== "Paid"), `no one-time reminder at "${label}" is for a completed or paid booking`);
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
