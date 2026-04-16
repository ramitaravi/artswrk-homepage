CREATE TABLE `ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`name` varchar(256),
	`link` text,
	`imageUrl` text,
	`startDate` timestamp,
	`endDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `ads_id` PRIMARY KEY(`id`),
	CONSTRAINT `ads_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `affiliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`display` varchar(256) NOT NULL,
	`slug` varchar(256),
	`logoUrl` text,
	`isPublic` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `affiliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliations_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
CREATE TABLE `user_affiliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliationId` int NOT NULL,
	`bubbleAffiliationId` varchar(64),
	`artistUserId` int,
	`bubbleArtistId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_affiliations_id` PRIMARY KEY(`id`)
);
