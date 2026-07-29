CREATE TABLE `booking_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`periodNumber` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`notifyArtistAt` timestamp NOT NULL,
	`artistNotifiedAt` timestamp,
	`artistSubmittedAt` timestamp,
	`status` varchar(32) DEFAULT 'upcoming',
	`actualHours` double,
	`artistNotes` text,
	`invoicePaymentToken` varchar(64),
	`invoiceStripeCheckoutUrl` text,
	`invoiceTotalCents` int,
	`invoicePaidAt` timestamp,
	`invoiceStripePaymentIntentId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `isAdminBooking` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `bookings` ADD `isRecurring` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `bookings` ADD `recurringCadence` varchar(32);--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `bookingPeriodId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeConnectAccountId` varchar(64);