-- Manually numbered and applied with scripts/apply-migration-0056-user-deactivation.mjs,
-- for the same reason as 0055: drizzle's meta/_journal.json is desynced from what
-- is live, so `drizzle-kit migrate` isn't safe to run.
--
-- APPLY THIS BEFORE DEPLOYING the code that adds these columns to
-- drizzle/schema.ts. Drizzle selects every column in the schema, so until they
-- exist every query that reads users fails — sign-in included.
ALTER TABLE `users` ADD `deactivatedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `deactivatedBy` varchar(128);
