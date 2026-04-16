/**
 * Backfill: Client Company Logos
 * For every client_company where logo IS NULL, copies the owning client's
 * profilePicture into the logo column.
 *
 * Usage:
 *   node scripts/migration/backfill-company-logos.mjs
 */
import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Single UPDATE: join client_companies → users on ownerUserId,
  // set logo = user.profilePicture where logo is null and profilePicture is not null
  const [result] = await conn.execute(`
    UPDATE client_companies cc
    JOIN users u ON cc.ownerUserId = u.id
    SET cc.logo = u.profilePicture
    WHERE (cc.logo IS NULL OR cc.logo = '')
      AND u.profilePicture IS NOT NULL
      AND u.profilePicture != ''
  `);

  console.log(`Updated ${result.affectedRows} company logos from client profile pictures`);

  // Report remaining gaps
  const [[stillMissing]] = await conn.execute(`
    SELECT COUNT(*) as c FROM client_companies
    WHERE logo IS NULL OR logo = ''
  `);
  const [[total]] = await conn.execute(`SELECT COUNT(*) as c FROM client_companies`);
  const [[withLogo]] = await conn.execute(`SELECT COUNT(*) as c FROM client_companies WHERE logo IS NOT NULL AND logo != ''`);

  console.log(`\n── Summary ──────────────────────────────────`);
  console.log(`Total companies     : ${total.c}`);
  console.log(`With logo now       : ${withLogo.c}`);
  console.log(`Still missing logo  : ${stillMissing.c} (client has no profile pic)`);

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
