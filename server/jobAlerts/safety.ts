/**
 * SEND SAFETY GATES
 * ─────────────────────────────────────────────────────────────────────────────
 * Every job-alert send passes through here. The system is OFF unless somebody
 * deliberately turns it on, and there are four independent ways to keep it off,
 * so a mistake in any one of them still cannot mail a real artist.
 *
 *   1. DB switch      app_settings.job_alerts_enabled — the admin UI toggle.
 *                     Absent or anything other than "true" = off. This is the
 *                     master switch, in the database rather than an env var so
 *                     it can be turned OFF INSTANTLY mid-send without a deploy.
 *   2. JOB_ALERTS_KILL  set to "true" and nothing sends, whatever the DB says.
 *                     The break-glass override.
 *   3. JOB_ALERTS_ENABLED  an env-only way to enable, for CLI dry runs and
 *                     tests without touching the shared DB switch.
 *   4. JOB_ALERTS_ALLOWLIST  when set, ONLY these addresses can receive
 *                     anything. Everyone else is dropped and counted.
 *
 * Plus EMAIL_REDIRECT_TO in server/email.ts, which reroutes every message to a
 * single inbox outside production.
 *
 * The policy is loaded ONCE per run and passed down, rather than each send
 * hitting the database. Loading it per recipient would be thousands of queries;
 * loading it once per run keeps a mid-run "turn it off" from taking effect
 * until the next run, which is the right trade for a run measured in seconds.
 */
import { getDb } from "../db";

export const SETTING_KEY = "job_alerts_enabled";

export interface SendPolicy {
  /** Whether any send may happen at all. */
  enabled: boolean;
  /** When non-empty, the only addresses allowed to receive. */
  allowlist: string[];
  /** Why it is on or off, for the log banner. */
  reason: string;
}

export const ALLOWLIST: string[] = (process.env.JOB_ALERTS_ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Known-safe addresses for testing. NOT automatically allowed — they only
 * receive mail if the allowlist names them. Exported so scripts can label
 * "is this a real artist?" consistently in one place.
 */
export const SAFE_TEST_ADDRESSES = ["ramita@artswrk.com", "ramitaravi.94@gmail.com"];

export function isSafeTestAddress(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (SAFE_TEST_ADDRESSES.includes(e)) return true;
  return /^ramitaravi\.94\+[^@]*@gmail\.com$/.test(e) || /^ramita\+[^@]*@artswrk\.com$/.test(e);
}

/** Read the DB switch. Any failure reads as OFF — if we can't prove sending was
 *  enabled, we don't send. */
export async function isEnabledInDb(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const rows: any = await db.execute(
      `SELECT settingValue FROM app_settings WHERE settingKey = '${SETTING_KEY}' LIMIT 1`
    );
    const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
    return String(list[0]?.settingValue ?? "").trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}

/** Load the policy for one run. Call once, pass the result down. */
export async function loadSendPolicy(): Promise<SendPolicy> {
  if (process.env.JOB_ALERTS_KILL === "true") {
    return { enabled: false, allowlist: ALLOWLIST, reason: "JOB_ALERTS_KILL is set — hard stop" };
  }
  const envOn = process.env.JOB_ALERTS_ENABLED === "true";
  const dbOn = await isEnabledInDb();
  if (!envOn && !dbOn) {
    return {
      enabled: false,
      allowlist: ALLOWLIST,
      reason: "the admin switch is OFF (app_settings.job_alerts_enabled)",
    };
  }
  return {
    enabled: true,
    allowlist: ALLOWLIST,
    reason: dbOn ? "the admin switch is ON" : "JOB_ALERTS_ENABLED is set for this process",
  };
}

export type SendDecision =
  | { send: true }
  | { send: false; reason: "dry_run" | "not_on_allowlist" };

/** The one question every send asks, immediately before dispatch. */
export function decideSend(policy: SendPolicy, email: string): SendDecision {
  if (!policy.enabled) return { send: false, reason: "dry_run" };
  if (policy.allowlist.length && !policy.allowlist.includes(email.trim().toLowerCase())) {
    return { send: false, reason: "not_on_allowlist" };
  }
  return { send: true };
}

/** One-line banner so no run is ever ambiguous about what it just did. */
export function describeMode(policy: SendPolicy): string {
  if (!policy.enabled) return `DRY RUN — ${policy.reason}. Nothing will be sent to anyone.`;
  if (policy.allowlist.length) {
    return `LIVE, ALLOWLIST ONLY (${policy.reason}) — only: ${policy.allowlist.join(", ")}`;
  }
  return `LIVE — SENDING TO REAL ARTISTS (${policy.reason}). No allowlist is set.`;
}
