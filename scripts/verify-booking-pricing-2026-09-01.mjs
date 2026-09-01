import "dotenv/config";
const { getClientBookingDetail } = await import("../server/db.ts");
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const LEAKY = ["artistRate", "totalArtistRate", "grossProfit", "stripeFee", "postFeeRevenue", "_artistRate", "_bubbleId"];

async function show(label, sql) {
  const [rows] = await c.query(sql);
  console.log(`\n=== ${label} ===`);
  for (const r of rows) {
    const b = await getClientBookingDetail(r.id, r.clientUserId);
    if (!b) { console.log(`  booking ${r.id}: not found`); continue; }
    const p = b.pricing;
    const leaked = LEAKY.filter((k) => k in b);
    const sum = p.subtotal + p.processingFee + p.reimbursements;
    console.log(`  booking ${b.id}${r.bubbleId ? " (legacy)" : " (new)"}:`);
    if (p.unitRate != null && p.isHourly && p.hours) console.log(`     $${p.unitRate}/hr × ${p.hours} hrs`);
    console.log(`     subtotal      $${p.subtotal}`);
    console.log(`     processing    $${p.processingFee}${p.hasProcessingFee ? "" : "  (legacy — no fee line shown)"}`);
    console.log(`     reimbursement $${p.reimbursements}`);
    console.log(`     TOTAL         $${p.total}   ${sum === p.total ? "✓ lines sum" : "✗ MISMATCH"}`);
    console.log(`     leaked fields: ${leaked.length ? leaked.join(",") : "NONE ✓"}`);
  }
}

await show("Legacy Bubble, hourly + reimbursements",
  `SELECT id, clientUserId, bubbleId FROM bookings WHERE bubbleId IS NOT NULL AND clientUserId IS NOT NULL
     AND totalClientRate > clientRate AND hours > 0 LIMIT 2`);
await show("Legacy Bubble, flat",
  `SELECT b.id, b.clientUserId, b.bubbleId FROM bookings b JOIN interested_artists ia ON ia.id=b.interestedArtistId
   WHERE b.bubbleId IS NOT NULL AND ia.isHourlyRate=0 AND b.clientUserId IS NOT NULL LIMIT 1`);
await show("New native booking (should show 5% fee)",
  `SELECT id, clientUserId, bubbleId FROM bookings WHERE bubbleId IS NULL AND clientUserId IS NOT NULL AND hours > 0 LIMIT 2`);

await c.end();
process.exit(0);
