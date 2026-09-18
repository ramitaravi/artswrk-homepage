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
