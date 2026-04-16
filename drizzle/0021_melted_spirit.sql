CREATE TABLE `benefits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`companyName` varchar(256),
	`slug` varchar(256),
	`logoUrl` text,
	`url` text,
	`businessDescription` text,
	`discountOffering` text,
	`howToRedeem` text,
	`contactName` varchar(256),
	`contactEmail` varchar(320),
	`audienceTypes` text,
	`businessTypes` text,
	`artistTypes` text,
	`categories` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `benefits_id` PRIMARY KEY(`id`),
	CONSTRAINT `benefits_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `eoy_email_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`artistUserId` int,
	`bubbleArtistId` varchar(64),
	`name` varchar(256),
	`email` varchar(320),
	`bookings2023` int,
	`earnings2023` double,
	`reimbursements2023` double,
	`bookings2024` int,
	`earnings2024` double,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `eoy_email_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `eoy_email_snapshots_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `rate_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`conversionType` enum('artist_to_client','client_to_artist') DEFAULT 'artist_to_client',
	`artistRate` double,
	`clientRate` double,
	`isHourly` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`bubbleCreatedAt` timestamp,
	CONSTRAINT `rate_conversions_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_conversions_bubbleId_unique` UNIQUE(`bubbleId`)
);
