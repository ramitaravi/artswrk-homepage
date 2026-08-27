ALTER TABLE `bookings` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `bookings` ADD `bubbleCreatedById` varchar(64);--> statement-breakpoint
ALTER TABLE `bookings` ADD `bubbleJobId` varchar(64);--> statement-breakpoint
ALTER TABLE `bookings` ADD `bubblePaymentIds` longtext;--> statement-breakpoint
ALTER TABLE `bookings` ADD `bubbleReimbursementIds` longtext;--> statement-breakpoint
ALTER TABLE `bookings` ADD `bubbleInvoice` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `notificationArtistScheduledReminder` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `bookings` ADD `showAlert` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `bookings` ADD `bubbleWorkflowId2` varchar(256);