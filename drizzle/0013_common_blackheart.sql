CREATE TABLE `client_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`logo` text,
	`bubbleClientCompanyId` varchar(64),
	`website` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_companies_id` PRIMARY KEY(`id`)
);
