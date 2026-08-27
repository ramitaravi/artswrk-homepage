import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";

type ExistingUser = {
  id: number;
  openId: string;
  bubbleId: string | null;
  email: string | null;
  passwordHash: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
};

type BubbleUser = Record<string, unknown> & {
  _id: string;
  authentication?: { email?: { email?: string | null } };
};

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isSyntheticOpenId(openId: string | null | undefined): boolean {
  return !openId || openId.startsWith("bubble_") || openId.startsWith("bubble_csv_");
}

export function selectCanonicalUser(candidates: ExistingUser[]): ExistingUser | undefined {
  return [...candidates].sort((a, b) => {
    const score = (user: ExistingUser) =>
      (isSyntheticOpenId(user.openId) ? 0 : 100) +
      (user.passwordHash ? 50 : 0) +
      (user.role === "admin" ? 40 : 0) +
      (user.loginMethod && user.loginMethod !== "bubble" ? 10 : 0);
    return score(b) - score(a) || a.id - b.id;
  })[0];
}

function bool(value: unknown): number {
  return value === true ? 1 : 0;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function fixUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.startsWith("//") ? `https:${value}` : value;
}

export function limitText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function bubbleEmail(user: BubbleUser): string | null {
  const value = user.authentication?.email?.email ?? user.email ?? user.Email;
  const normalized = normalizeEmail(value);
  return normalized || null;
}

function bubbleRole(user: BubbleUser): "Client" | "Artist" | "Admin" | null {
  const value = user["User Role"] ?? user.userRole;
  return value === "Client" || value === "Artist" || value === "Admin" ? value : null;
}

function locationAddress(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && "address" in value) {
    const address = (value as { address?: unknown }).address;
    return typeof address === "string" ? address : null;
  }
  return null;
}

function readBubbleToken(): string {
  if (process.env.BUBBLE_API_KEY) return process.env.BUBBLE_API_KEY;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(root, "scripts/sync-all.mjs"), "utf8");
  const fallback = source.match(/BUBBLE_API_KEY\s*=\s*process\.env\.BUBBLE_API_KEY\s*\|\|\s*"([^"]+)"/)?.[1];
  if (!fallback) throw new Error("Bubble API credential is unavailable");
  return fallback;
}

async function fetchBubbleUsers(token: string): Promise<BubbleUser[]> {
  const base = "https://artswrk.com/version-live/api/1.1/obj/user";
  const users: BubbleUser[] = [];
  let cursor = 0;
  while (true) {
    const response = await fetch(`${base}?limit=100&cursor=${cursor}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Bubble user API returned ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json() as {
      response?: { results?: BubbleUser[]; remaining?: number };
    };
    const batch = payload.response?.results ?? [];
    users.push(...batch);
    process.stdout.write(`\rFetched ${users.length} Bubble users`);
    if (Number(payload.response?.remaining ?? 0) === 0) break;
    cursor += batch.length;
  }
  process.stdout.write("\n");
  return users;
}

async function loadLookup(
  conn: mysql.Connection,
  table: string,
): Promise<Map<string, string>> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT bubbleId, name FROM ${table} WHERE bubbleId IS NOT NULL`,
  );
  return new Map(rows.map((row) => [String(row.bubbleId), String(row.name)]));
}

function resolveList(value: unknown, lookup: Map<string, string>): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const resolved = value.map((item) => lookup.get(String(item)) ?? String(item)).filter(Boolean);
  return resolved.length ? JSON.stringify(resolved) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");

  const token = readBubbleToken();
  const sourceUsers = await fetchBubbleUsers(token);
  const sourceIds = new Set(sourceUsers.map((user) => user._id));
  if (sourceUsers.length === 0 || sourceIds.size !== sourceUsers.length) {
    throw new Error("Bubble user source is empty or contains duplicate IDs; refusing to continue");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const artistTypes = await loadLookup(conn, "master_artist_types");
  const serviceTypes = await loadLookup(conn, "master_service_types");
  const styleTypes = await loadLookup(conn, "master_style_types");

  const [existingRows] = await conn.execute<(ExistingUser & RowDataPacket)[]>(`
    SELECT id, openId, bubbleId, email, passwordHash, loginMethod, role
    FROM users
    ORDER BY id
  `);

  const byBubbleId = new Map<string, ExistingUser[]>();
  const byEmail = new Map<string, ExistingUser[]>();
  const byOpenId = new Map<string, ExistingUser>();
  for (const user of existingRows) {
    if (user.bubbleId) {
      const list = byBubbleId.get(user.bubbleId) ?? [];
      list.push(user);
      byBubbleId.set(user.bubbleId, list);
    }
    const email = normalizeEmail(user.email);
    if (email) {
      const list = byEmail.get(email) ?? [];
      list.push(user);
      byEmail.set(email, list);
    }
    byOpenId.set(user.openId, user);
  }

  const planned = {
    sourceUsers: sourceUsers.length,
    updateByBubbleId: 0,
    attachByOpenId: 0,
    attachByEmail: 0,
    insert: 0,
    suppressedDuplicateRows: 0,
  };

  const plan = sourceUsers.map((source) => {
    const direct = byBubbleId.get(source._id) ?? [];
    let canonical = selectCanonicalUser(direct);
    let method: "bubbleId" | "openId" | "email" | "insert" = "bubbleId";
    if (direct.length > 1) planned.suppressedDuplicateRows += direct.length - 1;

    if (!canonical) {
      canonical = byOpenId.get(`bubble_${source._id}`);
      method = canonical ? "openId" : "email";
    }

    if (!canonical) {
      const email = bubbleEmail(source);
      const emailCandidates = email
        ? (byEmail.get(email) ?? []).filter((row) => !row.bubbleId || !sourceIds.has(row.bubbleId))
        : [];
      canonical = selectCanonicalUser(emailCandidates);
      method = canonical ? "email" : "insert";
    }

    if (method === "bubbleId") planned.updateByBubbleId += 1;
    else if (method === "openId") planned.attachByOpenId += 1;
    else if (method === "email") planned.attachByEmail += 1;
    else planned.insert += 1;

    return { source, canonical, method };
  });

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned }, null, 2));
  if (!apply) {
    await conn.end();
    return;
  }

  await conn.beginTransaction();
  try {
    await conn.execute("UPDATE users SET bubbleSourcePresent = 0");

    let processed = 0;
    for (const { source, canonical } of plan) {
      const email = bubbleEmail(source);
      const firstName = source["First Name"] ?? source.firstName ?? null;
      const lastName = source["Last Name"] ?? source.lastName ?? null;
      const fullName = source["Full Name"] ?? (
        firstName || lastName ? [firstName, lastName].filter(Boolean).join(" ") : email ?? `bubble_${source._id}`
      );
      const hiringCategoryId = source["Hiring Category"];
      const hiringCategory = hiringCategoryId ? artistTypes.get(String(hiringCategoryId)) ?? null : null;
      const transportation = Array.isArray(source["Artist Transportation Accesses"])
        ? source["Artist Transportation Accesses"].map(String).join(", ") || null
        : null;

      const values = [
        source._id,
        email,
        limitText(firstName, 128),
        limitText(lastName, 128),
        fullName,
        limitText(source.Slug ?? source.slug, 128),
        fixUrl(source["Profile Picture"]),
        limitText(source["Phone Number"], 32),
        bubbleRole(source),
        limitText(source.Option_availability, 64),
        limitText(locationAddress(source.Location ?? source.location), 256),
        limitText(source["Business or Individual?"], 64),
        limitText(source["Business Type"], 128),
        limitText(source["Client Company Name"], 256),
        limitText(hiringCategory, 128),
        source.Bio ?? null,
        limitText(source.Pronouns, 64),
        limitText(source.Instagram, 128),
        source.Tiktok ?? null,
        source.YouTube ?? null,
        source.Credits ?? null,
        source.Website ?? null,
        resolveList(source["Master Artist Types"], artistTypes),
        resolveList(source["List of Master Styles"], styleTypes),
        resolveList(source["List of Master Services"], serviceTypes),
        limitText(transportation, 128),
        bool(source["Artswrk PRO - Artists"] ?? source["Artswrk PRO?"]),
        bool(source["Artswrk Basic"] ?? source["Artswrk Basic?"]),
        bool(source["Priority List"]),
        Number(source["Late Cancel"] ?? 0) || 0,
        Number(source["Onboarding Step"] ?? 0) || 0,
        bool(source.user_signed_up),
        bool(source.BETA),
        limitText(source.StripeCustomerID, 64),
        limitText(source["Artist Stripe Account ID"], 64),
        limitText(source["Artist Stripe Return Code"], 256),
        limitText(source["Stripe product ID"], 64),
        safeDate(source["Artist Stripe Date Created"]),
        limitText(source["Client Stripe Customer ID"], 64),
        limitText(source["Client Stripe Card ID"], 64),
        limitText(source["Client Subscription ID"], 64),
        bool(source["Client Premium"]),
        safeDate(source["Created Date"]),
        safeDate(source["Modified Date"]),
      ];

      if (canonical) {
        await conn.execute(`
          UPDATE users SET
            bubbleId=?, bubbleSourcePresent=1, email=?, firstName=?, lastName=?, name=?, slug=?, profilePicture=?,
            phoneNumber=?, userRole=?, optionAvailability=?, location=?, businessOrIndividual=?, businessType=?,
            clientCompanyName=?, hiringCategory=?, bio=?, pronouns=?, instagram=?, tiktok=?, youtube=?, credits=?,
            website=?, masterArtistTypes=?, masterStyles=?, artistServices=?, artistTransportationAccommodation=?,
            artswrkPro=?, artswrkBasic=?, priorityList=?, lateCancelCount=?, onboardingStep=?, userSignedUp=?, beta=?,
            stripeCustomerId=?, artistStripeAccountId=?, artistStripeReturnCode=?, artistStripeProductId=?,
            artistStripeDateCreated=?, clientStripeCustomerId=?, clientStripeCardId=?, clientSubscriptionId=?,
            clientPremium=?, bubbleCreatedAt=?, bubbleModifiedAt=?
          WHERE id=?
        `, [...values, canonical.id]);
      } else {
        const insertColumns = `
            INSERT INTO users (
              openId, loginMethod, role, passwordIsTemporary,
              bubbleId, bubbleSourcePresent, email, firstName, lastName, name, slug, profilePicture,
            phoneNumber, userRole, optionAvailability, location, businessOrIndividual, businessType,
            clientCompanyName, hiringCategory, bio, pronouns, instagram, tiktok, youtube, credits,
            website, masterArtistTypes, masterStyles, artistServices, artistTransportationAccommodation,
            artswrkPro, artswrkBasic, priorityList, lateCancelCount, onboardingStep, userSignedUp, beta,
            stripeCustomerId, artistStripeAccountId, artistStripeReturnCode, artistStripeProductId,
              artistStripeDateCreated, clientStripeCustomerId, clientStripeCardId, clientSubscriptionId,
              clientPremium, bubbleCreatedAt, bubbleModifiedAt
            )`;
        const insertValues = [
          `bubble_${source._id}`,
          "bubble",
          "user",
          1,
          values[0],
          1,
          ...values.slice(1),
        ];
        const placeholders = insertValues.map(() => "?").join(", ");
        await conn.execute(
          `${insertColumns} VALUES (${placeholders})`,
          insertValues,
        );
      }

      processed += 1;
      if (processed % 250 === 0) process.stdout.write(`\rApplied ${processed}/${sourceUsers.length} users`);
    }
    process.stdout.write("\n");

    const [validationRows] = await conn.execute<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS flaggedRows,
        COUNT(DISTINCT bubbleId) AS distinctBubbleIds,
        SUM(userRole = 'Artist') AS artists,
        SUM(userRole = 'Client') AS clients,
        SUM(artswrkBasic = 1) AS basic,
        SUM(artswrkPro = 1) AS pro,
        SUM(clientPremium = 1) AS premiumClients
      FROM users
      WHERE bubbleSourcePresent = 1
    `);
    const validation = validationRows[0];
    if (Number(validation.flaggedRows) !== sourceUsers.length || Number(validation.distinctBubbleIds) !== sourceIds.size) {
      throw new Error(`Validation failed: ${JSON.stringify(validation)}`);
    }

    await conn.commit();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/home/ubuntu/artswrk-backups/user-sync-${timestamp}.json`;
    const report = { appliedAt: new Date().toISOString(), planned, validation };
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`REPORT=${outputPath}`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
