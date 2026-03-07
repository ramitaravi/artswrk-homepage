import { and, desc, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, jobs, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Artswrk-specific queries ──────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByBubbleId(bubbleId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.bubbleId, bubbleId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).limit(limit).offset(offset);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Job queries ──────────────────────────────────────────────────────────────

/**
 * Get all jobs for a given local user ID, ordered by most recently created.
 */
export async function getJobsByUserId(
  userId: number,
  limit = 50,
  offset = 0,
  statusFilter?: string[]
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(jobs.clientUserId, userId)];
  if (statusFilter && statusFilter.length > 0) {
    // Build OR conditions for each status
    const statusConditions = statusFilter.map(s => eq(jobs.requestStatus, s));
    conditions.push(or(...statusConditions)!);
  }

  return db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.bubbleCreatedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get job stats for a user (counts by status).
 */
export async function getJobStatsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, confirmed: 0, completed: 0 };

  const result = await db
    .select({
      requestStatus: jobs.requestStatus,
      count: sql<number>`COUNT(*)`
    })
    .from(jobs)
    .where(eq(jobs.clientUserId, userId))
    .groupBy(jobs.requestStatus);

  const stats = { total: 0, active: 0, confirmed: 0, completed: 0 };
  for (const row of result) {
    const count = Number(row.count);
    stats.total += count;
    if (row.requestStatus === 'Active') stats.active += count;
    if (row.requestStatus === 'Confirmed') stats.confirmed += count;
    if (row.requestStatus === 'Completed') stats.completed += count;
  }
  return stats;
}

/**
 * Get all public (active) jobs for the /jobs listing page.
 */
export async function getPublicJobs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(jobs)
    .where(or(
      eq(jobs.requestStatus, 'Active'),
      eq(jobs.requestStatus, 'Confirmed'),
    ))
    .orderBy(desc(jobs.bubbleCreatedAt))
    .limit(limit)
    .offset(offset);
}

export async function setUserPassword(
  userId: number,
  passwordHash: string,
  isTemporary: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ passwordHash, passwordIsTemporary: isTemporary, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
