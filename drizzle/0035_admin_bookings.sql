-- Admin Bookings: recurring billing periods support
-- Adds 3 columns to bookings, bookingPeriodId to reimbursements,
-- and creates the new booking_periods table.

ALTER TABLE `bookings`
  ADD COLUMN `isAdminBooking` boolean DEFAULT false,
  ADD COLUMN `isRecurring` boolean DEFAULT false,
  ADD COLUMN `recurringCadence` varchar(32);

ALTER TABLE `reimbursements`
  ADD COLUMN `bookingPeriodId` int;

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
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `booking_periods_pk` PRIMARY KEY (`id`)
);
