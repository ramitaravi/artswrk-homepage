/** Read-only: what Tiffany's wallet shows before vs after the dedupe. */
import "dotenv/config";
const { getPaymentsByClientId, getPaymentStatsByClientId, getWalletStatsByClientId } =
  await import("../server/db.ts");
import mysql from "mysql2/promise";

const U = 1024407;
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [[raw]] = await c.query(
  `SELECT COUNT(*) n, SUM(stripeAmount) cents FROM payments
   WHERE clientUserId=${U} AND stripeStatus IN ('paid','succeeded')`);
await c.end();

const rows = await getPaymentsByClientId(U);
const wallet = await getWalletStatsByClientId(U);

console.log("BEFORE (raw table):");
console.log(`  ${raw.n} transactions · $${(raw.cents / 100).toLocaleString()}`);
console.log("\nAFTER (deduped):");
console.log(`  ${rows.length} transaction(s) · $${(rows.reduce((s, r) => s + (r.stripeAmount ?? 0), 0) / 100).toLocaleString()}`);
rows.forEach(r => console.log(`    ${new Date(r.paymentDate).toISOString().slice(0,10)}  $${(r.stripeAmount/100).toFixed(2)}  ${r.artistName ?? "Artswrk"}`));
console.log("\nWallet card (unchanged, comes from bookings not payments):");
console.log(`  $${wallet.totalSpent} spent · $${wallet.futurePayments} future`);
process.exit(0);
