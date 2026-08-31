import "dotenv/config";
import { listHeartbeatJobs } from "../server/_core/heartbeat.ts";
const r = await listHeartbeatJobs("");
console.log(JSON.stringify(r, null, 2));
