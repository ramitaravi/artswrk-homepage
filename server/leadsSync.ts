/**
 * Leads CRM Sync Engine
 *
 * Pulls all contacts from Brevo in batches, enriches them with Artswrk user
 * data (jobs posted, bookings, premium status, role), and upserts into the
 * leads_contacts cache table.
 *
 * Called on-demand from the admin Leads Dashboard "Sync from Brevo" button.
 * Never runs automatically — always triggered manually.
 */

import { getDb } from "./db";
import { leadsContacts, leadsSyncLog, users, jobs } from "../drizzle/schema";
import { eq, inArray, sql } from "drizzle-orm";
import https from "https";

const BREVO_HOST = "api.brevo.com";
const BREVO_PATH = "/v3";
const BATCH_SIZE = 1000; // Brevo max per request
const ARTSWRK_BATCH = 200; // DB lookup batch size

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
}

function brevoKey(): string {
  const k = process.env.BREVO_API_KEY;
  if (!k) throw new Error("BREVO_API_KEY not set");
  return k;
}

// ── Low-level HTTPS helper (avoids undici TLS issues) ────────────────────────

function httpsGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: BREVO_HOST,
        path: `${BREVO_PATH}${path}`,
        method: "GET",
        headers: {
          "api-key": brevoKey(),
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// ── Brevo fetch helpers ───────────────────────────────────────────────────────

async function fetchBrevoContactPage(offset: number): Promise<{
  contacts: any[];
  count: number;
}> {
  const data = await httpsGet(
    `/contacts?limit=${BATCH_SIZE}&offset=${offset}&sort=desc`
  );
  return {
    contacts: data.contacts ?? [],
    count: data.count ?? 0,
  };
}

async function fetchBrevoContactStats(email: string): Promise<{
  totalCampaignsReceived: number;
  totalOpens: number;
  totalClicks: number;
  lastOpenedAt: Date | null;
  lastClickedAt: Date | null;
  lastCampaignAt: Date | null;
}> {
  try {
    const data = await httpsGet(
      `/contacts/${encodeURIComponent(email)}/campaignStats?limit=50`
    );
    const messages: any[] = data.messagesSent ?? [];
    let totalOpens = 0;
    let totalClicks = 0;
    let lastOpenedAt: Date | null = null;
    let lastClickedAt: Date | null = null;
    let lastCampaignAt: Date | null = null;

    for (const m of messages) {
      const stats = m.statistics ?? {};
      totalOpens += stats.uniqueViews ?? 0;
      totalClicks += stats.uniqueClicks ?? 0;

      if (m.sentAt) {
        const sent = new Date(m.sentAt);
        if (!lastCampaignAt || sent > lastCampaignAt) lastCampaignAt = sent;
      }
      if (stats.lastOpenDate) {
        const d = new Date(stats.lastOpenDate);
        if (!lastOpenedAt || d > lastOpenedAt) lastOpenedAt = d;
      }
      if (stats.lastClickDate) {
        const d = new Date(stats.lastClickDate);
        if (!lastClickedAt || d > lastClickedAt) lastClickedAt = d;
      }
    }

    return {
      totalCampaignsReceived: messages.length,
      totalOpens,
      totalClicks,
      lastOpenedAt,
      lastClickedAt,
      lastCampaignAt,
    };
  } catch {
    return {
      totalCampaignsReceived: 0,
      totalOpens: 0,
      totalClicks: 0,
      lastOpenedAt: null,
      lastClickedAt: null,
      lastCampaignAt: null,
    };
  }
}

// ── Artswrk enrichment ────────────────────────────────────────────────────────

async function getArtswrkEnrichment(emails: string[]): Promise<
  Map<
    string,
    {
      userId: number;
      userRole: string | null;
      hiringCategory: string | null;
      bookingCount: number;
      jobsPostedCount: number;
      artswrkPro: boolean;
      artswrkBasic: boolean;
      clientPremium: boolean;
    }
  >
> {
  if (emails.length === 0) return new Map();

  // Fetch matching users
  const matchedUsers = await (await db())
    .select({
      id: users.id,
      email: users.email,
      userRole: users.userRole,
      hiringCategory: users.hiringCategory,
      bookingCount: users.bookingCount,
      artswrkPro: users.artswrkPro,
      artswrkBasic: users.artswrkBasic,
      clientPremium: users.clientPremium,
    })
    .from(users)
    .where(inArray(users.email, emails));

  // Count jobs posted per user
  const userIds = matchedUsers.map((u) => u.id);
  const jobCounts = userIds.length > 0
    ? await (await db())
        .select({
          clientUserId: jobs.clientUserId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(jobs)
        .where(inArray(jobs.clientUserId, userIds))
        .groupBy(jobs.clientUserId)
    : [];

  const jobCountMap = new Map<number, number>(
    jobCounts.map((j) => [j.clientUserId!, Number(j.count)])
  );

  const result = new Map<string, any>();
  for (const u of matchedUsers) {
    if (!u.email) continue;
    result.set(u.email.toLowerCase(), {
      userId: u.id,
      userRole: u.userRole,
      hiringCategory: u.hiringCategory,
      bookingCount: u.bookingCount ?? 0,
      jobsPostedCount: jobCountMap.get(u.id) ?? 0,
      artswrkPro: u.artswrkPro ?? false,
      artswrkBasic: u.artswrkBasic ?? false,
      clientPremium: u.clientPremium ?? false,
    });
  }
  return result;
}

// ── Main sync function ────────────────────────────────────────────────────────

export interface SyncResult {
  contactsUpserted: number;
  artswrkMatched: number;
  durationMs: number;
  error?: string;
}

export async function syncLeadsFromBrevo(
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const startedAt = new Date();
  const log = await (await db())
    .insert(leadsSyncLog)
    .values({ syncType: "full", startedAt })
    .$returningId();
  const logId = log[0]?.id;

  const progress = (msg: string) => {
    console.log(`[LeadsSync] ${msg}`);
    onProgress?.(msg);
  };

  let contactsUpserted = 0;
  let artswrkMatched = 0;

  try {
    // ── Step 1: Fetch total contact count ──────────────────────────────────
    progress("Fetching contact count from Brevo...");
    const firstPage = await fetchBrevoContactPage(0);
    const totalContacts = firstPage.count;
    progress(`Total Brevo contacts: ${totalContacts}`);

    // ── Step 2: Fetch all contacts in batches ──────────────────────────────
    const allContacts: any[] = [...firstPage.contacts];
    let offset = BATCH_SIZE;
    while (offset < totalContacts) {
      progress(`Fetching contacts ${offset}–${Math.min(offset + BATCH_SIZE, totalContacts)}...`);
      const page = await fetchBrevoContactPage(offset);
      allContacts.push(...page.contacts);
      offset += BATCH_SIZE;
    }
    progress(`Fetched ${allContacts.length} contacts total`);

    // ── Step 3: Process in Artswrk enrichment batches ─────────────────────
    for (let i = 0; i < allContacts.length; i += ARTSWRK_BATCH) {
      const batch = allContacts.slice(i, i + ARTSWRK_BATCH);
      const emails = batch
        .map((c: any) => c.email?.toLowerCase())
        .filter(Boolean) as string[];

      progress(`Enriching batch ${i}–${i + batch.length} with Artswrk data...`);
      const artswrkMap = await getArtswrkEnrichment(emails);

      // Build upsert rows
      const rows = batch.map((c: any) => {
        const attrs = c.attributes ?? {};
        const email = (c.email ?? "").toLowerCase();
        const artswrk = artswrkMap.get(email);

        return {
          brevoId: c.id ?? null,
          email,
          emailBlacklisted: c.emailBlacklisted ?? false,
          firstName: attrs.FIRSTNAME ?? null,
          lastName: attrs.LASTNAME ?? null,
          fullName: attrs.FULL_NAME ?? null,
          companyName: attrs.COMPANY_NAME ?? null,
          city: attrs.CITY ?? attrs.LOCATION ?? null,
          state: attrs.STATE ?? null,
          country: attrs.COUNTRY ?? null,
          brevoUserRole: attrs.USERROLE ?? null,
          hiringCategory: attrs.HIRING_CATEGORY ?? null,
          brevoListIds: JSON.stringify(c.listIds ?? []),
          hasUnsubscribed: c.emailBlacklisted ?? false,
          // Artswrk enrichment
          isArtswrkUser: !!artswrk,
          artswrkUserId: artswrk?.userId ?? null,
          artswrkUserRole: artswrk?.userRole ?? null,
          artswrkHiringCategory: artswrk?.hiringCategory ?? null,
          jobsPostedCount: artswrk?.jobsPostedCount ?? 0,
          bookingCount: artswrk?.bookingCount ?? 0,
          artswrkPro: artswrk?.artswrkPro ?? false,
          artswrkBasic: artswrk?.artswrkBasic ?? false,
          clientPremium: artswrk?.clientPremium ?? false,
          // Engagement stats — set to 0 initially; run stats sync separately
          totalCampaignsReceived: 0,
          totalOpens: 0,
          totalClicks: 0,
          lastSyncedAt: new Date(),
          brevoCreatedAt: c.createdAt ? new Date(c.createdAt) : null,
        };
      });

      // Upsert (insert or update on duplicate email)
      const d = await db();
      for (const row of rows) {
        await d
          .insert(leadsContacts)
          .values(row)
          .onDuplicateKeyUpdate({
            set: {
              brevoId: row.brevoId,
              emailBlacklisted: row.emailBlacklisted,
              firstName: row.firstName,
              lastName: row.lastName,
              fullName: row.fullName,
              companyName: row.companyName,
              city: row.city,
              state: row.state,
              country: row.country,
              brevoUserRole: row.brevoUserRole,
              hiringCategory: row.hiringCategory,
              brevoListIds: row.brevoListIds,
              hasUnsubscribed: row.hasUnsubscribed,
              isArtswrkUser: row.isArtswrkUser,
              artswrkUserId: row.artswrkUserId,
              artswrkUserRole: row.artswrkUserRole,
              artswrkHiringCategory: row.artswrkHiringCategory,
              jobsPostedCount: row.jobsPostedCount,
              bookingCount: row.bookingCount,
              artswrkPro: row.artswrkPro,
              artswrkBasic: row.artswrkBasic,
              clientPremium: row.clientPremium,
              lastSyncedAt: row.lastSyncedAt,
            },
          });
        contactsUpserted++;
        if (artswrkMap.get(row.email)) artswrkMatched++;
      }
    }

    // ── Step 4: Update sync log ────────────────────────────────────────────
    const durationMs = Date.now() - startedAt.getTime();
    if (logId) {
      await (await db())
        .update(leadsSyncLog)
        .set({ contactsUpserted, artswrkMatched, completedAt: new Date() })
        .where(eq(leadsSyncLog.id, logId));
    }
    progress(`Sync complete: ${contactsUpserted} upserted, ${artswrkMatched} Artswrk matches`);
    return { contactsUpserted, artswrkMatched, durationMs };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (logId) {
      await (await db())
        .update(leadsSyncLog)
        .set({ error: msg, completedAt: new Date() })
        .where(eq(leadsSyncLog.id, logId));
    }
    return {
      contactsUpserted,
      artswrkMatched,
      durationMs: Date.now() - startedAt.getTime(),
      error: msg,
    };
  }
}

// ── DB query helpers for the CRM list view ────────────────────────────────────

export async function getLeadsContacts(params: {
  limit: number;
  offset: number;
  search?: string;
  userRole?: string;
  hiringCategory?: string;
  isArtswrkUser?: boolean;
  hasPostedJobs?: boolean;
  isPremium?: boolean;
  sort?: "newest" | "oldest" | "most_opens" | "most_clicks";
}) {
  // Build dynamic WHERE conditions
  const conditions: any[] = [];

  if (params.search) {
    const q = `%${params.search}%`;
    conditions.push(
      sql`(${leadsContacts.email} LIKE ${q} OR ${leadsContacts.fullName} LIKE ${q} OR ${leadsContacts.companyName} LIKE ${q} OR ${leadsContacts.city} LIKE ${q})`
    );
  }
  if (params.userRole) {
    conditions.push(
      sql`(${leadsContacts.brevoUserRole} = ${params.userRole} OR ${leadsContacts.artswrkUserRole} = ${params.userRole})`
    );
  }
  if (params.hiringCategory) {
    conditions.push(
      sql`(${leadsContacts.hiringCategory} = ${params.hiringCategory} OR ${leadsContacts.artswrkHiringCategory} = ${params.hiringCategory})`
    );
  }
  if (params.isArtswrkUser !== undefined) {
    conditions.push(eq(leadsContacts.isArtswrkUser, params.isArtswrkUser));
  }
  if (params.hasPostedJobs) {
    conditions.push(sql`${leadsContacts.jobsPostedCount} > 0`);
  }
  if (params.isPremium) {
    conditions.push(
      sql`(${leadsContacts.artswrkPro} = 1 OR ${leadsContacts.artswrkBasic} = 1 OR ${leadsContacts.clientPremium} = 1)`
    );
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  const orderClause = (() => {
    switch (params.sort) {
      case "oldest":
        return sql`ORDER BY ${leadsContacts.brevoCreatedAt} ASC`;
      case "most_opens":
        return sql`ORDER BY ${leadsContacts.totalOpens} DESC`;
      case "most_clicks":
        return sql`ORDER BY ${leadsContacts.totalClicks} DESC`;
      default:
        return sql`ORDER BY ${leadsContacts.brevoCreatedAt} DESC`;
    }
  })();

  const d = await db();
  const [rows, countRows] = await Promise.all([
    d
      .select()
      .from(leadsContacts)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(
        params.sort === "oldest"
          ? sql`${leadsContacts.brevoCreatedAt} ASC`
          : params.sort === "most_opens"
          ? sql`${leadsContacts.totalOpens} DESC`
          : params.sort === "most_clicks"
          ? sql`${leadsContacts.totalClicks} DESC`
          : sql`${leadsContacts.brevoCreatedAt} DESC`
      )
      .limit(params.limit)
      .offset(params.offset),
    d
      .select({ count: sql<number>`count(*)` })
      .from(leadsContacts)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined),
  ]);

  return {
    contacts: rows,
    total: Number(countRows[0]?.count ?? 0),
  };
}

export async function getLeadsContact(email: string) {
  const rows = await (await db())
    .select()
    .from(leadsContacts)
    .where(eq(leadsContacts.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLastSyncInfo() {
  const rows = await (await db())
    .select()
    .from(leadsSyncLog)
    .orderBy(sql`${leadsSyncLog.startedAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

export async function getLeadsCrmStats() {
  const [totals] = await (await db())
    .select({
      total: sql<number>`count(*)`,
      artswrkUsers: sql<number>`sum(case when ${leadsContacts.isArtswrkUser} = 1 then 1 else 0 end)`,
      notOnPlatform: sql<number>`sum(case when ${leadsContacts.isArtswrkUser} = 0 then 1 else 0 end)`,
      clients: sql<number>`sum(case when ${leadsContacts.brevoUserRole} = 'Client' or ${leadsContacts.artswrkUserRole} = 'Client' then 1 else 0 end)`,
      artists: sql<number>`sum(case when ${leadsContacts.brevoUserRole} = 'Artist' or ${leadsContacts.artswrkUserRole} = 'Artist' then 1 else 0 end)`,
      premium: sql<number>`sum(case when ${leadsContacts.artswrkPro} = 1 or ${leadsContacts.clientPremium} = 1 then 1 else 0 end)`,
      hasPostedJobs: sql<number>`sum(case when ${leadsContacts.jobsPostedCount} > 0 then 1 else 0 end)`,
      unsubscribed: sql<number>`sum(case when ${leadsContacts.hasUnsubscribed} = 1 then 1 else 0 end)`,
    })
    .from(leadsContacts);

  return {
    total: Number(totals?.total ?? 0),
    artswrkUsers: Number(totals?.artswrkUsers ?? 0),
    notOnPlatform: Number(totals?.notOnPlatform ?? 0),
    clients: Number(totals?.clients ?? 0),
    artists: Number(totals?.artists ?? 0),
    premium: Number(totals?.premium ?? 0),
    hasPostedJobs: Number(totals?.hasPostedJobs ?? 0),
    unsubscribed: Number(totals?.unsubscribed ?? 0),
  };
}
