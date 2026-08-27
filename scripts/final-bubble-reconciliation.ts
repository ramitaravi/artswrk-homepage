import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type BubbleRow = Record<string, unknown> & { _id: string };

export function toEpochSecond(value: unknown): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  const milliseconds = date.getTime();
  return Number.isFinite(milliseconds) ? Math.round(milliseconds / 1000) : null;
}

function readBubbleToken(): string {
  if (process.env.BUBBLE_API_KEY) return process.env.BUBBLE_API_KEY;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(root, "scripts/sync-all.mjs"), "utf8");
  const fallback = source.match(/BUBBLE_API_KEY\s*=\s*process\.env\.BUBBLE_API_KEY\s*\|\|\s*"([^"]+)"/)?.[1];
  if (!fallback) throw new Error("Bubble API credential is unavailable");
  return fallback;
}

async function fetchType(token: string, type: string): Promise<BubbleRow[]> {
  const rows: BubbleRow[] = [];
  let cursor = 0;
  const base = `https://artswrk.com/version-live/api/1.1/obj/${encodeURIComponent(type)}`;
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Bubble ${type} API returned ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: { results?: BubbleRow[]; remaining?: number } };
    const batch = payload.response?.results ?? [];
    rows.push(...batch);
    process.stdout.write(`\rAuditing ${type}: ${rows.length} rows`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");
  const token = readBubbleToken();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const mappings = [
    { type: "user", table: "users", idColumn: "bubbleId" },
    { type: "Request", table: "jobs", idColumn: "bubbleId" },
    { type: "ClientCompany", table: "client_companies", idColumn: "bubbleClientCompanyId" },
    { type: "premium_jobs", table: "premium_jobs", idColumn: "bubbleId" },
    { type: "interestedartists", table: "bubble_interested_artists_source", idColumn: "bubbleId" },
    { type: "booking", table: "bookings", idColumn: "bubbleId" },
    { type: "payment", table: "payments", idColumn: "bubbleId" },
    { type: "conversation", table: "conversations", idColumn: "bubbleId" },
    { type: "message", table: "messages", idColumn: "bubbleId" },
    { type: "Benefits", table: "benefits", idColumn: "bubbleId" },
  ];

  const tables: Record<string, unknown> = {};
  for (const mapping of mappings) {
    const source = await fetchType(token, mapping.type);
    const [destination] = await conn.execute<RowDataPacket[]>(
      `SELECT \`${mapping.idColumn}\` AS bubbleId, bubbleModifiedAt FROM \`${mapping.table}\` WHERE bubbleSourcePresent = 1`,
    );
    const sourceById = new Map(source.map((row) => [row._id, row]));
    const destinationById = new Map(destination.map((row) => [String(row.bubbleId), row]));
    const missingIds = [...sourceById.keys()].filter((id) => !destinationById.has(id));
    const extraIds = [...destinationById.keys()].filter((id) => !sourceById.has(id));
    const modifiedMismatches = [...sourceById.entries()].filter(([id, row]) => {
      const destinationRow = destinationById.get(id);
      if (!destinationRow) return false;
      return toEpochSecond(row["Modified Date"]) !== toEpochSecond(destinationRow.bubbleModifiedAt);
    });
    tables[mapping.table] = {
      bubbleType: mapping.type,
      sourceRows: source.length,
      sourceDistinctIds: sourceById.size,
      destinationRows: destination.length,
      destinationDistinctIds: destinationById.size,
      missingIds: missingIds.length,
      extraCanonicalIds: extraIds.length,
      modifiedMismatches: modifiedMismatches.length,
      missingIdSamples: missingIds.slice(0, 10),
      extraIdSamples: extraIds.slice(0, 10),
      modifiedMismatchSamples: modifiedMismatches.slice(0, 10).map(([id]) => id),
    };
  }

  const scalar = async (query: string): Promise<number> => {
    const [rows] = await conn.execute<RowDataPacket[]>(query);
    return Number(Object.values(rows[0] ?? {})[0] ?? 0);
  };
  const integrity = {
    duplicateCanonicalUsers: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM users WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalJobs: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM jobs WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalCompanies: await scalar("SELECT COUNT(*) FROM (SELECT bubbleClientCompanyId FROM client_companies WHERE bubbleSourcePresent=1 GROUP BY bubbleClientCompanyId HAVING COUNT(*)>1) d"),
    duplicateCanonicalPremiumJobs: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM premium_jobs WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalApplications: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM bubble_interested_artists_source WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalBookings: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM bookings WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalPayments: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM payments WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalConversations: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM conversations WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    duplicateCanonicalMessages: await scalar("SELECT COUNT(*) FROM (SELECT bubbleId FROM messages WHERE bubbleSourcePresent=1 GROUP BY bubbleId HAVING COUNT(*)>1) d"),
    orphanJobCompanies: await scalar("SELECT COUNT(*) FROM jobs j LEFT JOIN client_companies c ON c.bubbleClientCompanyId=j.bubbleClientCompanyId AND c.bubbleSourcePresent=1 WHERE j.bubbleSourcePresent=1 AND j.bubbleClientCompanyId IS NOT NULL AND c.id IS NULL"),
    orphanCompanyMembershipUsers: await scalar("SELECT COUNT(*) FROM client_company_memberships m LEFT JOIN users u ON u.id=m.userId WHERE m.userId IS NOT NULL AND u.id IS NULL"),
    orphanStandardApplicationJobs: await scalar("SELECT COUNT(*) FROM interested_artists a LEFT JOIN jobs j ON j.id=a.jobId WHERE a.bubbleSourcePresent=1 AND a.jobId IS NOT NULL AND j.id IS NULL"),
    orphanStandardApplicationArtists: await scalar("SELECT COUNT(*) FROM interested_artists a LEFT JOIN users u ON u.id=a.artistUserId WHERE a.bubbleSourcePresent=1 AND a.artistUserId IS NOT NULL AND u.id IS NULL"),
    orphanPremiumApplicationJobs: await scalar("SELECT COUNT(*) FROM premium_job_interested_artists a LEFT JOIN premium_jobs j ON j.id=a.premiumJobId WHERE a.bubbleSourcePresent=1 AND a.premiumJobId IS NOT NULL AND j.id IS NULL"),
    orphanPremiumApplicationArtists: await scalar("SELECT COUNT(*) FROM premium_job_interested_artists a LEFT JOIN users u ON u.id=a.artistUserId WHERE a.bubbleSourcePresent=1 AND a.artistUserId IS NOT NULL AND u.id IS NULL"),
    orphanBookingJobs: await scalar("SELECT COUNT(*) FROM bookings b LEFT JOIN jobs j ON j.id=b.jobId WHERE b.bubbleSourcePresent=1 AND b.jobId IS NOT NULL AND j.id IS NULL"),
    orphanBookingArtists: await scalar("SELECT COUNT(*) FROM bookings b LEFT JOIN users u ON u.id=b.artistUserId WHERE b.bubbleSourcePresent=1 AND b.artistUserId IS NOT NULL AND u.id IS NULL"),
    orphanBookingClients: await scalar("SELECT COUNT(*) FROM bookings b LEFT JOIN users u ON u.id=b.clientUserId WHERE b.bubbleSourcePresent=1 AND b.clientUserId IS NOT NULL AND u.id IS NULL"),
    orphanPaymentBookings: await scalar("SELECT COUNT(*) FROM payments p LEFT JOIN bookings b ON b.id=p.bookingId WHERE p.bubbleSourcePresent=1 AND p.bookingId IS NOT NULL AND b.id IS NULL"),
    orphanMessageConversations: await scalar("SELECT COUNT(*) FROM messages m LEFT JOIN conversations c ON c.id=m.conversationId WHERE m.bubbleSourcePresent=1 AND m.conversationId IS NOT NULL AND c.id IS NULL"),
    orphanMessageSenders: await scalar("SELECT COUNT(*) FROM messages m LEFT JOIN users u ON u.id=m.senderUserId WHERE m.bubbleSourcePresent=1 AND m.senderUserId IS NOT NULL AND u.id IS NULL"),
  };

  const [userRows] = await conn.execute<RowDataPacket[]>(`
    SELECT COUNT(DISTINCT bubbleId) AS totalUsers,
      COUNT(DISTINCT CASE WHEN userRole='Artist' THEN bubbleId END) AS artists,
      COUNT(DISTINCT CASE WHEN userRole='Client' THEN bubbleId END) AS clients,
      COUNT(DISTINCT CASE WHEN artswrkBasic=1 THEN bubbleId END) AS basic,
      COUNT(DISTINCT CASE WHEN artswrkPro=1 THEN bubbleId END) AS pro,
      COUNT(DISTINCT CASE WHEN priorityList=1 THEN bubbleId END) AS priority,
      COUNT(DISTINCT CASE WHEN clientPremium=1 THEN bubbleId END) AS premiumClients
    FROM users WHERE bubbleSourcePresent=1
  `);
  const [financialRows] = await conn.execute<RowDataPacket[]>(`
    SELECT COUNT(*) AS completedBookings,
      SUM(CASE WHEN deleted=0 THEN 1 ELSE 0 END) AS nonDeletedCompletedBookings,
      SUM(CASE WHEN deleted=0 THEN COALESCE(totalClientRate, clientRate, 0) ELSE 0 END) AS revenueDollars,
      SUM(CASE WHEN deleted=0 THEN COALESCE(grossProfit, 0) ELSE 0 END) AS commissionDollars
    FROM bookings
    WHERE bubbleSourcePresent=1 AND bookingStatus='Completed' AND paymentStatus='Paid'
  `);
  const [paymentRows] = await conn.execute<RowDataPacket[]>(`
    SELECT COUNT(*) AS payments, COALESCE(SUM(stripeAmount),0) AS stripeAmountCents,
      COALESCE(SUM(stripeApplicationFeeAmount),0) AS applicationFeeCents
    FROM payments WHERE bubbleSourcePresent=1
  `);

  const report = {
    auditedAt: new Date().toISOString(),
    tables,
    integrity,
    headlineMetrics: { users: userRows[0], financials: financialRows[0], payments: paymentRows[0] },
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = `/home/ubuntu/artswrk-backups/final-reconciliation-${timestamp}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`REPORT=${outputPath}`);
  await conn.end();
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
