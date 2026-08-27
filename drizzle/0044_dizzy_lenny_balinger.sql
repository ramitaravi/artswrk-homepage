ALTER TABLE `payments` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `payments` ADD `bubbleCreatedById` varchar(64);--> statement-breakpoint
ALTER TABLE `payments` ADD `bubbleRequestId` varchar(64);--> statement-breakpoint
ALTER TABLE `payments` ADD `stripeCustomer` varchar(128);