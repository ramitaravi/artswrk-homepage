CREATE TABLE `acquisition_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`leadType` enum('job','artist') NOT NULL,
	`name` varchar(256),
	`title` varchar(256),
	`location` varchar(256),
	`rate` varchar(128),
	`contactInfo` varchar(512),
	`disciplines` text,
	`description` text,
	`rawPostText` text,
	`outreachMessage` text,
	`magicLinkToken` varchar(128),
	`status` enum('new','outreach_sent','clicked','joined') NOT NULL DEFAULT 'new',
	`outreachSentAt` timestamp,
	`convertedUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acquisition_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `acquisition_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupName` varchar(256),
	`groupUrl` text,
	`rawText` text NOT NULL,
	`jobCount` int DEFAULT 0,
	`artistCount` int DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acquisition_sessions_id` PRIMARY KEY(`id`)
);
