ALTER TABLE `bookings` ADD `paymentMethod` varchar(16);--> statement-breakpoint
ALTER TABLE `bookings` ADD `directPayConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `artswrkInvoiceSubmittedAt` timestamp;