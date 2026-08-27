import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubblePayment = Record<string, unknown> & { _id: string };

export function paymentInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function paymentText(value: unknown, maxLength: number): string | null {
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

async function fetchPayments(token: string): Promise<BubblePayment[]> {
  const rows: BubblePayment[] = [];
  let cursor = 0;
  const base = "https://artswrk.com/version-live/api/1.1/obj/payment";
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble payment API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubblePayment[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rFetched ${rows.length} Bubble payments`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

const COLUMNS = [
  "bubbleId", "bubbleSourcePresent", "bubbleCreatedById", "bookingId", "bubbleBookingId",
  "bubbleRequestId", "clientUserId", "stripeId", "stripeCustomer", "stripeStatus", "status",
  "stripeAmount", "stripeApplicationFee", "stripeApplicationFeeAmount", "stripeCardBrand",
  "stripeCardLast4", "stripeCardName", "stripeDescription", "stripeReceiptUrl", "stripeRefundUrl",
  "paymentDate", "bubbleCreatedAt", "bubbleModifiedAt",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const source = await fetchPayments(readBubbleToken());
  const sourceIds = new Set(source.map((payment) => payment._id));
  if (source.length === 0 || source.length !== sourceIds.size) {
    throw new Error("Bubble payment source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId, stripeCustomerId, enterpriseStripeCustomerId
    FROM users
    WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const userMap = new Map(userRows.map((row) => [String(row.bubbleId), Number(row.id)]));
  const usersByStripeCustomer = new Map<string, Set<number>>();
  for (const row of userRows) {
    for (const value of [row.stripeCustomerId, row.enterpriseStripeCustomerId]) {
      if (!value) continue;
      const customerId = String(value);
      const userIds = usersByStripeCustomer.get(customerId) ?? new Set<number>();
      userIds.add(Number(row.id));
      usersByStripeCustomer.set(customerId, userIds);
    }
  }
  const uniqueUserByStripeCustomer = new Map(
    [...usersByStripeCustomer.entries()]
      .filter(([, userIds]) => userIds.size === 1)
      .map(([customerId, userIds]) => [customerId, [...userIds][0]]),
  );
  const [bookingRows] = await conn.execute<RowDataPacket[]>(`
    SELECT id, bubbleId, clientUserId FROM bookings WHERE bubbleSourcePresent = 1 AND bubbleId IS NOT NULL
  `);
  const bookingMap = new Map(
    bookingRows.map((row) => [String(row.bubbleId), { id: Number(row.id), clientUserId: row.clientUserId == null ? null : Number(row.clientUserId) }]),
  );
  const [existingRows] = await conn.execute<RowDataPacket[]>("SELECT bubbleId FROM payments WHERE bubbleId IS NOT NULL");
  const existingIds = new Set(existingRows.map((row) => String(row.bubbleId)));

  const sourceStripeAmountTotal = source.reduce((sum, row) => sum + (paymentInteger(row["Stripe Amount"]) ?? 0), 0);
  const sourceApplicationFeeTotal = source.reduce((sum, row) => sum + (paymentInteger(row["Stripe Application Fee Amount"]) ?? 0), 0);
  const planned = {
    sourcePayments: source.length,
    update: source.filter((payment) => existingIds.has(payment._id)).length,
    insert: source.filter((payment) => !existingIds.has(payment._id)).length,
    unresolvedBookings: source.filter((payment) => payment.Booking && !bookingMap.has(String(payment.Booking))).length,
    directCreatorMisses: source.filter((payment) => payment["Created By"] && !userMap.has(String(payment["Created By"]))).length,
    unresolvedClientsAfterBookingFallback: source.filter((payment) => {
      const creator = paymentText(payment["Created By"], 64);
      const stripeCustomer = paymentText(payment["Stripe Customer"], 128);
      const booking = payment.Booking ? bookingMap.get(String(payment.Booking)) : undefined;
      return !(creator && userMap.has(creator)) &&
        !(stripeCustomer && uniqueUserByStripeCustomer.has(stripeCustomer)) &&
        !booking?.clientUserId;
    }).length,
    sourceStripeAmountTotal,
    sourceApplicationFeeTotal,
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
    await conn.execute("UPDATE payments SET bubbleSourcePresent = 0");
    let processed = 0;
    for (const payment of source) {
      const bookingBubbleId = paymentText(payment.Booking, 64);
      const booking = bookingBubbleId ? bookingMap.get(bookingBubbleId) : undefined;
      const creatorBubbleId = paymentText(payment["Created By"], 64);
      const stripeCustomer = paymentText(payment["Stripe Customer"], 128);
      const clientUserId =
        (creatorBubbleId ? userMap.get(creatorBubbleId) : undefined) ??
        (stripeCustomer ? uniqueUserByStripeCustomer.get(stripeCustomer) : undefined) ??
        booking?.clientUserId ??
        null;
      const values = [
        payment._id,
        1,
        creatorBubbleId,
        booking?.id ?? null,
        bookingBubbleId,
        paymentText(payment.Request, 64),
        clientUserId,
        paymentText(payment["Stripe ID"], 128),
        stripeCustomer,
        paymentText(payment["Stripe Status"], 32),
        paymentText(payment.Status, 32),
        paymentInteger(payment["Stripe Amount"]),
        paymentText(payment["Stripe Application Fee"], 128),
        paymentInteger(payment["Stripe Application Fee Amount"]),
        paymentText(payment["Stripe Card Brand"], 32),
        paymentText(payment["Stripe Card Last 4"], 4),
        paymentText(payment["Stripe Card Name"], 256),
        payment["Stripe Description"] ?? null,
        payment["Stripe Receipt URL"] ?? null,
        payment["Stripe Refund URL"] ?? null,
        safeDate(payment.Date),
        safeDate(payment["Created Date"]),
        safeDate(payment["Modified Date"]),
      ];
      await conn.execute(
        `INSERT INTO payments (${columnSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
        values,
      );
      processed += 1;
      if (processed % 1000 === 0) process.stdout.write(`\rApplied ${processed}/${source.length} payments`);
    }
    process.stdout.write("\n");

    const [validationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT COUNT(*) AS liveRows, COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
             SUM(bookingId IS NOT NULL) AS resolvedBookings, SUM(clientUserId IS NOT NULL) AS resolvedClients,
             COALESCE(SUM(stripeAmount), 0) AS stripeAmountTotal,
             COALESCE(SUM(stripeApplicationFeeAmount), 0) AS applicationFeeTotal
      FROM payments WHERE bubbleSourcePresent = 1
    `);
    const validation = validationRows[0];
    if (
      Number(validation.liveRows) !== source.length ||
      Number(validation.distinctBubbleIds) !== sourceIds.size ||
      Number(validation.stripeAmountTotal) !== sourceStripeAmountTotal ||
      Number(validation.applicationFeeTotal) !== sourceApplicationFeeTotal
    ) {
      throw new Error(`Payment validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/payments-sync-${timestamp}.json`;
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
