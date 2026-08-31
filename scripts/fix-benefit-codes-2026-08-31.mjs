/**
 * Moves redemption codes out of benefits.discountOffering and into
 * benefits.howToRedeem, and rewrites The Bridge Dance Project's copy.
 *
 *   node scripts/fix-benefit-codes-2026-08-31.mjs [--dry-run]
 *
 * WHY: discountOffering is shown to NON-members as the teaser — that's the
 * point of it. howToRedeem is stripped server-side for anyone without an
 * eligible plan. Four partners had written their code into the offer text, so
 * it was being handed to every free account that opened the page.
 *
 * server/routers.ts also redacts code-shaped text from the teaser at request
 * time. That's the durable guard; this is the data catching up to it, so
 * paying members see clean copy plus a proper redemption line.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DRY = process.argv.includes("--dry-run");

const FIXES = [
  { match: "RecitalReady",
    offering: "10% off an annual subscription to RecitalReady",
    redeem: "Use code RRART at checkout." },
  { match: "Tap Roots",
    offering: "Artswrk members receive 15% off Tap Roots Teacher Certification and the Tap Roots Curriculum App (monthly or annual subscription). This includes access to our full digital curriculum, teaching resources, and online professional development led by Julie Kay Stallcup.",
    redeem: "Use code Artswrk15 at checkout." },
  { match: "United Dance Merchants",
    offering: "50% off attendee tickets.",
    redeem: "Use promo code UDMA50 at checkout." },
  { match: "DanceCuts",
    offering: "20% off your first 12 months of a Premium Subscription.",
    redeem: 'Enter "artswrk20" at checkout.' },
  // Not a leak — a copy fix. "We provide resources that don't require
  // discounts" reads like there's no benefit at all.
  { match: "The Bridge Dance Project",
    offering: "Complimentary access to The Bridge Dance Project's resources for Artswrk members — no discount code needed.",
    redeem: null },
];

const c = await mysql.createConnection(process.env.DATABASE_URL);
console.log(`${DRY ? "[dry run] " : ""}fixing ${FIXES.length} benefits\n`);

for (const f of FIXES) {
  const [rows] = await c.query(
    `SELECT id, companyName, discountOffering, howToRedeem FROM benefits WHERE companyName LIKE ?`,
    [`%${f.match}%`]
  );
  if (rows.length !== 1) {
    console.log(`  ✗ ${f.match}: matched ${rows.length} rows — skipping rather than guessing`);
    continue;
  }
  const b = rows[0];
  console.log(`  ${b.companyName}`);
  console.log(`     offering: ${JSON.stringify(String(b.discountOffering).slice(0, 70))}…`);
  console.log(`           →   ${JSON.stringify(f.offering.slice(0, 70))}…`);
  if (f.redeem) console.log(`     redeem:   ${JSON.stringify(f.redeem)}`);
  if (!DRY) {
    await c.query(`UPDATE benefits SET discountOffering = ?, howToRedeem = ? WHERE id = ?`,
                  [f.offering, f.redeem ?? b.howToRedeem ?? null, b.id]);
  }
  console.log();
}

if (!DRY) {
  const [left] = await c.query(
    `SELECT companyName, discountOffering FROM benefits
     WHERE discountOffering REGEXP 'code|coupon|promo'`);
  console.log(`benefits whose offer text still mentions a code: ${left.length}`);
  for (const b of left) console.log(`  ${b.companyName}: ${JSON.stringify(String(b.discountOffering).slice(0,90))}`);
}
await c.end();
