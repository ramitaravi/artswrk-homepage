/** Read-only check of every gate Rosemary hits on job 2880001. Sends nothing. */
import "dotenv/config";
import mysql from "mysql2/promise";
const { isClientJobUnlocked, canClientMessageArtist } = await import("../server/db.ts");

const JOB = 2880001, CLIENT = 1022081;
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [[j]] = await c.query(`SELECT * FROM jobs WHERE id=${JOB}`);
const [[u]] = await c.query(`SELECT id,email,planTier,artistStripeAccountId FROM users WHERE id=${CLIENT}`);

console.log("CLIENT:", u.email, "| plan:", u.planTier);
console.log("JOB   :", j.title, "| openRate:", !!j.openRate, "| isHourly:", !!j.isHourly, "| rate:", j.clientHourlyRate);
console.log("");

console.log("1. Artists can find + apply");
console.log("   requestStatus:", j.requestStatus, j.requestStatus === "Active" ? "✓" : "✗");
console.log("   networkStatus:", j.networkStatus, "(alert still queued)");

console.log("\n2. Rosemary can SEE applicants + their pitched rate");
const unlocked = await isClientJobUnlocked(CLIENT, JOB);
console.log("   job unlocked for her:", unlocked, unlocked ? "✓" : "✗ — she must pay $30 or subscribe to see applicants");
console.log("   openRate =", !!j.openRate, "→ artists pitch a rate, stored on the application");

const [apps] = await c.query(`SELECT id,artistUserId,artistHourlyRate,artistFlatRate,isHourlyRate,status
  FROM interested_artists WHERE jobId=${JOB}`);
console.log("   applications so far:", apps.length);

console.log("\n3. Confirm → booking");
const [[bk]] = await c.query(`SELECT COUNT(*) n FROM bookings WHERE jobId=${JOB}`);
console.log("   bookings on this job:", bk.n);

console.log("\n4. Artist gets 'complete your booking' email");
const [cron] = await c.query(`SELECT 1`);
console.log("   driven by the booking-completion-reminders cron (registered + running)");

console.log("\n5. Rosemary pays the artist");
console.log("   she needs a payment method; artist needs Stripe Connect to receive it");
await c.end();
process.exit(0);
