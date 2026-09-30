-- Weekly classes become one booking per class date, so a studio pays each date
-- with the same Pay Now button it already knows from one-off bookings. The
-- series id keeps the dates of one class linked (label, bulk rate change,
-- cancelling a whole season) without ever being a status of its own.
ALTER TABLE bookings ADD COLUMN recurringSeriesId INT NULL;
CREATE INDEX idx_bookings_series ON bookings (recurringSeriesId);
