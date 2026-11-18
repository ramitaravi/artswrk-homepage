/**
 * FINANCE FEED — projected Marketplace bookings, read-only
 * ─────────────────────────────────────────────────────────────────────────────
 * Feeds the "Marketplace Bookings (live)" tab of the NEW Master TXs workbook,
 * which the Revenue Dashboard sums into its Projected section. Google Apps
 * Script calls GET /api/finance/projected-bookings hourly with a shared key.
 *
 * READ-ONLY. It never writes to the database, sends email, or touches Stripe.
 *
 * What it returns — one row per booking (or per week of a recurring admin
 * booking) that has not been paid yet:
 *   bucket "Upcoming"           confirmed, and its date is still ahead
 *   bucket "Delivered - unpaid" the date has passed (last 365 days) but the
 *                               studio has not paid yet — a receivable
 *
 * Money comes from bookingMoney() — the same function invoices are charged
 * with — never from the raw rate/total columns on bookings directly. Those
 * columns hold a per-hour rate on some rows and a total on others (see
 * docs/booking-rates.md); the admin "Future revenue" stat reads them raw.
 *
 * Direct-pay bookings (paymentMethod = "direct") are returned with their
 * booking value, but artswrkRevenue / artswrkGrossProfit are 0: the studio
 * pays the artist outside Artswrk, so no money reaches Artswrk.
 *
 * Reimbursements are not projected (they are unknown until the artist submits).
 */
import crypto from "crypto";
import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "./db";
import { bookings, users } from "../drizzle/schema";
import { bookingMoney, bookingRatesFrom } from "@shared/bookingRates";

/** How far back an unpaid, already-delivered booking still counts as a receivable. */
export const RECEIVABLE_LOOKBACK_DAYS = 365;

export type FeedBucket = "Upcoming" | "Delivered - unpaid";
export type FeedRowType = "One-time" | "Class date" | "Recurring week";

/** The rate fields bookingRatesFrom() reads — never touched directly here. */
type RateFields = NonNullable<Parameters<typeof bookingRatesFrom>[0]>;

export type FeedSourceBooking = RateFields & {
  id: number;
  bookingStatus: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  startDate: Date | string | null;
  isAdminBooking: number | boolean | null;
  isRecurring: number | boolean | null;
  recurringSeriesId: number | null;
  clientName: string | null;
  artistName: string | null;
};

export interface FeedSourcePeriod {
  bookingId: number;
  periodNumber: number;
  periodStart: Date | string;
  actualHours: number | string | null;
}

export interface FeedRow {
  bookingId: number;
  periodNumber: number | null;
  rowType: FeedRowType;
  bucket: FeedBucket;
  /** YYYY-MM-DD, Eastern */
  date: string;
  /** YYYY-MM, Eastern — the month the revenue is earned */
  month: string;
  bookingStatus: string;
  paymentMethod: "artswrk" | "direct";
  clientName: string;
  artistName: string;
  rateType: string;
  hours: number;
  /** What the studio pays for the booking (before reimbursements) */
  clientTotal: number;
  /** What the artist receives (before reimbursements) */
  artistTotal: number;
  /** Money that reaches Artswrk: clientTotal, or 0 on direct-pay */
  artswrkRevenue: number;
  /** Artswrk's margin: clientTotal - artistTotal, or 0 on direct-pay */
  artswrkGrossProfit: number;
  /** True when an admin set the totals by hand */
  manualTotals: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const truthy = (v: unknown) => v === true || v === 1 || v === "1";

/** Eastern calendar date for a timestamp, as YYYY-MM-DD. */
export function easternDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function bucketFor(start: Date, now: Date): FeedBucket | null {
  if (start.getTime() >= now.getTime()) return "Upcoming";
  const cutoff = now.getTime() - RECEIVABLE_LOOKBACK_DAYS * 86_400_000;
  return start.getTime() >= cutoff ? "Delivered - unpaid" : null;
}

function moneyRow(
  b: FeedSourceBooking,
  start: Date,
  bucket: FeedBucket,
  rowType: FeedRowType,
  periodNumber: number | null,
  hoursOverride: number | null,
): FeedRow {
  const rates = bookingRatesFrom(b);
  const m = bookingMoney(rates, { hoursOverride });
  const direct = b.paymentMethod === "direct";
  const clientTotal = round2(m.clientTotal);
  const artistTotal = round2(m.artistTotal);
  const date = easternDate(start);
  return {
    bookingId: b.id,
    periodNumber,
    rowType,
    bucket,
    date,
    month: date.slice(0, 7),
    bookingStatus: b.bookingStatus ?? "",
    paymentMethod: direct ? "direct" : "artswrk",
    clientName: (b.clientName ?? "").trim(),
    artistName: (b.artistName ?? "").trim(),
    rateType: m.rateType,
    hours: round2(m.hours),
    clientTotal,
    artistTotal,
    artswrkRevenue: direct ? 0 : clientTotal,
    artswrkGrossProfit: direct ? 0 : round2(clientTotal - artistTotal),
    manualTotals: rates.manualArtistTotal != null || rates.manualClientTotal != null,
  };
}

/**
 * Pure: turn bookings (+ the weeks of recurring admin bookings) into feed rows.
 * Callers pass only unpaid, non-deleted, non-cancelled bookings; this decides
 * which dates count and prices them.
 */
export function buildFeedRows(
  bookings: FeedSourceBooking[],
  periods: FeedSourcePeriod[],
  now: Date = new Date(),
): FeedRow[] {
  const periodsByBooking = new Map<number, FeedSourcePeriod[]>();
  for (const p of periods) {
    const list = periodsByBooking.get(p.bookingId) ?? [];
    list.push(p);
    periodsByBooking.set(p.bookingId, list);
  }

  const rows: FeedRow[] = [];
  for (const b of bookings) {
    const status = b.bookingStatus ?? "";
    if (status === "Cancelled") continue;

    // A weekly admin class is ONE booking with one row per week in
    // booking_periods; each week is invoiced on its own.
    if (truthy(b.isAdminBooking) && truthy(b.isRecurring)) {
      for (const p of periodsByBooking.get(b.id) ?? []) {
        const start = new Date(p.periodStart);
        if (Number.isNaN(start.getTime())) continue;
        const bucket = bucketFor(start, now);
        if (!bucket) continue;
        const hours = p.actualHours != null && p.actualHours !== "" ? Number(p.actualHours) : null;
        rows.push(moneyRow(b, start, bucket, "Recurring week", p.periodNumber, hours));
      }
      continue;
    }

    // Weeks above are settled one by one; a one-time booking is settled once.
    if (b.paymentStatus === "Paid" || b.paymentStatus === "Refunded") continue;
    if (!b.startDate) continue;
    const start = new Date(b.startDate);
    if (Number.isNaN(start.getTime())) continue;
    const bucket = bucketFor(start, now);
    if (!bucket) continue;
    // Upcoming only counts once confirmed; a past booking still owed money
    // can be Confirmed, Pay Now or Completed.
    if (bucket === "Upcoming" && status !== "Confirmed") continue;
    rows.push(moneyRow(b, start, bucket, b.recurringSeriesId != null ? "Class date" : "One-time", null, null));
  }

  rows.sort((a, z) => a.date.localeCompare(z.date) || a.bookingId - z.bookingId);
  return rows;
}

/** Read the unpaid bookings and weeks the feed is built from. */
export async function loadFeedRows(now: Date = new Date()): Promise<FeedRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const client = alias(users, "client");
  const artist = alias(users, "artist");
  const bookingRows: FeedSourceBooking[] = (await db
    .select({
      booking: bookings,
      clientCompany: client.clientCompanyName,
      clientFirst: client.firstName,
      clientLast: client.lastName,
      clientFull: client.name,
      artistFirst: artist.firstName,
      artistLast: artist.lastName,
      artistFull: artist.name,
    })
    .from(bookings)
    .leftJoin(client, eq(bookings.clientUserId, client.id))
    .leftJoin(artist, eq(bookings.artistUserId, artist.id))
    .where(sql`(${bookings.deleted} IS NULL OR ${bookings.deleted} = 0)
      AND COALESCE(${bookings.bookingStatus}, '') <> 'Cancelled'
      AND (
        COALESCE(${bookings.paymentStatus}, '') NOT IN ('Paid', 'Refunded')
        -- weekly admin classes are paid per week (booking_periods), not here
        OR (COALESCE(${bookings.isAdminBooking}, 0) = 1 AND COALESCE(${bookings.isRecurring}, 0) = 1)
      )`))
    .map((r) => ({
      ...r.booking,
      clientName: r.clientCompany || [r.clientFirst, r.clientLast].filter(Boolean).join(" ") || r.clientFull,
      artistName: [r.artistFirst, r.artistLast].filter(Boolean).join(" ") || r.artistFull,
    }));

  const [periodRows] = (await db.execute(`
    SELECT bp.bookingId, bp.periodNumber, bp.periodStart, bp.actualHours
    FROM booking_periods bp
    JOIN bookings b ON bp.bookingId = b.id
    WHERE (b.deleted IS NULL OR b.deleted = 0)
      AND COALESCE(b.bookingStatus, '') <> 'Cancelled'
      AND bp.invoicePaidAt IS NULL
      AND COALESCE(bp.status, '') NOT IN ('client_paid', 'skipped')
  `)) as unknown as [FeedSourcePeriod[]];

  return buildFeedRows(bookingRows, periodRows, now);
}

/** Constant-time check of the shared key. An unset key disables the feed. */
export function isAuthorizedFeedRequest(header: string | undefined, key: string | undefined): boolean {
  if (!key) return false;
  const supplied = (header ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** GET /api/finance/projected-bookings — Authorization: Bearer <FINANCE_FEED_KEY> */
export async function handleProjectedBookingsFeed(req: Request, res: Response) {
  const key = process.env.FINANCE_FEED_KEY;
  if (!key) return res.status(503).json({ error: "Finance feed is not configured" });
  if (!isAuthorizedFeedRequest(req.headers.authorization, key)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const now = new Date();
    const rows = await loadFeedRows(now);
    res.set("Cache-Control", "no-store");
    res.json({ generatedAt: now.toISOString(), count: rows.length, rows });
  } catch (err: any) {
    console.error("[FinanceFeed] Failed:", err?.message);
    res.status(500).json({ error: "Feed failed" });
  }
}
