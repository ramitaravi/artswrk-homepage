ALTER TABLE `premium_job_interested_artists` ADD `bubbleInterestedArtistId` varchar(64);--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `message` text;--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `rate` varchar(255);--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `resumeLink` text;--> statement-breakpoint
ALTER TABLE `premium_job_interested_artists` ADD `status` varchar(64);