-- PRO job service type mapping — the bridge that makes premium_jobs matchable.
--
-- premium_jobs has only ever stored free-text serviceType/category, which is
-- why PRO jobs have never gone out to the network. These two tables map those
-- raw values onto canonical master_service_types rows: confident matches land
-- in _map and apply silently, ambiguous ones land in _review and wait for a
-- human, because a wrong mapping silently emails the wrong artists.
--
-- Hand-written rather than drizzle-kit generated, for the same reason as 0052:
-- the generator bundles in unrelated pending DROP COLUMN statements.

CREATE TABLE `premium_service_type_map` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rawValue` varchar(256) NOT NULL,
	`masterServiceTypeId` int NOT NULL,
	`matchMethod` enum('exact','normalized','fuzzy','manual') NOT NULL,
	`confidence` double,
	`reviewedBy` varchar(128),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `premium_service_type_map_id` PRIMARY KEY(`id`),
	-- The pair, not rawValue alone: one raw value may map to two real types
	-- ("Photographer/Videographer (events)" is genuinely both). This is the
	-- unique key the seed file's header assumed but nothing created.
	CONSTRAINT `premium_service_type_map_raw_type` UNIQUE(`rawValue`,`masterServiceTypeId`)
);
--> statement-breakpoint
CREATE TABLE `premium_service_type_review` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rawValue` varchar(256) NOT NULL,
	`candidateTypes` text,
	`reason` text,
	`resolvedAt` timestamp,
	`resolvedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `premium_service_type_review_id` PRIMARY KEY(`id`),
	CONSTRAINT `premium_service_type_review_rawValue_unique` UNIQUE(`rawValue`)
);
--> statement-breakpoint
-- Enqueue looks up raw values by name on every PRO job; without this it scans.
CREATE INDEX `premium_service_type_map_raw` ON `premium_service_type_map` (`rawValue`);--> statement-breakpoint

-- ─── General Staff ──────────────────────────────────────────────────────────
-- "Competition staff (general)" is the single biggest bucket in the PRO audit
-- (79 companies) and had no home: the April seed listed a General Staff role,
-- but scripts/retaxonomy-2026-08-29.mjs — the one that actually ran — never
-- created it. Splitting 79 companies across Crew/Registration/Backstage needs
-- per-company judgment nobody has; giving them one honest bucket does not.
--
-- Created exactly the way the Aug 29 retaxonomy created its nine other
-- competition-staff roles: parented by the integer masterArtistTypeId, with NO
-- bubbleId. Nine of the ten existing children of artist type 3 are already
-- local-id-only, and both resolvers already handle the mixed id space
-- (bubbleId when present, the integer id as a string otherwise).
--
-- Guarded so a re-run is a no-op rather than a duplicate row.
INSERT INTO `master_service_types` (`name`, `masterArtistTypeId`, `isPublic`)
SELECT 'General Staff', 3, 1 FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT * FROM `master_service_types`) m
  WHERE m.`name` = 'General Staff' AND m.`masterArtistTypeId` = 3
);
