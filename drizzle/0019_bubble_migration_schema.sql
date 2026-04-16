-- Migration: Schema gaps for Bubble → Artswrk data migration
-- Adds missing tables and fields discovered by comparing Bubble API data types
-- against the existing Drizzle schema.

-- ─── 1. Fix bookings.hours: int → double (Bubble stores decimals e.g. 2.75) ──
ALTER TABLE `bookings` MODIFY COLUMN `hours` double;

-- ─── 2. Add missing artist fields to users ────────────────────────────────────
ALTER TABLE `users`
  ADD COLUMN `lateCancelCount` int DEFAULT 0,
  ADD COLUMN `credits` text,
  ADD COLUMN `artistStripeAccountId` varchar(64),
  ADD COLUMN `artistStripeReturnCode` varchar(256),
  ADD COLUMN `artistStripeProductId` varchar(64),
  ADD COLUMN `artistStripeDateCreated` timestamp NULL;

-- ─── 3. Add missing fields to client_companies ────────────────────────────────
ALTER TABLE `client_companies`
  ADD COLUMN `locationAddress` text,
  ADD COLUMN `locationLat` varchar(32),
  ADD COLUMN `locationLng` varchar(32),
  ADD COLUMN `transportReimbursed` boolean DEFAULT false,
  ADD COLUMN `transportDetails` text;

-- ─── 4. Add bubbleId to artist_service_categories ────────────────────────────
ALTER TABLE `artist_service_categories`
  ADD COLUMN `bubbleId` varchar(64);

-- ─── 5. Create artist_experiences table ──────────────────────────────────────
CREATE TABLE `artist_experiences` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `bubbleId` varchar(64) UNIQUE,
  `artistUserId` int NOT NULL,
  `bubbleArtistId` varchar(64),
  `artistType` varchar(128),
  `bubbleArtistTypeId` varchar(64),
  `yearsOfExperience` varchar(64),
  `ageGroups` text,
  `styles` text,
  `bubbleStyleIds` text,
  `legacyResumeLink` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `bubbleCreatedAt` timestamp NULL,
  `bubbleModifiedAt` timestamp NULL
);

-- ─── 6. Create artist_resumes table ──────────────────────────────────────────
CREATE TABLE `artist_resumes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `bubbleId` varchar(64) UNIQUE,
  `artistUserId` int NOT NULL,
  `bubbleArtistId` varchar(64),
  `title` varchar(512),
  `fileUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `bubbleCreatedAt` timestamp NULL,
  `bubbleModifiedAt` timestamp NULL
);

-- ─── 7. Create ads table ─────────────────────────────────────────────────────
CREATE TABLE `ads` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `bubbleId` varchar(64) UNIQUE,
  `name` varchar(256),
  `link` text,
  `imageUrl` text,
  `startDate` timestamp NULL,
  `endDate` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `bubbleCreatedAt` timestamp NULL,
  `bubbleModifiedAt` timestamp NULL
);

-- ─── 8. Create affiliations table ────────────────────────────────────────────
CREATE TABLE `affiliations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `bubbleId` varchar(64) UNIQUE,
  `display` varchar(256) NOT NULL,
  `slug` varchar(256),
  `logoUrl` text,
  `isPublic` boolean DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `bubbleCreatedAt` timestamp NULL,
  `bubbleModifiedAt` timestamp NULL
);

-- ─── 9. Create user_affiliations join table ───────────────────────────────────
CREATE TABLE `user_affiliations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `affiliationId` int NOT NULL,
  `bubbleAffiliationId` varchar(64),
  `artistUserId` int,
  `bubbleArtistId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

-- ─── 10. Create reimbursements table ─────────────────────────────────────────
CREATE TABLE `reimbursements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `bubbleId` varchar(64) UNIQUE,
  `bookingId` int,
  `bubbleBookingId` varchar(64),
  `artistUserId` int,
  `bubbleArtistId` varchar(64),
  `value` double,
  `expenseDate` timestamp NULL,
  `note` text,
  `fileUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `bubbleCreatedAt` timestamp NULL,
  `bubbleModifiedAt` timestamp NULL
);
