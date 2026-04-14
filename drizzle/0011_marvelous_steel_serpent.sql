CREATE TABLE `premium_job_interested_artists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`premiumJobId` int NOT NULL,
	`bubblePremiumJobId` varchar(64),
	`artistUserId` int,
	`bubbleArtistId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `premium_job_interested_artists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `premium_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64),
	`company` varchar(256),
	`logo` text,
	`createdByUserId` int,
	`bubbleCreatedById` varchar(64),
	`bubbleClientCompanyId` varchar(64),
	`serviceType` varchar(256),
	`category` varchar(128),
	`description` text,
	`budget` varchar(256),
	`location` varchar(256),
	`tag` varchar(256),
	`slug` varchar(256),
	`applyDirect` boolean DEFAULT false,
	`applyEmail` varchar(320),
	`applyLink` text,
	`workFromAnywhere` boolean DEFAULT false,
	`featured` boolean DEFAULT false,
	`status` varchar(64) DEFAULT 'Active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	CONSTRAINT `premium_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `premium_jobs_bubbleId_unique` UNIQUE(`bubbleId`)
);
