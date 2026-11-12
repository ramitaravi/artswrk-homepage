/**
 * Per-contact Brevo engagement for the Data Hub: last open, opens in the last
 * 90 days, and how many WRK Experience campaigns the contact opened.
 *
 * Brevo has no bulk "who opened what" export over the API, so this reads
 * /contacts/{email}/campaignStats one contact at a time. To stay inside the
 * rate limit, each run refreshes only the stalest `budget` contacts; with
 * ~25k contacts and the default budget, everyone is refreshed about weekly,
 * and anyone who never had stats goes first.
 */
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { leadsContacts } from "../../drizzle/schema";
import { requestJson, mapLimit } from "./http";

const BREVO_HOST = "api.brevo.com";
const DAY = 86_400_000;

/** WRK campaigns sent before the name convention settled. */
const KNOWN_WRK_CAMPAIGN_IDS = [512, 701, 768, 809];
const WRK_NAME = /experience|\bwrk\b|intensive|convention/i;

function brevoHeaders() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not set");
  return { "api-key": key };
}

export interface CampaignStats {
  opened?: { campaignId: number; count?: number; eventTime?: string }[];
}

export interface Engagement {
  lastOpenedAt: Date | null;
  opens90d: number;
  wrkEmailsOpened: number;
}

/** Pure: turn a campaignStats payload into the three Data Hub numbers. */
export function computeEngagement(stats: CampaignStats, wrkIds: Set<number>, now = new Date()): Engagement {
  const cutoff = now.getTime() - 90 * DAY;
  let lastOpenedAt: Date | null = null;
  const recent = new Set<number>();
  const wrk = new Set<number>();
  for (const o of stats.opened ?? []) {
    const t = o.eventTime ? new Date(o.eventTime) : null;
    if (t && !isNaN(t.getTime())) {
      if (!lastOpenedAt || t > lastOpenedAt) lastOpenedAt = t;
      if (t.getTime() >= cutoff) recent.add(o.campaignId);
    }
    if (wrkIds.has(o.campaignId)) wrk.add(o.campaignId);
  }
  return { lastOpenedAt, opens90d: recent.size, wrkEmailsOpened: wrk.size };
}

/** IDs of sent campaigns that belong to The WRK Experience. */
export async function getWrkCampaignIds(): Promise<Set<number>> {
  const ids = new Set(KNOWN_WRK_CAMPAIGN_IDS);
  for (let offset = 0; offset < 2000; offset += 100) {
    const { status, data } = await requestJson(
      BREVO_HOST,
      `/v3/emailCampaigns?status=sent&limit=100&offset=${offset}&excludeHtmlContent=true`,
      { headers: brevoHeaders() }
    );
    if (status !== 200) break;
    const list: any[] = data?.campaigns ?? [];
    for (const c of list) if (WRK_NAME.test(`${c.name ?? ""} ${c.subject ?? ""}`)) ids.add(c.id);
    if (list.length < 100) break;
  }
  return ids;
}

export async function refreshEngagement(budget = 3500): Promise<{ refreshed: number; failed: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const wrkIds = await getWrkCampaignIds();

  const due = await db
    .select({ id: leadsContacts.id, email: leadsContacts.email })
    .from(leadsContacts)
    .where(or(isNull(leadsContacts.statsSyncedAt), sql`${leadsContacts.statsSyncedAt} < NOW() - INTERVAL 5 DAY`))
    .orderBy(sql`${leadsContacts.statsSyncedAt} IS NOT NULL`, asc(leadsContacts.statsSyncedAt))
    .limit(budget);

  let refreshed = 0;
  let failed = 0;
  await mapLimit(due, 4, async (c) => {
    try {
      const { status, data } = await requestJson<CampaignStats>(
        BREVO_HOST,
        `/v3/contacts/${encodeURIComponent(c.email)}/campaignStats`,
        { headers: brevoHeaders() }
      );
      if (status === 429) throw new Error("rate limited");
      const e = status === 200 ? computeEngagement(data ?? {}, wrkIds) : { lastOpenedAt: null, opens90d: 0, wrkEmailsOpened: 0 };
      await db
        .update(leadsContacts)
        .set({
          lastOpenedAt: e.lastOpenedAt,
          opens90d: e.opens90d,
          wrkEmailsOpened: e.wrkEmailsOpened,
          statsSyncedAt: new Date(),
        })
        .where(and(eq(leadsContacts.id, c.id)));
      refreshed++;
    } catch {
      failed++;
    }
  });
  console.log(`[data-hub] engagement: ${refreshed} refreshed, ${failed} failed, ${wrkIds.size} WRK campaigns`);
  return { refreshed, failed };
}
