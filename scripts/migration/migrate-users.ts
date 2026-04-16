/**
 * Migration: Users
 * Pulls all 6,691 users from Bubble's live API and upserts into the `users` table.
 *
 * Strategy:
 *  - Match by email first. If the user already exists → UPDATE Bubble fields only
 *    (preserves existing openId, passwordHash, and any data Manus already set).
 *  - If email not found → INSERT with openId = "bubble_<bubbleId>" as placeholder.
 *    When the user logs in via OAuth for the first time, the app matches by email
 *    and replaces the placeholder openId with their real OAuth ID.
 *  - Resolves Master Artist Type IDs → names
 *  - Resolves Master Service Type IDs → names
 *  - Resolves Hiring Category ID → artist type name
 *  - Safe to re-run (upserts, won't duplicate)
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> DATABASE_URL=<url> npx tsx scripts/migration/migrate-users.ts
 */

import mysql from "mysql2/promise";
import { fetchAllRecords } from "./bubble-client";
import { MASTER_ARTIST_TYPES, MASTER_SERVICE_TYPES } from "../../drizzle/seeds/reference_data";

// ── Reference lookups ──────────────────────────────────────────────────────────
const artistTypeById = Object.fromEntries(MASTER_ARTIST_TYPES.map((t) => [t.bubbleId, t.name]));
const serviceTypeById = Object.fromEntries(MASTER_SERVICE_TYPES.map((s) => [s.bubbleId, s.name]));

function resolveIds(ids: string[], lookup: Record<string, string>): string[] {
  return ids.map((id) => lookup[id] ?? id).filter(Boolean);
}

function fixImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Bubble CDN URLs often start with // — make them https
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

// ── Bubble user shape ──────────────────────────────────────────────────────────
interface BubbleUser {
  _id: string;
  "First Name"?: string;
  "Last Name"?: string;
  "Full Name"?: string;
  "Slug"?: string;
  "Profile Picture"?: string;
  "Phone Number"?: string;
  "User Role"?: string;
  "Bio"?: string;
  "Pronouns"?: string;
  "Instagram"?: string;
  "Tiktok"?: string;
  "YouTube"?: string;
  "Credits"?: string;
  "Website"?: string;
  "Location"?: { address?: string; lat?: number; lng?: number };
  "Option_availability"?: string;
  "Business or Individual?"?: string;
  "Business Type"?: string;
  "Client Company Name"?: string;
  "Hiring Category"?: string;
  "Master Artist Types"?: string[];
  "List of Master Services"?: string[];
  "Artist Transportation Accesses"?: string[];
  "Artswrk PRO - Artists"?: boolean;
  "Artswrk Basic"?: boolean;
  "Priority List"?: boolean;
  "Late Cancel"?: number;
  "Onboarding Step"?: number;
  "Artist Onboarding Complete"?: boolean;
  "user_signed_up"?: boolean;
  "BETA"?: boolean;
  "StripeCustomerID"?: string;
  "Artist Stripe Account ID"?: string;
  "Artist Stripe Return Code"?: string;
  "Stripe product ID"?: string;
  "Artist Stripe Date Created"?: string;
  "Client Stripe Customer ID"?: string;
  "Client Stripe Card ID"?: string;
  "Client Subscription ID"?: string;
  "Client Premium"?: boolean;
  "Deleted?"?: boolean;
  "authentication"?: {
    email?: { email?: string; email_confirmed?: boolean | null };
  };
  "Created Date"?: string;
  "Modified Date"?: string;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log("Fetching all users from Bubble API...");
  const bubbleUsers = await fetchAllRecords<BubbleUser>(
    "user",
    (fetched, total) => process.stdout.write(`\r  Fetched ${fetched} / ${total}`)
  );
  console.log(`\nFetched ${bubbleUsers.length} users from Bubble`);

  // Build email → existing DB user lookup
  const [existingRows] = await conn.execute(
    "SELECT id, email, openId FROM users WHERE email IS NOT NULL"
  ) as any[];
  const emailToExisting: Record<string, { id: number; openId: string }> = {};
  for (const row of existingRows) {
    if (row.email) emailToExisting[row.email.toLowerCase().trim()] = { id: row.id, openId: row.openId };
  }
  console.log(`Found ${Object.keys(emailToExisting).length} existing users in DB`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const u of bubbleUsers) {
    // Skip soft-deleted users
    if (u["Deleted?"] === true) { skipped++; continue; }

    const email = u.authentication?.email?.email?.toLowerCase().trim() ?? null;
    const bubbleId = u._id;

    // Resolve array fields
    const masterArtistTypeNames = resolveIds(u["Master Artist Types"] ?? [], artistTypeById);
    const masterServiceNames = resolveIds(u["List of Master Services"] ?? [], serviceTypeById);
    const hiringCategoryName = u["Hiring Category"]
      ? (artistTypeById[u["Hiring Category"]] ?? null)
      : null;
    const transportation = (u["Artist Transportation Accesses"] ?? []).join(", ") || null;

    const fields = {
      bubbleId,
      email,
      firstName: u["First Name"] ?? null,
      lastName: u["Last Name"] ?? null,
      name: u["Full Name"] ?? null,
      slug: u["Slug"] ?? null,
      profilePicture: fixImageUrl(u["Profile Picture"]),
      phoneNumber: u["Phone Number"] ?? null,
      userRole: (u["User Role"] as "Client" | "Artist" | "Admin") ?? null,
      optionAvailability: u["Option_availability"] ?? null,
      location: u["Location"]?.address ?? null,
      businessOrIndividual: u["Business or Individual?"] ?? null,
      businessType: u["Business Type"] ?? null,
      clientCompanyName: u["Client Company Name"] ?? null,
      hiringCategory: hiringCategoryName,
      bio: u["Bio"] ?? null,
      pronouns: u["Pronouns"] ?? null,
      instagram: u["Instagram"] ?? null,
      tiktok: u["Tiktok"] ?? null,
      youtube: u["YouTube"] ?? null,
      credits: u["Credits"] ?? null,
      website: u["Website"] ?? null,
      masterArtistTypes: masterArtistTypeNames.length ? JSON.stringify(masterArtistTypeNames) : null,
      artistServices: masterServiceNames.length ? JSON.stringify(masterServiceNames) : null,
      artistTransportationAccommodation: transportation,
      artswrkPro: u["Artswrk PRO - Artists"] ? 1 : 0,
      artswrkBasic: u["Artswrk Basic"] ? 1 : 0,
      priorityList: u["Priority List"] ? 1 : 0,
      lateCancelCount: u["Late Cancel"] ?? 0,
      onboardingStep: u["Onboarding Step"] ?? 0,
      userSignedUp: u["user_signed_up"] ? 1 : 0,
      beta: u["BETA"] ? 1 : 0,
      stripeCustomerId: u["StripeCustomerID"] ?? null,
      artistStripeAccountId: u["Artist Stripe Account ID"] ?? null,
      artistStripeReturnCode: u["Artist Stripe Return Code"] ?? null,
      artistStripeProductId: u["Stripe product ID"] ?? null,
      artistStripeDateCreated: u["Artist Stripe Date Created"] ? new Date(u["Artist Stripe Date Created"]) : null,
      clientStripeCustomerId: u["Client Stripe Customer ID"] ?? null,
      clientStripeCardId: u["Client Stripe Card ID"] ?? null,
      clientSubscriptionId: u["Client Subscription ID"] ?? null,
      clientPremium: u["Client Premium"] ? 1 : 0,
      bubbleCreatedAt: u["Created Date"] ? new Date(u["Created Date"]) : null,
      bubbleModifiedAt: u["Modified Date"] ? new Date(u["Modified Date"]) : null,
    };

    try {
      const existing = email ? emailToExisting[email] : null;

      if (existing) {
        // UPDATE — preserve openId and passwordHash, update everything else
        await conn.execute(
          `UPDATE users SET
            bubbleId=?, firstName=?, lastName=?, name=?, slug=?, profilePicture=?,
            phoneNumber=?, userRole=?, optionAvailability=?, location=?,
            businessOrIndividual=?, businessType=?, clientCompanyName=?, hiringCategory=?,
            bio=?, pronouns=?, instagram=?, tiktok=?, youtube=?, credits=?, website=?,
            masterArtistTypes=?, artistServices=?, artistTransportationAccommodation=?,
            artswrkPro=?, artswrkBasic=?, priorityList=?, lateCancelCount=?,
            onboardingStep=?, userSignedUp=?, beta=?,
            stripeCustomerId=?, artistStripeAccountId=?, artistStripeReturnCode=?,
            artistStripeProductId=?, artistStripeDateCreated=?,
            clientStripeCustomerId=?, clientStripeCardId=?, clientSubscriptionId=?,
            clientPremium=?, bubbleCreatedAt=?, bubbleModifiedAt=?
          WHERE id=?`,
          [
            fields.bubbleId, fields.firstName, fields.lastName, fields.name,
            fields.slug, fields.profilePicture, fields.phoneNumber, fields.userRole,
            fields.optionAvailability, fields.location, fields.businessOrIndividual,
            fields.businessType, fields.clientCompanyName, fields.hiringCategory,
            fields.bio, fields.pronouns, fields.instagram, fields.tiktok,
            fields.youtube, fields.credits, fields.website,
            fields.masterArtistTypes, fields.artistServices,
            fields.artistTransportationAccommodation,
            fields.artswrkPro, fields.artswrkBasic, fields.priorityList,
            fields.lateCancelCount, fields.onboardingStep, fields.userSignedUp,
            fields.beta, fields.stripeCustomerId, fields.artistStripeAccountId,
            fields.artistStripeReturnCode, fields.artistStripeProductId,
            fields.artistStripeDateCreated, fields.clientStripeCustomerId,
            fields.clientStripeCardId, fields.clientSubscriptionId,
            fields.clientPremium, fields.bubbleCreatedAt, fields.bubbleModifiedAt,
            existing.id,
          ]
        );
        updated++;
      } else {
        // INSERT — use bubble_<bubbleId> as placeholder openId
        await conn.execute(
          `INSERT IGNORE INTO users (
            openId, bubbleId, email, firstName, lastName, name, slug, profilePicture,
            phoneNumber, userRole, optionAvailability, location,
            businessOrIndividual, businessType, clientCompanyName, hiringCategory,
            bio, pronouns, instagram, tiktok, youtube, credits, website,
            masterArtistTypes, artistServices, artistTransportationAccommodation,
            artswrkPro, artswrkBasic, priorityList, lateCancelCount,
            onboardingStep, userSignedUp, beta,
            stripeCustomerId, artistStripeAccountId, artistStripeReturnCode,
            artistStripeProductId, artistStripeDateCreated,
            clientStripeCustomerId, clientStripeCardId, clientSubscriptionId,
            clientPremium, passwordIsTemporary, bubbleCreatedAt, bubbleModifiedAt
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, 1, ?, ?
          )`,
          [
            `bubble_${bubbleId}`, // placeholder openId
            fields.bubbleId, fields.email, fields.firstName, fields.lastName,
            fields.name, fields.slug, fields.profilePicture, fields.phoneNumber,
            fields.userRole, fields.optionAvailability, fields.location,
            fields.businessOrIndividual, fields.businessType, fields.clientCompanyName,
            fields.hiringCategory, fields.bio, fields.pronouns, fields.instagram,
            fields.tiktok, fields.youtube, fields.credits, fields.website,
            fields.masterArtistTypes, fields.artistServices,
            fields.artistTransportationAccommodation,
            fields.artswrkPro, fields.artswrkBasic, fields.priorityList,
            fields.lateCancelCount, fields.onboardingStep, fields.userSignedUp,
            fields.beta, fields.stripeCustomerId, fields.artistStripeAccountId,
            fields.artistStripeReturnCode, fields.artistStripeProductId,
            fields.artistStripeDateCreated, fields.clientStripeCustomerId,
            fields.clientStripeCardId, fields.clientSubscriptionId,
            fields.clientPremium, fields.bubbleCreatedAt, fields.bubbleModifiedAt,
          ]
        );
        inserted++;
      }
    } catch (e: any) {
      console.error(`\nError on user ${bubbleId} (${email}):`, e.message);
      errors++;
    }

    const total = inserted + updated + skipped + errors;
    if (total % 100 === 0) {
      process.stdout.write(`\r  Processed ${total} / ${bubbleUsers.length} — inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
    }
  }

  console.log("\n\n── Summary ──────────────────────────────────────");
  console.log(`Inserted (new)    : ${inserted}`);
  console.log(`Updated (existing): ${updated}`);
  console.log(`Skipped (deleted) : ${skipped}`);
  console.log(`Errors            : ${errors}`);
  console.log(`Total processed   : ${inserted + updated + skipped + errors}`);

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
