CREATE TABLE `sync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mode` enum('frequent','daily') NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`summary` text,
	`errorMessage` text,
	`durationMs` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `sync_runs_id` PRIMARY KEY(`id`)
);
