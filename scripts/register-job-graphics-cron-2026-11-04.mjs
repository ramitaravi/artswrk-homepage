/**
 * Registers the daily job graphics run with the Manus Heartbeat scheduler.
 *
 *   npx tsx scripts/register-job-graphics-cron-2026-11-04.mjs
 *
 * 14:00 UTC is 9 AM New York in winter and 10 AM in summer, and either is fine
 * for a batch the team reviews during the day. Does nothing if already registered.
 */
import "dotenv/config";
import { createHeartbeatJob, listHeartbeatJobs } from "../server/_core/heartbeat.ts";

const NAME = "job-graphics-daily";

const existing = await listHeartbeatJobs("");
const already = existing.jobs.find((j) => j.name === NAME);
if (already) {
  console.log("Already registered:", already);
  process.exit(0);
}

const result = await createHeartbeatJob(
  {
    name: NAME,
    cron: "0 0 14 * * *",
    path: "/api/scheduled/job-graphics",
    method: "POST",
    description: "Daily: new Artswrk jobs become filled Canva designs in the team folder",
  },
  "",
);
console.log("Registered:", result);
