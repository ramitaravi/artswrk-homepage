ALTER TABLE `jobs` ADD `bubbleSourcePresent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `jobs` ADD `bubbleArtistId` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `bubbleArtistTypeId` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `bubbleBookingIds` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `bubbleInterestedArtistIds` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `bubbleInterestedArtistUserIds` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `dateDetails` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `artistFlatRate` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `clientFlatRate` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `hours` double;--> statement-breakpoint
ALTER TABLE `jobs` ADD `rateType` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `transportationDetails` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `sameDay` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `jobs` ADD `unlocked` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `jobs` ADD `outreachStatus` varchar(128);--> statement-breakpoint
ALTER TABLE `jobs` ADD `sentTo` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `bubbleMasterStyleIds` text;