-- Operational switches that must be changeable without a deploy.
-- The job-alert master switch lives here so it can be turned on from the admin
-- UI, and turned OFF instantly if a send goes wrong. No row = off, always.
CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(64) NOT NULL,
	`settingValue` text,
	`updatedBy` varchar(128),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
-- Seed the switch explicitly OFF. Being present-and-false is clearer in the
-- admin UI than absent, and it makes the intent unmistakable in the DB.
INSERT INTO `app_settings` (`settingKey`, `settingValue`, `updatedBy`)
SELECT 'job_alerts_enabled', 'false', 'migration 0054' FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT * FROM `app_settings`) s WHERE s.`settingKey` = 'job_alerts_enabled'
);
