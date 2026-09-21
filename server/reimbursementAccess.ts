type ReimbursementBooking = {
  id: number;
  artistUserId?: number | null;
  paymentMethod?: string | null;
  isAdminBooking?: boolean | number | null;
  isRecurring?: boolean | number | null;
};

type ReimbursementPeriod = {
  bookingId?: number | null;
} | null;

/**
 * An expense can be removed only by the artist who added it, and only until it
 * has been invoiced. Once a week's hours (or a one-off booking's invoice) are
 * submitted, the studio has been sent a total that includes it — removing it
 * afterwards would leave the records disagreeing with what they were billed.
 */
export function assertReimbursementRemovable(input: {
  userId: number;
  reimbursement: { artistUserId?: number | null; bookingId?: number | null; bookingPeriodId?: number | null } | null | undefined;
  booking: { artistUserId?: number | null; artswrkInvoiceSubmittedAt?: Date | string | null; paymentStatus?: string | null } | null | undefined;
  period?: { bookingId?: number | null; status?: string | null } | null;
}): void {
  const { userId, reimbursement, booking, period } = input;
  if (!reimbursement || !booking || reimbursement.artistUserId !== userId || booking.artistUserId !== userId) {
    throw new Error("Not authorized");
  }
  if (reimbursement.bookingPeriodId != null) {
    if (!period || period.bookingId !== reimbursement.bookingId) throw new Error("Not authorized");
    if (period.status !== "open" && period.status !== "upcoming") {
      throw new Error("This week's hours were already submitted, so its expenses can't be changed");
    }
    return;
  }
  if (booking.artswrkInvoiceSubmittedAt || String(booking.paymentStatus ?? "").toLowerCase() === "paid") {
    throw new Error("This booking has already been invoiced, so its expenses can't be changed");
  }
}

/**
 * Reimbursements may only be created by the booked artist, on Artswrk-paid
 * bookings. Recurring admin bookings must attach every expense to one of that
 * booking's own periods so it cannot disappear from the weekly invoice or be
 * injected into another artist's invoice.
 */
export function assertReimbursementWriteAccess(input: {
  userId: number;
  booking: ReimbursementBooking | null | undefined;
  bookingPeriodId?: number | null;
  period?: ReimbursementPeriod;
}): void {
  const { userId, booking, bookingPeriodId, period } = input;
  if (!booking || booking.artistUserId !== userId) {
    throw new Error("Not authorized");
  }
  if (booking.paymentMethod === "direct") {
    throw new Error("Reimbursements can only be added to bookings paid through Artswrk");
  }

  const isWeekly = !!booking.isAdminBooking && !!booking.isRecurring;
  if (isWeekly && bookingPeriodId == null) {
    throw new Error("Choose the week this reimbursement belongs to");
  }
  if (bookingPeriodId != null && (!period || period.bookingId !== booking.id)) {
    throw new Error("That week does not belong to this booking");
  }
}
