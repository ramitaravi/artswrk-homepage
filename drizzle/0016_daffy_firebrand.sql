CREATE TABLE `artist_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistUserId` int NOT NULL,
	`reviewerName` varchar(256),
	`reviewerStudio` varchar(256),
	`reviewerAvatar` text,
	`rating` int DEFAULT 5,
	`body` text,
	`reviewDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artist_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artist_service_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistUserId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`imageUrl` text,
	`subServices` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artist_service_categories_id` PRIMARY KEY(`id`)
);
