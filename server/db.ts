import { and, desc, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, interestedArtists, jobs, users } from "../drizzle/schema";
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

// ── Interested Artists queries ────────────────────────────────────────────────

/**
 * Get all interested artist records for a client, optionally filtered by job.
 */
export async function getInterestedArtistsByClientId(
  clientUserId: number,
  limit = 100,
  offset = 0,
  statusFilter?: string[],
  jobId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(interestedArtists.clientUserId, clientUserId)];
  if (statusFilter && statusFilter.length > 0) {
    const statusConds = statusFilter.map(s => eq(interestedArtists.status, s));
    conditions.push(or(...statusConds)!);
  }
  if (jobId !== undefined) {
    conditions.push(eq(interestedArtists.jobId, jobId));
  }

  return db
    .select()
    .from(interestedArtists)
    .where(and(...conditions))
    .orderBy(desc(interestedArtists.bubbleCreatedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get applicant stats for a client (counts by status).
 */
export async function getApplicantStatsByClientId(clientUserId: number) {
  const db = await getDb();
  if (!db) return { total: 0, interested: 0, confirmed: 0, declined: 0 };

  const result = await db
    .select({
      status: interestedArtists.status,
      count: sql<number>`COUNT(*)`
    })
    .from(interestedArtists)
    .where(eq(interestedArtists.clientUserId, clientUserId))
    .groupBy(interestedArtists.status);

  const stats = { total: 0, interested: 0, confirmed: 0, declined: 0 };
  for (const row of result) {
    const count = Number(row.count);
    stats.total += count;
    if (row.status === 'Interested') stats.interested += count;
    if (row.status === 'Confirmed') stats.confirmed += count;
    if (row.status === 'Declined') stats.declined += count;
  }
  return stats;
}

/**
 * Get applicants for a specific job.
 */
export async function getApplicantsByJobId(jobId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(interestedArtists)
    .where(eq(interestedArtists.jobId, jobId))
    .orderBy(desc(interestedArtists.bubbleCreatedAt))
    .limit(limit)
    .offset(offset);
}

// ── Booking queries ───────────────────────────────────────────────────────────

import { bookings } from "../drizzle/schema";

/**
 * Get all bookings for a client, optionally filtered by status.
 */
export async function getBookingsByClientId(
  clientUserId: number,
  limit = 100,
  offset = 0,
  statusFilter?: string[]
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(bookings.clientUserId, clientUserId)];
  if (statusFilter && statusFilter.length > 0) {
    const statusConds = statusFilter.map(s => eq(bookings.bookingStatus, s));
    conditions.push(or(...statusConds)!);
  }

  return db
    .select()
    .from(bookings)
    .where(and(...conditions))
    .orderBy(desc(bookings.startDate))
    .limit(limit)
    .offset(offset);
}

/**
 * Get booking stats for a client (counts by status + financial totals).
 */
export async function getBookingStatsByClientId(clientUserId: number) {
  const db = await getDb();
  if (!db) return { total: 0, confirmed: 0, completed: 0, cancelled: 0, paid: 0, unpaid: 0, totalRevenue: 0 };

  const statusResult = await db
    .select({
      bookingStatus: bookings.bookingStatus,
      paymentStatus: bookings.paymentStatus,
      count: sql<number>`COUNT(*)`,
      sumClientRate: sql<number>`SUM(COALESCE(totalClientRate, clientRate, 0))`,
    })
    .from(bookings)
    .where(eq(bookings.clientUserId, clientUserId))
    .groupBy(bookings.bookingStatus, bookings.paymentStatus);

  const stats = { total: 0, confirmed: 0, completed: 0, cancelled: 0, paid: 0, unpaid: 0, totalRevenue: 0 };
  for (const row of statusResult) {
    const count = Number(row.count);
    stats.total += count;
    if (row.bookingStatus === 'Confirmed') stats.confirmed += count;
    if (row.bookingStatus === 'Completed') stats.completed += count;
    if (row.bookingStatus === 'Cancelled') stats.cancelled += count;
    if (row.paymentStatus === 'Paid') {
      stats.paid += count;
      stats.totalRevenue += Number(row.sumClientRate ?? 0);
    }
    if (row.paymentStatus === 'Unpaid') stats.unpaid += count;
  }
  return stats;
}

/**
 * Get bookings for a specific job.
 */
export async function getBookingsByJobId(jobId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(bookings)
    .where(eq(bookings.jobId, jobId))
    .orderBy(desc(bookings.startDate))
    .limit(limit)
    .offset(offset);
}

/**
 * Get a single booking by its local ID.
 */
export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get booking linked to an interested artist record.
 */
export async function getBookingByInterestedArtistId(interestedArtistId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.interestedArtistId, interestedArtistId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}
