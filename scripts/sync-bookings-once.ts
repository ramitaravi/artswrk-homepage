import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleBooking = Record<string, unknown> & { _id: string };

export function bookingNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function bookingHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function bookingList(value: unknown): string | null {
  return Array.isArray(value) && value.length ? JSON.stringify(value) : null;
}

export function bookingSourceText(value: unknown): string | null {
  if (value == null || value === "") return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function parseBookingLocation(value: unknown): {
  address: string | null;
  lat: string | null;
  lng: string | null;
} {
  if (typeof value === "string") return { address: value || null, lat: null, lng: null };
  if (!value || typeof value !== "object") return { address: null, lat: null, lng: null };
  const location = value as { address?: unknown; lat?: unknown; lng?: unknown };
  return {
    address: typeof location.address === "string" ? location.address : null,
    lat: location.lat == null ? null : String(location.lat),
    lng: location.lng == null ? null : String(location.lng),
  };
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function readBubbleToken(): string {
  if (process.env.BUBBLE_API_KEY) return process.env.BUBBLE_API_KEY;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(root, "scripts/sync-all.mjs"), "utf8");
  const fallback = source.match(/BUBBLE_API_KEY\s*=\s*process\.env\.BUBBLE_API_KEY\s*\|\|\s*"([^"]+)"/)?.[1];
  if (!fallback) throw new Error("Bubble API credential is unavailable");
  return fallback;
}

async function fetchBookings(token: string): Promise<BubbleBooking[]> {
  const rows: BubbleBooking[] = [];
  let cursor = 0;
  const base = "https://artswrk.com/version-live/api/1.1/obj/booking";
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble booking API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleBooking[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rFetched ${rows.length} Bubble bookings`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

const COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "bubbleCreatedById", "jobId", "bubbleRequestId", "bubbleJobId",
  "interestedArtistId", "bubbleInterestedArtistId", "clientUserId", "bubbleClientId", "artistUserId",
  "bubbleArtistId", "bubblePaymentIds", "bubbleReimbursementIds", "bookingStatus", "paymentStatus",
  "clientRate", "artistRate", "totalClientRate", "totalArtistRate", "grossProfit", "stripeFee",
  "postFeeRevenue", "hours", "externalPayment", "startDate", "endDate", "locationAddress",
  "locationLat", "locationLng", "description", "stripeCheckoutUrl", "bubbleInvoice",
  "addedToSpreadsheet", "deleted", "notificationArtistScheduledReminder", "showAlert", "bubbleWorkflowId2",
  "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const source = await fetchBookings(readBubbleToken());
  const sourceIds = new Set(source.map((booking) => booking._id));
  if (source.length === 0 || source.length !== sourceIds.size) {
    throw new Error("Bubble booking source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM users WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [jobRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM jobs WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const jobMap = new Map(jobRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [applicationRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId FROM interested_artists WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const applicationMap = new Map(applicationRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const [existingRows] = await conn.execute<RowDataPacket[]>("SELECT bubbleId FROM bookings WHERE bubbleId IS NOT NULL");
  const existingIds = new Set(existingRows.map((row) => String(row.bubbleId)));

  const planned = {
    sourceBookings: source.length,
    update: source.filter((booking) => existingIds.has(booking._id)).length,
    insert: source.filter((booking) => !existingIds.has(booking._id)).length,
    deleted: source.filter((booking) => booking["deleted?"] === true).length,
    nonDeleted: source.filter((booking) => booking["deleted?"] !== true).length,
    unresolvedRequests: source.filter((booking) => booking.Request && !jobMap.has(String(booking.Request))).length,
    unresolvedApplications: source.filter((booking) => booking["Interested Artist"] && !applicationMap.has(String(booking["Interested Artist"]))).length,
    unresolvedArtists: source.filter((booking) => booking.Artist && !userMap.has(String(booking.Artist))).length,
    unresolvedClients: source.filter((booking) => booking.Client && !userMap.has(String(booking.Client))).length,
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  const columnSql = COLUMNS.map((column) => `\`${column}\``).join(", ");
  const placeholders = COLUMNS.map(() => "?").join(", ");
  const updates = COLUMNS.slice(1).map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(", ");

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE bookings SET bubbleSourcePresent = 0");
    let processed = 0;
    for (const booking of source) {
      const requestId = boundedText(booking.Request, 64);
      const applicationId = boundedText(booking["Interested Artist"], 64);
      const artistId = boundedText(booking.Artist, 64);
      const clientId = boundedText(booking.Client, 64);
      const location = parseBookingLocation(booking.Location);
      const values = [
        booking._id,
        1,
        boundedText(booking["Created By"], 64),
        requestId ? jobMap.get(requestId) ?? null : null,
        requestId,
        boundedText(booking.Job, 64),
        applicationId ? applicationMap.get(applicationId) ?? null : null,
        applicationId,
        clientId ? userMap.get(clientId) ?? null : null,
        clientId,
        artistId ? userMap.get(artistId) ?? null : null,
        artistId,
        bookingList(booking["List of Payments"]),
        bookingList(booking["List of Reimbursement"]),
        boundedText(booking._Option_Booking_Status, 64),
        boundedText(booking._Option_Payment_Status, 64),
        bookingNumber(booking["Client Rate"]),
        bookingNumber(booking["Artist Rate"]),
        bookingNumber(booking["Total Client Rate (Client Rate + Reimbursements)"]),
        bookingNumber(booking["Total Artist Rate (Artist Rate + Reimbursements)"]),
        bookingNumber(booking["Gross Profit"]),
        bookingNumber(booking["stripe fee"]),
        bookingNumber(booking["Post Fee Revenue"]),
        bookingHours(booking.hours),
        booking["external payment?"] === true ? 1 : 0,
        safeDate(booking["Start date"]),
        safeDate(booking["End date"]),
        location.address,
        boundedText(location.lat, 32),
        boundedText(location.lng, 32),
        booking.Description ?? null,
        booking["Stripe checkout url"] ?? null,
        bookingSourceText(booking.invoice),
        booking["Added to Spreadsheet?"] === true ? 1 : 0,
        booking["deleted?"] === true ? 1 : 0,
        booking.Notification_Artist_Scheduled_Reminder === true ? 1 : 0,
        booking["show_alert?"] === true ? 1 : 0,
        boundedText(booking["Wf_ID 2"], 256),
        safeDate(booking["Created Date"]),
        safeDate(booking["Modified Date"]),
      ];
      await conn.execute(
        `INSERT INTO bookings (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
        values,
      );
      processed += 1;
      if (processed % 250 === 0) process.stdout.write(`\rApplied ${processed}/${source.length} bookings`);
    }
    process.stdout.write("\n");

    const [validationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(deleted = 1) AS deletedRows, SUM(deleted = 0) AS nonDeletedRows,
             SUM(jobId IS NOT NULL) AS resolvedJobs, SUM(interestedArtistId IS NOT NULL) AS resolvedApplications,
             SUM(artistUserId IS NOT NULL) AS resolvedArtists, SUM(clientUserId IS NOT NULL) AS resolvedClients
      FROM bookings WHERE bubbleSourcePresent = 1
    `);
    const validation = validationRows[0];
    if (Number(validation.liveRows) !== source.length || Number(validation.distinctBubbleIds) !== sourceIds.size) {
      throw new Error(`Booking validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/bookings-sync-${timestamp}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`REPORT=${outputPath}`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
