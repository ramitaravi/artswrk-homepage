import {
  boolean,
  double,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
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
  /** "Admin" removed from this enum 2026-08-29 — never actually assigned
   * anywhere in the app (zero hits), admin permission is handled entirely by
   * the separate `role` field. Enterprise accounts still share userRole
   * "Client" (layered with the separate `enterprise` boolean) rather than
   * having their own value — splitting that out is a bigger, deliberately
   * deferred change (would require auditing every userRole === "Client"
   * check across the app to add Enterprise back in). */
  userRole: mysqlEnum("userRole", ["Client", "Artist"]),
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
  /** Raw Bubble "List of Master Services" — a distinct field from artistServices,
   * mapped 1:1 from Bubble, not a replacement for it. */
  masterServiceType: text("masterServiceType"),
  /** JSON array of master artist type strings */
  masterArtistTypes: text("masterArtistTypes"),
  /** JSON array of master style strings */
  masterStyles: text("masterStyles"),
  /** JSON array of experience strings */
  artistExperiences: text("artistExperiences"),
  /** Location string (city, state) — the Google-formatted address we display. */
  location: varchar("location", { length: 256 }),
  /** Structured Google Places data behind `location`, captured on save.
   *  lat/lng are what radius ("artists near me") filtering runs on; city and
   *  state back exact-match filtering for rows without coordinates. Stored as
   *  varchar to match jobs/client_companies, which the same SQL casts. */
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),
  locationCity: varchar("locationCity", { length: 128 }),
  locationState: varchar("locationState", { length: 64 }),
  locationCountry: varchar("locationCountry", { length: 64 }),
  /** Google place id — stable identity for the place, survives renames. */
  locationPlaceId: varchar("locationPlaceId", { length: 128 }),
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
  /**
   * Enterprise billing plan:
   *   on_demand  — pay $100 per job to unlock candidate list
   *   subscriber — monthly ($250/mo) or annual ($2500/yr) subscription
   * Null = not yet assigned (admin sets this)
   */
  enterprisePlan: mysqlEnum("enterprisePlan", ["on_demand", "subscriber"]),
  /** Stripe customer ID for enterprise billing */
  enterpriseStripeCustomerId: varchar("enterpriseStripeCustomerId", { length: 64 }),
  /** Active Stripe subscription ID (subscriber plan only) */
  enterpriseStripeSubscriptionId: varchar("enterpriseStripeSubscriptionId", { length: 64 }),
  /** Billing interval for subscriber plan — set when subscription is activated */
  enterpriseSubInterval: mysqlEnum("enterpriseSubInterval", ["month", "year"]),

  // ── Plan tier (single source of truth for gating — replaces artswrkPro,
  // artswrkBasic, clientPremium, enterprise, enterprisePlan once every read
  // site has migrated over; those fields are kept, untouched, until then) ──
  planTier: mysqlEnum("planTier", [
    "artist_free", "artist_basic", "artist_pro",
    "client_on_demand", "client_premium",
    "enterprise_on_demand", "enterprise_subscription",
  ]),
  /** The current active Stripe subscription, if any — replaces
   * artistStripeProductId (misleadingly named, but that's what it holds),
   * clientSubscriptionId, and enterpriseStripeSubscriptionId. Null for any
   * non-subscription tier (artist_free, client_on_demand, enterprise_on_demand). */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  /** Which exact Stripe Price the active subscription is on — new; nothing
   * stored this before. Lets you tell a legacy monthly PRO subscriber apart
   * from a new annual one without checking Stripe directly. */
  stripePriceId: varchar("stripePriceId", { length: 64 }),

  // ── Onboarding ─────────────────────────────────────────────────────────────
  onboardingStep: int("onboardingStep").default(0),
  userSignedUp: boolean("userSignedUp").default(false),
  beta: boolean("beta").default(false),
  /** True if this account was created by an admin rather than self-serve signup. */
  addedByAdmin: boolean("addedByAdmin").default(false),
  /** Acquisition source — from Bubble's "source", not previously captured. */
  source: varchar("source", { length: 128 }),
  /** Email unsubscribe / marketing opt-out flag. */
  unsubscribe: boolean("unsubscribe").default(false),

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
  /** Stripe Connect account ID for artist payouts (e.g. acct_1PKkRm...) — the
   * real, live field (544 populated, actively read for payouts). */
  artistStripeAccountId: varchar("artistStripeAccountId", { length: 64 }),
  /** OAuth return code from Stripe Connect onboarding flow */
  artistStripeReturnCode: varchar("artistStripeReturnCode", { length: 256 }),
  /** Stripe product ID tied to the artist's Connect account — Connect/payout
   * related, NOT tied to any subscription (confirmed 2026-08-29). The real,
   * live field (536 populated, actively read). stripeProductId and
   * stripeConnectAccountId (dead duplicates from the Bubble migration, never
   * written by live code) and artistStripeAccountType (mislabeled — held a
   * raw account id, not a type; zero live references) were removed
   * 2026-08-29 after confirming 0 divergence from this field. */
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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** FK → users.id (the hirer who created this job) */
  clientUserId: int("clientUserId"),
  /** Bubble client user ID (for cross-referencing during migration) */
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),
  /** Bubble client company ID */
  bubbleClientCompanyId: varchar("bubbleClientCompanyId", { length: 64 }),
  /** FK → client_companies.id — which of the poster's companies this job was posted under (null = posted as themselves, no company) */
  clientCompanyId: int("clientCompanyId"),
  /** Bubble artist ID stored on converted or filled requests */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  /** Bubble artist type reference */
  bubbleArtistTypeId: varchar("bubbleArtistTypeId", { length: 64 }),
  /** Bubble booking IDs associated with this request */
  bubbleBookingIds: longtext("bubbleBookingIds"),
  /** Bubble Interested Artist record IDs associated with this request */
  bubbleInterestedArtistIds: longtext("bubbleInterestedArtistIds"),
  /** Bubble artist user IDs associated with interested artists */
  bubbleInterestedArtistUserIds: longtext("bubbleInterestedArtistUserIds"),

  // ── Content ────────────────────────────────────────────────────────────────
  description: text("description"),
  title: varchar("title", { length: 256 }),
  slug: varchar("slug", { length: 256 }),

  // ── Status ─────────────────────────────────────────────────────────────────
  /** e.g. Active, Confirmed, Completed, Deleted by Client, Submissions Paused, Lost - No Revenue */
  requestStatus: varchar("requestStatus", { length: 64 }),
  /** e.g. Awaiting Response, Confirmed, etc. */
  status: varchar("status", { length: 64 }),

  // ── Scheduling ─────────────────────────────────────────────────────────────
  /** Single Date | Ongoing | Recurring */
  dateType: varchar("dateType", { length: 32 }),
  dateDetails: text("dateDetails"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),

  // ── Location ───────────────────────────────────────────────────────────────
  locationAddress: text("locationAddress"),
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),
  /** Structured Google Places data behind the address above, captured when the
   *  location is picked. City/state back exact-match filtering; placeId is the
   *  stable identity for the place. */
  locationCity: varchar("locationCity", { length: 128 }),
  locationState: varchar("locationState", { length: 64 }),
  locationPlaceId: varchar("locationPlaceId", { length: 128 }),

  // ── Rates ──────────────────────────────────────────────────────────────────
  isHourly: boolean("isHourly").default(true),
  openRate: boolean("openRate").default(false),
  artistHourlyRate: int("artistHourlyRate"),
  clientHourlyRate: int("clientHourlyRate"),
  artistFlatRate: int("artistFlatRate"),
  clientFlatRate: int("clientFlatRate"),
  hours: double("hours"),
  rateType: varchar("rateType", { length: 64 }),

  // ── Audience ───────────────────────────────────────────────────────────────
  /** JSON array of age ranges e.g. ["6-10", "11-14"] */
  ages: text("ages"),

  // ── Flags ──────────────────────────────────────────────────────────────────
  direct: boolean("direct").default(false),
  /** Bubble-era boolean. Superseded by networkStatus below, kept because the
   *  Bubble sync scripts still write it and it's the historical record of what
   *  the old system sent. Do not read it for send decisions. */
  sentToNetwork: boolean("sentToNetwork").default(false),
  /** Where this job sits in the job-alert queue.
   *    pending         — waiting for the next 1pm ET digest run
   *    sent_digest     — included in a digest
   *    sent_lastminute — sent immediately (starts within 48h)
   *    expired         — start date passed before it was ever sent
   *    suppressed      — deliberately excluded; every pre-launch job is set to
   *                      this so the first digest run can't blast the backlog
   *  Null on legacy rows is treated as `suppressed`, never as `pending`. */
  networkStatus: mysqlEnum("networkStatus", [
    "pending", "sent_digest", "sent_lastminute", "expired", "suppressed",
  ]),
  networkSentAt: timestamp("networkSentAt"),
  transportation: boolean("transportation").default(false),
  transportationDetails: text("transportationDetails"),
  converted: boolean("converted").default(false),
  sameDay: boolean("sameDay").default(false),
  unlocked: boolean("unlocked").default(false),
  outreachStatus: varchar("outreachStatus", { length: 128 }),
  sentTo: longtext("sentTo"),

  // ── Service Type ───────────────────────────────────────────────────────────
  /** Bubble master_service_type ID — will resolve to name in future */
  masterServiceTypeId: varchar("masterServiceTypeId", { length: 64 }),
  /** JSON array of Bubble master style IDs */
  bubbleMasterStyleIds: longtext("bubbleMasterStyleIds"),

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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),

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

/**
 * Canonical mirror of Bubble's interestedartists data type.
 * One row is retained per Bubble record before records are normalized into
 * standard-job and premium-job application tables for application queries.
 */
export const bubbleInterestedArtistsSource = mysqlTable("bubble_interested_artists_source", {
  id: int("id").autoincrement().primaryKey(),
  bubbleId: varchar("bubbleId", { length: 64 }).notNull().unique(),
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  bubbleRequestId: varchar("bubbleRequestId", { length: 64 }),
  bubblePremiumJobId: varchar("bubblePremiumJobId", { length: 64 }),
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  bubbleBookingId: varchar("bubbleBookingId", { length: 64 }),
  bubbleServiceId: varchar("bubbleServiceId", { length: 64 }),
  status: varchar("status", { length: 64 }),
  converted: boolean("converted").default(false),
  isHourlyRate: boolean("isHourlyRate").default(false),
  artistHourlyRate: double("artistHourlyRate"),
  clientHourlyRate: double("clientHourlyRate"),
  artistFlatRate: double("artistFlatRate"),
  clientFlatRate: double("clientFlatRate"),
  premiumJobRate: varchar("premiumJobRate", { length: 255 }),
  rateType: varchar("rateType", { length: 64 }),
  totalHours: double("totalHours"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  resumeLink: text("resumeLink"),
  message: text("message"),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ── Bookings (Bubble: booking) ────────────────────────────────────────────────
/**
 * Confirmed bookings — the final step in the job → applicant → booking chain.
 * One row per booking. Links back to a job (Request) and an interested artist record.
 */
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble internal record ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → jobs.id */
  jobId: int("jobId"),
  /** Bubble Request/job ID */
  bubbleRequestId: varchar("bubbleRequestId", { length: 64 }),
  /** Bubble Job relation ID, retained separately from Request */
  bubbleJobId: varchar("bubbleJobId", { length: 64 }),
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
  /** Exact Bubble List of Payments relationship */
  bubblePaymentIds: longtext("bubblePaymentIds"),
  /** Exact Bubble List of Reimbursement relationship */
  bubbleReimbursementIds: longtext("bubbleReimbursementIds"),

  // ── Status ─────────────────────────────────────────────────────────────────
  /** Confirmed | Completed | Cancelled | Pay Now */
  bookingStatus: varchar("bookingStatus", { length: 64 }),
  /** Paid | Unpaid */
  paymentStatus: varchar("paymentStatus", { length: 64 }),

  // ── Rates & Financials ─────────────────────────────────────────────────────
  /** What the client pays */
  clientRate: double("clientRate"),
  /** What the artist receives */
  artistRate: double("artistRate"),
  /** Total client rate including reimbursements */
  totalClientRate: double("totalClientRate"),
  /** Total artist rate including reimbursements */
  totalArtistRate: double("totalArtistRate"),
  /** Artswrk gross profit (clientRate - artistRate - stripeFee) */
  grossProfit: double("grossProfit"),
  /** Stripe processing fee */
  stripeFee: double("stripeFee"),
  /** Revenue after Stripe fee */
  postFeeRevenue: double("postFeeRevenue"),
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
  /** Structured Google Places data behind the address above, captured when the
   *  location is picked. City/state back exact-match filtering; placeId is the
   *  stable identity for the place. */
  locationCity: varchar("locationCity", { length: 128 }),
  locationState: varchar("locationState", { length: 64 }),
  locationPlaceId: varchar("locationPlaceId", { length: 128 }),

  // ── Content ────────────────────────────────────────────────────────────────
  description: text("description"),
  stripeCheckoutUrl: text("stripeCheckoutUrl"),
  /** Legacy Bubble invoice relation or value */
  bubbleInvoice: text("bubbleInvoice"),

  // ── Payment Method ────────────────────────────────────────────────────────
  /**
   * How the artist will be paid:
   *   "artswrk" — client pays via Artswrk invoice (4% processing fee)
   *   "direct"  — client pays artist directly outside Artswrk
   * Null = not yet decided (legacy/Bubble bookings).
   */
  paymentMethod: varchar("paymentMethod", { length: 16 }),
  /** Timestamp when the artist confirmed they received direct payment */
  directPayConfirmedAt: timestamp("directPayConfirmedAt"),
  /** Timestamp when the artist submitted their Artswrk invoice */
  artswrkInvoiceSubmittedAt: timestamp("artswrkInvoiceSubmittedAt"),
  /**
   * Timestamp the "complete your booking" reminder was sent (fires 10 min
   * after startDate has a real time-of-day, or the calendar day of startDate
   * if it doesn't). Set once so the reminder never sends twice.
   */
  completionReminderSentAt: timestamp("completionReminderSentAt"),
  /** Unique token for the studio payment link (e.g. /invoice/:token) */
  invoicePaymentToken: varchar("invoicePaymentToken", { length: 64 }),
  /** Stripe Checkout session URL — created when the studio approves the invoice, not when the artist submits it */
  invoiceStripeCheckoutUrl: text("invoiceStripeCheckoutUrl"),
  /** Total invoice amount in cents at submission time */
  invoiceTotalCents: int("invoiceTotalCents"),
  /** Timestamp when the studio paid the invoice via Stripe */
  invoicePaidAt: timestamp("invoicePaidAt"),
  /** Stripe payment intent ID for this invoice payment */
  invoiceStripePaymentIntentId: varchar("invoiceStripePaymentIntentId", { length: 128 }),

  // ── Flags ──────────────────────────────────────────────────────────────────
  addedToSpreadsheet: boolean("addedToSpreadsheet").default(false),
  deleted: boolean("deleted").default(false),
  notificationArtistScheduledReminder: boolean("notificationArtistScheduledReminder").default(false),
  showAlert: boolean("showAlert").default(false),
  bubbleWorkflowId2: varchar("bubbleWorkflowId2", { length: 256 }),
  /** Created directly by admin (not via job → applicant flow) */
  isAdminBooking: boolean("isAdminBooking").default(false),
  /** Whether this booking recurs on a fixed cadence */
  isRecurring: boolean("isRecurring").default(false),
  /** weekly | biweekly | monthly | quarterly — set when isRecurring = true */
  recurringCadence: varchar("recurringCadence", { length: 32 }),

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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),

  // ── Relationships ──────────────────────────────────────────────────────────
  /** FK → bookings.id */
  bookingId: int("bookingId"),
  /** Bubble booking ID (for cross-referencing) */
  bubbleBookingId: varchar("bubbleBookingId", { length: 64 }),
  /** Bubble Request ID retained for legacy payments without a booking */
  bubbleRequestId: varchar("bubbleRequestId", { length: 64 }),
  /** FK → users.id (the client who paid) */
  clientUserId: int("clientUserId"),

  // ── Stripe Data ────────────────────────────────────────────────────────────
  /** Stripe charge ID e.g. ch_3LsIGN... */
  stripeId: varchar("stripeId", { length: 128 }),
  /** Stripe customer ID retained for migrated Checkout records */
  stripeCustomer: varchar("stripeCustomer", { length: 128 }),
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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),

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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),

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
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),

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
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),
  /** Structured Google Places data behind the address above, captured when the
   *  location is picked. City/state back exact-match filtering; placeId is the
   *  stable identity for the place. */
  locationCity: varchar("locationCity", { length: 128 }),
  locationState: varchar("locationState", { length: 64 }),
  locationPlaceId: varchar("locationPlaceId", { length: 128 }),
  /** Bubble master_service_type id, and its parent artist type. PRO jobs stored
   *  only free-text serviceType/category until now, which left them unmatchable
   *  — this is what lets them into the job alert emails for the first time. */
  masterServiceTypeId: varchar("masterServiceTypeId", { length: 64 }),
  bubbleArtistTypeId: varchar("bubbleArtistTypeId", { length: 64 }),
  /** Job-alert queue state. Same semantics as jobs.networkStatus. */
  networkStatus: mysqlEnum("networkStatus", [
    "pending", "sent_digest", "sent_lastminute", "expired", "suppressed",
  ]),
  networkSentAt: timestamp("networkSentAt"),
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
  /** Exact Bubble interested_artists relationship list, normalized in the next phase. */
  bubbleInterestedArtistIds: longtext("bubbleInterestedArtistIds"),

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
  /** True when this Bubble record exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** FK → premium_jobs.id */
  premiumJobId: int("premiumJobId").notNull(),
  /** Bubble premium job ID */
  bubblePremiumJobId: varchar("bubblePremiumJobId", { length: 64 }),
  /** FK → users.id (the artist) */
  artistUserId: int("artistUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  /** Bubble interestedartists record ID */
  bubbleInterestedArtistId: varchar("bubbleInterestedArtistId", { length: 64 }).unique(),
  /** Artist's application message */
  message: text("message"),
  /** Rate the artist quoted for this job */
  rate: varchar("rate", { length: 255 }),
  /** Resume/portfolio link */
  resumeLink: text("resumeLink"),
  /** Status from Bubble */
  status: varchar("status", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
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
  ownerUserId: int("ownerUserId"),
  /** Company display name */
  name: varchar("name", { length: 256 }).notNull(),
  /** Company logo URL */
  logo: text("logo"),
  /** Bubble client company ID (for deduplication) */
  bubbleClientCompanyId: varchar("bubbleClientCompanyId", { length: 64 }),
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),
  /** Exact JSON list from Bubble's Client relationship field */
  bubbleClientIds: longtext("bubbleClientIds"),
  /** Website URL */
  website: text("website"),
  /** Description */
  description: text("description"),
  /** Company location address */
  locationAddress: text("locationAddress"),
  locationLat: varchar("locationLat", { length: 32 }),
  locationLng: varchar("locationLng", { length: 32 }),
  /** Structured Google Places data behind the address above, captured when the
   *  location is picked. City/state back exact-match filtering; placeId is the
   *  stable identity for the place. */
  locationCity: varchar("locationCity", { length: 128 }),
  locationState: varchar("locationState", { length: 64 }),
  locationPlaceId: varchar("locationPlaceId", { length: 128 }),
  /** Whether the company reimburses artist transportation */
  transportReimbursed: boolean("transportReimbursed").default(false),
  /** Instructions for how artists should get to this studio */
  transportDetails: text("transportDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
}, (t) => ({
  /** One destination company per Bubble ClientCompany record */
  bubbleCompanyUniq: uniqueIndex("client_companies_bubble_id_uniq").on(t.bubbleClientCompanyId),
}));
export type ClientCompany = typeof clientCompanies.$inferSelect;
export type InsertClientCompany = typeof clientCompanies.$inferInsert;

/** Exact Bubble ClientCompany.Client relationship rows. */
export const clientCompanyMemberships = mysqlTable("client_company_memberships", {
  id: int("id").autoincrement().primaryKey(),
  clientCompanyId: int("clientCompanyId").notNull(),
  userId: int("userId"),
  bubbleClientCompanyId: varchar("bubbleClientCompanyId", { length: 64 }).notNull(),
  bubbleUserId: varchar("bubbleUserId", { length: 64 }).notNull(),
  isPrimary: boolean("isPrimary").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  companyUserUniq: uniqueIndex("client_company_memberships_company_user_uniq").on(t.clientCompanyId, t.bubbleUserId),
}));

/**
 * Enterprise Job Unlocks — tracks which on-demand enterprise jobs have been
 * paid for (at $100 each) so the client can view the candidate list.
 */
export const enterpriseJobUnlocks = mysqlTable("enterprise_job_unlocks", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id (the enterprise client who paid) */
  clientUserId: int("clientUserId").notNull(),
  /** FK → premium_jobs.id */
  jobId: int("jobId").notNull(),
  /** Stripe Checkout Session ID for this payment */
  stripeSessionId: varchar("stripeSessionId", { length: 128 }),
  /** Stripe Payment Intent ID */
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  /** Amount paid in cents (should be 10000 = $100) */
  amountCents: int("amountCents").default(10000),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EnterpriseJobUnlock = typeof enterpriseJobUnlocks.$inferSelect;
export type InsertEnterpriseJobUnlock = typeof enterpriseJobUnlocks.$inferInsert;

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

  // ── Source ────────────────────────────────────────────────────────────────
  /** Which Facebook group this lead came from (group name label) */
  sourceGroup: varchar("sourceGroup", { length: 256 }),

  // ── Poster Identity ───────────────────────────────────────────────────────
  /** Person or company name */
  name: varchar("name", { length: 256 }),
  /** Direct link to the poster's Facebook profile */
  posterFacebookUrl: text("posterFacebookUrl"),
  /** Email address extracted from post or contact info */
  email: varchar("email", { length: 320 }),
  /** Instagram handle (e.g. @username) */
  instagram: varchar("instagram", { length: 128 }),
  /** All contact info in one string (fallback / extra detail) */
  contactInfo: varchar("contactInfo", { length: 512 }),

  // ── Studio / Company ──────────────────────────────────────────────────────
  /** Studio or company affiliation */
  studioName: varchar("studioName", { length: 256 }),
  /** Studio Facebook page or website URL */
  studioUrl: text("studioUrl"),
  /** Studio physical address */
  studioAddress: text("studioAddress"),

  // ── Location ──────────────────────────────────────────────────────────────
  /** Full location string (e.g. "Lincoln Park, Chicago, IL") */
  location: varchar("location", { length: 256 }),
  /** City only — for filtering */
  city: varchar("city", { length: 128 }),
  /** State abbreviation — for filtering */
  state: varchar("state", { length: 32 }),

  // ── Job Details ───────────────────────────────────────────────────────────
  /** For jobs: role/title. For artists: primary discipline */
  title: varchar("title", { length: 256 }),
  /** AI-generated 1-2 sentence summary of the post */
  jobSummary: text("jobSummary"),
  /** Clean extracted job description (plain text, no fluff) */
  jobDescription: text("jobDescription"),
  /** Raw original post text */
  rawPostText: text("rawPostText"),
  /** Full description / original post text excerpt (legacy) */
  description: text("description"),

  // ── Scheduling ────────────────────────────────────────────────────────────
  /** Date string as written in the post (e.g. "Saturday 3/15", "April - June") */
  jobDate: varchar("jobDate", { length: 256 }),
  /** Single Date | Recurring | Ongoing */
  jobDateType: mysqlEnum("jobDateType", ["single", "recurring", "ongoing"]),

  // ── Rates ─────────────────────────────────────────────────────────────────
  /** Rate string as written in the post (e.g. "$50/hr", "$500 flat") */
  rate: varchar("rate", { length: 128 }),
  /** Parsed rate amount in cents (e.g. 5000 = $50.00) */
  rateAmount: int("rateAmount"),
  /** hourly | flat | open */
  rateType: mysqlEnum("rateType", ["hourly", "flat", "open"]),

  // ── Disciplines ───────────────────────────────────────────────────────────
  /** Disciplines / skills (JSON array string) */
  disciplines: text("disciplines"),

  // ── Outreach ──────────────────────────────────────────────────────────────
  /** AI-generated DM message */
  outreachMessage: text("outreachMessage"),
  /** Magic link token for pre-filled onboarding */
  magicLinkToken: varchar("magicLinkToken", { length: 128 }),
  /** Free-text notes from your team */
  notes: text("notes"),

  // ── Status & Funnel Tracking ──────────────────────────────────────────────
  /** "new" | "outreach_sent" | "clicked" | "joined" */
  status: mysqlEnum("status", ["new", "outreach_sent", "clicked", "joined"]).default("new").notNull(),
  /** Full funnel stage: lead → outreach_sent → signed_up → job_posted → booking_made */
  funnelStage: mysqlEnum("funnelStage", ["lead", "outreach_sent", "signed_up", "job_posted", "booking_made"]).default("lead"),
  outreachSentAt: timestamp("outreachSentAt"),
  /** FK → users.id if they signed up via magic link */
  convertedUserId: int("convertedUserId"),
  /** FK → jobs.id once this lead posts a job on the platform */
  convertedJobId: int("convertedJobId"),
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
  /** Bubble internal record ID — used for idempotent migration */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** FK → users.id (the artist being reviewed) */
  artistUserId: int("artistUserId").notNull(),
  /** FK → users.id (the client who left the review) */
  clientUserId: int("clientUserId"),
  /** Bubble artist user ID */
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  /** Bubble client user ID */
  bubbleClientId: varchar("bubbleClientId", { length: 64 }),
  /** FK → bookings.id */
  bookingId: int("bookingId"),
  /** Bubble booking ID */
  bubbleBookingId: varchar("bubbleBookingId", { length: 64 }),
  /** Reviewer name (hirer/studio name) — resolved from client user at migration time */
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
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
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

  /** FK → booking_periods.id (for admin booking period reimbursements) */
  bookingPeriodId: int("bookingPeriodId"),

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

/**
 * One billing period per recurring admin booking cycle.
 * For one-time admin bookings this table has exactly one row per booking.
 * The artist submits hours + reimbursements for each period;
 * the system then generates a client invoice (same Stripe flow as regular bookings).
 */
export const bookingPeriods = mysqlTable("booking_periods", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → bookings.id */
  bookingId: int("bookingId").notNull(),
  /** 1-based index within the booking's recurring schedule */
  periodNumber: int("periodNumber").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  /** When to auto-email the artist to submit hours */
  notifyArtistAt: timestamp("notifyArtistAt").notNull(),
  /** Set when the notification email was sent */
  artistNotifiedAt: timestamp("artistNotifiedAt"),
  /** Set when the artist submits hours for this period */
  artistSubmittedAt: timestamp("artistSubmittedAt"),
  /** upcoming | open | artist_submitted | client_paid */
  status: varchar("status", { length: 32 }).default("upcoming"),
  /** Actual hours worked (artist fills this in at submission) */
  actualHours: double("actualHours"),
  artistNotes: text("artistNotes"),
  // ── Per-period invoice (same pattern as bookings.invoicePaymentToken) ──────
  invoicePaymentToken: varchar("invoicePaymentToken", { length: 64 }),
  invoiceStripeCheckoutUrl: text("invoiceStripeCheckoutUrl"),
  invoiceTotalCents: int("invoiceTotalCents"),
  invoicePaidAt: timestamp("invoicePaidAt"),
  invoiceStripePaymentIntentId: varchar("invoiceStripePaymentIntentId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BookingPeriod = typeof bookingPeriods.$inferSelect;
export type InsertBookingPeriod = typeof bookingPeriods.$inferInsert;

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

// ─── Rate Conversion Table ────────────────────────────────────────────────────

/**
 * Artist-to-client rate conversion lookup table.
 * Maps artist rates → client rates (the Artswrk markup).
 * Used when suggesting client pricing for a given artist rate.
 * Maps to Bubble's "ArtistToClientRateConversion" type (1,986 records).
 */
export const rateConversions = mysqlTable("rate_conversions", {
  id: int("id").autoincrement().primaryKey(),
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** "artist_to_client" = suggest client price from artist rate; "client_to_artist" = reverse */
  conversionType: mysqlEnum("conversionType", ["artist_to_client", "client_to_artist"]).default("artist_to_client"),
  artistRate: double("artistRate"),
  clientRate: double("clientRate"),
  isHourly: boolean("isHourly").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
});
export type RateConversion = typeof rateConversions.$inferSelect;
export type InsertRateConversion = typeof rateConversions.$inferInsert;

// ─── Benefits (Partner Perks) ─────────────────────────────────────────────────

/**
 * Partner benefits / perks shown to artists and clients.
 * e.g. discounts from dance software, conventions, curriculum providers.
 * Maps to Bubble's "Benefits" type (27 records).
 */
export const benefits = mysqlTable("benefits", {
  id: int("id").autoincrement().primaryKey(),
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  /** True when this Bubble ID exists in the latest complete live-source reconciliation. */
  bubbleSourcePresent: boolean("bubbleSourcePresent").default(false),
  /** Bubble user ID recorded in the source record's Created By field */
  bubbleCreatedById: varchar("bubbleCreatedById", { length: 64 }),

  companyName: varchar("companyName", { length: 256 }),
  slug: varchar("slug", { length: 256 }),
  logoUrl: text("logoUrl"),
  url: text("url"),
  businessDescription: text("businessDescription"),
  discountOffering: text("discountOffering"),
  howToRedeem: text("howToRedeem"),
  contactName: varchar("contactName", { length: 256 }),
  contactEmail: varchar("contactEmail", { length: 320 }),

  /** JSON array: ["Artist"] | ["Client"] | ["Artist", "Client"] */
  audienceTypes: text("audienceTypes"),
  /** JSON array: ["Dance Studio", "Dance Competition", ...] */
  businessTypes: text("businessTypes"),
  /** JSON array: ["Dance Educator", "Dance Adjudicator", ...] */
  artistTypes: text("artistTypes"),
  /** JSON array: ["Software", "Convention", "Curriculum", ...] */
  categories: text("categories"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type Benefit = typeof benefits.$inferSelect;
export type InsertBenefit = typeof benefits.$inferInsert;

// ─── End of Year Email Snapshots ──────────────────────────────────────────────

/**
 * Annual earnings snapshot sent to artists at year end.
 * Maps to Bubble's "end_of_year_email" type (144 records).
 */
export const eoyEmailSnapshots = mysqlTable("eoy_email_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  artistUserId: int("artistUserId"),
  bubbleArtistId: varchar("bubbleArtistId", { length: 64 }),
  name: varchar("name", { length: 256 }),
  email: varchar("email", { length: 320 }),
  bookings2023: int("bookings2023"),
  earnings2023: double("earnings2023"),
  reimbursements2023: double("reimbursements2023"),
  bookings2024: int("bookings2024"),
  earnings2024: double("earnings2024"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  bubbleCreatedAt: timestamp("bubbleCreatedAt"),
  bubbleModifiedAt: timestamp("bubbleModifiedAt"),
});
export type EoyEmailSnapshot = typeof eoyEmailSnapshots.$inferSelect;
export type InsertEoyEmailSnapshot = typeof eoyEmailSnapshots.$inferInsert;

/**
 * Password Reset Tokens
 * Short-lived tokens emailed to users for the forgot-password flow.
 * Tokens expire after 1 hour and are single-use (deleted on redemption).
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── Master Artist Types ──────────────────────────────────────────────────────

/**
 * Lookup table for the 8 master artist type categories (Dance Educator, Photographer, etc.).
 * Sourced from Bubble option set — seeded from reference_data.ts, not migrated via API.
 */
export const masterArtistTypes = mysqlTable("master_artist_types", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble option set value ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }),
  iconUrl: text("iconUrl"),
  listingOrder: int("listingOrder"),
  isPublic: boolean("isPublic").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MasterArtistType = typeof masterArtistTypes.$inferSelect;
export type InsertMasterArtistType = typeof masterArtistTypes.$inferInsert;

// ─── Master Service Types ─────────────────────────────────────────────────────

/**
 * Lookup table for the 42 service types grouped under master artist types.
 * e.g. "Recurring Classes", "Substitute Teacher", "Competition Choreography"
 * Sourced from Bubble option set — seeded from reference_data.ts.
 */
export const masterServiceTypes = mysqlTable("master_service_types", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble option set value ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }),
  /** FK → master_artist_types.id */
  masterArtistTypeId: int("masterArtistTypeId"),
  /** Bubble artist type option ID (for cross-referencing) */
  bubbleArtistTypeId: varchar("bubbleArtistTypeId", { length: 64 }),
  listingOrder: int("listingOrder"),
  isPublic: boolean("isPublic").default(true),
  isMcLandingPage: boolean("isMcLandingPage").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MasterServiceType = typeof masterServiceTypes.$inferSelect;
export type InsertMasterServiceType = typeof masterServiceTypes.$inferInsert;

// ─── Master Style Types ───────────────────────────────────────────────────────

/**
 * Lookup table for the 34 dance style/discipline option set values.
 * e.g. "Ballet", "Jazz", "Hip Hop", "Contemporary"
 * Sourced from Bubble option set — seeded from reference_data.ts.
 */
export const masterStyleTypes = mysqlTable("master_style_types", {
  id: int("id").autoincrement().primaryKey(),
  /** Bubble option set value ID */
  bubbleId: varchar("bubbleId", { length: 64 }).unique(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MasterStyleType = typeof masterStyleTypes.$inferSelect;
export type InsertMasterStyleType = typeof masterStyleTypes.$inferInsert;

// ─── Sync Runs Log ────────────────────────────────────────────────────────────

/**
 * Tracks each Bubble→DB sync run for monitoring and debugging.
 * Visible in the admin dashboard to confirm sync health.
 */
export const syncRuns = mysqlTable("sync_runs", {
  id: int("id").autoincrement().primaryKey(),
  /** "frequent" | "daily" */
  mode: mysqlEnum("mode", ["frequent", "daily"]).notNull(),
  /** "running" | "success" | "error" */
  status: mysqlEnum("status", ["running", "success", "error"]).notNull().default("running"),
  /** Summary of records upserted per table (JSON) */
  summary: text("summary"),
  /** Error message if status = 'error' */
  errorMessage: text("errorMessage"),
  /** How long the sync took in milliseconds */
  durationMs: int("durationMs"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});
export type SyncRun = typeof syncRuns.$inferSelect;
export type InsertSyncRun = typeof syncRuns.$inferInsert;

// ─── Client Job Unlocks ───────────────────────────────────────────────────────
/**
 * Tracks per-job unlocks for regular (non-enterprise) clients on the on-demand plan.
 * Once a job is unlocked it stays unlocked forever, even if the client unsubscribes.
 * Active subscribers have all jobs auto-unlocked (checked at query time via clientSubscriptionId).
 */
export const clientJobUnlocks = mysqlTable("client_job_unlocks", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id (the client who paid to unlock) */
  clientUserId: int("clientUserId").notNull(),
  /** FK → jobs.id */
  jobId: int("jobId").notNull(),
  /** Stripe Checkout Session ID for this payment */
  stripeSessionId: varchar("stripeSessionId", { length: 128 }),
  /** Stripe Payment Intent ID */
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  /** Amount paid in cents (3000 = $30) */
  amountCents: int("amountCents").default(3000),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientJobUnlock = typeof clientJobUnlocks.$inferSelect;
export type InsertClientJobUnlock = typeof clientJobUnlocks.$inferInsert;

// ─── Leads CRM Cache ──────────────────────────────────────────────────────────

/**
 * Cached snapshot of Brevo contacts, enriched with Artswrk user data.
 * Synced on-demand via the admin Leads Dashboard "Sync from Brevo" button.
 *
 * This is the single source of truth for the Leads CRM — never query Brevo
 * live for list/filter views; always read from this table.
 */
export const leadsContacts = mysqlTable("leads_contacts", {
  id: int("id").autoincrement().primaryKey(),

  // ── Brevo identity ──────────────────────────────────────────────────────────
  brevoId: int("brevoId").unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailBlacklisted: boolean("emailBlacklisted").default(false),

  // ── Brevo contact attributes ────────────────────────────────────────────────
  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  fullName: varchar("fullName", { length: 256 }),
  companyName: varchar("companyName", { length: 256 }),

  /** CITY attribute from Brevo (may include state, e.g. "Chicago, IL, USA") */
  city: varchar("city", { length: 256 }),
  state: varchar("state", { length: 128 }),
  country: varchar("country", { length: 128 }),

  /** USERROLE from Brevo: "Artist" | "Client" | null */
  brevoUserRole: varchar("brevoUserRole", { length: 64 }),

  /** HIRING_CATEGORY from Brevo: "Dance Studio" | "Dance Competition" | "Music School" | "Other Business" | etc. */
  hiringCategory: varchar("hiringCategory", { length: 128 }),

  /** JSON array of Brevo list IDs this contact belongs to */
  brevoListIds: text("brevoListIds"),

  // ── Brevo engagement stats (cached from /contacts/{email}/campaignStats) ────
  /** Total campaigns received */
  totalCampaignsReceived: int("totalCampaignsReceived").default(0),
  /** Total unique opens */
  totalOpens: int("totalOpens").default(0),
  /** Total unique clicks */
  totalClicks: int("totalClicks").default(0),
  /** Last campaign open date */
  lastOpenedAt: timestamp("lastOpenedAt"),
  /** Last campaign click date */
  lastClickedAt: timestamp("lastClickedAt"),
  /** Last campaign received date */
  lastCampaignAt: timestamp("lastCampaignAt"),
  /** Whether this contact has ever unsubscribed */
  hasUnsubscribed: boolean("hasUnsubscribed").default(false),

  // ── Artswrk user cross-reference ────────────────────────────────────────────
  /** FK → users.id — null if not on Artswrk */
  artswrkUserId: int("artswrkUserId"),
  /** Whether this email has an Artswrk account */
  isArtswrkUser: boolean("isArtswrkUser").default(false),
  /** "Artist" | "Client" | "Admin" | null */
  artswrkUserRole: varchar("artswrkUserRole", { length: 32 }),
  /** Artswrk hiringCategory: "Dance Studio" | "Dance Competition" | "Music School" | "Other Business" | etc. */
  artswrkHiringCategory: varchar("artswrkHiringCategory", { length: 128 }),

  // ── Artswrk activity (denormalized for fast list queries) ───────────────────
  /** Number of jobs posted on Artswrk */
  jobsPostedCount: int("jobsPostedCount").default(0),
  /** Number of bookings made on Artswrk */
  bookingCount: int("bookingCount").default(0),
  /** Whether on Artswrk Pro */
  artswrkPro: boolean("artswrkPro").default(false),
  /** Whether on Artswrk Basic */
  artswrkBasic: boolean("artswrkBasic").default(false),
  /** Whether on Client Premium */
  clientPremium: boolean("clientPremium").default(false),

  // ── Sync metadata ───────────────────────────────────────────────────────────
  /** When this record was last synced from Brevo */
  lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
  /** When this contact was first added to Brevo */
  brevoCreatedAt: timestamp("brevoCreatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeadsContact = typeof leadsContacts.$inferSelect;
export type InsertLeadsContact = typeof leadsContacts.$inferInsert;

/**
 * Tracks the last time a full Brevo sync was run.
 * Used to show "Last synced X minutes ago" in the UI.
 */
export const leadsSyncLog = mysqlTable("leads_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  /** "full" = all contacts, "stats" = engagement stats only */
  syncType: mysqlEnum("syncType", ["full", "stats"]).notNull().default("full"),
  /** How many contacts were upserted */
  contactsUpserted: int("contactsUpserted").default(0),
  /** How many contacts were enriched with Artswrk data */
  artswrkMatched: int("artswrkMatched").default(0),
  /** Error message if sync failed */
  error: text("error"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type LeadsSyncLog = typeof leadsSyncLog.$inferSelect;

// ── Saved Artists (Client Favorites) ─────────────────────────────────────────
export const savedArtists = mysqlTable("saved_artists", {
  id: int("id").autoincrement().primaryKey(),
  clientUserId: int("clientUserId").notNull(),
  artistUserId: int("artistUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SavedArtist = typeof savedArtists.$inferSelect;

/** Who invited whom — from Bubble's "Invited Users" list field, normalized
 * into a real table instead of a JSON blob on the user row. */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerUserId: int("referrerUserId").notNull(),
  invitedUserId: int("invitedUserId").notNull(),
  bubbleId: varchar("bubbleId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Referral = typeof referrals.$inferSelect;

// ─── Job Alert Emails ─────────────────────────────────────────────────────────

/**
 * Per-artist job alert preferences — layer 1 of the three-layer opt-out
 * architecture, and the source of truth for what a person *asked* for (as
 * opposed to email_suppressions, which records what they or their provider
 * have *blocked*).
 *
 * `serviceTypes` deliberately holds the same Bubble master_service_type ids
 * the matcher reads off users.masterServiceType, not names. The older
 * name-keyed toggles on artist_service_categories.jobEmailEnabled stay as a
 * display surface and write through to this table — one place decides who
 * gets what, so a preference can never be true in one taxonomy and false in
 * the other.
 */
export const userNotificationSettings = mysqlTable("user_notification_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId").notNull().unique(),
  /** Global kill switch for job alert emails. Off = no digest, no last-minute. */
  jobEmailsEnabled: boolean("jobEmailsEnabled").default(true).notNull(),
  /** Separate toggle — some artists want the daily digest but not urgent one-offs. */
  lastMinuteEnabled: boolean("lastMinuteEnabled").default(true).notNull(),
  /** JSON array of Bubble master_service_type ids the artist wants alerts for.
   *  Seeded from users.masterServiceType. Empty array = matches nothing, which
   *  is intentional: an artist who never picked a service hasn't consented to
   *  hearing about all of them. */
  serviceTypes: text("serviceTypes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type InsertUserNotificationSettings = typeof userNotificationSettings.$inferInsert;

/**
 * Unified suppression list — every address that must not receive a given class
 * of mail, whatever the reason and whoever recorded it. Written by the SendGrid
 * event webhook, the nightly Brevo blocklist sync, and in-app unsubscribes;
 * read by the send worker before EVERY send rather than on a nightly snapshot,
 * so a one-click unsubscribe takes effect on the next batch instead of the
 * next day.
 *
 * Keyed by email rather than userId on purpose: bounces and spam reports
 * arrive from providers as bare addresses, often for people who no longer
 * have (or never had) an account.
 */
export const emailSuppressions = mysqlTable("email_suppressions", {
  id: int("id").autoincrement().primaryKey(),
  /** Always stored lowercased — every read path lowercases before comparing. */
  email: varchar("email", { length: 320 }).notNull(),
  /** Who told us: sendgrid | brevo | inapp */
  source: mysqlEnum("source", ["sendgrid", "brevo", "inapp"]).notNull(),
  /** How wide the block is. `global` blocks all mail; `job_alerts` blocks only
   *  this system, leaving booking confirmations and other transactional mail. */
  scope: mysqlEnum("scope", ["global", "job_alerts"]).default("job_alerts").notNull(),
  /** Provider event or human reason: bounce, spamreport, unsubscribe, … */
  reason: varchar("reason", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // One row per address per scope — re-reporting the same block updates in
  // place instead of growing the table on every webhook retry.
  emailScope: uniqueIndex("email_suppressions_email_scope").on(t.email, t.scope),
}));
export type EmailSuppression = typeof emailSuppressions.$inferSelect;
export type InsertEmailSuppression = typeof emailSuppressions.$inferInsert;

/**
 * One row per (job, artist, send). This is the load-bearing table of the whole
 * system: it is simultaneously the dedupe guard (an artist can never be sent
 * the same job twice, across both the digest and last-minute paths), the
 * counter behind the 3-per-rolling-24h last-minute cap, and the audit trail
 * for what actually went out.
 *
 * A run that matched nobody still writes a row with recipientCount = 0, so a
 * job is never left looking unsent and retried forever.
 */
export const emailSendLog = mysqlTable("email_send_log", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → jobs.id for regular jobs, null when premiumJobId is set. */
  jobId: int("jobId"),
  /** FK → premium_jobs.id for PRO jobs, null when jobId is set. */
  premiumJobId: int("premiumJobId"),
  /** FK → users.id — the artist. Null on a zero-recipient bookkeeping row. */
  userId: int("userId"),
  sendType: mysqlEnum("sendType", ["digest", "lastminute"]).notNull(),
  /** `capped` records a send deliberately skipped by the 24h cap — kept so the
   *  skip is visible in reporting rather than looking like a matching failure. */
  status: mysqlEnum("status", ["sent", "capped", "failed"]).default("sent").notNull(),
  /** SendGrid's x-message-id, for tracing a complaint back to a specific send. */
  providerMessageId: varchar("providerMessageId", { length: 128 }),
  /** How many artists this send reached. 0 is a real, meaningful value. */
  recipientCount: int("recipientCount").default(1),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
}, (t) => ({
  // The dedupe lookup: "has this artist already been sent this job?"
  userJob: uniqueIndex("email_send_log_user_job").on(t.userId, t.jobId, t.premiumJobId),
}));
export type EmailSendLog = typeof emailSendLog.$inferSelect;
export type InsertEmailSendLog = typeof emailSendLog.$inferInsert;

// ─── PRO Job Service Type Mapping ─────────────────────────────────────────────

/**
 * Maps a premium_jobs free-text `serviceType`/`category` value onto canonical
 * master_service_types rows, so PRO jobs can be matched to artists the same way
 * regular jobs are. PRO jobs only ever stored free text, which is why they have
 * never been matchable — this table is the bridge.
 *
 * Deliberately NOT unique on rawValue alone: one raw value may legitimately map
 * to two types ("Photographer/Videographer (events)" is both), so the key is the
 * pair. The admin review action writes one row per chosen type.
 *
 * Column names are camelCase to match every other table here; the hand-written
 * seed that populates this used snake_case and was adjusted to match.
 */
export const premiumServiceTypeMap = mysqlTable("premium_service_type_map", {
  id: int("id").autoincrement().primaryKey(),
  /** The raw premium_jobs value, verbatim — e.g. "Merch/Merchandise". */
  rawValue: varchar("rawValue", { length: 256 }).notNull(),
  /** FK → master_service_types.id (the local int id, not the Bubble id — nine
   *  of the competition-staff types have no Bubble id at all). */
  masterServiceTypeId: int("masterServiceTypeId").notNull(),
  /** How the mapping was arrived at. `manual` = a human picked it in the admin
   *  review view; the rest come from the seed. */
  matchMethod: mysqlEnum("matchMethod", ["exact", "normalized", "fuzzy", "manual"]).notNull(),
  /** 0–1. Seed policy: exact/normalized apply silently, fuzzy only at >= 0.85,
   *  anything lower goes to review instead of being written here. */
  confidence: double("confidence"),
  reviewedBy: varchar("reviewedBy", { length: 128 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  rawType: uniqueIndex("premium_service_type_map_raw_type").on(t.rawValue, t.masterServiceTypeId),
}));
export type PremiumServiceTypeMap = typeof premiumServiceTypeMap.$inferSelect;
export type InsertPremiumServiceTypeMap = typeof premiumServiceTypeMap.$inferInsert;

/**
 * The queue of raw values too ambiguous to auto-map — compound values
 * ("Sales/Recruiting/Customer relations"), values with no matching type (DJ),
 * and the catch-all buckets. These wait here for a human pick rather than being
 * guessed at, because a wrong mapping silently emails the wrong artists.
 *
 * `candidateTypes` is a JSON array of master_service_types NAMES for the admin
 * view to offer as one-click options.
 */
export const premiumServiceTypeReview = mysqlTable("premium_service_type_review", {
  id: int("id").autoincrement().primaryKey(),
  rawValue: varchar("rawValue", { length: 256 }).notNull().unique(),
  /** JSON array of candidate type names. Empty array = nothing plausible;
   *  needs a new type created or a job-by-job decision. */
  candidateTypes: text("candidateTypes"),
  reason: text("reason"),
  /** Set when a human has dealt with it — the corresponding rows now live in
   *  premium_service_type_map. Kept rather than deleted so the decision, and
   *  the fact it was made, stay visible. */
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: varchar("resolvedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PremiumServiceTypeReview = typeof premiumServiceTypeReview.$inferSelect;
export type InsertPremiumServiceTypeReview = typeof premiumServiceTypeReview.$inferInsert;

/**
 * Small key/value store for operational switches that must be changeable
 * WITHOUT a deploy. The job-alert master switch lives here rather than in an
 * env var so it can be flipped from the admin UI — and, more importantly, so it
 * can be flipped OFF instantly if something goes wrong mid-send.
 *
 * Absence of a row always means "off". Nothing here should ever default to on.
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 64 }).notNull().unique(),
  settingValue: text("settingValue"),
  /** Who last changed it, for the audit trail on a switch this consequential. */
  updatedBy: varchar("updatedBy", { length: 128 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
