/**
 * Apply Data Hub "Do Not Contact" flags everywhere we send from:
 *   - Brevo: blacklist the contact (creates a blacklisted contact if they
 *     aren't in Brevo yet, so a later import can't mail them either).
 *   - email_suppressions (scope global): the SendGrid send worker checks this
 *     before every send.
 * HubSpot gets the flag through the regular HubSpot push.
 * Only rows not yet applied are processed, so the nightly run is cheap.
 */
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { dataHubFlags, emailSuppressions } from "../../drizzle/schema";
import { requestJson, mapLimit } from "./http";

export async function applyDnc(): Promise<{ applied: number; failed: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not set");

  const pending = await db
    .select({ id: dataHubFlags.id, email: dataHubFlags.email, scope: dataHubFlags.dncScope })
    .from(dataHubFlags)
    .where(and(eq(dataHubFlags.doNotContact, true), isNull(dataHubFlags.dncAppliedAt)));

  let applied = 0;
  let failed = 0;
  await mapLimit(pending, 3, async (f) => {
    try {
      const { status, data } = await requestJson("api.brevo.com", "/v3/contacts", {
        method: "POST",
        headers: { "api-key": key },
        body: { email: f.email, emailBlacklisted: true, updateEnabled: true },
      });
      if (status >= 300) throw new Error(`Brevo ${status}: ${JSON.stringify(data).slice(0, 200)}`);

      const reason = `Data Hub DNC${f.scope ? `: ${f.scope}` : ""}`.slice(0, 128);
      await db
        .insert(emailSuppressions)
        .values({ email: f.email, source: "inapp", scope: "global", reason })
        .onDuplicateKeyUpdate({ set: { reason, updatedAt: new Date() } });
      await db.update(dataHubFlags).set({ dncAppliedAt: new Date() }).where(eq(dataHubFlags.id, f.id));
      applied++;
    } catch (e) {
      failed++;
      console.error(`[data-hub] DNC apply failed for row ${f.id}:`, (e as Error).message);
    }
  });
  console.log(`[data-hub] DNC: ${applied} applied, ${failed} failed`);
  return { applied, failed };
}
