/**
 * Push the Artswrk Data Hub into HubSpot contacts.
 *
 * Source of truth per field:
 *   leads_contacts  → Brevo engagement (last open, 90-day opens, WRK opens)
 *   users           → Artswrk account + role (client / enterprise / artist)
 *   data_hub_flags  → master-sheet Row ID + Do Not Contact
 *
 * Contacts are upserted by email. Names/company are only sent for contacts
 * HubSpot doesn't have yet, so Brevo never overwrites better CRM data.
 * Needs HUBSPOT_ACCESS_TOKEN (service key "Artswrk Data Hub Sync").
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { dataHubFlags, leadsContacts, users } from "../../drizzle/schema";
import { requestJson, sleep } from "./http";

const HS_HOST = "api.hubapi.com";
const BATCH = 100;

export interface HubRow {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  lastOpenedAt?: Date | null;
  opens90d?: number | null;
  wrkEmailsOpened?: number | null;
  isArtswrkUser?: boolean | null;
  userRole?: string | null;
  enterprise?: boolean | null;
  masterRowId?: string | null;
  doNotContact?: boolean | null;
}

export function roleFor(userRole?: string | null, enterprise?: boolean | null): string | null {
  if (!userRole) return null;
  if (/client/i.test(userRole)) return enterprise ? "enterprise" : "client";
  if (/artist/i.test(userRole)) return "artist";
  return null;
}

/** Pure: Data Hub row → HubSpot property map. Empty values are omitted, never blanked. */
export function buildHubspotProps(r: HubRow, now = new Date()): Record<string, string> {
  const p: Record<string, string> = {
    artswrk_brevo_opens_90d: String(r.opens90d ?? 0),
    artswrk_wrk_emails_opened: String(r.wrkEmailsOpened ?? 0),
    artswrk_is_user: r.isArtswrkUser ? "true" : "false",
    artswrk_do_not_contact: r.doNotContact ? "true" : "false",
    artswrk_data_hub_synced_at: now.toISOString(),
  };
  if (r.lastOpenedAt) p.artswrk_brevo_last_open = new Date(r.lastOpenedAt).toISOString();
  const role = roleFor(r.userRole, r.enterprise);
  if (role) p.artswrk_role = role;
  if (r.masterRowId) p.artswrk_master_row_id = r.masterRowId;
  return p;
}

function hsHeaders() {
  const t = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!t) throw new Error("HUBSPOT_ACCESS_TOKEN not set");
  return { Authorization: `Bearer ${t}` };
}

async function hs(path: string, body: unknown) {
  for (let attempt = 0; ; attempt++) {
    const res = await requestJson(HS_HOST, path, { method: "POST", headers: hsHeaders(), body });
    if (res.status === 429 && attempt < 4) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    return res;
  }
}

async function existingEmails(emails: string[]): Promise<Set<string>> {
  const res = await hs("/crm/v3/objects/contacts/batch/read", {
    idProperty: "email",
    properties: ["email"],
    inputs: emails.map((id) => ({ id })),
  });
  const found = new Set<string>();
  for (const r of res.data?.results ?? []) {
    const e = String(r.properties?.email ?? "").toLowerCase();
    if (e) found.add(e);
  }
  return found;
}

async function loadRows(): Promise<HubRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const leads = await db
    .select({
      email: leadsContacts.email,
      firstName: leadsContacts.firstName,
      lastName: leadsContacts.lastName,
      companyName: leadsContacts.companyName,
      lastOpenedAt: leadsContacts.lastOpenedAt,
      opens90d: leadsContacts.opens90d,
      wrkEmailsOpened: leadsContacts.wrkEmailsOpened,
      isArtswrkUser: leadsContacts.isArtswrkUser,
      userRole: users.userRole,
      enterprise: users.enterprise,
      masterRowId: dataHubFlags.masterRowId,
      doNotContact: dataHubFlags.doNotContact,
    })
    .from(leadsContacts)
    .leftJoin(users, eq(users.id, leadsContacts.artswrkUserId))
    .leftJoin(dataHubFlags, eq(dataHubFlags.email, leadsContacts.email));

  // DNC / Row-ID rows for people who aren't in Brevo.
  const extra = await db
    .select({
      email: dataHubFlags.email,
      companyName: dataHubFlags.studioName,
      masterRowId: dataHubFlags.masterRowId,
      doNotContact: dataHubFlags.doNotContact,
    })
    .from(dataHubFlags)
    .where(sql`${dataHubFlags.doNotContact} = 1 AND NOT EXISTS (SELECT 1 FROM leads_contacts lc WHERE lc.email = ${dataHubFlags.email})`);

  return [...leads, ...extra];
}

export async function pushToHubspot(): Promise<{ upserted: number; created: number; failed: number }> {
  const rows = await loadRows();
  const now = new Date();
  let upserted = 0;
  let created = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const known = await existingEmails(batch.map((r) => r.email));
    const inputs = batch.map((r) => {
      const properties = buildHubspotProps(r, now);
      if (!known.has(r.email)) {
        if (r.firstName) properties.firstname = r.firstName;
        if (r.lastName) properties.lastname = r.lastName;
        if (r.companyName) properties.company = r.companyName;
      }
      return { idProperty: "email", id: r.email, properties };
    });

    let res = await hs("/crm/v3/objects/contacts/batch/upsert", { inputs });
    if (res.status >= 300) {
      // One bad address fails the whole batch — retry in small pieces.
      for (let j = 0; j < inputs.length; j += 10) {
        res = await hs("/crm/v3/objects/contacts/batch/upsert", { inputs: inputs.slice(j, j + 10) });
        if (res.status < 300) upserted += Math.min(10, inputs.length - j);
        else failed += Math.min(10, inputs.length - j);
      }
    } else {
      upserted += inputs.length;
      created += batch.length - known.size;
    }
    await sleep(250);
  }
  console.log(`[data-hub] HubSpot: ${upserted} upserted (${created} new), ${failed} failed`);
  return { upserted, created, failed };
}
