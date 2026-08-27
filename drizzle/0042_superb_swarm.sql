CREATE TABLE `bubble_interested_artists_source` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleId` varchar(64) NOT NULL,
	`bubbleSourcePresent` boolean DEFAULT false,
	`bubbleCreatedById` varchar(64),
	`bubbleArtistId` varchar(64),
	`bubbleRequestId` varchar(64),
	`bubblePremiumJobId` varchar(64),
	`bubbleClientId` varchar(64),
	`bubbleBookingId` varchar(64),
	`bubbleServiceId` varchar(64),
	`status` varchar(64),
	`converted` boolean DEFAULT false,
	`isHourlyRate` boolean DEFAULT false,
	`artistHourlyRate` double,
	`clientHourlyRate` double,
	`artistFlatRate` double,
	`clientFlatRate` double,
	`premiumJobRate` varchar(255),
	`rateType` varchar(64),
	`totalHours` double,
	`startDate` timestamp,
	`endDate` timestamp,
	`resumeLink` text,
	`message` text,
	`bubbleCreatedAt` timestamp,
	`bubbleModifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bubble_interested_artists_source_id` PRIMARY KEY(`id`),
	CONSTRAINT `bubble_interested_artists_source_bubbleId_unique` UNIQUE(`bubbleId`)
);
--> statement-breakpoint
ALTER TABLE `interested_artists` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `bubbleCreatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `bubbleModifiedAt` timestamp;