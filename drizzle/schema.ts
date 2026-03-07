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

// ── Future tables ──────────────────────────────────────────────────────────────
// jobs, bookings, payments, artistServices, clientCompanies, messages, etc.
// will be added here as we port each Bubble data type.
