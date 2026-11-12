-- Data Hub only. Other differences from snapshot 0052 were verified
-- already present in production from earlier manually applied releases.
CREATE TABLE `data_hub_flags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `email` varchar(320) NOT NULL,
  `masterRowId` varchar(32),
  `studioName` varchar(256),
  `doNotContact` boolean NOT NULL DEFAULT false,
  `dncScope` varchar(128),
  `sourceTab` varchar(32),
  `dncAppliedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `data_hub_flags_id` PRIMARY KEY(`id`),
  CONSTRAINT `data_hub_flags_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `leads_contacts` ADD `opens90d` int DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `leads_contacts` ADD `wrkEmailsOpened` int DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `leads_contacts` ADD `statsSyncedAt` timestamp;
