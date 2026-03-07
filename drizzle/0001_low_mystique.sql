ALTER TABLE `users` ADD `bubbleId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `firstName` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `lastName` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `slug` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `profilePicture` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `userRole` enum('Client','Artist','Admin');--> statement-breakpoint
ALTER TABLE `users` ADD `optionAvailability` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clientCompanyName` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `clientStripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clientStripeCardId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clientSubscriptionId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clientPremium` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingStep` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `userSignedUp` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `beta` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `bubbleCreatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `bubbleModifiedAt` timestamp;