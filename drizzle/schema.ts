import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table — mirrors the Bubble User data type.
 * Fields are mapped from the Bubble Data API response for artswrk.com.
 */
export const users = mysqlTable("users", {
  // ── System / Auth ──────────────────────────────────────────────────────────
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId). Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  /** Bubble internal record ID (e.g. "1659533883431x527826980339748400") */
  bubbleId: varchar("bubbleId", { length: 64 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),

  // ── Identity ───────────────────────────────────────────────────────────────
  email: varchar("email", { length: 320 }),
  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  name: text("name"),
  slug: varchar("slug", { length: 128 }),
  profilePicture: text("profilePicture"),
  phoneNumber: varchar("phoneNumber", { length: 32 }),

  // ── User Role / Type ───────────────────────────────────────────────────────
  /** "Client" (hirer) or "Artist" */
  userRole: mysqlEnum("userRole", ["Client", "Artist", "Admin"]),
  optionAvailability: varchar("optionAvailability", { length: 64 }),

  // ── Client (Hirer) Fields ──────────────────────────────────────────────────
  clientCompanyName: varchar("clientCompanyName", { length: 256 }),
  clientStripeCustomerId: varchar("clientStripeCustomerId", { length: 64 }),
  clientStripeCardId: varchar("clientStripeCardId", { length: 64 }),
  clientSubscriptionId: varchar("clientSubscriptionId", { length: 64 }),
  clientPremium: boolean("clientPremium").default(false),

  // ── Artist Fields ──────────────────────────────────────────────────────────
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),

  // ── Onboarding ─────────────────────────────────────────────────────────────
  onboardingStep: int("onboardingStep").default(0),
  userSignedUp: boolean("userSignedUp").default(false),
  beta: boolean("beta").default(false),

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** bcrypt hash of a temporary password set by admin. Null = no password login. */
  passwordHash: varchar("passwordHash", { length: 256 }),
  /** Flag to force password reset on next login */
  passwordIsTemporary: boolean("passwordIsTemporary").default(true),

  // ── Metadata ───────────────────────────────────────────────────────────────
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Jobs (Bubble: Request) ────────────────────────────────────────────────────
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** FK → users.id (the hirer who created this job) */
  clientUserId: int("clientUserId"),
  /** Bubble client user ID (for cross-referencing during migration) */
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  /** Bubble client company ID */
  bubbleClientCompanyId: varchar("bubbleClientCompanyId", { length: 64 }),

  // ── Content ────────────────────────────────────────────────────────────────
  description: text("description"),
  slug: varchar("slug", { length: 256 }),

  // ── Status ─────────────────────────────────────────────────────────────────
  /** e.g. Active, Confirmed, Completed, Deleted by Client, Submissions Paused, Lost - No Revenue */
  requestStatus: varchar("requestStatus", { length: 64 }),
  /** e.g. Awaiting Response, Confirmed, etc. */
  status: varchar("status", { length: 64 }),

  // ── Scheduling ─────────────────────────────────────────────────────────────
  /** Single Date | Ongoing | Recurring */
  dateType: varchar("dateType", { length: 32 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),

  // ── Location ───────────────────────────────────────────────────────────────
  locationAddress: text("locationAddress"),
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),

  // ── Rates ──────────────────────────────────────────────────────────────────
  isHourly: boolean("isHourly").default(true),
  openRate: boolean("openRate").default(false),
  artistHourlyRate: int("artistHourlyRate"),
  clientHourlyRate: int("clientHourlyRate"),

  // ── Audience ───────────────────────────────────────────────────────────────
  /** JSON array of age ranges e.g. ["6-10", "11-14"] */
  ages: text("ages"),

  // ── Flags ──────────────────────────────────────────────────────────────────
  direct: boolean("direct").default(false),
  sentToNetwork: boolean("sentToNetwork").default(false),
  transportation: boolean("transportation").default(false),
  converted: boolean("converted").default(false),

  // ── Service Type ───────────────────────────────────────────────────────────
  /** Bubble master_service_type ID — will resolve to name in future */
  masterServiceTypeId: varchar("masterServiceTypeId", { length: 64 }),

  // ── Client contact ─────────────────────────────────────────────────────────
  clientEmail: varchar("clientEmail", { length: 320 }),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ── Interested Artists (Bubble: interested artists) ───────────────────────────
/**
 * Applicant records — one row per artist who expressed interest in a job.
 * Connects jobs ↔ artists (Bubble User records) ↔ clients.
 */
export const interestedArtists = mysqlTable("interested_artists", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → jobs.id (the job this application is for) */
  jobId: int("jobId"),
  /** Bubble request/job ID (for cross-referencing) */
  bubbleRequestId: varchar("bubbleRequestId", { length: 64 }),
  /** FK → users.id (the artist who applied) — null until artist is migrated */
  artistUserId: int("artistUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  /** FK → users.id (the client/hirer) */
  clientUserId: int("clientUserId"),
  /** Bubble client user ID */
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  /** Bubble service ID */
  bubbleServiceId: varchar("bubbleServiceId", { length: 64 }),
  /** Bubble booking ID (if converted to a booking) */
  bubbleBookingId: varchar("bubbleBookingId", { length: 64 }),

  // ── Status ─────────────────────────────────────────────────────────────────
  /** Interested | Confirmed | Declined */
  status: varchar("status", { length: 64 }),
  /** Whether this application was converted to a booking */
  converted: boolean("converted").default(false),

  // ── Rates ──────────────────────────────────────────────────────────────────
  isHourlyRate: boolean("isHourlyRate").default(true),
  artistHourlyRate: int("artistHourlyRate"),
  clientHourlyRate: int("clientHourlyRate"),
  artistFlatRate: int("artistFlatRate"),
  clientFlatRate: int("clientFlatRate"),
  totalHours: int("totalHours"),

  // ── Scheduling ─────────────────────────────────────────────────────────────
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),

  // ── Content ────────────────────────────────────────────────────────────────
  /** Artist's resume/portfolio link (S3 URL) */
  resumeLink: text("resumeLink"),
  /** Optional message from the artist */
  message: text("message"),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type InterestedArtist = typeof interestedArtists.$inferSelect;
export type InsertInterestedArtist = typeof interestedArtists.$inferInsert;

// ── Bookings (Bubble: booking) ────────────────────────────────────────────────
/**
 * Confirmed bookings — the final step in the job → applicant → booking chain.
 * One row per booking. Links back to a job (Request) and an interested artist record.
 */
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → jobs.id */
  jobId: int("jobId"),
  /** Bubble Request/job ID */
  bubbleRequestId: varchar("bubbleRequestId", { length: 64 }),
  /** FK → interested_artists.id (the applicant that became this booking) */
  interestedArtistId: int("interestedArtistId"),
  /** Bubble interested artist record ID */
  bubbleInterestedArtistId: varchar("bubbleInterestedArtistId", { length: 64 }),
  /** FK → users.id (the hirer / client) */
  clientUserId: int("clientUserId"),
  /** Bubble client user ID */
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  /** FK → users.id (the artist) — null until artist records are migrated */
  artistUserId: int("artistUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),

  // ── Status ─────────────────────────────────────────────────────────────────
  /** Confirmed | Completed | Cancelled | Pay Now */
  bookingStatus: varchar("bookingStatus", { length: 64 }),
  /** Paid | Unpaid */
  paymentStatus: varchar("paymentStatus", { length: 64 }),

  // ── Rates & Financials ─────────────────────────────────────────────────────
  /** What the client pays */
  clientRate: int("clientRate"),
  /** What the artist receives */
  artistRate: int("artistRate"),
  /** Total client rate including reimbursements */
  totalClientRate: int("totalClientRate"),
  /** Total artist rate including reimbursements */
  totalArtistRate: int("totalArtistRate"),
  /** Artswrk gross profit (clientRate - artistRate - stripeFee) */
  grossProfit: int("grossProfit"),
  /** Stripe processing fee */
  stripeFee: int("stripeFee"),
  /** Revenue after Stripe fee */
  postFeeRevenue: int("postFeeRevenue"),
  /** Number of hours booked */
  hours: int("hours"),
  /** Whether payment was made outside Stripe */
  externalPayment: boolean("externalPayment").default(false),

  // ── Scheduling ─────────────────────────────────────────────────────────────
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),

  // ── Location ───────────────────────────────────────────────────────────────
  locationAddress: text("locationAddress"),
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),

  // ── Content ────────────────────────────────────────────────────────────────
  description: text("description"),
  stripeCheckoutUrl: text("stripeCheckoutUrl"),

  // ── Flags ──────────────────────────────────────────────────────────────────
  addedToSpreadsheet: boolean("addedToSpreadsheet").default(false),
  deleted: boolean("deleted").default(false),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
