ALTER TABLE `premium_jobs` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `locationLat` varchar(32);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `locationLng` varchar(32);--> statement-breakpoint
ALTER TABLE `premium_jobs` ADD `bubbleInterestedArtistIds` longtext;