CREATE TABLE `client_job_unlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientUserId` int NOT NULL,
	`jobId` int NOT NULL,
	`stripeSessionId` varchar(128),
	`stripePaymentIntentId` varchar(128),
	`amountCents` int DEFAULT 3000,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_job_unlocks_id` PRIMARY KEY(`id`)
);
