import "dotenv/config";
const { getClientBookingDetail } = await import("../server/db.ts");
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await c.query(
  "SELECT id, clientUserId FROM bookings WHERE grossProfit IS NOT NULL AND artistRate IS NOT NULL AND clientUserId IS NOT NULL LIMIT 1"
);
await c.end();
if (!rows.length) { console.log("no suitable booking found"); process.exit(0); }

const b = await getClientBookingDetail(rows[0].id, rows[0].clientUserId);
const LEAKY = ["grossProfit", "artistRate", "totalArtistRate", "stripeFee", "postFeeRevenue"];
const leaked = LEAKY.filter((k) => k in (b ?? {}));
console.log(`booking ${rows[0].id} — keys returned: ${Object.keys(b ?? {}).length}`);
console.log("leaked margin fields:", leaked.length ? leaked : "NONE ✓");
console.log("client-facing figures:", JSON.stringify({
  clientRate: b.clientRate, totalClientRate: b.totalClientRate,
  reimbursementsTotal: b.reimbursementsTotal, hours: b.hours,
}));
process.exit(0);
