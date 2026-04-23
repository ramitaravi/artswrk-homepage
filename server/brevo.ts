/**
 * Brevo (formerly Sendinblue) API helper
 * All calls are server-side only — the API key is never exposed to the client.
 *
 * Docs: https://developers.brevo.com/reference
 *
 * Note: Uses Node.js https module instead of native fetch to avoid TLS
 * compatibility issues with undici (Node's built-in fetch) and Brevo's servers.
 */
import https from "https";

const BASE_HOST = "api.brevo.com";
const BASE_PATH = "/v3";

function apiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY is not set");
  return key;
}

/** Make an HTTPS request using Node's https module to avoid undici TLS issues */
function httpsRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: BASE_HOST,
      path: `${BASE_PATH}${path}`,
      method,
      headers,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function brevoFetch<T>(
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    "api-key": apiKey(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (options.body) headers["Content-Length"] = Buffer.byteLength(options.body).toString();

  const { status, data } = await httpsRequest(method, path, headers, options.body);

  if (status < 200 || status >= 300) {
    throw new Error(`Brevo API error ${status}: ${data}`);
  }
  return JSON.parse(data) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrevoContact {
  id: number;
  email: string;
  emailBlacklisted: boolean;
  smsBlacklisted: boolean;
  createdAt: string;
  modifiedAt: string;
  listIds: number[];
  attributes: Record<string, string | number | boolean | null>;
}

export interface BrevoContactsResponse {
  contacts: BrevoContact[];
  count: number;
}

export interface BrevoList {
  id: number;
  name: string;
  totalBlacklisted: number;
  totalSubscribers: number;
  uniqueSubscribers: number;
  folderId?: number;
  createdAt?: string;
}

export interface BrevoListsResponse {
  lists: BrevoList[];
  count: number;
}

export interface BrevoGlobalStats {
  uniqueClicks: number;
  clickers: number;
  complaints: number;
  delivered: number;
  sent: number;
  softBounces: number;
  hardBounces: number;
  uniqueViews: number;
  unsubscriptions: number;
  viewed: number;
  trackableViews: number;
  estimatedViews: number;
  opensRate: number;
}

export interface BrevoCampaign {
  id: number;
  name: string;
  subject: string;
  status: "sent" | "draft" | "queued" | "suspended" | "archive" | "inProcess";
  sentDate?: string;
  createdAt: string;
  modifiedAt: string;
  sender: { name: string; email: string };
  recipients: { lists: number[]; exclusionLists: number[] };
  statistics?: {
    globalStats: BrevoGlobalStats;
  };
  tag?: string;
}

export interface BrevoCampaignsResponse {
  campaigns: BrevoCampaign[];
  count: number;
}

export interface BrevoEmailEvent {
  email: string;
  date: string;
  subject?: string;
  messageId?: string;
  event: string;
  tag?: string;
  ip?: string;
  link?: string;
  from?: string;
}

export interface BrevoEmailEventsResponse {
  events: BrevoEmailEvent[];
  count?: number;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts(opts: {
  limit?: number;
  offset?: number;
  sort?: "asc" | "desc";
  email?: string;
  listId?: number;
}): Promise<BrevoContactsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 25));
  params.set("offset", String(opts.offset ?? 0));
  params.set("sort", opts.sort ?? "desc");
  if (opts.listId) params.set("listId", String(opts.listId));

  // Brevo doesn't support free-text search on /contacts; use /contacts/{email} for exact lookup
  if (opts.email) {
    try {
      const contact = await brevoFetch<BrevoContact>(
        `/contacts/${encodeURIComponent(opts.email)}`
      );
      return { contacts: [contact], count: 1 };
    } catch {
      return { contacts: [], count: 0 };
    }
  }

  return brevoFetch<BrevoContactsResponse>(`/contacts?${params.toString()}`);
}

export async function getContactByEmail(
  email: string
): Promise<BrevoContact | null> {
  try {
    return await brevoFetch<BrevoContact>(
      `/contacts/${encodeURIComponent(email)}`
    );
  } catch {
    return null;
  }
}

export async function getContactEmailHistory(
  email: string,
  limit = 20
): Promise<BrevoEmailEvent[]> {
  try {
    const params = new URLSearchParams({ email, limit: String(limit), sort: "desc" });
    const res = await brevoFetch<BrevoEmailEventsResponse>(
      `/smtp/statistics/events?${params.toString()}`
    );
    return res.events ?? [];
  } catch {
    return [];
  }
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export async function getLists(opts: {
  limit?: number;
  offset?: number;
  sort?: "asc" | "desc";
}): Promise<BrevoListsResponse> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
    sort: opts.sort ?? "desc",
  });
  return brevoFetch<BrevoListsResponse>(`/contacts/lists?${params.toString()}`);
}

export async function getListById(id: number): Promise<BrevoList> {
  return brevoFetch<BrevoList>(`/contacts/lists/${id}`);
}

export async function createList(name: string, folderId = 1): Promise<{ id: number }> {
  return brevoFetch<{ id: number }>("/contacts/lists", {
    method: "POST",
    body: JSON.stringify({ name, folderId }),
  });
}

export async function deleteList(id: number): Promise<void> {
  await brevoFetch<void>(`/contacts/lists/${id}`, { method: "DELETE" });
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaigns(opts: {
  limit?: number;
  offset?: number;
  status?: "sent" | "draft" | "queued" | "archive" | "inProcess";
  sort?: "asc" | "desc";
}): Promise<BrevoCampaignsResponse> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 25),
    offset: String(opts.offset ?? 0),
    sort: opts.sort ?? "desc",
  });
  if (opts.status) params.set("status", opts.status);
  return brevoFetch<BrevoCampaignsResponse>(
    `/emailCampaigns?${params.toString()}`
  );
}

export async function getCampaignById(id: number): Promise<BrevoCampaign> {
  return brevoFetch<BrevoCampaign>(`/emailCampaigns/${id}`);
}

// ─── Overview stats (aggregated from recent campaigns) ────────────────────────

export interface LeadsOverviewStats {
  totalContacts: number;
  totalLists: number;
  totalCampaignsSent: number;
  avgOpenRate: number;       // 0–100
  avgClickRate: number;      // 0–100
  totalDelivered: number;
  totalUnsubscribes: number;
}

export async function getOverviewStats(): Promise<LeadsOverviewStats> {
  const [contactsRes, listsRes, campaignsRes] = await Promise.all([
    brevoFetch<BrevoContactsResponse>("/contacts?limit=1&offset=0"),
    brevoFetch<BrevoListsResponse>("/contacts/lists?limit=1&offset=0"),
    brevoFetch<BrevoCampaignsResponse>(
      "/emailCampaigns?limit=50&offset=0&status=sent&sort=desc"
    ),
  ]);

  const campaigns = campaignsRes.campaigns ?? [];
  let totalDelivered = 0;
  let totalViews = 0;
  let totalClicks = 0;
  let totalUnsubs = 0;
  let campaignsWithData = 0;

  for (const c of campaigns) {
    const gs = c.statistics?.globalStats;
    if (!gs || gs.delivered === 0) continue;
    campaignsWithData++;
    totalDelivered += gs.delivered;
    totalViews += gs.uniqueViews;
    totalClicks += gs.uniqueClicks;
    totalUnsubs += gs.unsubscriptions;
  }

  const avgOpenRate =
    campaignsWithData > 0
      ? Math.round((totalViews / totalDelivered) * 100 * 10) / 10
      : 0;
  const avgClickRate =
    campaignsWithData > 0
      ? Math.round((totalClicks / totalDelivered) * 100 * 10) / 10
      : 0;

  return {
    totalContacts: contactsRes.count ?? 0,
    totalLists: listsRes.count ?? 0,
    totalCampaignsSent: campaignsRes.count ?? 0,
    avgOpenRate,
    avgClickRate,
    totalDelivered,
    totalUnsubscribes: totalUnsubs,
  };
}
