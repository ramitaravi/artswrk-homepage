/**
 * Registers the job alert digest with the Manus Heartbeat scheduler. It was
 * built but never scheduled, so no daily digest had ever run.
 *
 *   npx tsx scripts/register-job-alerts-cron-2026-09-14.mjs
 *
 * Hourly, not daily: 1 PM ET is 17:00 UTC in summer and 18:00 in winter, so
 * the handler (server/jobAlerts/scheduled.ts) checks the New York hour itself
 * and exits unless it's 1 PM. Does nothing if the job is already registered.
 * Whether anything is actually emailed is still controlled by the admin switch.
 */
import "dotenv/config";
import { createHeartbeatJob, listHeartbeatJobs } from "../server/_core/heartbeat.ts";

const NAME = "job-alerts-digest";

const existing = await listHeartbeatJobs("");
const already = existing.jobs.find((j) => j.name === NAME);
if (already) {
  console.log("Already registered:", already);
  process.exit(0);
}

const result = await createHeartbeatJob(
  {
    name: NAME,
    cron: "0 0 * * * *",
    path: "/api/scheduled/job-alerts",
    method: "POST",
    description: "Daily job alert digest — runs hourly, exits unless it is 1 PM in New York",
  },
  ""
);
console.log("Registered:", result);
