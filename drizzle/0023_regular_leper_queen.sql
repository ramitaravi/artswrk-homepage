CREATE TABLE `master_artist_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`name` varchar(128) NOT NULL,
	`slug` varchar(128),
	`iconUrl` text,
	`listingOrder` int,
	`isPublic` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_artist_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `master_artist_types_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `master_service_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`name` varchar(128) NOT NULL,
	`slug` varchar(128),
	`masterArtistTypeId` int,
	`bubbleArtistTypeId` varchar(64),
	`listingOrder` int,
	`isPublic` boolean DEFAULT true,
	`isMcLandingPage` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_service_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `master_service_types_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `master_style_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_style_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `master_style_types_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bubbleId` varchar(64);--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `clientUserId` int;--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bubbleArtistId` varchar(64);--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bubbleClientId` varchar(64);--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bookingId` int;--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bubbleBookingId` varchar(64);--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bubbleCreatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD `bubbleModifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `artist_reviews` ADD CONSTRAINT `artist_reviews_bubbleId_unique` UNIQUE(`bubbleId`);