import "dotenv/config";
import { createHeartbeatJob, listHeartbeatJobs } from "../server/_core/heartbeat.ts";

const existing = await listHeartbeatJobs("");
const already = existing.jobs.find((j) => j.name === "booking-completion-reminders");
if (already) {
  console.log("Already registered:", already);
  process.exit(0);
}

const result = await createHeartbeatJob(
  {
    name: "booking-completion-reminders",
    cron: "0 */15 * * * *",
    path: "/api/scheduled/booking-completion-reminders",
    method: "POST",
    description: "Complete-your-booking reminder — 10 min after job start (or day-of if no time set)",
  },
  ""
);
console.log("Registered:", result);
