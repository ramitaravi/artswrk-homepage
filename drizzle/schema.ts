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
  /** Short bio / about text */
  bio: text("bio"),
  /** Pronouns (e.g. "She/her", "They/them") */
  pronouns: varchar("pronouns", { length: 64 }),
  /** JSON array of discipline strings (e.g. ["Ballet", "Hip Hop"]) */
  artistDisciplines: text("artistDisciplines"),
  /** JSON array of service/role strings (e.g. ["Dance Educator", "Choreographer"]) */
  artistServices: text("artistServices"),
  /** JSON array of master artist type strings */
  masterArtistTypes: text("masterArtistTypes"),
  /** JSON array of master style strings */
  masterStyles: text("masterStyles"),
  /** JSON array of experience strings */
  artistExperiences: text("artistExperiences"),
  /** Location string (city, state) */
  location: varchar("location", { length: 256 }),
  /** Portfolio URL */
  portfolio: text("portfolio"),
  /** Website URL */
  website: text("website"),
  /** Instagram handle */
  instagram: varchar("instagram", { length: 128 }),
  /** TikTok handle or URL */
  tiktok: text("tiktok"),
  /** YouTube URL */
  youtube: text("youtube"),
  /** JSON array of resume file URLs */
  resumes: text("resumes"),
  /** JSON array of video URLs */
  videos: text("videos"),
  /** Artswrk PRO status */
  artswrkPro: boolean("artswrkPro").default(false),
  /** Artswrk Basic status */
  artswrkBasic: boolean("artswrkBasic").default(false),
  /** Business or Individual */
  businessOrIndividual: varchar("businessOrIndividual", { length: 64 }),
  /** Business type */
  businessType: varchar("businessType", { length: 128 }),
  /** Business name */
  artistBusinessName: varchar("artistBusinessName", { length: 256 }),
  /** Transportation accommodation */
  artistTransportationAccommodation: varchar("artistTransportationAccommodation", { length: 128 }),
  /** Hiring category */
  hiringCategory: varchar("hiringCategory", { length: 128 }),

  // ── Enterprise ────────────────────────────────────────────────────────────
  /** Enterprise client — gets the enterprise dashboard with premium jobs */
  enterprise: boolean("enterprise").default(false),
  /** Enterprise company logo URL */
  enterpriseLogoUrl: text("enterpriseLogoUrl"),
  /** Enterprise company description */
  enterpriseDescription: text("enterpriseDescription"),

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

  // ── Boost / Promotion ─────────────────────────────────────────────────────
  /** Whether this job is currently boosted for higher visibility */
  isBoosted: boolean("isBoosted").default(false),
  /** Daily budget in dollars for the boost (e.g. 15 = $15/day) */
  boostDailyBudget: int("boostDailyBudget"),
  /** Number of days the boost runs */
  boostDurationDays: int("boostDurationDays"),
  /** When the boost started */
  boostStartDate: timestamp("boostStartDate"),
  /** When the boost expires */
  boostEndDate: timestamp("boostEndDate"),
  /** Stripe checkout session ID for the boost payment */
  boostStripeSessionId: varchar("boostStripeSessionId", { length: 256 }),

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

// ── Payments (Bubble: payment) ────────────────────────────────────────────────
/**
 * Stripe payment records — one per booking payment.
 * Links to a booking and contains full Stripe charge details.
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → bookings.id */
  bookingId: int("bookingId"),
  /** Bubble booking ID (for cross-referencing) */
  bubbleBookingId: varchar("bubbleBookingId", { length: 64 }),
  /** FK → users.id (the client who paid) */
  clientUserId: int("clientUserId"),

  // ── Stripe Data ────────────────────────────────────────────────────────────
  /** Stripe charge ID e.g. ch_3LsIGN... */
  stripeId: varchar("stripeId", { length: 128 }),
  /** Stripe charge status e.g. succeeded */
  stripeStatus: varchar("stripeStatus", { length: 32 }),
  /** Overall payment status e.g. Success */
  status: varchar("status", { length: 32 }),
  /** Amount charged in cents */
  stripeAmount: int("stripeAmount"),
  /** Artswrk application fee ID */
  stripeApplicationFee: varchar("stripeApplicationFee", { length: 128 }),
  /** Application fee amount in cents */
  stripeApplicationFeeAmount: int("stripeApplicationFeeAmount"),
  /** Card brand e.g. Visa, MasterCard */
  stripeCardBrand: varchar("stripeCardBrand", { length: 32 }),
  /** Last 4 digits of card */
  stripeCardLast4: varchar("stripeCardLast4", { length: 4 }),
  /** Cardholder name */
  stripeCardName: varchar("stripeCardName", { length: 256 }),
  /** Description on the charge */
  stripeDescription: text("stripeDescription"),
  /** Stripe receipt URL */
  stripeReceiptUrl: text("stripeReceiptUrl"),
  /** Stripe refund URL */
  stripeRefundUrl: text("stripeRefundUrl"),
  /** Date of payment */
  paymentDate: timestamp("paymentDate"),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ── Conversations (Bubble: conversation) ──────────────────────────────────────
/**
 * Messaging threads between a client and an artist.
 * One conversation per client-artist pair.
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → users.id (the client/hirer) */
  clientUserId: int("clientUserId"),
  /** Bubble client user ID */
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  /** FK → users.id (the artist) */
  artistUserId: int("artistUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  /** Bubble ID of the last message */
  bubbleLastMessageId: varchar("bubbleLastMessageId", { length: 64 }),
  /** Timestamp of the last message */
  lastMessageDate: timestamp("lastMessageDate"),
  /** Count of unread messages */
  unreadCount: int("unreadCount").default(0),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ── Messages (Bubble: message) ────────────────────────────────────────────────
/**
 * Individual messages within a conversation thread.
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → conversations.id */
  conversationId: int("conversationId"),
  /** Bubble conversation ID */
  bubbleConversationId: varchar("bubbleConversationId", { length: 64 }),
  /** FK → users.id (who sent this message) */
  senderUserId: int("senderUserId"),
  /** Bubble sender user ID */
  bubbleSentById: varchar("bubbleSentById", { length: 64 }),

  // ── Content ────────────────────────────────────────────────────────────────
  content: text("content"),
  /** Whether this is a system/automated message (booking confirmations etc.) */
  isSystem: boolean("isSystem").default(false),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
