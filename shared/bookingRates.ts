/**
 * The one sanctioned way to work out what a booking is worth.
 *
 * Background — the two rules that keep getting broken:
 *
 *  1. `bookings.artistRate` / `clientRate` are booking TOTALS, not unit rates.
 *     Bubble stored "$50/hr × 5 hrs" as 250, and flat rates as-is. Multiplying
 *     one of them by hours double-counts.
 *  2. `bookings` has NO hourly/flat column. The real flag is
 *     `interested_artists.isHourlyRate`. Code that inferred "hourly" from
 *     `hours` being set treated the 365 flat bookings that also record hours as
 *     hourly — and that decided the amount actually charged to a studio's card
 *     (a $3,600 flat booking came out at $734,400).
 *
 * Both rules live here so no caller has to remember them. Pure and
 * dependency-free so it can be unit tested and shared by client and server.
 */

export type BookingRateBasis = {
  /** interested_artists.isHourlyRate — the REAL flag. Never infer this. */
  isHourlyRate?: boolean | number | null;
  /** bookings.artistRate (or clientRate) — already the TOTAL for the booking. */
  storedTotal?: number | null;
  /** interested_artists.artistHourlyRate — the per-hour rate, when hourly. */
  unitHourlyRate?: number | null;
  /** bookings.hours — the hours the total was originally based on. */
  storedHours?: number | null;
};

export function isHourlyBooking(basis: BookingRateBasis): boolean {
  return !!basis.isHourlyRate;
}

/**
 * The base amount to charge, before reimbursements and fees.
 *
 * `adjustedHours` is what the studio typed on the approval screen. The stored
 * total is used untouched unless they genuinely changed the hours on an hourly
 * booking AND we hold a real per-hour rate to recompute from — never by
 * re-multiplying a total, and never for a flat booking.
 */
export function resolveBookingBaseAmount(
  basis: BookingRateBasis,
  adjustedHours?: number | null
): number {
  const storedTotal = Number(basis.storedTotal ?? 0);
  if (!isHourlyBooking(basis)) return storedTotal;

  const unit = basis.unitHourlyRate ?? null;
  const stored = basis.storedHours ?? null;
  const hoursChanged =
    adjustedHours != null && stored != null && Number(adjustedHours) !== Number(stored);

  if (!hoursChanged || unit == null) return storedTotal;
  return Math.round(Number(unit) * Number(adjustedHours));
}

/** Full money breakdown for an invoice, in dollars. */
export function resolveInvoiceTotals(
  basis: BookingRateBasis,
  opts: { adjustedHours?: number | null; reimbursements?: number; feeRate?: number }
): { baseAmount: number; reimbursements: number; processingFee: number; total: number } {
  const baseAmount = resolveBookingBaseAmount(basis, opts.adjustedHours);
  const reimbursements = Number(opts.reimbursements ?? 0);
  const feeRate = opts.feeRate ?? 0;
  const processingFee = Math.round((baseAmount + reimbursements) * feeRate);
  return {
    baseAmount,
    reimbursements,
    processingFee,
    total: baseAmount + reimbursements + processingFee,
  };
}
