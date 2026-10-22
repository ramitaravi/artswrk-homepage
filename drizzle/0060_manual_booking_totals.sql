-- Admin-set booking totals.
--
-- Until now the artist and studio totals were always derived: rate x hours,
-- plus a fixed 5% on the studio side. Real bookings do not always fit that --
-- a negotiated flat fee, a discount, an agreed amount that is simply what it
-- is -- and admin had no way to record one without a SQL script.
--
-- These are deliberately NEW columns rather than reuse of totalArtistRate /
-- totalClientRate, which are full of migrated Bubble values. Keeping them
-- separate means "a human set this on purpose" is never confused with "this
-- came out of Bubble", which is exactly the ambiguity that made artistRate
-- mean two different things and produced the $18 invoice.
--
-- Both are NULL on every existing row, so nothing changes until an admin
-- sets one.

-- One column per statement: the applier checks each for existence before
-- running it, so this stays safe to re-run after a partial failure.
ALTER TABLE bookings ADD COLUMN manualArtistTotal DOUBLE NULL;
ALTER TABLE bookings ADD COLUMN manualClientTotal DOUBLE NULL;
ALTER TABLE bookings ADD COLUMN manualTotalsSetAt TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN manualTotalsSetByUserId INT NULL;
ALTER TABLE bookings ADD COLUMN manualTotalsReason VARCHAR(512) NULL;
