ALTER TABLE `bookings` ADD `invoicePaymentToken` varchar(64);--> statement-breakpoint
ALTER TABLE `bookings` ADD `invoiceStripeCheckoutUrl` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `invoiceTotalCents` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `invoicePaidAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `invoiceStripePaymentIntentId` varchar(128);