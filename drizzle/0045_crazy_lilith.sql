ALTER TABLE `bookings` MODIFY COLUMN `clientRate` double;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `artistRate` double;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `totalClientRate` double;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `totalArtistRate` double;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `grossProfit` double;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `stripeFee` double;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `postFeeRevenue` double;