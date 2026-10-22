-- Booking management: an audit trail, and a record of how a booking was cancelled.
--
-- Until now nothing could edit a booking. Nine production incidents in three
-- weeks were each fixed by running SQL by hand -- a wrong reimbursement nobody
-- could remove, two cancellations, two manual payments, a wrong rate. Before
-- artists, studios and admins can all edit bookings, every change has to say
-- who made it and what it was before.

-- Every change to a booking, one row per field changed.
CREATE TABLE booking_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT NOT NULL,
  -- Who. actorRole is kept separately because a user's role can change later
  -- and the question "was this an admin edit?" has to stay answerable.
  actorUserId INT NULL,
  actorRole VARCHAR(16) NOT NULL,          -- artist | client | admin | system
  action VARCHAR(32) NOT NULL,             -- edit | cancel | mark_paid | invoice_void | reimbursement
  field VARCHAR(64) NULL,                  -- the column changed, when action = edit
  oldValue TEXT NULL,
  newValue TEXT NULL,
  reason TEXT NULL,                        -- required for cancel and mark_paid
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_booking_audit_booking ON booking_audit (bookingId, createdAt);
CREATE INDEX idx_booking_audit_action ON booking_audit (action, createdAt);

-- How a booking was cancelled. Deliberately a record, not a penalty: there is
-- no cutoff, because blocking a late cancellation does not stop the artist
-- being absent -- it only stops it being written down.
ALTER TABLE bookings ADD COLUMN cancelledAt TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN cancelledByUserId INT NULL;
ALTER TABLE bookings ADD COLUMN cancelledByRole VARCHAR(16) NULL;
ALTER TABLE bookings ADD COLUMN cancellationReason TEXT NULL;
-- Hours between cancelling and the class start. This is the field that
-- matters: "cancelled" and "cancelled four hours before a class a studio had
-- been promised" are different facts, and only the second is actionable.
ALTER TABLE bookings ADD COLUMN cancellationNoticeHours DECIMAL(10,2) NULL;
CREATE INDEX idx_bookings_cancelled ON bookings (cancelledAt);

-- A rate change needs both sides to agree, so it is a proposal until accepted.
-- Neither an artist nor a studio may unilaterally change what the other is
-- paid; an admin may, and the audit row records that they did.
ALTER TABLE bookings ADD COLUMN proposedHourlyRate DECIMAL(10,2) NULL;
ALTER TABLE bookings ADD COLUMN proposedFlatRate DECIMAL(10,2) NULL;
ALTER TABLE bookings ADD COLUMN proposedRateBy VARCHAR(16) NULL;   -- artist | client
ALTER TABLE bookings ADD COLUMN proposedRateAt TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN proposedRateReason TEXT NULL;
