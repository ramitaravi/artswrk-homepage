/**
 * SENDGRID EVENT WEBHOOK  →  email_suppressions
 * ─────────────────────────────────────────────────────────────────────────────
 * Layer 2 of the opt-out architecture. SendGrid posts delivery events here; the
 * ones that mean "never mail this address again" are written straight into the
 * suppression table, which the send worker reads before EVERY send. That is why
 * a one-click unsubscribe takes effect on the next batch rather than the next
 * nightly sync.
 *
 * Scope matters. A `group_unsubscribe` on the Job Alerts group stops job alerts
 * and nothing else; a bounce or spam report stops everything, because the
 * address is either dead or has told a mailbox provider we are spam.
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { ASM_GROUP_JOB_ALERTS } from "../email";

type Scope = "global" | "job_alerts";

/** Which events suppress, and how widely. Anything not listed is ignored. */
function classify(event: string, asmGroupId?: number): Scope | null {
  switch (event) {
    case "bounce":
    case "dropped":
    case "spamreport":
      // Dead or hostile address — stop all mail, not just job alerts.
      return "global";
    case "unsubscribe":
    case "group_unsubscribe":
      // Scoped to the group the message was stamped with. Job alert sends carry
      // ASM_GROUP_JOB_ALERTS, so unsubscribing from one leaves booking
      // confirmations and messages alone.
      return asmGroupId === ASM_GROUP_JOB_ALERTS ? "job_alerts" : "global";
    default:
      return null;
  }
}

export async function handleSendGridWebhook(req: Request, res: Response): Promise<void> {
  // Acknowledge immediately. SendGrid retries on a non-2xx, and a slow handler
  // turns one batch into a retry storm.
  res.status(200).json({ received: true });

  const events: any[] = Array.isArray(req.body) ? req.body : [];
  if (!events.length) return;

  const db = await getDb();
  if (!db) { console.error("[sendgrid-webhook] no database"); return; }

  let suppressed = 0;
  for (const e of events) {
    const email = String(e?.email ?? "").trim().toLowerCase();
    const event = String(e?.event ?? "");
    if (!email || !email.includes("@")) continue;

    const scope = classify(event, e?.asm_group_id);
    if (!scope) continue;

    const reason = [event, e?.type, e?.reason].filter(Boolean).join(": ").slice(0, 128);
    try {
      await db.execute(`
        INSERT INTO email_suppressions (email, source, scope, reason, createdAt, updatedAt)
        VALUES (${q(email)}, 'sendgrid', '${scope}', ${q(reason)}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE reason = VALUES(reason), updatedAt = NOW()`);
      suppressed++;
    } catch (err) {
      console.error(`[sendgrid-webhook] failed to suppress ${email}:`, (err as Error).message);
    }
  }
  if (suppressed) console.log(`[sendgrid-webhook] ${suppressed} suppression(s) from ${events.length} event(s)`);
}

function q(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}
