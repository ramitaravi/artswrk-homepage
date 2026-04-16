/**
 * Seed: Master Artist Types, Master Service Types, Master Style Types
 *
 * These are Bubble option set values — not accessible via the Data API.
 * We seed them from the constants in reference_data.ts.
 *
 * Run once (or re-run safely — uses INSERT IGNORE).
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/migration/seed-master-types.ts
 */
import mysql from "mysql2/promise";
import { MASTER_ARTIST_TYPES, MASTER_SERVICE_TYPES, DANCE_STYLES } from "./reference_data";

function fixIconUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // ── 1. Master Artist Types ─────────────────────────────────────────────────
  console.log("Seeding master_artist_types...");
  let matInserted = 0, matSkipped = 0;
  for (const t of MASTER_ARTIST_TYPES) {
    try {
      await conn.execute(
        `INSERT IGNORE INTO master_artist_types
           (bubbleId, name, slug, iconUrl, listingOrder, isPublic)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          t.bubbleId,
          t.name,
          (t as any).slug ?? null,
          fixIconUrl((t as any).iconUrl),
          t.listingOrder ?? null,
          t.isPublic ? 1 : 0,
        ]
      );
      matInserted++;
      console.log(`  ✓ ${t.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { matSkipped++; }
      else { console.error(`  ✗ ${t.name}:`, e.message); }
    }
  }
  console.log(`  → Inserted: ${matInserted}, Skipped: ${matSkipped}`);

  // Build bubbleId → DB id lookup for artist types (needed for service types FK)
  const [matRows] = await conn.execute(
    "SELECT id, bubbleId FROM master_artist_types"
  ) as any[];
  const bubbleToMatId: Record<string, number> = {};
  for (const r of matRows) bubbleToMatId[r.bubbleId] = r.id;

  // ── 2. Master Service Types ────────────────────────────────────────────────
  console.log("\nSeeding master_service_types...");
  let mstInserted = 0, mstSkipped = 0;
  for (const t of MASTER_SERVICE_TYPES) {
    const masterArtistTypeId = t.bubbleArtistTypeId
      ? (bubbleToMatId[t.bubbleArtistTypeId] ?? null)
      : null;
    try {
      await conn.execute(
        `INSERT IGNORE INTO master_service_types
           (bubbleId, name, slug, masterArtistTypeId, bubbleArtistTypeId, listingOrder, isPublic, isMcLandingPage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.bubbleId,
          t.name,
          (t as any).slug ?? null,
          masterArtistTypeId,
          t.bubbleArtistTypeId ?? null,
          t.listingOrder ?? null,
          t.isPublic ? 1 : 0,
          t.isMcLandingPage ? 1 : 0,
        ]
      );
      mstInserted++;
      console.log(`  ✓ ${t.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { mstSkipped++; }
      else { console.error(`  ✗ ${t.name}:`, e.message); }
    }
  }
  console.log(`  → Inserted: ${mstInserted}, Skipped: ${mstSkipped}`);

  // ── 3. Master Style Types (Dance Styles) ───────────────────────────────────
  console.log("\nSeeding master_style_types...");
  let stylInserted = 0, stylSkipped = 0;
  for (const [bubbleId, name] of Object.entries(DANCE_STYLES)) {
    try {
      await conn.execute(
        `INSERT IGNORE INTO master_style_types (bubbleId, name) VALUES (?, ?)`,
        [bubbleId, name]
      );
      stylInserted++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") { stylSkipped++; }
      else { console.error(`  ✗ ${name}:`, e.message); }
    }
  }
  console.log(`  → Inserted: ${stylInserted}, Skipped: ${stylSkipped}`);

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`master_artist_types  : ${matInserted} inserted, ${matSkipped} skipped`);
  console.log(`master_service_types : ${mstInserted} inserted, ${mstSkipped} skipped`);
  console.log(`master_style_types   : ${stylInserted} inserted, ${stylSkipped} skipped`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
