ALTER TABLE `jobs` ADD `isBoosted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `jobs` ADD `boostDailyBudget` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `boostDurationDays` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `boostStartDate` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `boostEndDate` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `boostStripeSessionId` varchar(256);