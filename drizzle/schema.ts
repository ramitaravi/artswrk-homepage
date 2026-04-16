import {
  boolean,
  double,
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

  // ── Artist Profile Extended ───────────────────────────────────────────────
  /** JSON array of photo URLs for the media grid on the profile */
  mediaPhotos: text("mediaPhotos"),
  /** JSON array of {url, name} objects for resume files */
  resumeFiles: text("resumeFiles"),
  /** Number of completed bookings (displayed on profile) */
  bookingCount: int("bookingCount").default(0),
  /** Average rating (0-5, stored as float * 10 for integer storage) */
  ratingScore: int("ratingScore").default(0),
  /** Number of reviews */
  reviewCount: int("reviewCount").default(0),
  /** JSON array of work type strings shown as chips (e.g. ["Dance Adjudicator", "Dance Educator"]) */
  workTypes: text("workTypes"),
  /** Short tagline shown under name */
  tagline: varchar("tagline", { length: 256 }),
  /** Priority/featured artist flag from Bubble */
  priorityList: boolean("priorityList").default(false),
  /** Number of late cancellations (affects reliability score) */
  lateCancelCount: int("lateCancelCount").default(0),
  /** Performance/CV credits text (e.g. "Broadway Dance Center, TNT's I Am The Night") */
  credits: text("credits"),

  // ── Artist Stripe Connect ─────────────────────────────────────────────────
  /** Stripe Connect account ID for artist payouts (e.g. acct_1PKkRm...) */
  artistStripeAccountId: varchar("artistStripeAccountId", { length: 64 }),
  /** OAuth return code from Stripe Connect onboarding flow */
  artistStripeReturnCode: varchar("artistStripeReturnCode", { length: 256 }),
  /** Stripe product ID tied to the artist's PRO subscription */
  artistStripeProductId: varchar("artistStripeProductId", { length: 64 }),
  /** When the artist's Stripe Connect account was created */
  artistStripeDateCreated: timestamp("artistStripeDateCreated"),

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
  /** Number of hours booked (decimal, e.g. 2.75) */
  hours: double("hours"),
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

/**
 * Premium Jobs table — mirrors the Bubble "premium_jobs" data type.
 * These are PRO/Enterprise jobs posted by enterprise clients.
 * Kept separate from regular jobs (requests) intentionally — different data shape,
 * different pricing tier, always updated independently.
 */
export const premiumJobs = mysqlTable("premium_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  // ── Company / Poster ───────────────────────────────────────────────────────
  /** Company name (stored directly on the record, not derived from user) */
  company: varchar("company", { length: 256 }),
  /** Company logo URL */
  logo: text("logo"),
  /** FK → users.id (the enterprise user who created this job) */
  createdByUserId: int("createdByUserId"),
  /** Bubble user ID of creator */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),
  /** Bubble Client-Company relation ID */
  bubbleClientCompanyId: varchar("bubbleClientCompanyId", { length: 64 }),

  // ── Job Details ────────────────────────────────────────────────────────────
  /** Free-text job title / service type (e.g. "Judge April 24-26", "Social Media Manager") */
  serviceType: varchar("serviceType", { length: 256 }),
  /** Category (e.g. "Dance Competition", "Acrobatic Arts") */
  category: varchar("category", { length: 128 }),
  /** Rich text job description */
  description: text("description"),
  /** Free-text budget (e.g. "$35/hr + $250/class", "Pitch your rate", "$18/hour (12 hours/week)") */
  budget: varchar("budget", { length: 256 }),
  /** Location text */
  location: varchar("location", { length: 256 }),
  /** Tag (e.g. "#Judges #MasterClasses") */
  tag: varchar("tag", { length: 256 }),
  /** URL slug */
  slug: varchar("slug", { length: 256 }),

  // ── Application Settings ───────────────────────────────────────────────────
  /** If true, artists apply directly via email/link rather than through the platform */
  applyDirect: boolean("applyDirect").default(false),
  /** Email address for direct applications */
  applyEmail: varchar("applyEmail", { length: 320 }),
  /** External link for direct applications */
  applyLink: text("applyLink"),

  // ── Flags ──────────────────────────────────────────────────────────────────
  /** Whether this job can be done remotely */
  workFromAnywhere: boolean("workFromAnywhere").default(false),
  /** Whether this job is featured/promoted */
  featured: boolean("featured").default(false),

  // ── Status ─────────────────────────────────────────────────────────────────
  /** e.g. "Active", "Completed", "Lost - No Revenue", "Closed" */
  status: varchar("status", { length: 64 }).default("Active"),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type PremiumJob = typeof premiumJobs.$inferSelect;
export type InsertPremiumJob = typeof premiumJobs.$inferInsert;

/**
 * Premium Job Interested Artists — normalized join table.
 * Bubble stores interested_artists as an array on the premium_jobs record;
 * we normalize to a proper join table for efficient querying.
 */
export const premiumJobInterestedArtists = mysqlTable("premium_job_interested_artists", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → premium_jobs.id */
  premiumJobId: int("premiumJobId").notNull(),
  /** Bubble premium job ID */
  bubblePremiumJobId: varchar("bubblePremiumJobId", { length: 64 }),
  /** FK → users.id (the artist) */
  artistUserId: int("artistUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  /** Bubble interestedartists record ID */
  bubbleInterestedArtistId: varchar("bubbleInterestedArtistId", { length: 64 }),
  /** Artist's application message */
  message: text("message"),
  /** Rate the artist quoted for this job */
  rate: varchar("rate", { length: 255 }),
  /** Resume/portfolio link */
  resumeLink: text("resumeLink"),
  /** Status from Bubble */
  status: varchar("status", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PremiumJobInterestedArtist = typeof premiumJobInterestedArtists.$inferSelect;
export type InsertPremiumJobInterestedArtist = typeof premiumJobInterestedArtists.$inferInsert;

/**
 * Client Companies — companies associated with enterprise users.
 * Derived from distinct company names/logos in premium_jobs.
 * Each enterprise user can have multiple companies.
 */
export const clientCompanies = mysqlTable("client_companies", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id (the enterprise user who owns this company) */
  ownerUserId: int("ownerUserId").notNull(),
  /** Company display name */
  name: varchar("name", { length: 256 }).notNull(),
  /** Company logo URL */
  logo: text("logo"),
  /** Bubble client company ID (for deduplication) */
  bubbleClientCompanyId: varchar("bubbleClientCompanyId", { length: 64 }),
  /** Website URL */
  website: text("website"),
  /** Description */
  description: text("description"),
  /** Company location address */
  locationAddress: text("locationAddress"),
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),
  /** Whether the company reimburses artist transportation */
  transportReimbursed: boolean("transportReimbursed").default(false),
  /** Instructions for how artists should get to this studio */
  transportDetails: text("transportDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientCompany = typeof clientCompanies.$inferSelect;
export type InsertClientCompany = typeof clientCompanies.$inferInsert;

// ─── Facebook Group Acquisition ──────────────────────────────────────────────

/**
 * A single "parse session" — one paste of Facebook post text by a team member.
 * Stores the raw input and which group it came from.
 */
export const acquisitionSessions = mysqlTable("acquisition_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Name/URL of the Facebook group (for display) */
  groupName: varchar("groupName", { length: 256 }),
  groupUrl: text("groupUrl"),
  /** Raw pasted text from Facebook */
  rawText: text("rawText").notNull(),
  /** Number of jobs parsed from this session */
  jobCount: int("jobCount").default(0),
  /** Number of artists parsed from this session */
  artistCount: int("artistCount").default(0),
  /** Admin user who created this session */
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AcquisitionSession = typeof acquisitionSessions.$inferSelect;
export type InsertAcquisitionSession = typeof acquisitionSessions.$inferInsert;

/**
 * A single lead (job poster or artist) extracted from a Facebook group post.
 */
export const acquisitionLeads = mysqlTable("acquisition_leads", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  /** "job" or "artist" */
  leadType: mysqlEnum("leadType", ["job", "artist"]).notNull(),

  // ── Parsed fields (populated by AI) ──────────────────────────────────────
  /** Person or company name */
  name: varchar("name", { length: 256 }),
  /** For jobs: role/title. For artists: primary discipline */
  title: varchar("title", { length: 256 }),
  /** Location string */
  location: varchar("location", { length: 256 }),
  /** Rate/budget string */
  rate: varchar("rate", { length: 128 }),
  /** Contact info (email, Instagram handle, etc.) */
  contactInfo: varchar("contactInfo", { length: 512 }),
  /** Disciplines / skills (JSON array string) */
  disciplines: text("disciplines"),
  /** Full description / original post text excerpt */
  description: text("description"),
  /** Raw original post text */
  rawPostText: text("rawPostText"),

  // ── Outreach ──────────────────────────────────────────────────────────────
  /** AI-generated DM message */
  outreachMessage: text("outreachMessage"),
  /** Magic link token for pre-filled onboarding */
  magicLinkToken: varchar("magicLinkToken", { length: 128 }),

  // ── Status tracking ───────────────────────────────────────────────────────
  /** "new" | "outreach_sent" | "clicked" | "joined" */
  status: mysqlEnum("status", ["new", "outreach_sent", "clicked", "joined"]).default("new").notNull(),
  outreachSentAt: timestamp("outreachSentAt"),
  /** FK → users.id if they signed up via magic link */
  convertedUserId: int("convertedUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AcquisitionLead = typeof acquisitionLeads.$inferSelect;
export type InsertAcquisitionLead = typeof acquisitionLeads.$inferInsert;

// ─── Artist Reviews ───────────────────────────────────────────────────────────

/**
 * Reviews left by hirers for artists after completed bookings.
 */
export const artistReviews = mysqlTable("artist_reviews", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id (the artist being reviewed) */
  artistUserId: int("artistUserId").notNull(),
  /** Reviewer name (hirer/studio name) */
  reviewerName: varchar("reviewerName", { length: 256 }),
  /** Reviewer studio/company name */
  reviewerStudio: varchar("reviewerStudio", { length: 256 }),
  /** Reviewer avatar URL */
  reviewerAvatar: text("reviewerAvatar"),
  /** Star rating (1-5) */
  rating: int("rating").default(5),
  /** Review text */
  body: text("body"),
  /** Date of the review (displayed on profile) */
  reviewDate: timestamp("reviewDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ArtistReview = typeof artistReviews.$inferSelect;
export type InsertArtistReview = typeof artistReviews.$inferInsert;

// ─── Artist Service Categories ────────────────────────────────────────────────

/**
 * Service categories for an artist profile.
 * Each category has a name, an image, and a list of sub-services (chips).
 */
export const artistServiceCategories = mysqlTable("artist_service_categories", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble ArtistService record ID (for migration tracking) */
  bubbleId: varchar("bubbleId", { length: 64 }),
  /** FK → users.id (the artist) */
  artistUserId: int("artistUserId").notNull(),
  /** Category name (e.g. "Dance Adjudicator", "Dance Educator") */
  name: varchar("name", { length: 256 }).notNull(),
  /** Category image URL */
  imageUrl: text("imageUrl"),
  /** JSON array of sub-service chip strings */
  subServices: text("subServices"),
  /** Display order */
  sortOrder: int("sortOrder").default(0),
  /** Whether this sub-service is listed on the public profile */
  listOnProfile: boolean("listOnProfile").default(true),
  /** Whether the artist wants job emails for this service */
  jobEmailEnabled: boolean("jobEmailEnabled").default(true),
  /** JSON array of per-sub-service settings: [{name, listOnProfile, jobEmailEnabled}] */
  subServiceSettings: text("subServiceSettings"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ArtistServiceCategory = typeof artistServiceCategories.$inferSelect;
export type InsertArtistServiceCategory = typeof artistServiceCategories.$inferInsert;

// ─── Artist Experiences ───────────────────────────────────────────────────────

/**
 * Teaching/performance experience records for artists.
 * Maps to Bubble's ArtistExperience type (1,215 records).
 * Each record represents one experience entry (a style category × age group combination).
 */
export const artistExperiences = mysqlTable("artist_experiences", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble ArtistExperience record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** FK → users.id (the artist) */
  artistUserId: int("artistUserId").notNull(),
  /** Bubble artist user ID (for cross-referencing during migration) */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),

  // ── Experience Details ─────────────────────────────────────────────────────
  /** Artist type (e.g. "Dance Educator", "Choreographer") — Bubble master artist type name */
  artistType: varchar("artistType", { length: 128 }),
  /** Bubble master artist type ID */
  bubbleArtistTypeId: varchar("bubbleArtistTypeId", { length: 64 }),
  /** Years of experience range (e.g. "5-10 years", "10+ years") */
  yearsOfExperience: varchar("yearsOfExperience", { length: 64 }),
  /** JSON array of age group strings (e.g. ["<5", "6-10", "11-14", "15-18", "18+"]) */
  ageGroups: text("ageGroups"),
  /** JSON array of style/discipline strings (e.g. ["Ballet", "Jazz", "Hip Hop"]) */
  styles: text("styles"),
  /** JSON array of Bubble style IDs (for reference during migration) */
  bubbleStyleIds: text("bubbleStyleIds"),
  /** Legacy resume/portfolio link from old Bubble field */
  legacyResumeLink: text("legacyResumeLink"),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type ArtistExperience = typeof artistExperiences.$inferSelect;
export type InsertArtistExperience = typeof artistExperiences.$inferInsert;

// ─── Resumes ──────────────────────────────────────────────────────────────────

/**
 * Resume file uploads linked to artist profiles.
 * Maps to Bubble's Resume type (868 records).
 * An artist can have multiple resume files.
 */
export const artistResumes = mysqlTable("artist_resumes", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble Resume record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** FK → users.id (the artist) */
  artistUserId: int("artistUserId").notNull(),
  /** Bubble artist user ID (for cross-referencing during migration) */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),

  // ── File Details ───────────────────────────────────────────────────────────
  /** Display name / filename (e.g. "2024 Acting - Dance - Business Resume.docx") */
  title: varchar("title", { length: 512 }),
  /** File URL (Bubble CDN or migrated S3 URL) */
  fileUrl: text("fileUrl"),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type ArtistResume = typeof artistResumes.$inferSelect;
export type InsertArtistResume = typeof artistResumes.$inferInsert;

// ─── Reimbursements ───────────────────────────────────────────────────────────

/**
 * Expense reimbursement receipts attached to bookings.
 * Maps to Bubble's Reimbursement type (2,305 live records).
 * An artist submits these for transportation or other approved costs.
 */
export const reimbursements = mysqlTable("reimbursements", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble Reimbursement record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** FK → bookings.id */
  bookingId: int("bookingId"),
  /** Bubble booking ID (for cross-referencing during migration) */
  bubbleBookingId: varchar("bubbleBookingId", { length: 64 }),
  /** FK → users.id (the artist who submitted this reimbursement) */
  artistUserId: int("artistUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),

  // ── Reimbursement Details ─────────────────────────────────────────────────
  /** Dollar value of the reimbursement */
  value: double("value"),
  /** Date the expense was incurred */
  expenseDate: timestamp("expenseDate"),
  /** Artist's note describing the expense (e.g. "Transport", "Parking") */
  note: text("note"),
  /** Receipt file URL (S3 or Bubble CDN) */
  fileUrl: text("fileUrl"),

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type Reimbursement = typeof reimbursements.$inferSelect;
export type InsertReimbursement = typeof reimbursements.$inferInsert;

// ─── Ads ──────────────────────────────────────────────────────────────────────

/**
 * Banner/display ads shown on the platform (admin-managed).
 * Maps to Bubble's "ads" type (1 live record, but growing).
 */
export const ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  name: varchar("name", { length: 256 }),
  link: text("link"),
  imageUrl: text("imageUrl"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type Ad = typeof ads.$inferSelect;
export type InsertAd = typeof ads.$inferInsert;

// ─── Affiliations ─────────────────────────────────────────────────────────────

/**
 * Organizations, schools, or programs artists are affiliated with.
 * Maps to Bubble's "Affiliations" type (36 live records).
 * e.g. "CLI Conservatory", "University of Arizona", "Acrobatic Arts"
 */
export const affiliations = mysqlTable("affiliations", {
  id: int("id").autoincrement().primaryKey(),
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),

  display: varchar("display", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }),
  logoUrl: text("logoUrl"),
  isPublic: boolean("isPublic").default(false),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type Affiliation = typeof affiliations.$inferSelect;
export type InsertAffiliation = typeof affiliations.$inferInsert;

/**
 * Join table: which artists belong to which affiliation.
 */
export const userAffiliations = mysqlTable("user_affiliations", {
  id: int("id").autoincrement().primaryKey(),
  affiliationId: int("affiliationId").notNull(),
  bubbleAffiliationId: varchar("bubbleAffiliationId", { length: 64 }),
  artistUserId: int("artistUserId"),
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserAffiliation = typeof userAffiliations.$inferSelect;
export type InsertUserAffiliation = typeof userAffiliations.$inferInsert;
