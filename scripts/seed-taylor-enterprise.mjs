/**
 * Seed script: imports Taylor / REVEL Dance Convention as an enterprise user.
 * Source: Bubble live API
 * Run with: node scripts/seed-taylor-enterprise.mjs
 */
import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const TAYLOR_BUBBLE_ID = "1772121421134x418341755101401700";
const COMPANY_LOGO = "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1773623236874x382468136169884900/REVEL%20Dance%20Convention.jpeg";

async function main() {
  const db = await createConnection(process.env.DATABASE_URL);
  console.log("Connected to database");

  try {
    const openId = `bubble_${TAYLOR_BUBBLE_ID}`;

    const [existing] = await db.execute(
      "SELECT id, email FROM users WHERE bubbleId = ? OR email = ?",
      [TAYLOR_BUBBLE_ID, "taylor@dancerevel.com"]
    );

    if (existing.length > 0) {
      console.log(`Updating existing user: ${existing[0].email} (id: ${existing[0].id})`);
      await db.execute(
        `UPDATE users SET
          email = ?, firstName = ?, lastName = ?, name = ?,
          phoneNumber = ?, profilePicture = ?, userRole = ?,
          enterprise = ?, enterpriseLogoUrl = ?, clientCompanyName = ?,
          businessOrIndividual = ?, businessType = ?, userSignedUp = ?,
          bubbleId = ?, bubbleCreatedAt = ?, bubbleModifiedAt = ?
        WHERE bubbleId = ? OR email = ?`,
        [
          "taylor@dancerevel.com", "REVEL", "Dance Convention", "REVEL Dance Convention",
          "8135634249", COMPANY_LOGO, "Client",
          true, COMPANY_LOGO, "REVEL Dance Convention",
          "Business", "Dance Convention", true,
          TAYLOR_BUBBLE_ID, new Date("2026-02-26T15:57:01.134Z"), new Date("2026-04-14T04:34:06.892Z"),
          TAYLOR_BUBBLE_ID, "taylor@dancerevel.com",
        ]
      );
    } else {
      console.log("Inserting new enterprise user: taylor@dancerevel.com");
      await db.execute(
        `INSERT INTO users (
          openId, bubbleId, email, firstName, lastName, name,
          phoneNumber, profilePicture, userRole,
          enterprise, enterpriseLogoUrl, clientCompanyName,
          businessOrIndividual, businessType, userSignedUp, role,
          bubbleCreatedAt, bubbleModifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          openId, TAYLOR_BUBBLE_ID, "taylor@dancerevel.com",
          "REVEL", "Dance Convention", "REVEL Dance Convention",
          "8135634249", COMPANY_LOGO, "Client",
          true, COMPANY_LOGO, "REVEL Dance Convention",
          "Business", "Dance Convention", true, "user",
          new Date("2026-02-26T15:57:01.134Z"), new Date("2026-04-14T04:34:06.892Z"),
        ]
      );
    }

    const [result] = await db.execute(
      "SELECT id, email, name, enterprise, enterpriseLogoUrl, clientCompanyName FROM users WHERE email = ?",
      ["taylor@dancerevel.com"]
    );
    console.log("\n✅ Taylor in DB:", result[0]);

  } catch (err) {
    console.error("Error:", err.message);
    throw err;
  } finally {
    await db.end();
  }
}

main().catch(console.error);
