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
  booking: {
    artistUserId?: number | null; clientUserId?: number | null;
    artswrkInvoiceSubmittedAt?: Date | string | null;
    invoicePaidAt?: Date | string | null; paymentStatus?: string | null;
  } | null | undefined;
  period?: { bookingId?: number | null; status?: string | null; invoicePaidAt?: Date | string | null } | null;
  isAdmin?: boolean;
}): void {
  const { userId, reimbursement, booking, period, isAdmin } = input;
  if (!reimbursement || !booking) throw new Error("Not authorized");

  // Either party to the booking, or an admin. Expenses are part of what the
  // client pays, so a studio disputing a line should not have to email
  // support to get it looked at.
  const isArtist = booking.artistUserId === userId && reimbursement.artistUserId === userId;
  const isClient = booking.clientUserId === userId;
  if (!isArtist && !isClient && !isAdmin) throw new Error("Not authorized");

  // Paid is the only hard stop. It used to be "submitted", which is how
  // Marlon ended up with two travel receipts on one day and no way to remove
  // the wrong one -- he had already submitted, so the button was gone and it
  // took a SQL DELETE. Removing one now withdraws the open invoice instead,
  // and the artist resubmits.
  const paid = !!booking.invoicePaidAt || String(booking.paymentStatus ?? "").toLowerCase() === "paid";
  if (paid) {
    throw new Error("This booking has been paid, so its expenses are fixed. Contact support if something needs correcting.");
  }
  if (reimbursement.bookingPeriodId != null) {
    if (!period || period.bookingId !== reimbursement.bookingId) throw new Error("Not authorized");
    if (period.status === "client_paid" || period.status === "paid" || period.invoicePaidAt) {
      throw new Error("This week has been paid, so its expenses are fixed.");
    }
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
