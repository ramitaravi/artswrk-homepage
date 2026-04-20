import { and, asc, desc, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ClientCompany, EnterpriseJobUnlock, InsertClientCompany, InsertEnterpriseJobUnlock, InsertUser, bookings, clientCompanies, conversations, enterpriseJobUnlocks, interestedArtists, jobs, messages, payments, premiumJobInterestedArtists, premiumJobs, users } from "../drizzle/schema";
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
    // IMPORTANT: When role is not explicitly provided, do NOT include role in updateSet.
    // This preserves manually-set admin roles from being overwritten on each login.
    // The INSERT default is 'user', but ON DUPLICATE KEY UPDATE will only touch role
    // if it was explicitly set above.

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

/**
 * Public job listings enriched with client info (company name + avatar).
 * Used by the /jobs listing page and the SEO job detail page.
 */
export async function getPublicJobsEnriched(limit = 100, offset = 0): Promise<{
  id: number;
  requestStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  dateType: string | null;
  isHourly: boolean | null;
  openRate: boolean | null;
  artistHourlyRate: number | null;
  clientHourlyRate: number | null;
  locationAddress: string | null;
  locationLat: string | null;
  locationLng: string | null;
  description: string | null;
  direct: boolean | null;
  bubbleCreatedAt: Date | null;
  // joined from users
  clientCompanyName: string | null;
  clientName: string | null;
  clientProfilePicture: string | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT j.id, j.requestStatus, j.startDate, j.endDate, j.dateType,
       j.isHourly, j.openRate, j.artistHourlyRate, j.clientHourlyRate,
       j.locationAddress, j.locationLat, j.locationLng,
       j.description, j.direct, j.bubbleCreatedAt,
       j.masterServiceTypeId,
       u.clientCompanyName, u.name as clientName,
       COALESCE(u.enterpriseLogoUrl, u.profilePicture) as clientProfilePicture
     FROM jobs j
     LEFT JOIN users u ON j.clientUserId = u.id
     WHERE j.requestStatus IN ('Active', 'Confirmed', 'Submissions Paused')
     ORDER BY j.bubbleCreatedAt DESC
     LIMIT ${limit} OFFSET ${offset}`
  );
  return (rows[0] as unknown as any[]);
}

/**
 * Get a single public job by ID enriched with client info.
 * Used for the SEO job detail page.
 */
export async function getJobDetailById(id: number): Promise<{
  id: number;
  requestStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  dateType: string | null;
  isHourly: boolean | null;
  openRate: boolean | null;
  artistHourlyRate: number | null;
  clientHourlyRate: number | null;
  locationAddress: string | null;
  locationLat: string | null;
  locationLng: string | null;
  description: string | null;
  direct: boolean | null;
  bubbleCreatedAt: Date | null;
  clientUserId: number | null;
  clientCompanyName: string | null;
  clientName: string | null;
  clientProfilePicture: string | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(
    `SELECT j.id, j.requestStatus, j.startDate, j.endDate, j.dateType,
       j.isHourly, j.openRate, j.artistHourlyRate, j.clientHourlyRate,
       j.locationAddress, j.locationLat, j.locationLng,
       j.description, j.direct, j.bubbleCreatedAt, j.clientUserId,
       u.clientCompanyName, u.name as clientName,
       COALESCE(u.enterpriseLogoUrl, u.profilePicture) as clientProfilePicture
     FROM jobs j
     LEFT JOIN users u ON j.clientUserId = u.id
     WHERE j.id = ${id}
     LIMIT 1`
  );
  const result = (rows[0] as unknown as any[])[0];
  return result ?? null;
}

/**
 * Get a logged-in artist's applications (interested_artists) with job info.
 */
export async function getArtistJobApplications(artistUserId: number, limit = 50, offset = 0): Promise<{
  id: number;
  status: string | null;
  createdAt: Date | null;
  jobId: number | null;
  description: string | null;
  locationAddress: string | null;
  startDate: Date | null;
  dateType: string | null;
  isHourly: boolean | null;
  openRate: boolean | null;
  artistHourlyRate: number | null;
  clientHourlyRate: number | null;
  requestStatus: string | null;
  clientCompanyName: string | null;
  clientProfilePicture: string | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT ia.id, ia.status, ia.createdAt, ia.jobId,
       j.description, j.locationAddress, j.startDate, j.dateType,
       j.isHourly, j.openRate, j.artistHourlyRate, j.clientHourlyRate,
       j.requestStatus,
       u.clientCompanyName,
       COALESCE(u.enterpriseLogoUrl, u.profilePicture) as clientProfilePicture
     FROM interested_artists ia
     JOIN jobs j ON ia.jobId = j.id
     LEFT JOIN users u ON j.clientUserId = u.id
     WHERE ia.artistUserId = ${artistUserId}
     ORDER BY ia.createdAt DESC
     LIMIT ${limit} OFFSET ${offset}`
  );
  return (rows[0] as unknown as any[]);
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

// Alias for the artist user join
const artistUser = users;

/**
 * Get all interested artist records for a client, optionally filtered by job.
 * JOINs on users table to include real artist name + photo.
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

  const rows = await db
    .select({
      // All interested_artists columns
      id: interestedArtists.id,
      bubbleId: interestedArtists.bubbleId,
      jobId: interestedArtists.jobId,
      bubbleRequestId: interestedArtists.bubbleRequestId,
      artistUserId: interestedArtists.artistUserId,
      bubbleArtistId: interestedArtists.bubbleArtistId,
      clientUserId: interestedArtists.clientUserId,
      bubbleClientId: interestedArtists.bubbleClientId,
      bubbleServiceId: interestedArtists.bubbleServiceId,
      bubbleBookingId: interestedArtists.bubbleBookingId,
      status: interestedArtists.status,
      converted: interestedArtists.converted,
      isHourlyRate: interestedArtists.isHourlyRate,
      artistHourlyRate: interestedArtists.artistHourlyRate,
      clientHourlyRate: interestedArtists.clientHourlyRate,
      artistFlatRate: interestedArtists.artistFlatRate,
      clientFlatRate: interestedArtists.clientFlatRate,
      totalHours: interestedArtists.totalHours,
      startDate: interestedArtists.startDate,
      endDate: interestedArtists.endDate,
      resumeLink: interestedArtists.resumeLink,
      message: interestedArtists.message,
      createdAt: interestedArtists.createdAt,
      updatedAt: interestedArtists.updatedAt,
      bubbleCreatedAt: interestedArtists.bubbleCreatedAt,
      bubbleModifiedAt: interestedArtists.bubbleModifiedAt,
      // Artist user fields
      artistFirstName: artistUser.firstName,
      artistLastName: artistUser.lastName,
      artistName: artistUser.name,
      artistProfilePicture: artistUser.profilePicture,
      artistSlug: artistUser.slug,
      artistAvailability: artistUser.optionAvailability,
    })
    .from(interestedArtists)
    .leftJoin(artistUser, eq(interestedArtists.artistUserId, artistUser.id))
    .where(and(...conditions))
    .orderBy(desc(interestedArtists.bubbleCreatedAt))
    .limit(limit)
    .offset(offset);

  return rows;
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

/**
 * Get all bookings for a client, optionally filtered by status.
 * JOINs on users table to include real artist name + photo.
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
    .select({
      // All bookings columns
      id: bookings.id,
      bubbleId: bookings.bubbleId,
      jobId: bookings.jobId,
      bubbleRequestId: bookings.bubbleRequestId,
      interestedArtistId: bookings.interestedArtistId,
      bubbleInterestedArtistId: bookings.bubbleInterestedArtistId,
      clientUserId: bookings.clientUserId,
      bubbleClientId: bookings.bubbleClientId,
      artistUserId: bookings.artistUserId,
      bubbleArtistId: bookings.bubbleArtistId,
      bookingStatus: bookings.bookingStatus,
      paymentStatus: bookings.paymentStatus,
      clientRate: bookings.clientRate,
      artistRate: bookings.artistRate,
      totalClientRate: bookings.totalClientRate,
      totalArtistRate: bookings.totalArtistRate,
      grossProfit: bookings.grossProfit,
      stripeFee: bookings.stripeFee,
      postFeeRevenue: bookings.postFeeRevenue,
      hours: bookings.hours,
      externalPayment: bookings.externalPayment,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      locationAddress: bookings.locationAddress,
      locationLat: bookings.locationLat,
      locationLng: bookings.locationLng,
      description: bookings.description,
      stripeCheckoutUrl: bookings.stripeCheckoutUrl,
      addedToSpreadsheet: bookings.addedToSpreadsheet,
      deleted: bookings.deleted,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
      bubbleCreatedAt: bookings.bubbleCreatedAt,
      bubbleModifiedAt: bookings.bubbleModifiedAt,
      // Artist user fields
      artistFirstName: artistUser.firstName,
      artistLastName: artistUser.lastName,
      artistName: artistUser.name,
      artistProfilePicture: artistUser.profilePicture,
      artistSlug: artistUser.slug,
      artistAvailability: artistUser.optionAvailability,
    })
    .from(bookings)
    .leftJoin(artistUser, eq(bookings.artistUserId, artistUser.id))
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

// ── Payment queries ───────────────────────────────────────────────────────────

/**
 * Get all payments for a client, joined with booking info.
 */
export async function getPaymentsByClientId(
  clientUserId: number,
  limit = 100,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: payments.id,
      bubbleId: payments.bubbleId,
      bookingId: payments.bookingId,
      bubbleBookingId: payments.bubbleBookingId,
      clientUserId: payments.clientUserId,
      stripeId: payments.stripeId,
      stripeStatus: payments.stripeStatus,
      status: payments.status,
      stripeAmount: payments.stripeAmount,
      stripeApplicationFee: payments.stripeApplicationFee,
      stripeApplicationFeeAmount: payments.stripeApplicationFeeAmount,
      stripeCardBrand: payments.stripeCardBrand,
      stripeCardLast4: payments.stripeCardLast4,
      stripeCardName: payments.stripeCardName,
      stripeDescription: payments.stripeDescription,
      stripeReceiptUrl: payments.stripeReceiptUrl,
      stripeRefundUrl: payments.stripeRefundUrl,
      paymentDate: payments.paymentDate,
      createdAt: payments.createdAt,
      bubbleCreatedAt: payments.bubbleCreatedAt,
      // Booking fields for context
      bookingStartDate: bookings.startDate,
      bookingStatus: bookings.bookingStatus,
      bookingDescription: bookings.description,
      // Artist fields
      artistFirstName: artistUser.firstName,
      artistLastName: artistUser.lastName,
      artistName: artistUser.name,
      artistProfilePicture: artistUser.profilePicture,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(artistUser, eq(bookings.artistUserId, artistUser.id))
    .where(eq(payments.clientUserId, clientUserId))
    .orderBy(desc(payments.paymentDate))
    .limit(limit)
    .offset(offset);
}

/**
 * Get payment stats for a client.
 */
export async function getPaymentStatsByClientId(clientUserId: number) {
  const db = await getDb();
  if (!db) return { total: 0, succeeded: 0, totalAmount: 0, totalFees: 0 };

  const result = await db
    .select({
      stripeStatus: payments.stripeStatus,
      count: sql<number>`COUNT(*)`,
      sumAmount: sql<number>`SUM(COALESCE(stripeAmount, 0))`,
      sumFees: sql<number>`SUM(COALESCE(stripeApplicationFeeAmount, 0))`,
    })
    .from(payments)
    .where(eq(payments.clientUserId, clientUserId))
    .groupBy(payments.stripeStatus);

  const stats = { total: 0, succeeded: 0, totalAmount: 0, totalFees: 0 };
  for (const row of result) {
    const count = Number(row.count);
    stats.total += count;
    if (row.stripeStatus === 'succeeded') {
      stats.succeeded += count;
      stats.totalAmount += Number(row.sumAmount ?? 0);
      stats.totalFees += Number(row.sumFees ?? 0);
    }
  }
  return stats;
}

// ── Conversation + Message queries ────────────────────────────────────────────

/**
 * Get all conversations for a client, joined with artist info.
 * Ordered by last message date descending.
 */
export async function getConversationsByClientId(
  clientUserId: number,
  limit = 100,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: conversations.id,
      bubbleId: conversations.bubbleId,
      clientUserId: conversations.clientUserId,
      bubbleClientId: conversations.bubbleClientId,
      artistUserId: conversations.artistUserId,
      bubbleArtistId: conversations.bubbleArtistId,
      lastMessageDate: conversations.lastMessageDate,
      unreadCount: conversations.unreadCount,
      createdAt: conversations.createdAt,
      bubbleCreatedAt: conversations.bubbleCreatedAt,
      // Artist fields
      artistFirstName: artistUser.firstName,
      artistLastName: artistUser.lastName,
      artistName: artistUser.name,
      artistProfilePicture: artistUser.profilePicture,
      artistSlug: artistUser.slug,
    })
    .from(conversations)
    .leftJoin(artistUser, eq(conversations.artistUserId, artistUser.id))
    .where(eq(conversations.clientUserId, clientUserId))
    .orderBy(desc(conversations.lastMessageDate))
    .limit(limit)
    .offset(offset);
}

/**
 * Get all messages for a conversation, ordered chronologically.
 */
export async function getMessagesByConversationId(
  conversationId: number,
  limit = 200,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];

  // Use a separate alias for sender user
  const senderUser = users;

  return db
    .select({
      id: messages.id,
      bubbleId: messages.bubbleId,
      conversationId: messages.conversationId,
      senderUserId: messages.senderUserId,
      bubbleSentById: messages.bubbleSentById,
      content: messages.content,
      isSystem: messages.isSystem,
      createdAt: messages.createdAt,
      bubbleCreatedAt: messages.bubbleCreatedAt,
      // Sender info
      senderFirstName: senderUser.firstName,
      senderLastName: senderUser.lastName,
      senderName: senderUser.name,
      senderProfilePicture: senderUser.profilePicture,
      senderUserRole: senderUser.userRole,
    })
    .from(messages)
    .leftJoin(senderUser, eq(messages.senderUserId, senderUser.id))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.bubbleCreatedAt)
    .limit(limit)
    .offset(offset);
}

/**
 * Get message stats for a client.
 */
export async function getMessageStatsByClientId(clientUserId: number) {
  const db = await getDb();
  if (!db) return { totalConversations: 0, totalMessages: 0, unreadMessages: 0 };

  const convoResult = await db
    .select({
      totalConversations: sql<number>`COUNT(*)`,
      unreadMessages: sql<number>`SUM(COALESCE(unreadCount, 0))`,
    })
    .from(conversations)
    .where(eq(conversations.clientUserId, clientUserId));

  const msgResult = await db
    .select({ totalMessages: sql<number>`COUNT(*)` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.clientUserId, clientUserId));

  return {
    totalConversations: Number(convoResult[0]?.totalConversations ?? 0),
    totalMessages: Number(msgResult[0]?.totalMessages ?? 0),
    unreadMessages: Number(convoResult[0]?.unreadMessages ?? 0),
  };
}

// ── Wallet / Payment helpers ──────────────────────────────────────────────────

/**
 * Get wallet stats for the Payments page:
 * - totalSpent: sum of clientRate for all completed/confirmed/pay-now bookings
 * - futurePayments: sum of clientRate for confirmed bookings (upcoming)
 * - pendingCount: number of "Pay Now" bookings
 * - totalPaidAmount: sum of stripeAmount (cents) for succeeded payments → divide by 100 for dollars
 */
export async function getWalletStatsByClientId(clientUserId: number) {
  const db = await getDb();
  if (!db) return { totalSpent: 0, futurePayments: 0, pendingCount: 0, totalPaidAmount: 0 };

  const [totalRow] = await db
    .select({ total: sql<number>`SUM(COALESCE(clientRate, 0))` })
    .from(bookings)
    .where(and(
      eq(bookings.clientUserId, clientUserId),
      inArray(bookings.bookingStatus, ['Completed', 'Confirmed', 'Pay Now'])
    ));

  const [futureRow] = await db
    .select({ total: sql<number>`SUM(COALESCE(clientRate, 0))` })
    .from(bookings)
    .where(and(
      eq(bookings.clientUserId, clientUserId),
      eq(bookings.bookingStatus, 'Confirmed')
    ));

  const [pendingRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bookings)
    .where(and(
      eq(bookings.clientUserId, clientUserId),
      eq(bookings.bookingStatus, 'Pay Now')
    ));

  const [paidRow] = await db
    .select({ total: sql<number>`SUM(COALESCE(stripeAmount, 0))` })
    .from(payments)
    .where(and(
      eq(payments.clientUserId, clientUserId),
      eq(payments.stripeStatus, 'succeeded')
    ));

  return {
    totalSpent: Number(totalRow?.total ?? 0),
    futurePayments: Number(futureRow?.total ?? 0),
    pendingCount: Number(pendingRow?.count ?? 0),
    // stripeAmount is in cents — divide by 100 for dollars
    totalPaidAmount: Number(paidRow?.total ?? 0) / 100,
  };
}

/**
 * Get pending "Pay Now" bookings for the client, joined with artist info.
 */
export async function getPendingPaymentsByClientId(clientUserId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: bookings.id,
      clientRate: bookings.clientRate,
      startDate: bookings.startDate,
      bookingStatus: bookings.bookingStatus,
      stripeCheckoutUrl: bookings.stripeCheckoutUrl,
      artistFirstName: artistUser.firstName,
      artistLastName: artistUser.lastName,
      artistName: artistUser.name,
      artistProfilePicture: artistUser.profilePicture,
      artistSlug: artistUser.slug,
    })
    .from(bookings)
    .leftJoin(artistUser, eq(bookings.artistUserId, artistUser.id))
    .where(and(
      eq(bookings.clientUserId, clientUserId),
      eq(bookings.bookingStatus, 'Pay Now')
    ))
    .orderBy(bookings.startDate);
}

// ── Artist Profile Queries ─────────────────────────────────────────────────────

/** Get a single artist user by their local DB id */
export async function getArtistById(artistId: number) {
  const db = await getDb();
  if (!db) return null;

  const [artist] = await db
    .select()
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  return artist ?? null;
}

/** Get a single artist user by their Bubble ID */
export async function getArtistByBubbleId(bubbleId: string) {
  const db = await getDb();
  if (!db) return null;

  const [artist] = await db
    .select()
    .from(users)
    .where(eq(users.bubbleId, bubbleId))
    .limit(1);

  return artist ?? null;
}

/** Get an artist's full history with a specific client:
 *  - jobs they applied to
 *  - bookings
 *  - conversations
 */
export async function getArtistHistoryForClient(artistUserId: number, clientUserId: number) {
  const db = await getDb();
  if (!db) return { applications: [], bookings: [], conversations: [] };

  // Applications (interested artists)
  const applications = await db
    .select({
      id: interestedArtists.id,
      status: interestedArtists.status,
      startDate: interestedArtists.startDate,
      endDate: interestedArtists.endDate,
      artistHourlyRate: interestedArtists.artistHourlyRate,
      clientHourlyRate: interestedArtists.clientHourlyRate,
      artistFlatRate: interestedArtists.artistFlatRate,
      clientFlatRate: interestedArtists.clientFlatRate,
      message: interestedArtists.message,
      resumeLink: interestedArtists.resumeLink,
      bubbleCreatedAt: interestedArtists.bubbleCreatedAt,
      jobId: interestedArtists.jobId,
      jobDescription: jobs.description,
      jobLocationAddress: jobs.locationAddress,
      jobStartDate: jobs.startDate,
    })
    .from(interestedArtists)
    .leftJoin(jobs, eq(interestedArtists.jobId, jobs.id))
    .where(and(
      eq(interestedArtists.artistUserId, artistUserId),
      eq(interestedArtists.clientUserId, clientUserId),
    ))
    .orderBy(desc(interestedArtists.bubbleCreatedAt));

  // Bookings
  const artistBookings = await db
    .select({
      id: bookings.id,
      bookingStatus: bookings.bookingStatus,
      clientRate: bookings.clientRate,
      artistRate: bookings.artistRate,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      locationAddress: bookings.locationAddress,
      stripeCheckoutUrl: bookings.stripeCheckoutUrl,
      bubbleCreatedAt: bookings.bubbleCreatedAt,
    })
    .from(bookings)
    .where(and(
      eq(bookings.artistUserId, artistUserId),
      eq(bookings.clientUserId, clientUserId),
    ))
    .orderBy(desc(bookings.bubbleCreatedAt));

  // Conversations
  const artistConversations = await db
    .select({
      id: conversations.id,
      lastMessageDate: conversations.lastMessageDate,
      unreadCount: conversations.unreadCount,
      bubbleCreatedAt: conversations.bubbleCreatedAt,
    })
    .from(conversations)
    .where(and(
      eq(conversations.artistUserId, artistUserId),
      eq(conversations.clientUserId, clientUserId),
    ))
    .orderBy(desc(conversations.bubbleCreatedAt));

  return {
    applications,
    bookings: artistBookings,
    conversations: artistConversations,
  };
}

// ── Job Creation ──────────────────────────────────────────────────────────────

export interface CreateJobInput {
  clientUserId?: number;
  clientEmail?: string;
  description?: string;
  locationAddress?: string;
  locationLat?: string;
  locationLng?: string;
  dateType?: string;
  startDate?: Date;
  endDate?: Date;
  isHourly?: boolean;
  openRate?: boolean;
  clientHourlyRate?: number;
  artistHourlyRate?: number;
  transportation?: boolean;
  /** Job status — "Pending Payment" until Stripe confirms, then "Active" */
  requestStatus?: string;
  slug?: string;
}

/**
 * Insert a new job row and return the created record.
 */
export async function createJob(input: CreateJobInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db
    .insert(jobs)
    .values({
      clientUserId: input.clientUserId,
      clientEmail: input.clientEmail,
      description: input.description,
      locationAddress: input.locationAddress,
      locationLat: input.locationLat,
      locationLng: input.locationLng,
      dateType: input.dateType ?? "Single Date",
      startDate: input.startDate,
      endDate: input.endDate,
      isHourly: input.isHourly ?? true,
      openRate: input.openRate ?? false,
      clientHourlyRate: input.clientHourlyRate,
      artistHourlyRate: input.artistHourlyRate,
      transportation: input.transportation ?? false,
      requestStatus: input.requestStatus ?? "Pending Payment",
      slug: input.slug,
    });
  const newId = (result as { insertId: number }).insertId;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, newId));
  return job;
}

/**
 * Activate a job after successful Stripe payment.
 */
export async function activateJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(jobs)
    .set({ requestStatus: "Active" })
    .where(eq(jobs.id, jobId));
}

/**
 * Save Stripe customer ID on the user record (client side).
 */
export async function saveClientStripeCustomerId(userId: number, stripeCustomerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ clientStripeCustomerId: stripeCustomerId })
    .where(eq(users.id, userId));
}

/**
 * Save Stripe subscription ID on the user record (client side).
 */
export async function saveClientSubscriptionId(userId: number, subscriptionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ clientSubscriptionId: subscriptionId, clientPremium: true })
    .where(eq(users.id, userId));
}

/**
 * Create a brand-new user account (self-signup).
 * Generates a unique openId prefixed "local_" and stores the bcrypt hash.
 */
export async function createNewUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}): Promise<{ id: number; openId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check for duplicate email
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) throw new Error("EMAIL_TAKEN");

  const { randomUUID } = await import("crypto");
  const openId = `local_${randomUUID()}`;
  const name = `${input.firstName} ${input.lastName}`.trim();

  const result = await db.insert(users).values({
    openId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    name,
    passwordHash: input.passwordHash,
    passwordIsTemporary: false,
    userRole: "Client",
    userSignedUp: true,
    onboardingStep: 1,
    lastSignedIn: new Date(),
  });
  const newId = (result as any).insertId as number;
  return { id: newId, openId };
}

/**
 * Save onboarding data to the user record.
 */
export async function updateUserOnboarding(userId: number, data: {
  businessOrIndividual?: string;
  hiringCategory?: string;
  clientCompanyName?: string;
  location?: string;
  website?: string;
  phoneNumber?: string;
  onboardingStep?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = {};
  if (data.businessOrIndividual !== undefined) updateData.businessOrIndividual = data.businessOrIndividual;
  if (data.hiringCategory !== undefined) updateData.hiringCategory = data.hiringCategory;
  if (data.clientCompanyName !== undefined) updateData.clientCompanyName = data.clientCompanyName;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.website !== undefined) updateData.website = data.website;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
  if (data.onboardingStep !== undefined) updateData.onboardingStep = data.onboardingStep;
  await db.update(users).set(updateData as any).where(eq(users.id, userId));
}

/**
 * Activate a boost on a job after successful Stripe payment.
 */
export async function activateBoost(jobId: number, data: {
  dailyBudget: number;
  durationDays: number;
  stripeSessionId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const endDate = new Date(now.getTime() + data.durationDays * 24 * 60 * 60 * 1000);
  await db.update(jobs).set({
    isBoosted: true,
    boostDailyBudget: data.dailyBudget,
    boostDurationDays: data.durationDays,
    boostStartDate: now,
    boostEndDate: endDate,
    boostStripeSessionId: data.stripeSessionId,
  }).where(eq(jobs.id, jobId));
}

/**
 * Get a single job by ID.
 */
export async function getJobById(jobId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Browse all artists (userRole = 'Artist') with optional search and filter.
 */
export async function getArtistsList({
  limit = 50,
  offset = 0,
  search,
  artistType,
}: {
  limit?: number;
  offset?: number;
  search?: string;
  artistType?: string;
}) {
  const db = await getDb();
  if (!db) return { artists: [], total: 0 };

  const conditions = [
    eq(users.userRole, "Artist"),
    // Only show artists with at least a name or firstName populated
    or(
      and(isNotNull(users.firstName), sql`${users.firstName} != ''`),
      and(isNotNull(users.name), sql`${users.name} != ''`),
    )!,
  ];

  if (search) {
    const q = `%${search}%`;
    conditions.push(
      or(
        like(users.firstName, q),
        like(users.lastName, q),
        like(users.name, q),
        like(users.slug, q),
        like(users.location, q),
      )!
    );
  }

  if (artistType) {
    conditions.push(
      or(
        like(users.masterArtistTypes, `%${artistType}%`),
        like(users.artistServices, `%${artistType}%`),
        like(users.artistDisciplines, `%${artistType}%`),
      )!
    );
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(where);

  const artists = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      slug: users.slug,
      profilePicture: users.profilePicture,
      location: users.location,
      bio: users.bio,
      masterArtistTypes: users.masterArtistTypes,
      artistServices: users.artistServices,
      artistDisciplines: users.artistDisciplines,
      artswrkPro: users.artswrkPro,
      instagram: users.instagram,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.artswrkPro), desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return { artists, total: Number(countRow?.count ?? 0) };
}

// ── Admin Helpers ─────────────────────────────────────────────────────────────

/** Overview stats for the admin dashboard */
export async function getAdminOverviewStats() {
  const db = await getDb();
  if (!db) return null;

  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [totalArtists] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.userRole, "Artist"));
  const [totalClients] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.userRole, "Client"));
  const [proArtists] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.userRole, "Artist"), eq(users.artswrkPro, true)));
  const [basicArtists] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.userRole, "Artist"), eq(users.artswrkBasic, true)));
  const [premiumClients] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.userRole, "Client"), eq(users.clientPremium, true)));
  const [totalBookings] = await db.select({ count: sql<number>`count(*)` }).from(bookings).where(eq(bookings.deleted, false));
  const [totalJobs] = await db.select({ count: sql<number>`count(*)` }).from(jobs);

  // Revenue = sum of all paid payments
  const [revenueRow] = await db
    .select({ total: sql<number>`coalesce(sum(stripeAmount), 0)` })
    .from(payments)
    .where(eq(payments.status, "Success"));

  // Commission = sum of application fees
  const [commissionRow] = await db
    .select({ total: sql<number>`coalesce(sum(stripeApplicationFeeAmount), 0)` })
    .from(payments)
    .where(eq(payments.status, "Success"));

  // Future revenue = sum of confirmed/unpaid bookings clientRate
  const [futureRevenueRow] = await db
    .select({ total: sql<number>`coalesce(sum(clientRate), 0)` })
    .from(bookings)
    .where(and(eq(bookings.bookingStatus, "Confirmed"), eq(bookings.paymentStatus, "Unpaid"), eq(bookings.deleted, false)));

  return {
    totalUsers: Number(totalUsers?.count ?? 0),
    totalArtists: Number(totalArtists?.count ?? 0),
    totalClients: Number(totalClients?.count ?? 0),
    proArtists: Number(proArtists?.count ?? 0),
    basicArtists: Number(basicArtists?.count ?? 0),
    premiumClients: Number(premiumClients?.count ?? 0),
    totalBookings: Number(totalBookings?.count ?? 0),
    totalJobs: Number(totalJobs?.count ?? 0),
    totalRevenueCents: Number(revenueRow?.total ?? 0),
    totalCommissionCents: Number(commissionRow?.total ?? 0),
    futureRevenueCents: Number(futureRevenueRow?.total ?? 0),
  };
}

/** Admin: list all artists with search + filters */
export async function getAdminArtists({
  search,
  locationSearch,
  artistType,
  state,
  plan,
  limit = 50,
  offset = 0,
}: {
  search?: string;
  locationSearch?: string;
  artistType?: string;
  state?: string;
  plan?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { artists: [], total: 0 };

  const conditions = [
    eq(users.userRole, "Artist"),
    // Only show artists with at least a name or firstName populated
    or(
      and(isNotNull(users.firstName), sql`${users.firstName} != ''`),
      and(isNotNull(users.name), sql`${users.name} != ''`),
    )!,
  ];
  if (search) conditions.push(or(like(users.name, `%${search}%`), like(users.firstName, `%${search}%`), like(users.lastName, `%${search}%`), like(users.email, `%${search}%`))!);
  if (locationSearch) conditions.push(like(users.location, `%${locationSearch}%`));
  if (artistType) conditions.push(like(users.masterArtistTypes, `%${artistType}%`));
  if (state) conditions.push(like(users.location, `%${state}%`));
  if (plan === "PRO") conditions.push(eq(users.artswrkPro, true));
  if (plan === "Basic") conditions.push(eq(users.artswrkBasic, true));

  const where = and(...conditions);

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where);
  const artists = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      slug: users.slug,
      profilePicture: users.profilePicture,
      location: users.location,
      masterArtistTypes: users.masterArtistTypes,
      artistServices: users.artistServices,
      artswrkPro: users.artswrkPro,
      artswrkBasic: users.artswrkBasic,
      createdAt: users.createdAt,
      bubbleCreatedAt: users.bubbleCreatedAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return { artists, total: Number(countRow?.count ?? 0) };
}

/** Admin: list all clients with search + filters */
export async function getAdminClients({
  search,
  companySearch,
  locationSearch,
  hiringCategory,
  state,
  plan,
  businessType,
  limit = 50,
  offset = 0,
}: {
  search?: string;
  companySearch?: string;
  locationSearch?: string;
  hiringCategory?: string;
  state?: string;
  plan?: string;
  businessType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { clients: [], total: 0 };

  const conditions = [eq(users.userRole, "Client")];
  if (search) conditions.push(or(like(users.name, `%${search}%`), like(users.firstName, `%${search}%`), like(users.lastName, `%${search}%`))!);
  if (companySearch) conditions.push(like(users.clientCompanyName, `%${companySearch}%`));
  if (locationSearch) conditions.push(like(users.location, `%${locationSearch}%`));
  if (hiringCategory) conditions.push(like(users.hiringCategory, `%${hiringCategory}%`));
  if (state) conditions.push(like(users.location, `%${state}%`));
  if (plan === "Premium") conditions.push(eq(users.clientPremium, true));
  if (businessType) conditions.push(eq(users.businessOrIndividual, businessType));

  const where = and(...conditions);

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where);
  const clients = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      slug: users.slug,
      profilePicture: users.profilePicture,
      location: users.location,
      clientCompanyName: users.clientCompanyName,
      clientPremium: users.clientPremium,
      hiringCategory: users.hiringCategory,
      businessOrIndividual: users.businessOrIndividual,
      createdAt: users.createdAt,
      bubbleCreatedAt: users.bubbleCreatedAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return { clients, total: Number(countRow?.count ?? 0) };
}

/** Admin: list all jobs with search + filters */
export async function getAdminJobs({
  search,
  companySearch,
  artistSearch,
  locationSearch,
  service,
  status,
  state,
  limit = 50,
  offset = 0,
}: {
  search?: string;
  companySearch?: string;
  artistSearch?: string;
  locationSearch?: string;
  service?: string;
  status?: string;
  state?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { jobs: [], total: 0 };

  const conditions: ReturnType<typeof eq>[] = [];
  if (search) conditions.push(like(users.name, `%${search}%`) as any);
  if (companySearch) conditions.push(like(users.clientCompanyName, `%${companySearch}%`) as any);
  if (locationSearch) conditions.push(like(jobs.locationAddress, `%${locationSearch}%`) as any);
  if (status) conditions.push(eq(jobs.requestStatus, status) as any);
  if (state) conditions.push(like(jobs.locationAddress, `%${state}%`) as any);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .leftJoin(users, eq(jobs.clientUserId, users.id))
    .where(where);

  const rows = await db
    .select({
      id: jobs.id,
      description: jobs.description,
      locationAddress: jobs.locationAddress,
      requestStatus: jobs.requestStatus,
      clientHourlyRate: jobs.clientHourlyRate,
      isHourly: jobs.isHourly,
      openRate: jobs.openRate,
      startDate: jobs.startDate,
      createdAt: jobs.createdAt,
      bubbleCreatedAt: jobs.bubbleCreatedAt,
      clientUserId: jobs.clientUserId,
      clientEmail: jobs.clientEmail,
      // client info
      clientName: users.name,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      clientCompanyName: users.clientCompanyName,
    })
    .from(jobs)
    .leftJoin(users, eq(jobs.clientUserId, users.id))
    .where(where)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  return { jobs: rows, total: Number(countRow?.count ?? 0) };
}

/** Admin: list all bookings with filters */
export async function getAdminBookings({
  upcoming,
  paymentStatus,
  bookingStatus,
  artistSearch,
  clientSearch,
  companySearch,
  limit = 50,
  offset = 0,
}: {
  upcoming?: boolean;
  paymentStatus?: string;
  bookingStatus?: string;
  artistSearch?: string;
  clientSearch?: string;
  companySearch?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { bookings: [], total: 0 };

  const now = new Date();
  const conditions = [eq(bookings.deleted, false)];
  if (upcoming === true) conditions.push(sql`${bookings.startDate} >= ${now}` as any);
  if (upcoming === false) conditions.push(sql`${bookings.startDate} < ${now}` as any);
  if (paymentStatus) conditions.push(eq(bookings.paymentStatus, paymentStatus) as any);
  if (bookingStatus) conditions.push(eq(bookings.bookingStatus, bookingStatus) as any);

  const where = and(...conditions);

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(bookings).where(where);

  const rows = await db
    .select({
      id: bookings.id,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      bookingStatus: bookings.bookingStatus,
      paymentStatus: bookings.paymentStatus,
      clientRate: bookings.clientRate,
      artistRate: bookings.artistRate,
      grossProfit: bookings.grossProfit,
      stripeFee: bookings.stripeFee,
      postFeeRevenue: bookings.postFeeRevenue,
      externalPayment: bookings.externalPayment,
      clientUserId: bookings.clientUserId,
      artistUserId: bookings.artistUserId,
      jobId: bookings.jobId,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(where)
    .orderBy(desc(bookings.startDate))
    .limit(limit)
    .offset(offset);

  return { bookings: rows, total: Number(countRow?.count ?? 0) };
}

/** Admin: recent payments paginated */
// ── Premium Jobs helpers ────────────────────────────────────────────────────

/**
 * Get all premium jobs created by a specific user (enterprise client).
 * Returns full job details ordered by creation date desc.
 */
/**
 * Get a single premium job by its ID.
 */
export async function getPremiumJobById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(premiumJobs)
    .where(eq(premiumJobs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPremiumJobsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(premiumJobs)
    .where(eq(premiumJobs.createdByUserId, userId))
    .orderBy(desc(premiumJobs.createdAt));
}

/**
 * Get all premium jobs (for admin or public browse).
 */
export async function getAllPremiumJobs({
  limit = 50,
  offset = 0,
  status,
  search,
  clientUserId,
}: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  clientUserId?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { jobs: [], total: 0 };

  // Build WHERE conditions
  const conditions = [];
  if (status) conditions.push(eq(premiumJobs.status, status));
  if (clientUserId) conditions.push(eq(premiumJobs.createdByUserId, clientUserId));
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      sql`(${premiumJobs.company} LIKE ${like} OR ${premiumJobs.serviceType} LIKE ${like} OR ${premiumJobs.category} LIKE ${like})`
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Also fetch interested artist counts per job
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(premiumJobs)
    .where(where);

  const rows = await db
    .select()
    .from(premiumJobs)
    .where(where)
    .orderBy(desc(premiumJobs.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch interested artist counts for these jobs
  const jobIds = rows.map((j) => j.id);
  let countMap: Record<number, number> = {};
  if (jobIds.length > 0) {
    const counts = await db
      .select({
        premiumJobId: premiumJobInterestedArtists.premiumJobId,
        count: sql<number>`count(*)`,
      })
      .from(premiumJobInterestedArtists)
      .where(sql`${premiumJobInterestedArtists.premiumJobId} IN (${sql.join(jobIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(premiumJobInterestedArtists.premiumJobId);
    for (const c of counts) countMap[c.premiumJobId] = Number(c.count);
  }

  return {
    jobs: rows.map((j) => ({ ...j, interestedCount: countMap[j.id] ?? 0 })),
    total: Number(countRow?.count ?? 0),
  };
}

/**
 * Get interested artists for a specific premium job.
 */
export async function getPremiumJobInterestedArtists(premiumJobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: premiumJobInterestedArtists.id,
      premiumJobId: premiumJobInterestedArtists.premiumJobId,
      artistUserId: premiumJobInterestedArtists.artistUserId,
      bubbleArtistId: premiumJobInterestedArtists.bubbleArtistId,
      createdAt: premiumJobInterestedArtists.createdAt,
      // application-specific fields
      message: premiumJobInterestedArtists.message,
      rate: premiumJobInterestedArtists.rate,
      resumeLink: premiumJobInterestedArtists.resumeLink,
      status: premiumJobInterestedArtists.status,
      bubbleInterestedArtistId: premiumJobInterestedArtists.bubbleInterestedArtistId,
      // artist info
      artistName: users.name,
      artistFirstName: users.firstName,
      artistLastName: users.lastName,
      artistEmail: users.email,
      artistProfilePicture: users.profilePicture,
      artistLocation: users.location,
      artistBio: users.bio,
      artistDisciplines: users.artistDisciplines,
      artistSlug: users.slug,
      artswrkPro: users.artswrkPro,
    })
    .from(premiumJobInterestedArtists)
    .leftJoin(users, eq(premiumJobInterestedArtists.artistUserId, users.id))
    .where(eq(premiumJobInterestedArtists.premiumJobId, premiumJobId));
}

/**
 * Get all interested artists across all premium jobs created by a user.
 */
export async function getPremiumInterestedArtistsByCreatorId(creatorUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: premiumJobInterestedArtists.id,
      premiumJobId: premiumJobInterestedArtists.premiumJobId,
      artistUserId: premiumJobInterestedArtists.artistUserId,
      bubbleArtistId: premiumJobInterestedArtists.bubbleArtistId,
      createdAt: premiumJobInterestedArtists.createdAt,
      // job info
      jobTitle: premiumJobs.serviceType,
      jobCompany: premiumJobs.company,
      // artist info
      artistName: users.name,
      artistFirstName: users.firstName,
      artistLastName: users.lastName,
      artistProfilePicture: users.profilePicture,
      artistLocation: users.location,
      artswrkPro: users.artswrkPro,
    })
    .from(premiumJobInterestedArtists)
    .innerJoin(premiumJobs, eq(premiumJobInterestedArtists.premiumJobId, premiumJobs.id))
    .leftJoin(users, eq(premiumJobInterestedArtists.artistUserId, users.id))
    .where(eq(premiumJobs.createdByUserId, creatorUserId))
    .orderBy(desc(premiumJobInterestedArtists.createdAt));
}

export async function getAdminPayments({
  limit = 50,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { payments: [], total: 0 };

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(payments);

  const rows = await db
    .select({
      id: payments.id,
      stripeId: payments.stripeId,
      status: payments.status,
      stripeStatus: payments.stripeStatus,
      stripeAmount: payments.stripeAmount,
      stripeApplicationFeeAmount: payments.stripeApplicationFeeAmount,
      paymentDate: payments.paymentDate,
      createdAt: payments.createdAt,
      clientUserId: payments.clientUserId,
      bookingId: payments.bookingId,
      // client info
      clientName: users.name,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      clientCompanyName: users.clientCompanyName,
    })
    .from(payments)
    .leftJoin(users, eq(payments.clientUserId, users.id))
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);

  return { payments: rows, total: Number(countRow?.count ?? 0) };
}

/**
 * Get all enterprise clients with their job and interested artist counts.
 */
export async function getEnterpriseClients(opts: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { clients: [], total: 0 };

  const { search, limit = 50, offset = 0 } = opts;

  const conditions = [eq(users.enterprise, true)];
  if (search) {
    conditions.push(
      sql`(${users.name} LIKE ${`%${search}%`} OR ${users.email} LIKE ${`%${search}%`} OR ${users.clientCompanyName} LIKE ${`%${search}%`})`
    );
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const countRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(where);
  const countRow = countRows[0];

  // Get enterprise clients with job counts
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      clientCompanyName: users.clientCompanyName,
      location: users.location,
      profilePicture: users.profilePicture,
      enterpriseLogoUrl: users.enterpriseLogoUrl,
      enterpriseDescription: users.enterpriseDescription,
      enterprisePlan: users.enterprisePlan,
      enterpriseStripeCustomerId: users.enterpriseStripeCustomerId,
      enterpriseStripeSubscriptionId: users.enterpriseStripeSubscriptionId,
      hiringCategory: users.hiringCategory,
      website: users.website,
      instagram: users.instagram,
      bubbleId: users.bubbleId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(asc(users.name))
    .limit(limit)
    .offset(offset);

  // For each client, get their job count and interested artist count
  const enriched = await Promise.all(
    rows.map(async (client) => {
      const jobCountRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(premiumJobs)
        .where(eq(premiumJobs.createdByUserId, client.id));
      const jobCount = jobCountRows[0];

      const artistCountRows = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${premiumJobInterestedArtists.artistUserId})` })
        .from(premiumJobInterestedArtists)
        .innerJoin(premiumJobs, eq(premiumJobInterestedArtists.premiumJobId, premiumJobs.id))
        .where(eq(premiumJobs.createdByUserId, client.id));
      const artistCount = artistCountRows[0];

      return {
        ...client,
        jobCount: Number(jobCount?.count ?? 0),
        interestedArtistCount: Number(artistCount?.count ?? 0),
      };
    })
  );

  return { clients: enriched, total: Number(countRow?.count ?? 0) };
}

// ── Client Companies ──────────────────────────────────────────────────────────

/** Get all client companies for an enterprise user */
export async function getClientCompaniesByUserId(userId: number): Promise<ClientCompany[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientCompanies)
    .where(eq(clientCompanies.ownerUserId, userId))
    .orderBy(asc(clientCompanies.name));
}

/** Create a new premium job */
export async function createPremiumJob(data: {
  serviceType: string;
  company: string;
  logo?: string | null;
  category?: string | null;
  location?: string | null;
  budget?: string | null;
  workFromAnywhere?: boolean;
  description?: string | null;
  applyEmail?: string | null;
  createdByUserId: number;
  bubbleClientCompanyId?: string | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(premiumJobs).values({
    serviceType: data.serviceType,
    company: data.company,
    logo: data.logo ?? null,
    category: data.category ?? null,
    location: data.location ?? null,
    budget: data.budget ?? null,
    workFromAnywhere: data.workFromAnywhere ?? false,
    description: data.description ?? null,
    applyEmail: data.applyEmail ?? null,
    createdByUserId: data.createdByUserId,
    bubbleClientCompanyId: data.bubbleClientCompanyId ?? null,
    status: "Active",
  });
  // @ts-ignore
  return result[0].insertId;
}

// ── Artist Dashboard ──────────────────────────────────────────────────────────

/** Get jobs feed for artist dashboard (active/open jobs with client info) */
export async function getArtistJobsFeed(limit = 20, offset = 0): Promise<{
  id: number;
  requestStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isHourly: boolean | null;
  openRate: boolean | null;
  artistHourlyRate: string | null;
  createdAt: Date | null;
  clientCompanyName: string | null;
  clientName: string | null;
  clientLogo: string | null;
  locationAddress: string | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT j.id, j.requestStatus, j.startDate, j.endDate, j.isHourly, j.openRate, j.artistHourlyRate, j.createdAt, j.locationAddress,
     u.clientCompanyName, u.name as clientName, u.enterpriseLogoUrl as clientLogo
     FROM jobs j
     LEFT JOIN users u ON j.clientUserId = u.id
     WHERE j.requestStatus IN ('Active', 'Submissions Paused')
     ORDER BY j.createdAt DESC
     LIMIT ${limit} OFFSET ${offset}`
  );
  return (rows[0] as unknown as any[]);
}

/** Get PRO jobs feed for artist dashboard (active premium jobs) */
export async function getArtistProJobsFeed(limit = 20, offset = 0): Promise<{
  id: number;
  serviceType: string | null;
  company: string | null;
  logo: string | null;
  workFromAnywhere: boolean | null;
  budget: string | null;
  location: string | null;
  createdAt: Date | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT id, serviceType, company, logo, workFromAnywhere, budget, location, createdAt
     FROM premium_jobs
     WHERE status = 'Active'
     ORDER BY createdAt DESC
     LIMIT ${limit} OFFSET ${offset}`
  );
  return (rows[0] as unknown as any[]);
}

/** Get all PRO job applications for an artist */
export async function getArtistProApplications(artistUserId: number): Promise<{
  id: number;
  status: string | null;
  serviceType: string | null;
  company: string | null;
  logo: string | null;
  workFromAnywhere: boolean | null;
  budget: string | null;
  location: string | null;
  premiumJobId: number;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT pjia.id, pjia.status, pj.serviceType, pj.company, pj.logo, pj.workFromAnywhere, pj.budget, pj.location, pjia.premiumJobId
     FROM premium_job_interested_artists pjia
     JOIN premium_jobs pj ON pjia.premiumJobId = pj.id
     WHERE pjia.artistUserId = ${artistUserId}
     ORDER BY pjia.id DESC`
  );
  return (rows[0] as unknown as any[]);
}

/** Get bookings for an artist */
export async function getArtistBookings(artistUserId: number): Promise<{
  id: number;
  bookingStatus: string | null;
  paymentStatus: string | null;
  clientRate: string | null;
  artistRate: string | null;
  startDate: Date | null;
  endDate: Date | null;
  locationAddress: string | null;
  clientCompanyName: string | null;
  clientName: string | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT b.id, b.bookingStatus, b.paymentStatus, b.clientRate, b.artistRate, b.startDate, b.endDate, b.locationAddress,
     u.clientCompanyName, u.name as clientName
     FROM bookings b
     LEFT JOIN users u ON b.clientUserId = u.id
     WHERE b.artistUserId = ${artistUserId}
     ORDER BY b.startDate DESC
     LIMIT 50`
  );
  return (rows[0] as unknown as any[]);
}

/** Get payments for an artist (via bookings) */
export async function getArtistPayments(artistUserId: number): Promise<{
  id: number;
  stripeAmount: number | null;
  status: string | null;
  paymentDate: Date | null;
  createdAt: Date | null;
  clientCompanyName: string | null;
  stripeCardBrand: string | null;
  stripeCardLast4: string | null;
  stripeReceiptUrl: string | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    `SELECT p.id, p.stripeAmount, p.status, p.paymentDate, p.createdAt, p.stripeCardBrand, p.stripeCardLast4, p.stripeReceiptUrl, u.clientCompanyName
     FROM payments p
     JOIN bookings b ON p.bookingId = b.id
     LEFT JOIN users u ON p.clientUserId = u.id
     WHERE b.artistUserId = ${artistUserId}
     ORDER BY p.createdAt DESC
     LIMIT 50`
  );
  return (rows[0] as unknown as any[]);
}

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Delete any existing tokens for this user first (one active token at a time)
  await db.execute(`DELETE FROM password_reset_tokens WHERE userId = ${userId}`);
  const expiresStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
  await db.execute(`INSERT INTO password_reset_tokens (userId, token, expiresAt) VALUES (${userId}, '${token}', '${expiresStr}')`);
}

export async function getPasswordResetToken(token: string): Promise<{ userId: number; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(`SELECT userId, expiresAt FROM password_reset_tokens WHERE token = '${token}' LIMIT 1`);
  const row = (rows[0] as unknown as any[])[0];
  if (!row) return null;
  return { userId: row.userId, expiresAt: new Date(row.expiresAt) };
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(`DELETE FROM password_reset_tokens WHERE token = '${token}'`);
}


// ─── Artist Resumes ───────────────────────────────────────────────────────────
/**
 * Returns all resumes for an artist from the artist_resumes table,
 * plus any legacy resume URLs stored in users.resumeFiles (JSON array).
 */
export async function getArtistResumes(artistUserId: number): Promise<{ id: string; title: string; fileUrl: string; source: "library" | "profile" }[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. From artist_resumes table
  const rows = await db.execute(
    `SELECT id, title, fileUrl FROM artist_resumes WHERE artistUserId = ${artistUserId} AND fileUrl IS NOT NULL ORDER BY createdAt DESC LIMIT 20`
  );
  const libraryResumes: { id: string; title: string; fileUrl: string; source: "library" | "profile" }[] =
    (rows[0] as unknown as any[]).map((r: any) => ({
      id: `lib-${r.id}`,
      title: r.title || "Resume",
      fileUrl: r.fileUrl,
      source: "library" as const,
    }));

  // 2. From users.resumeFiles (JSON array of {url, name} or plain strings)
  const userRows = await db.execute(
    `SELECT resumeFiles, resumes FROM users WHERE id = ${artistUserId} LIMIT 1`
  );
  const userRow = (userRows[0] as unknown as any[])[0];
  const profileResumes: { id: string; title: string; fileUrl: string; source: "library" | "profile" }[] = [];
  if (userRow?.resumeFiles) {
    try {
      const parsed = JSON.parse(userRow.resumeFiles);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any, i: number) => {
          const url = typeof item === "string" ? item : item?.url;
          const name = typeof item === "object" ? (item?.name || item?.title || `Resume ${i + 1}`) : `Resume ${i + 1}`;
          if (url) profileResumes.push({ id: `profile-${i}`, title: name, fileUrl: url, source: "profile" });
        });
      }
    } catch {}
  }
  // Also check legacy resumes field
  if (userRow?.resumes) {
    try {
      const parsed = JSON.parse(userRow.resumes);
      if (Array.isArray(parsed)) {
        parsed.forEach((url: string, i: number) => {
          if (url && !profileResumes.some((r: any) => r.fileUrl === url)) {
            profileResumes.push({ id: `legacy-${i}`, title: `Resume ${i + 1}`, fileUrl: url, source: "profile" });
          }
        });
      }
    } catch {}
  }

  // Deduplicate by fileUrl, library takes precedence
  const seen = new Set<string>();
  const all = [...libraryResumes, ...profileResumes].filter(r => {
    if (seen.has(r.fileUrl)) return false;
    seen.add(r.fileUrl);
    return true;
  });
  return all;
}

// ─── Apply to Job ─────────────────────────────────────────────────────────────
/**
 * Creates an interested_artists record (i.e. a job application).
 * Returns the new record's ID.
 */
export async function applyToJob(params: {
  jobId: number;
  artistUserId: number;
  message?: string;
  resumeLink?: string;
  artistHourlyRate?: number;
  artistFlatRate?: number;
  isHourlyRate?: boolean;
  startDate?: Date;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Check for duplicate application
  const existing = await db.execute(
    `SELECT id FROM interested_artists WHERE jobId = ${params.jobId} AND artistUserId = ${params.artistUserId} LIMIT 1`
  );
  if ((existing[0] as unknown as any[]).length > 0) {
    throw new Error("You have already applied to this job.");
  }

  // Fetch job to get client info
  const jobRows = await db.execute(
    `SELECT clientUserId FROM jobs WHERE id = ${params.jobId} LIMIT 1`
  );
  const jobRow = (jobRows[0] as unknown as any[])[0];
  const clientUserId = jobRow?.clientUserId ?? null;

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const message = params.message ? params.message.replace(/'/g, "''") : null;
  const resumeLink = params.resumeLink ? params.resumeLink.replace(/'/g, "''") : null;
  const startDate = params.startDate ? params.startDate.toISOString().slice(0, 19).replace("T", " ") : null;

  const result = await db.execute(`
    INSERT INTO interested_artists
      (jobId, artistUserId, clientUserId, status, message, resumeLink,
       artistHourlyRate, artistFlatRate, isHourlyRate, startDate, createdAt, updatedAt)
    VALUES
      (${params.jobId}, ${params.artistUserId}, ${clientUserId ?? "NULL"}, 'Interested',
       ${message ? `'${message}'` : "NULL"},
       ${resumeLink ? `'${resumeLink}'` : "NULL"},
       ${params.artistHourlyRate != null ? params.artistHourlyRate : "NULL"},
       ${params.artistFlatRate != null ? params.artistFlatRate : "NULL"},
       ${params.isHourlyRate !== false ? 1 : 0},
       ${startDate ? `'${startDate}'` : "NULL"},
       '${now}', '${now}')
  `);
  return (result[0] as any).insertId;
}

// ─── Artist Subscription Helpers ─────────────────────────────────────────────

/** Save artist Stripe customer ID */
export async function saveArtistStripeCustomerId(userId: number, stripeCustomerId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
}

/** Save artist PRO subscription ID and mark artswrkPro = true */
export async function saveArtistProSubscription(userId: number, subscriptionId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ artswrkPro: true, artistStripeProductId: subscriptionId }).where(eq(users.id, userId));
}

/** Cancel artist PRO subscription (mark artswrkPro = false) */
export async function cancelArtistProSubscription(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ artswrkPro: false, artistStripeProductId: null }).where(eq(users.id, userId));
}

/** Get artist subscription fields for plan management */
export async function getArtistSubscriptionInfo(userId: number): Promise<{
  artswrkPro: boolean;
  artswrkBasic: boolean;
  stripeCustomerId: string | null;
  artistStripeProductId: string | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      artswrkPro: users.artswrkPro,
      artswrkBasic: users.artswrkBasic,
      stripeCustomerId: users.stripeCustomerId,
      artistStripeProductId: users.artistStripeProductId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) return null;
  return {
    artswrkPro: rows[0].artswrkPro ?? false,
    artswrkBasic: rows[0].artswrkBasic ?? false,
    stripeCustomerId: rows[0].stripeCustomerId,
    artistStripeProductId: rows[0].artistStripeProductId,
  };
}

/** Save artist Basic subscription ID and mark artswrkBasic = true */
export async function saveArtistBasicSubscription(userId: number, subscriptionId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ artswrkBasic: true, artistStripeProductId: subscriptionId }).where(eq(users.id, userId));
}

// ── Enterprise Billing ────────────────────────────────────────────────────────

/** Set the enterprise plan type for a user (admin action) */
export async function setEnterprisePlan(
  userId: number,
  plan: "on_demand" | "subscriber" | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ enterprisePlan: plan as any }).where(eq(users.id, userId));
}

/** Save enterprise Stripe customer ID */
export async function saveEnterpriseStripeCustomerId(userId: number, customerId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ enterpriseStripeCustomerId: customerId }).where(eq(users.id, userId));
}

/** Save enterprise subscription ID after successful checkout */
export async function saveEnterpriseSubscription(userId: number, subscriptionId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ enterpriseStripeSubscriptionId: subscriptionId }).where(eq(users.id, userId));
}

/** Cancel enterprise subscription (clear subscription ID) */
export async function cancelEnterpriseSubscription(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ enterpriseStripeSubscriptionId: null }).where(eq(users.id, userId));
}

/** Get enterprise billing fields for a user */
export async function getEnterpriseBillingInfo(userId: number): Promise<{
  enterprisePlan: "on_demand" | "subscriber" | null;
  enterpriseStripeCustomerId: string | null;
  enterpriseStripeSubscriptionId: string | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      enterprisePlan: users.enterprisePlan,
      enterpriseStripeCustomerId: users.enterpriseStripeCustomerId,
      enterpriseStripeSubscriptionId: users.enterpriseStripeSubscriptionId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) return null;
  return {
    enterprisePlan: rows[0].enterprisePlan ?? null,
    enterpriseStripeCustomerId: rows[0].enterpriseStripeCustomerId ?? null,
    enterpriseStripeSubscriptionId: rows[0].enterpriseStripeSubscriptionId ?? null,
  };
}

/** Record an on-demand job unlock after successful Stripe payment */
export async function recordEnterpriseJobUnlock(unlock: InsertEnterpriseJobUnlock): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(enterpriseJobUnlocks).values(unlock);
}

/** Get all unlocked job IDs for an enterprise client */
export async function getUnlockedJobIds(clientUserId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ jobId: enterpriseJobUnlocks.jobId })
    .from(enterpriseJobUnlocks)
    .where(eq(enterpriseJobUnlocks.clientUserId, clientUserId));
  return rows.map(r => r.jobId);
}

/** Check if a specific job is unlocked for a client */
export async function isJobUnlocked(clientUserId: number, jobId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: enterpriseJobUnlocks.id })
    .from(enterpriseJobUnlocks)
    .where(and(
      eq(enterpriseJobUnlocks.clientUserId, clientUserId),
      eq(enterpriseJobUnlocks.jobId, jobId)
    ))
    .limit(1);
  return rows.length > 0;
}
