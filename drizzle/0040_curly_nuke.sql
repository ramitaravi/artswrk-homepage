CREATE TABLE `client_company_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientCompanyId` int NOT NULL,
	`userId` int,
	`bubbleClientCompanyId` varchar(64) NOT NULL,
	`bubbleUserId` varchar(64) NOT NULL,
	`isPrimary` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_company_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_company_memberships_company_user_uniq` UNIQUE(`clientCompanyId`,`bubbleUserId`)
);
--> statement-breakpoint
ALTER TABLE `client_companies` DROP INDEX `client_companies_owner_name_uniq`;--> statement-breakpoint
ALTER TABLE `client_companies` MODIFY COLUMN `ownerUserId` int;--> statement-breakpoint
ALTER TABLE `client_companies` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `client_companies` ADD `bubbleCreatedById` varchar(64);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `bubbleClientIds` longtext;--> statement-breakpoint
ALTER TABLE `client_companies` ADD `bubbleCreatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `client_companies` ADD `bubbleModifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `client_companies` ADD CONSTRAINT `client_companies_bubble_id_uniq` UNIQUE(`bubbleClientCompanyId`);