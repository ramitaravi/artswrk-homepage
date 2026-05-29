/**
 * SCHEDULED BUBBLE SYNC HANDLER
 * ─────────────────────────────────────────────────────────────────────────────
 * Express handler for /api/scheduled/bubble-sync
 * Called by the Manus Heartbeat cron on a daily schedule.
 *
 * Runs the full sync-all.mjs script (--mode=daily) as a child process.
 * Returns immediately with { accepted: true } and logs output asynchronously.
 */
import { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function handleScheduledBubbleSync(req: Request, res: Response): Promise<void> {
  // Verify this is a cron call via the Manus-platform gateway header
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
  if (!taskUid) {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }

  const mode = (req.body?.mode as string) || "daily";
  if (!["frequent", "daily"].includes(mode)) {
    res.status(400).json({ error: "Invalid mode. Use 'frequent' or 'daily'." });
    return;
  }

  console.log(`[ScheduledSync] Triggered by cron task ${taskUid}, mode=${mode}`);

  // Respond immediately so the platform doesn't time out waiting
  res.json({ accepted: true, mode, taskUid });

  // Run the sync script as a background child process
  const scriptPath = path.resolve(__dirname, "../../scripts/sync-all.mjs");
  const child = spawn("node", [scriptPath, `--mode=${mode}`], {
    env: {
      ...process.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    stdout += text;
    process.stdout.write(`[ScheduledSync] ${text}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    stderr += text;
    process.stderr.write(`[ScheduledSync:ERR] ${text}`);
  });

  child.on("close", (code: number | null) => {
    if (code === 0) {
      console.log(`[ScheduledSync] Sync completed successfully (mode=${mode})`);
    } else {
      console.error(`[ScheduledSync] Sync exited with code ${code} (mode=${mode})`);
    }
  });

  child.on("error", (err: Error) => {
    console.error(`[ScheduledSync] Failed to spawn sync process: ${err.message}`);
  });
}
