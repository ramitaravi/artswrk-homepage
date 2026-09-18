-- Manually numbered and applied with scripts/apply-migration-0057-booking-rate-basis.mjs,
-- for the same reason as 0055/0056: drizzle's meta/_journal.json is desynced from
-- what is live, so `drizzle-kit migrate` isn't safe to run.
--
-- APPLY THIS BEFORE DEPLOYING the code that adds these columns to
-- drizzle/schema.ts. Drizzle selects every column in the schema, so until they
-- exist every query that reads bookings fails.
--
-- WHY: bookings.artistRate means two different things — a booking TOTAL on
-- one-time bookings, a PER-HOUR rate on weekly class bookings — and the real
-- hourly/flat flag lived on interested_artists, so a booking with no
-- application had no flag at all. That ambiguity billed Kaylee DaCosta $131
-- instead of $289 (2026-09-15), wrote "$131/hr" onto her booking, and printed
-- "Total Rate $55.00" for a $261.25 class day.
--
-- ONE rate per booking, not an artist rate and a client rate: there is no rate
-- conversion any more (Ramita, 2026-09-17). The studio pays that same amount
-- plus reimbursements plus the 5% processing fee; the artist receives their
-- full rate plus reimbursements.
--
-- Additive only: hours, totalArtistRate and totalClientRate already exist and
-- no existing column is altered, so money already recorded cannot move.
ALTER TABLE `bookings` ADD `rateType` enum('hourly','flat') NULL;
--> statement-breakpoint
ALTER TABLE `bookings` ADD `hourlyRate` double NULL;
--> statement-breakpoint
ALTER TABLE `bookings` ADD `flatRate` double NULL;
