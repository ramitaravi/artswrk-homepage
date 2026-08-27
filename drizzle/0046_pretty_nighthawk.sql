ALTER TABLE `conversations` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `conversations` ADD `bubbleCreatedById` varchar(64);--> statement-breakpoint
ALTER TABLE `messages` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `messages` ADD `bubbleCreatedById` varchar(64);