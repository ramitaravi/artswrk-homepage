ALTER TABLE `acquisition_leads` ADD `sourceGroup` varchar(256);--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `posterFacebookUrl` text;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `instagram` varchar(128);--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `studioUrl` text;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `studioAddress` text;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `city` varchar(128);--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `state` varchar(32);--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `jobSummary` text;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `jobDescription` text;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `jobDate` varchar(256);--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `jobDateType` enum('single','recurring','ongoing');--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `rateAmount` int;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `rateType` enum('hourly','flat','open');--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `funnelStage` enum('lead','outreach_sent','signed_up','job_posted','booking_made') DEFAULT 'lead';--> statement-breakpoint
ALTER TABLE `acquisition_leads` ADD `convertedJobId` int;