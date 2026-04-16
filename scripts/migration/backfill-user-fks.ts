/**
 * Backfill: Resolve user foreign keys
 * Run this AFTER migrate-users.ts completes.
 *
 * Updates artistUserId on:
 *  - artist_experiences  (matched via bubbleArtistId → users.bubbleId)
 *  - artist_service_categories (matched via subServiceSettings JSON → users.bubbleId)
 *  - user_affiliations   (matched via bubbleArtistId → users.bubbleId)
 *  - artist_resumes      (matched via bubbleArtistId → users.bubbleId)
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/migration/backfill-user-fks.ts
 */

import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log("Building bubbleId → userId lookup...");
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const row of userRows) {
    bubbleToUserId[row.bubbleId] = row.id;
  }
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} bubbleId → userId mappings`);

  // ── 1. artist_experiences ────────────────────────────────────────────────────
  console.log("\nBackfilling artist_experiences...");
  const [expRows] = await conn.execute(
    "SELECT id, bubbleArtistId FROM artist_experiences WHERE artistUserId IS NULL AND bubbleArtistId IS NOT NULL"
  ) as any[];
  let expFixed = 0;
  for (const row of expRows) {
    const userId = bubbleToUserId[row.bubbleArtistId];
    if (userId) {
      await conn.execute("UPDATE artist_experiences SET artistUserId=? WHERE id=?", [userId, row.id]);
      expFixed++;
    }
  }
  console.log(`  Fixed ${expFixed} / ${expRows.length} orphaned experience records`);

  // ── 2. user_affiliations ──────────────────────────────────────────────────────
  console.log("\nBackfilling user_affiliations...");
  const [affRows] = await conn.execute(
    "SELECT id, bubbleArtistId FROM user_affiliations WHERE artistUserId IS NULL AND bubbleArtistId IS NOT NULL"
  ) as any[];
  let affFixed = 0;
  for (const row of affRows) {
    const userId = bubbleToUserId[row.bubbleArtistId];
    if (userId) {
      await conn.execute("UPDATE user_affiliations SET artistUserId=? WHERE id=?", [userId, row.id]);
      affFixed++;
    }
  }
  console.log(`  Fixed ${affFixed} / ${affRows.length} orphaned affiliation memberships`);

  // ── 3. artist_resumes ─────────────────────────────────────────────────────────
  console.log("\nBackfilling artist_resumes...");
  const [resumeRows] = await conn.execute(
    "SELECT id, bubbleArtistId FROM artist_resumes WHERE artistUserId IS NULL AND bubbleArtistId IS NOT NULL"
  ) as any[];
  let resumeFixed = 0;
  for (const row of resumeRows) {
    const userId = bubbleToUserId[row.bubbleArtistId];
    if (userId) {
      await conn.execute("UPDATE artist_resumes SET artistUserId=? WHERE id=?", [userId, row.id]);
      resumeFixed++;
    }
  }
  console.log(`  Fixed ${resumeFixed} / ${resumeRows.length} orphaned resume records`);

  console.log("\n── Done ─────────────────────────────────────────");
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
