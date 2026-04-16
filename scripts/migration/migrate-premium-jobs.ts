/**
 * Migration: Premium Jobs
 * Pulls all 185 records from Bubble's "premium_jobs" type → `premium_jobs` table.
 *
 * NOTE: Run this BEFORE migrate-interested-artists.ts, which resolves
 * premium job bubble IDs → DB IDs.
 *
 * Bubble fields:
 *   _id, Company, logo, Category, Description, Budget, Tag, Status, Slug,
 *   Service Type, email (apply email), link (apply link),
 *   Apply Direct?, Work From Anywhere?, featured,
 *   Created By, Created Date, Modified Date
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-premium-jobs.ts
 */
import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";

interface BubblePremiumJob {
  _id: string;
  "Company"?: string;
  "logo"?: string;
  "Category"?: string;
  "Description"?: string;
  "Budget"?: string;
  "Tag"?: string;
  "Status"?: string;
  "Slug"?: string;
  "Service Type"?: string;
  "email"?: string;           // apply-to email address
  "link"?: string;            // apply-to external URL
  "Apply Direct?"?: boolean;
  "Work From Anywhere?"?: boolean;
  "featured"?: boolean;
  "Created By"?: string;      // Bubble user ID of creator
  "Created Date"?: string;
  "Modified Date"?: string;
}

function fixImageUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Build bubbleId → userId lookup for resolving createdByUserId
  const [userRows] = await conn.execute(
    "SELECT id, bubbleId FROM users WHERE bubbleId IS NOT NULL"
  ) as any[];
  const bubbleToUserId: Record<string, number> = {};
  for (const u of userRows) bubbleToUserId[u.bubbleId] = u.id;
  console.log(`Loaded ${Object.keys(bubbleToUserId).length} user mappings`);

  console.log("Fetching premium_jobs from Bubble...");
  const records = await fetchAllRecords<BubblePremiumJob>(
    "premium_jobs",
    (f, t) => process.stdout.write(`\r  Fetched ${f} / ${t}`)
  );
  console.log(`\nFetched ${records.length} premium jobs`);

  let inserted = 0, updated = 0, errors = 0;

  for (const r of records) {
    const createdByUserId = r["Created By"] ? (bubbleToUserId[r["Created By"]] ?? null) : null;

    try {
      const [result] = await conn.execute(
        `INSERT INTO premium_jobs (
           bubbleId,
           company, logo,
           createdByUserId, bubbleCreatedById,
           serviceType, category, description, budget, tag, slug,
           applyDirect, applyEmail, applyLink,
           workFromAnywhere, featured,
           status,
           bubbleCreatedAt, bubbleModifiedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           company=VALUES(company),
           logo=VALUES(logo),
           createdByUserId=VALUES(createdByUserId),
           serviceType=VALUES(serviceType),
           category=VALUES(category),
           description=VALUES(description),
           budget=VALUES(budget),
           tag=VALUES(tag),
           slug=VALUES(slug),
           applyDirect=VALUES(applyDirect),
           applyEmail=VALUES(applyEmail),
           applyLink=VALUES(applyLink),
           workFromAnywhere=VALUES(workFromAnywhere),
           featured=VALUES(featured),
           status=VALUES(status),
           bubbleModifiedAt=VALUES(bubbleModifiedAt)`,
        [
          r._id,
          r["Company"] ?? null,
          fixImageUrl(r["logo"]),
          createdByUserId,
          r["Created By"] ?? null,
          r["Service Type"] ?? null,
          r["Category"] ?? null,
          r["Description"] ?? null,
          r["Budget"] ?? null,
          r["Tag"] ?? null,
          r["Slug"] ?? null,
          r["Apply Direct?"] ? 1 : 0,
          r["email"] ?? null,
          r["link"] ?? null,
          r["Work From Anywhere?"] ? 1 : 0,
          r["featured"] ? 1 : 0,
          r["Status"] ?? "Active",
          r["Created Date"] ? new Date(r["Created Date"]) : null,
          r["Modified Date"] ? new Date(r["Modified Date"]) : null,
        ]
      ) as any;
      if (result.affectedRows === 1) inserted++;
      else updated++;
    } catch (e: any) {
      console.error(`\nError on premium job ${r._id}:`, e.message);
      errors++;
    }
  }

  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
