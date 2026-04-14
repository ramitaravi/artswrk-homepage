/**
 * Seed client_companies table from distinct company data in premium_jobs.
 * Each enterprise user gets one row per unique bubbleClientCompanyId.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get all enterprise users
  const [enterpriseUsers] = await conn.query(
    "SELECT id, email FROM users WHERE enterprise = 1"
  );
  console.log(`Found ${enterpriseUsers.length} enterprise users`);

  let totalInserted = 0;

  for (const user of enterpriseUsers) {
    // Get distinct companies from their premium_jobs
    const [rows] = await conn.query(
      `SELECT DISTINCT company, logo, bubbleClientCompanyId
       FROM premium_jobs
       WHERE createdByUserId = ? AND company IS NOT NULL
`,
      [user.id]
    );

    // Deduplicate by bubbleClientCompanyId (prefer first occurrence)
    const seen = new Set();
    const unique = [];
    for (const row of rows) {
      const key = row.bubbleClientCompanyId || row.company;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(row);
      }
    }

    for (const company of unique) {
      // Check if already exists
      const [existing] = await conn.query(
        "SELECT id FROM client_companies WHERE ownerUserId = ? AND (bubbleClientCompanyId = ? OR name = ?)",
        [user.id, company.bubbleClientCompanyId || null, company.company]
      );
      if (existing.length > 0) {
        console.log(`  Skipping existing: ${company.company}`);
        continue;
      }

      await conn.query(
        `INSERT INTO client_companies (ownerUserId, name, logo, bubbleClientCompanyId)
         VALUES (?, ?, ?, ?)`,
        [
          user.id,
          company.company,
          company.logo || null,
          company.bubbleClientCompanyId || null,
        ]
      );
      console.log(`  Inserted: ${user.email} → ${company.company}`);
      totalInserted++;
    }
  }

  console.log(`\nDone! Inserted ${totalInserted} client companies.`);
  await conn.end();
}

main().catch(console.error);
