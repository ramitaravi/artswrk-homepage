ALTER TABLE `bookings` ADD `locationCity` varchar(128);--> statement-breakpoint
ALTER TABLE `bookings` ADD `locationState` varchar(64);--> statement-breakpoint
ALTER TABLE `bookings` ADD `locationPlaceId` varchar(128);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `locationCity` varchar(128);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `locationState` varchar(64);--> statement-breakpoint
ALTER TABLE `client_companies` ADD `locationPlaceId` varchar(128);--> statement-breakpoint
ALTER TABLE `jobs` ADD `locationCity` varchar(128);--> statement-breakpoint
ALTER TABLE `jobs` ADD `locationState` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `locationPlaceId` varchar(128);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `locationCity` varchar(128);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `locationState` varchar(64);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `locationPlaceId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `locationLat` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `locationLng` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `locationCity` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `locationState` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `locationCountry` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `locationPlaceId` varchar(128);