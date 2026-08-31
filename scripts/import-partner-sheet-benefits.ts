/**
 * Import: Partner Portal (Benefits) sheet -> benefits table
 *
 * Source: "Artswrk | Partner Portal (Responses)" Google Sheet
 *   https://docs.google.com/spreadsheets/d/17VrYLsCRvupgAVYg_FkyeJ4lC-Ynp6XFEHPDjPZXCaU/edit
 *
 * 28 partners already exist in the benefits table via the Bubble migration
 * (scripts/migration/migrate-benefits.ts / scripts/sync-benefits-once.ts).
 * This script upserts 9 rows (v2, re-verified against the live sheet
 * 2026-08-31 7:25 AM ET):
 *
 *   NEW (not in Bubble):
 *   - Broadway Dance Center (BDC Online, code ARTSWRK2026)
 *   - Broadway Dance Center (In-Studio Classes) ($22 rate, email-to-enroll;
 *     added per user confirmation 2026-08-30 - Diane King email mechanism)
 *   - The WRK Experience (code PARTNERPORTAL100, email-to-redeem)
 *   - The Judge Experience: Dance Adjudicator Certification (code PROSEPT17)
 *
 *   UPDATES to existing Bubble-migrated rows (partial - only listed fields
 *   are touched; logos, types, categories, and bubbleIds are preserved):
 *   - Enrollio: offer changed 2026-08-30 (new form submission, row 33):
 *     $500 off Complete Growth Setup replaces $250 off 4-Hour Setup Sprint.
 *     Source: Brad Bingham, brad@enrollio.ai.
 *   - i am DANCE Productions: discount code #IAMARTSWRK250 confirmed
 *     2026-08-30 by Brandon Porter (brandon@iamdancecomp.com); code also
 *     entered into sheet row 9 on 2026-08-31.
 *
 *   v2 ADDITIONS (sheet edits detected 2026-08-31, Drive revision 04:26 UTC;
 *   all updateOnly, howToRedeem only - existing Bubble-migrated rows):
 *   - Prodigy: The Dance Team Convention: sheet Discount Code went from
 *     "Asked for code" to "WRK26".
 *   - Studio Shuffle: sheet Discount Code went from "Asked for code" to
 *     "ARTSWRK10".
 *   - SMR Music Edits: sheet "Redeem Offer" filled with text-to-redeem
 *     instructions (no discount code).
 *   NOTE: the sheet also gained a new column I ("Redeem Offer") on
 *   2026-08-31 - structural sheet change only, no import impact.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/import-partner-sheet-benefits.ts            # dry run (default)
 *   DATABASE_URL=<url> npx tsx scripts/import-partner-sheet-benefits.ts --apply    # write
 *   DATABASE_URL=<url> npx tsx scripts/import-partner-sheet-benefits.ts --apply --fix-audience
 *
 * Idempotent: matches on lower(trim(companyName)). New rows are inserted;
 * existing rows are updated in place. Rows marked updateOnly are skipped
 * with a warning if no existing row matches (they should always match -
 * both are confirmed present via the Bubble migration).
 *
 * NOTE: all 5 updated rows (Enrollio, i am DANCE, Prodigy, Studio Shuffle,
 * SMR Music Edits) carry bubbleIds, so a future run of the Bubble benefits
 * sync could overwrite these updated fields with the stale Bubble records.
 * Update the Bubble-side records too (or exclude them from the sync) to
 * make these changes stick.
 *
 * --fix-audience also normalizes legacy audienceTypes values so the new-site
 * filter (exact "Artist" / "Client" match in server/db.ts getBenefits) sees them:
 *   ["Artist and Client"] -> ["Artist","Client"]
 */

import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");
const FIX_AUDIENCE = process.argv.includes("--fix-audience");

// Column order used for inserts and dynamic update SET clauses.
const COLUMNS = [
  "companyName", "slug", "url", "businessDescription", "discountOffering",
  "howToRedeem", "contactName", "contactEmail",
  "audienceTypes", "businessTypes", "artistTypes", "categories",
] as const;
type Column = (typeof COLUMNS)[number];

interface SheetBenefit extends Partial<Record<Column, string | null>> {
  companyName: string; // required - the match key
  updateOnly?: boolean;  // skip insert if no existing row matches
}

const json = (arr: string[] | null): string | null =>
  arr && arr.length ? JSON.stringify(arr) : null;

const ROWS: SheetBenefit[] = [
  {
    companyName: "Broadway Dance Center",
    slug: "broadway-dance-center",
    url: "https://bdconline.tv/",
    businessDescription: "NYC dance studio. BDC Online offers streaming dance classes on monthly or yearly subscriptions.",
    discountOffering: "10% off monthly or yearly BDC Online subscriptions for Artswrk Pro members (no expiry)",
    howToRedeem: "Use code ARTSWRK2026 at bdconline.tv checkout.",
    contactName: "Samantha Martorano",
    contactEmail: "support@bdconline.tv",
    audienceTypes: json(["Artist"]),
    businessTypes: null,
    artistTypes: json(["Dance Teachers / Judges / Choreographer", "Dance Competition Staff (Tabulators, MCs, Merch etc)"]),
    categories: json(["Classes"]),
  },
  {
    // Added per user confirmation 2026-08-30 (iMessage): BDC's in-person
    // $22/class rate for Artswrk PRO members. No shareable code - enrollment
    // is by email (mechanism proposed by Diane King at BDC).
    companyName: "Broadway Dance Center (In-Studio Classes)",
    slug: "broadway-dance-center-in-studio",
    url: "https://www.broadwaydancecenter.com",
    businessDescription: "NYC dance studio offering in-studio drop-in dance classes across all levels and styles.",
    discountOffering: "$22 in-studio class rate for Artswrk Pro members",
    howToRedeem: "Email Studiomanager@bwydance.com to enable your Artswrk PRO membership and unlock the $22 class rate.",
    contactName: "Diane King",
    contactEmail: "Studiomanager@bwydance.com",
    audienceTypes: json(["Artist"]),
    businessTypes: null,
    artistTypes: null,
    categories: json(["Classes"]),
  },
  {
    companyName: "The WRK Experience",
    slug: "the-wrk-experience",
    url: "https://thewrkexperience.com",
    businessDescription: "The WRK Experience offers studios fully customized in-studio workshops and conventions with the best of Broadway, Radio City, Cirque, TV, film, tour, and more.",
    discountOffering: "$100 off the $300 deposit to secure your 2026/2027 event",
    howToRedeem: "Email contact@artswrk.com to redeem with code PARTNERPORTAL100.",
    contactName: "Nick Silverio",
    contactEmail: "contact@artswrk.com",
    audienceTypes: json(["Client"]),
    businessTypes: json(["Dance Studios"]),
    artistTypes: null,
    categories: json(["Live Event"]),
  },
  {
    companyName: "The Judge Experience: Dance Adjudicator Certification",
    slug: "the-judge-experience",
    // User confirmed 2026-08-30: linking straight to the Stripe checkout is
    // intended - the PROSEPT17 discount code applies there.
    url: "https://book.stripe.com/4gM14m7Vo6U380beIZ0Fu2Q",
    businessDescription: "The Judge Experience: Dance Adjudicator certification is an exclusive training event to become the most hirable, prepared, and proficient judge possible.",
    discountOffering: "$120 off registration fee",
    howToRedeem: "Use code PROSEPT17 at checkout.",
    contactName: "Nick Silverio",
    contactEmail: "contact@artswrk.com",
    audienceTypes: json(["Artist"]),
    businessTypes: null,
    artistTypes: json(["Dance Teachers / Judges / Choreographer"]),
    categories: json(["Curriculum"]),
  },
  {
    // UPDATE of existing Bubble-migrated row - new form submission 2026-08-30
    // (sheet row 33) replaces the old $250 Setup Sprint offer.
    updateOnly: true,
    companyName: "Enrollio",
    url: "https://www.enrollio.ai/doneforyou?utm_source=artswrk&utm_medium=partner&utm_campaign=premium_offer",
    businessDescription: "Enrollio is the all-in-one operating system built for dance studios. We bring class registration, CRM, lead follow-up, texting, payments, websites, and parent communication into one connected platform, helping studio owners increase enrollment while reducing administrative work.",
    discountOffering: "$500 off Enrollio's Complete Growth Setup, a done-for-you 28-day implementation (CRM, registration portal, automations, website, data migration, staff training)",
    howToRedeem: "Book a Studio Systems Call at enrollio.ai/doneforyou and mention \"Artswrk Premium\" to redeem - no code needed. The $500 discount is applied to your final project proposal. New Complete Growth Setup clients only; cannot be combined with other offers.",
    contactName: "Brad Bingham",
    contactEmail: "brad@enrollio.ai",
  },
  {
    // UPDATE of existing Bubble-migrated row - code confirmed 2026-08-30 by
    // Brandon Porter (Gmail thread 19bd3eb966d44cb8); sheet row 9 updated
    // 2026-08-31 with the same code and terms.
    updateOnly: true,
    companyName: "i am DANCE Productions, LLC",
    howToRedeem: "Email brandon@iamdancecomp.com with code #IAMARTSWRK250, your studio name, and your contact info. Minimum 10 registered entries.",
    contactEmail: "brandon@iamdancecomp.com",
  },
  {
    // v2: sheet row 5 Discount Code "Asked for code" -> "WRK26" (sheet edit
    // detected 2026-08-31). Sheet gives no redemption mechanism, so copy is
    // minimal. Match key is the sheet name; if the Bubble-migrated row uses
    // a different companyName this will SKIP with a warning - check dry-run.
    updateOnly: true,
    companyName: "Prodigy: The Dance Team Convention",
    howToRedeem: "Use code WRK26 to redeem.",
  },
  {
    // v2: sheet row 18 Discount Code "Asked for code" -> "ARTSWRK10" (sheet
    // edit detected 2026-08-31). No mechanism stated in the sheet.
    updateOnly: true,
    companyName: "Studio Shuffle",
    howToRedeem: "Use code ARTSWRK10 to redeem.",
  },
  {
    // v2: sheet row 19 "Redeem Offer" filled 2026-08-31 (no discount code -
    // redemption is by text message). howToRedeem is verbatim from the sheet.
    updateOnly: true,
    companyName: "SMR Music Edits",
    howToRedeem: "Studios can text \"50%\" to (607) 348-4035 to redeem the offer. The SMR will follow up shortly to schedule a consultation.",
  },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (no writes; pass --apply to write)");

  for (const b of ROWS) {
    const [existing] = await conn.query(
      "SELECT id, companyName FROM benefits WHERE LOWER(TRIM(companyName)) = LOWER(TRIM(?)) LIMIT 1",
      [b.companyName]
    );
    const row = (existing as any[])[0];

    if (row) {
      // UPDATE only the columns this row defines (companyName excluded).
      const setCols = COLUMNS.filter((c) => c !== "companyName" && b[c] !== undefined);
      const setSql = setCols.map((c) => `${c}=?`).join(", ");
      const params = setCols.map((c) => b[c]);
      console.log(`UPDATE  id=${row.id}  ${b.companyName}  [${setCols.join(", ")}]`);
      if (APPLY && setCols.length) {
        await conn.execute(`UPDATE benefits SET ${setSql} WHERE id=?`, [...params, row.id]);
      }
    } else if (b.updateOnly) {
      console.log(`SKIP    ${b.companyName}  (updateOnly, no existing row found - investigate)`);
    } else {
      console.log(`INSERT  ${b.companyName}`);
      if (APPLY) {
        const colSql = COLUMNS.join(", ");
        const placeholders = COLUMNS.map(() => "?").join(", ");
        const params = COLUMNS.map((c) => (b[c] === undefined ? null : b[c]));
        await conn.execute(`INSERT INTO benefits (${colSql}) VALUES (${placeholders})`, params);
      }
    }
  }

  if (FIX_AUDIENCE) {
    console.log("Normalizing legacy audienceTypes values...");
    if (APPLY) {
      const [r1] = await conn.execute(
        `UPDATE benefits SET audienceTypes='["Artist","Client"]' WHERE audienceTypes='["Artist and Client"]'`
      );
      console.log(`  fixed "Artist and Client": ${(r1 as any).affectedRows} rows`);
    } else {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS n FROM benefits WHERE audienceTypes='["Artist and Client"]'`
      );
      console.log(`  would fix ${(rows as any[])[0].n} rows with audienceTypes='["Artist and Client"]'`);
    }
  }

  const [[{ total }]] = await conn.query("SELECT COUNT(*) AS total FROM benefits") as any;
  console.log(`Total benefits in table: ${total}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
