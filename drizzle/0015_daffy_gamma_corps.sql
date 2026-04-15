ALTER TABLE `users` ADD `mediaPhotos` text;--> statement-breakpoint
ALTER TABLE `users` ADD `resumeFiles` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bookingCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `ratingScore` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `reviewCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `workTypes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `tagline` varchar(256);