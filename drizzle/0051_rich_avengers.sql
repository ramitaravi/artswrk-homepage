CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`invitedUserId` int NOT NULL,
	`bubbleId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `masterServiceType` text;--> statement-breakpoint
ALTER TABLE `users` ADD `addedByAdmin` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `source` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `unsubscribe` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `artistStripeAccountType` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeProductId` varchar(64);