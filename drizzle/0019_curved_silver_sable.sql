CREATE TABLE `artist_experiences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
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
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `artist_experiences_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_experiences_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `artist_resumes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`artistUserId` int NOT NULL,
	`bubbleArtistId` varchar(64),
	`title` varchar(512),
	`fileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `artist_resumes_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_resumes_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `reimbursements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`bookingId` int,
	`bubbleBookingId` varchar(64),
	`artistUserId` int,
	`bubbleArtistId` varchar(64),
	`value` double,
	`expenseDate` timestamp,
	`note` text,
	`fileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `reimbursements_id` PRIMARY KEY(`id`),
	CONSTRAINT `reimbursements_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `hours` double;--> statement-breakpoint
ALTER TABLE `artist_service_categories` ADD `bubbleId` varchar(64);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `locationAddress` text;--> statement-breakpoint
ALTER TABLE `client_companies` ADD `locationLat` varchar(32);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `locationLng` varchar(32);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `transportReimbursed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `client_companies` ADD `transportDetails` text;--> statement-breakpoint
ALTER TABLE `users` ADD `lateCancelCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `credits` text;--> statement-breakpoint
ALTER TABLE `users` ADD `artistStripeAccountId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `artistStripeReturnCode` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `artistStripeProductId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `artistStripeDateCreated` timestamp;