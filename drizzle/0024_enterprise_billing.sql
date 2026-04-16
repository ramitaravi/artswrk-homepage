-- Enterprise billing plan fields on users table
ALTER TABLE `users` ADD `enterprisePlan` enum('on_demand','subscriber');--> statement-breakpoint
ALTER TABLE `users` ADD `enterpriseStripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `enterpriseStripeSubscriptionId` varchar(64);--> statement-breakpoint

-- Enterprise job unlocks — tracks $100 per-job payments for on_demand clients
CREATE TABLE `enterprise_job_unlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientUserId` int NOT NULL,
	`jobId` int NOT NULL,
	`stripeSessionId` varchar(128),
	`stripePaymentIntentId` varchar(128),
	`amountCents` int DEFAULT 10000,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprise_job_unlocks_id` PRIMARY KEY(`id`)
);
