/**
 * Migration: Affiliations
 * Pulls all records from Bubble's "Affiliations" type and inserts into:
 *   - `affiliations` table (one row per affiliation)
 *   - `user_affiliations` join table (one row per affiliation ↔ user link)
 *
 * Note: artistUserId will be null until users are migrated.
 *       bubbleArtistId is stored so the FK can be resolved in a later pass.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-affiliations.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { affiliations, userAffiliations } from "../../drizzle/schema";
import { fetchAllRecords } from "./bubble-client";

interface BubbleAffiliation {
  _id: string;
  Display?: string;
  Slug?: string;
  logo?: string;
  public?: boolean;
  Users?: string[];
  "Created Date"?: string;
  "Modified Date"?: string;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  console.log("Fetching affiliations from Bubble...");
  const bubbleAffiliations = await fetchAllRecords<BubbleAffiliation>(
    "Affiliations",
    (fetched, total) => process.stdout.write(`\r  ${fetched} / ${total}`)
  );
  console.log(`\nFetched ${bubbleAffiliations.length} affiliations`);

  let affiliationsInserted = 0;
  let affiliationsSkipped = 0;
  let membershipsInserted = 0;

  for (const aff of bubbleAffiliations) {
    // 1. Insert the affiliation record
    let affiliationId: number | null = null;

    try {
      const result = await db.insert(affiliations).values({
        bubbleId: aff._id,
        display: aff.Display ?? aff._id,
        slug: aff.Slug ?? null,
        logoUrl: aff.logo ?? null,
        isPublic: aff.public ?? false,
        bubbleCreatedAt: aff["Created Date"] ? new Date(aff["Created Date"]) : null,
        bubbleModifiedAt: aff["Modified Date"] ? new Date(aff["Modified Date"]) : null,
      });
      affiliationId = (result[0] as any).insertId;
      affiliationsInserted++;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        // Already exists — fetch its ID so we can still insert memberships
        const existing = await db
          .select({ id: affiliations.id })
          .from(affiliations)
          .where(eq(affiliations.bubbleId, aff._id))
          .limit(1);
        affiliationId = existing[0]?.id ?? null;
        affiliationsSkipped++;
      } else {
        throw e;
      }
    }

    if (!affiliationId) continue;

    // 2. Insert user membership rows (bubbleArtistId only — FK resolved later)
    const users = aff.Users ?? [];
    for (const bubbleUserId of users) {
      try {
        await db.insert(userAffiliations).ignore().values({
          affiliationId,
          bubbleAffiliationId: aff._id,
          bubbleArtistId: bubbleUserId,
          artistUserId: null, // resolved in post-user-migration pass
        });
        membershipsInserted++;
      } catch {
        // skip duplicate membership rows silently
      }
    }

    console.log(`  [${aff.Display}] → ${users.length} members`);
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Affiliations inserted : ${affiliationsInserted}`);
  console.log(`Affiliations skipped  : ${affiliationsSkipped}`);
  console.log(`Memberships inserted  : ${membershipsInserted}`);

  await connection.end();
}

// Need eq for the duplicate-handling lookup
import { eq } from "drizzle-orm";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
