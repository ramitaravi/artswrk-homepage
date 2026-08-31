-- Manually numbered — drizzle's meta/_journal.json is desynced from what's
-- actually applied (0053_pro_service_type_mapping and 0054_app_settings both
-- exist on disk and are live in the DB, but neither is recorded in the
-- journal, so `drizzle-kit generate` collided on 0053 and tried to re-create
-- tables that already exist). Applied directly against the DB rather than via
-- `drizzle-kit migrate`, which isn't safe to run until the journal is
-- reconciled. Kept as 0055 to stay ahead of the real 0054 file on disk.
ALTER TABLE `bookings` ADD `completionReminderSentAt` timestamp;
