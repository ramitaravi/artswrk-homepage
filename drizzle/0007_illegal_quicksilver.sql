ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `pronouns` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `artistDisciplines` text;--> statement-breakpoint
ALTER TABLE `users` ADD `artistServices` text;--> statement-breakpoint
ALTER TABLE `users` ADD `masterArtistTypes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `masterStyles` text;--> statement-breakpoint
ALTER TABLE `users` ADD `artistExperiences` text;--> statement-breakpoint
ALTER TABLE `users` ADD `location` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `portfolio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `website` text;--> statement-breakpoint
ALTER TABLE `users` ADD `instagram` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `tiktok` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `youtube` text;--> statement-breakpoint
ALTER TABLE `users` ADD `resumes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `videos` text;--> statement-breakpoint
ALTER TABLE `users` ADD `artswrkPro` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `artswrkBasic` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `businessOrIndividual` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `businessType` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `artistBusinessName` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `artistTransportationAccommodation` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `hiringCategory` varchar(128);