-- Job alert emails — phase 1 schema.
--
-- ADDITIVE ONLY. drizzle-kit's generated version of this file also carried
-- three `ALTER TABLE users DROP COLUMN` statements (stripeConnectAccountId,
-- artistStripeAccountType, stripeProductId) and a userRole enum MODIFY, all
-- left over from the taxonomy commit's pending cleanup. They are unrelated to
-- job alerts and destructive, so they were removed by hand — that cleanup has
-- its own deliberate path in scripts/cleanup-dead-stripe-columns-2026-08-29.mjs
-- and should be run on its own, not smuggled in behind an email feature.

CREATE TABLE `email_send_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int,
	`premiumJobId` int,
	`userId` int,
	`sendType` enum('digest','lastminute') NOT NULL,
	`status` enum('sent','capped','failed') NOT NULL DEFAULT 'sent',
	`providerMessageId` varchar(128),
	`recipientCount` int DEFAULT 1,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_send_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_send_log_user_job` UNIQUE(`userId`,`jobId`,`premiumJobId`)
);
--> statement-breakpoint
CREATE TABLE `email_suppressions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`source` enum('sendgrid','brevo','inapp') NOT NULL,
	`scope` enum('global','job_alerts') NOT NULL DEFAULT 'job_alerts',
	`reason` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_suppressions_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_suppressions_email_scope` UNIQUE(`email`,`scope`)
);
--> statement-breakpoint
CREATE TABLE `user_notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobEmailsEnabled` boolean NOT NULL DEFAULT true,
	`lastMinuteEnabled` boolean NOT NULL DEFAULT true,
	`serviceTypes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_notification_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_notification_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `networkStatus` enum('pending','sent_digest','sent_lastminute','expired','suppressed');--> statement-breakpoint
ALTER TABLE `jobs` ADD `networkSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `masterServiceTypeId` varchar(64);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `bubbleArtistTypeId` varchar(64);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `networkStatus` enum('pending','sent_digest','sent_lastminute','expired','suppressed');--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `networkSentAt` timestamp;--> statement-breakpoint

-- The digest run scans for pending jobs; without this it table-scans every job.
CREATE INDEX `jobs_network_status` ON `jobs` (`networkStatus`);--> statement-breakpoint
CREATE INDEX `premium_jobs_network_status` ON `premium_jobs` (`networkStatus`);--> statement-breakpoint
-- Backs the rolling-24h last-minute cap: "how many did this artist get since X".
CREATE INDEX `email_send_log_user_sent` ON `email_send_log` (`userId`,`sentAt`);--> statement-breakpoint

-- ─── Backlog quarantine ─────────────────────────────────────────────────────
-- THE line that keeps launch safe. Every job that exists right now predates
-- this system, and 206 of the active ones were already sent by Bubble's old
-- network email. Defaulting them to 'pending' would make the first 1pm ET run
-- email a two-year backlog to the whole network in one burst — precisely the
-- deliverability event the content-gated digest exists to prevent.
--
-- Everything existing is therefore parked as 'suppressed'. Only jobs created
-- after this migration enter the queue. Costs a handful of legitimate sends in
-- week one; makes a backlog blast structurally impossible.
UPDATE `jobs` SET `networkStatus` = 'suppressed' WHERE `networkStatus` IS NULL;--> statement-breakpoint
UPDATE `premium_jobs` SET `networkStatus` = 'suppressed' WHERE `networkStatus` IS NULL;
