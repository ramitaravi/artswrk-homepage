/**
 * Seed script: imports Nick's Bubble user record (Phyllis F / Ferrari Dance Center NYC)
 * into the new artswrk database.
 *
 * Run with: node scripts/seed-bubble-user.mjs
 */

import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

// ── Bubble record for nick+ferrari@artswrk.com ────────────────────────────────
const bubbleRecord = {
  bubbleId: "1659533883431x527826980339748400",
  email: "nick+ferrari@artswrk.com",
  firstName: "Phyllis",
  lastName: "F",
  name: "Phyllis F",
  slug: "phyllis-d",
  profilePicture:
    "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1763747769369x507373344785449800/4268471_2000x.webp",
  phoneNumber: "3472340677",
  userRole: "Client",
  optionAvailability: "Available for work",
  clientCompanyName: "Ferrari Dance Center NYC",
  clientStripeCustomerId: "cus_MbVF3S9xtRuQ2g",
  clientStripeCardId: "card_1LsIESA91H1fWNkKzc4xqD7k",
  clientSubscriptionId: "sub_1NtjAdA91H1fWNkK1cOFJx62",
  clientPremium: true,
  stripeCustomerId: "cus_Oh7P8c0sMGXPrx",
  onboardingStep: 5,
  userSignedUp: true,
  beta: true,
  bubbleCreatedAt: new Date("2022-08-03T00:00:00Z"), // approx from Bubble ID timestamp
  bubbleModifiedAt: new Date(),
};

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("❌  DATABASE_URL not set. Check your .env file.");
    process.exit(1);
  }

  const conn = await createConnection(process.env.DATABASE_URL);

  try {
    // Use a placeholder openId for the Bubble-migrated user.
    // This will be updated to the real Manus openId when the user first logs in via OAuth.
    const openId = `bubble_${bubbleRecord.bubbleId}`;

    const [existing] = await conn.execute(
      "SELECT id FROM users WHERE bubbleId = ?",
      [bubbleRecord.bubbleId]
    );

    if (existing.length > 0) {
      console.log(`ℹ️  User already exists (id=${existing[0].id}). Updating...`);
      await conn.execute(
        `UPDATE users SET
          email = ?, firstName = ?, lastName = ?, name = ?, slug = ?,
          profilePicture = ?, phoneNumber = ?, userRole = ?, optionAvailability = ?,
          clientCompanyName = ?, clientStripeCustomerId = ?, clientStripeCardId = ?,
          clientSubscriptionId = ?, clientPremium = ?, stripeCustomerId = ?,
          onboardingStep = ?, userSignedUp = ?, beta = ?,
          bubbleCreatedAt = ?, bubbleModifiedAt = ?
        WHERE bubbleId = ?`,
        [
          bubbleRecord.email,
          bubbleRecord.firstName,
          bubbleRecord.lastName,
          bubbleRecord.name,
          bubbleRecord.slug,
          bubbleRecord.profilePicture,
          bubbleRecord.phoneNumber,
          bubbleRecord.userRole,
          bubbleRecord.optionAvailability,
          bubbleRecord.clientCompanyName,
          bubbleRecord.clientStripeCustomerId,
          bubbleRecord.clientStripeCardId,
          bubbleRecord.clientSubscriptionId,
          bubbleRecord.clientPremium ? 1 : 0,
          bubbleRecord.stripeCustomerId,
          bubbleRecord.onboardingStep,
          bubbleRecord.userSignedUp ? 1 : 0,
          bubbleRecord.beta ? 1 : 0,
          bubbleRecord.bubbleCreatedAt,
          bubbleRecord.bubbleModifiedAt,
          bubbleRecord.bubbleId,
        ]
      );
      console.log("✅  User updated successfully.");
    } else {
      await conn.execute(
        `INSERT INTO users (
          openId, bubbleId, loginMethod, role,
          email, firstName, lastName, name, slug,
          profilePicture, phoneNumber, userRole, optionAvailability,
          clientCompanyName, clientStripeCustomerId, clientStripeCardId,
          clientSubscriptionId, clientPremium, stripeCustomerId,
          onboardingStep, userSignedUp, beta,
          bubbleCreatedAt, bubbleModifiedAt,
          lastSignedIn
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          openId,
          bubbleRecord.bubbleId,
          "bubble",
          "user",
          bubbleRecord.email,
          bubbleRecord.firstName,
          bubbleRecord.lastName,
          bubbleRecord.name,
          bubbleRecord.slug,
          bubbleRecord.profilePicture,
          bubbleRecord.phoneNumber,
          bubbleRecord.userRole,
          bubbleRecord.optionAvailability,
          bubbleRecord.clientCompanyName,
          bubbleRecord.clientStripeCustomerId,
          bubbleRecord.clientStripeCardId,
          bubbleRecord.clientSubscriptionId,
          bubbleRecord.clientPremium ? 1 : 0,
          bubbleRecord.stripeCustomerId,
          bubbleRecord.onboardingStep,
          bubbleRecord.userSignedUp ? 1 : 0,
          bubbleRecord.beta ? 1 : 0,
          bubbleRecord.bubbleCreatedAt,
          bubbleRecord.bubbleModifiedAt,
        ]
      );
      console.log("✅  User inserted successfully.");
    }

    // Verify
    const [rows] = await conn.execute(
      "SELECT id, email, name, userRole, clientCompanyName, clientPremium, onboardingStep FROM users WHERE bubbleId = ?",
      [bubbleRecord.bubbleId]
    );
    console.log("\n📋  Persisted record:");
    console.table(rows);
  } finally {
    await conn.end();
  }
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
