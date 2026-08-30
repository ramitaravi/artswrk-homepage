/**
 * NIGHTLY BREVO SYNC  →  email_suppressions
 * ─────────────────────────────────────────────────────────────────────────────
 * Layer 3 of the opt-out design. Artswrk sends marketing through Brevo and job
 * alerts through SendGrid, and the two providers know nothing about each other.
 * Someone who unsubscribed in a Brevo campaign has plainly said "stop emailing
 * me" — mailing them job alerts anyway because a different vendor holds that
 * record is exactly how a sender earns spam complaints.
 *
 * So every night Brevo's blocked list is pulled into the same table the send
 * worker already checks. Scope is `global`: a Brevo unsubscribe isn't specific
 * to job alerts, so it isn't treated as if it were.
 */
import { getDb } from "../db";
import { getBrevoUnsubscribes } from "../suppressions";

export async function syncBrevoSuppressions(limit = 5000): Promise<{
  fetched: number; added: number; errors: number;
}> {
  const db = await getDb();
  if (!db) return { fetched: 0, added: 0, errors: 0 };

  const contacts = await getBrevoUnsubscribes(limit);
  let added = 0, errors = 0;

  for (const c of contacts) {
    const email = String(c.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    try {
      await db.execute(`
        INSERT INTO email_suppressions (email, source, scope, reason, createdAt, updatedAt)
        VALUES ('${email.replace(/'/g, "''")}', 'brevo', 'global', 'blocked in Brevo', NOW(), NOW())
        ON DUPLICATE KEY UPDATE updatedAt = NOW()`);
      added++;
    } catch {
      errors++;
    }
  }
  console.log(`[brevo-sync] ${contacts.length} blocked contacts, ${added} upserted, ${errors} errors`);
  return { fetched: contacts.length, added, errors };
}
