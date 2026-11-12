/**
 * Artswrk Data Hub — one run, in order:
 *   1. Brevo → leads_contacts        (existing syncLeadsFromBrevo)
 *   2. Brevo engagement refresh      (stalest contacts first)
 *   3. Do Not Contact → Brevo + email_suppressions
 *   4. leads_contacts + users + flags → HubSpot
 *
 * Triggered nightly by the Manus Heartbeat cron (/api/scheduled/data-hub-sync)
 * or from the admin Leads CRM page. Runs in the background; poll status.
 */
import type { Request, Response } from "express";
import { requireCronRequest } from "../_core/cronAuth";
import { syncLeadsFromBrevo } from "../leadsSync";
import { refreshEngagement } from "./engagement";
import { applyDnc } from "./dnc";
import { pushToHubspot } from "./hubspotSync";
import { isDataHubDailyWindow } from "./schedule";

export interface DataHubStatus {
  running: boolean;
  step: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
}

const status: DataHubStatus = { running: false, step: null, startedAt: null, finishedAt: null, error: null, result: null };

export function getDataHubStatus(): DataHubStatus {
  return { ...status };
}

export function startDataHubSync(opts: { skipBrevoPull?: boolean } = {}): boolean {
  if (status.running) return false;
  Object.assign(status, { running: true, step: "starting", startedAt: new Date().toISOString(), finishedAt: null, error: null, result: null });

  (async () => {
    const result: Record<string, unknown> = {};
    try {
      if (!opts.skipBrevoPull) {
        status.step = "Pulling contacts from Brevo";
        result.brevo = await syncLeadsFromBrevo();
      }
      status.step = "Refreshing email engagement";
      result.engagement = await refreshEngagement();
      status.step = "Applying Do Not Contact";
      result.dnc = await applyDnc();
      status.step = "Pushing to HubSpot";
      result.hubspot = await pushToHubspot();
      status.result = result;
    } catch (e) {
      status.error = (e as Error).message;
      status.result = result;
      console.error("[data-hub] run failed:", status.error);
    } finally {
      Object.assign(status, { running: false, step: null, finishedAt: new Date().toISOString() });
    }
  })();
  return true;
}

export async function handleScheduledDataHubSync(req: Request, res: Response): Promise<void> {
  try {
    await requireCronRequest(req);
  } catch {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }
  // UTC-only Heartbeat checks both DST offsets; only the 03:17 New York
  // slot starts work. Retries/delayed delivery are allowed within that hour.
  if (!isDataHubDailyWindow()) {
    res.json({ accepted: false, skipped: "outside-03:17-America/New_York" });
    return;
  }
  const started = startDataHubSync();
  res.json({ accepted: started, alreadyRunning: !started });
}
