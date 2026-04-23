/**
 * Unified suppression list helper
 * Pulls unsubscribed contacts from Brevo (emailBlacklisted) and
 * suppressed emails from SendGrid, merges them by email address.
 */
import { ENV } from "./_core/env";

const BREVO_API = "https://api.brevo.com/v3";
const SENDGRID_API = "https://api.sendgrid.com/v3";

export type SuppressionSource = "brevo" | "sendgrid" | "both";

export interface UnsubscribedContact {
  email: string;
  sources: SuppressionSource;
  inBrevo: boolean;
  inSendGrid: boolean;
  brevoCreatedAt?: string;
  sendgridCreatedAt?: string;
}

// ── Brevo helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch all blacklisted (unsubscribed) contacts from Brevo.
 * Uses the contacts endpoint filtered by emailBlacklisted.
 * Paginates through all pages.
 */
export async function getBrevoUnsubscribes(limit = 500): Promise<{ email: string; createdAt?: string }[]> {
  const results: { email: string; createdAt?: string }[] = [];
  let offset = 0;
  const pageSize = 500;

  while (true) {
    const res = await fetch(
      `${BREVO_API}/contacts?limit=${pageSize}&offset=${offset}&sort=desc`,
      { headers: { "api-key": ENV.brevoApiKey } }
    );
    if (!res.ok) break;
    const data = await res.json() as any;
    const contacts: any[] = data.contacts ?? [];

    for (const c of contacts) {
      if (c.emailBlacklisted) {
        results.push({ email: c.email.toLowerCase(), createdAt: c.modifiedAt });
      }
    }

    // If we've fetched all contacts or hit our limit, stop
    if (contacts.length < pageSize || results.length >= limit) break;
    offset += pageSize;

    // Safety cap: don't paginate more than 20 pages (10k contacts)
    if (offset >= 10000) break;
  }

  return results.slice(0, limit);
}

/**
 * Add an email to Brevo's global blacklist (unsubscribe from all).
 */
export async function addBrevoUnsubscribe(email: string): Promise<boolean> {
  const res = await fetch(`${BREVO_API}/contacts`, {
    method: "POST",
    headers: {
      "api-key": ENV.brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      emailBlacklisted: true,
      updateEnabled: true,
    }),
  });
  return res.ok || res.status === 204;
}

// ── SendGrid helpers ──────────────────────────────────────────────────────────

/**
 * Fetch all global unsubscribes from SendGrid.
 * Paginates through all pages.
 */
export async function getSendGridUnsubscribes(limit = 500): Promise<{ email: string; createdAt?: string }[]> {
  if (!ENV.sendgridApiKey) return [];

  const results: { email: string; createdAt?: string }[] = [];
  let offset = 0;
  const pageSize = 500;

  while (true) {
    const res = await fetch(
      `${SENDGRID_API}/suppression/unsubscribes?limit=${pageSize}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${ENV.sendgridApiKey}` } }
    );
    if (!res.ok) break;
    const data = await res.json() as any[];
    if (!Array.isArray(data) || data.length === 0) break;

    for (const item of data) {
      results.push({
        email: (item.email ?? "").toLowerCase(),
        createdAt: item.created ? new Date(item.created * 1000).toISOString() : undefined,
      });
    }

    if (data.length < pageSize || results.length >= limit) break;
    offset += pageSize;
    if (offset >= 10000) break;
  }

  return results.slice(0, limit);
}

/**
 * Add an email to SendGrid's global unsubscribe list.
 */
export async function addSendGridUnsubscribe(email: string): Promise<boolean> {
  if (!ENV.sendgridApiKey) return false;
  const res = await fetch(`${SENDGRID_API}/asm/suppressions/global`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_emails: [email] }),
  });
  return res.ok || res.status === 201;
}

/**
 * Remove an email from SendGrid's global unsubscribe list.
 */
export async function removeSendGridUnsubscribe(email: string): Promise<boolean> {
  if (!ENV.sendgridApiKey) return false;
  const encoded = encodeURIComponent(email);
  const res = await fetch(`${SENDGRID_API}/asm/suppressions/global/${encoded}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ENV.sendgridApiKey}` },
  });
  return res.ok || res.status === 204;
}

// ── Merged list ───────────────────────────────────────────────────────────────

/**
 * Fetch and merge unsubscribes from both Brevo and SendGrid.
 * Returns a deduplicated list with source flags.
 */
export async function getMergedUnsubscribes(limit = 500): Promise<{
  contacts: UnsubscribedContact[];
  brevoCount: number;
  sendgridCount: number;
  bothCount: number;
  onlyBrevoCount: number;
  onlySendGridCount: number;
}> {
  const [brevoList, sgList] = await Promise.all([
    getBrevoUnsubscribes(limit),
    getSendGridUnsubscribes(limit),
  ]);

  const brevoMap = new Map(brevoList.map((c) => [c.email, c.createdAt]));
  const sgMap = new Map(sgList.map((c) => [c.email, c.createdAt]));

  const allEmails = new Set([...brevoMap.keys(), ...sgMap.keys()]);
  const contacts: UnsubscribedContact[] = [];

  for (const email of allEmails) {
    const inBrevo = brevoMap.has(email);
    const inSendGrid = sgMap.has(email);
    const sources: SuppressionSource = inBrevo && inSendGrid ? "both" : inBrevo ? "brevo" : "sendgrid";
    contacts.push({
      email,
      sources,
      inBrevo,
      inSendGrid,
      brevoCreatedAt: brevoMap.get(email),
      sendgridCreatedAt: sgMap.get(email),
    });
  }

  // Sort: gaps first (only in one system), then both, alphabetically within groups
  contacts.sort((a, b) => {
    if (a.sources !== "both" && b.sources === "both") return -1;
    if (a.sources === "both" && b.sources !== "both") return 1;
    return a.email.localeCompare(b.email);
  });

  const brevoCount = contacts.filter((c) => c.inBrevo).length;
  const sendgridCount = contacts.filter((c) => c.inSendGrid).length;
  const bothCount = contacts.filter((c) => c.sources === "both").length;
  const onlyBrevoCount = contacts.filter((c) => c.sources === "brevo").length;
  const onlySendGridCount = contacts.filter((c) => c.sources === "sendgrid").length;

  return { contacts, brevoCount, sendgridCount, bothCount, onlyBrevoCount, onlySendGridCount };
}

/**
 * Sync gaps: add emails that are in Brevo but not SendGrid (and vice versa) to both systems.
 * Returns counts of emails synced.
 */
export async function syncSuppressionGaps(): Promise<{
  addedToSendGrid: number;
  addedToBrevo: number;
  errors: string[];
}> {
  const { contacts } = await getMergedUnsubscribes(2000);
  const errors: string[] = [];
  let addedToSendGrid = 0;
  let addedToBrevo = 0;

  const onlyBrevo = contacts.filter((c) => c.sources === "brevo");
  const onlySendGrid = contacts.filter((c) => c.sources === "sendgrid");

  // Add Brevo-only to SendGrid
  for (const c of onlyBrevo) {
    try {
      const ok = await addSendGridUnsubscribe(c.email);
      if (ok) addedToSendGrid++;
    } catch (e) {
      errors.push(`SendGrid add failed for ${c.email}`);
    }
  }

  // Add SendGrid-only to Brevo
  for (const c of onlySendGrid) {
    try {
      const ok = await addBrevoUnsubscribe(c.email);
      if (ok) addedToBrevo++;
    } catch (e) {
      errors.push(`Brevo add failed for ${c.email}`);
    }
  }

  return { addedToSendGrid, addedToBrevo, errors };
}
