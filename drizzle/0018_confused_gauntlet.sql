ALTER TABLE `artist_service_categories` ADD `listOnProfile` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `artist_service_categories` ADD `jobEmailEnabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `artist_service_categories` ADD `subServiceSettings` text;