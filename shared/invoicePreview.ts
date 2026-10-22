import {
  bookingMoney,
  hasManualTotals,
  resolveInvoiceTotals,
  type BookingMoney,
  type RateType,
} from "./bookingRates";

/**
 * The invoice amount shown to a studio and sent to Stripe, in dollars.
 *
 * `baseAmount` is the artist's work before reimbursements. `artistTotal` is
 * what reaches the artist (base plus reimbursements); `total` is what the
 * studio pays. Their difference is the processing fee, including a manual
 * client/artist gap where an admin deliberately set one.
 */
export type InvoicePreviewTotals = {
  baseAmount: number;
  reimbursements: number;
  processingFee: number;
  artistTotal: number;
  total: number;
};

/** Values public invoice projections expose for a normal booking. */
export type InvoiceBookingPreviewSource = {
  rateType?: RateType | string | null;
  hourlyRate?: number | string | null;
  flatRate?: number | string | null;
  artistHourlyRate?: number | string | null;
  artistRate?: number | string | null;
  clientRate?: number | string | null;
  hours?: number | string | null;
  reimbursementsTotal?: number | string | null;
  manualArtistTotal?: number | string | null;
  manualClientTotal?: number | string | null;
  /** The legacy applicant-record flag; never infer this from `hours`. */
  isHourlyRate?: boolean | number | null;
};

/** Values public invoice projections expose for an admin booking period. */
export type PeriodInvoicePreviewSource = InvoiceBookingPreviewSource & {
  actualHours?: number | string | null;
};

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function totalsFromMoney(money: BookingMoney): InvoicePreviewTotals {
  return {
    baseAmount: money.base,
    reimbursements: money.reimbursements,
    processingFee: money.processingFee,
    artistTotal: money.artistTotal,
    total: money.clientTotal,
  };
}

function isExplicitRateType(source: InvoiceBookingPreviewSource): boolean {
  return source.rateType === "hourly" || source.rateType === "flat";
}

/**
 * Preview a normal booking invoice.
 *
 * New rows carry an explicit basis, and admin-set totals are complete invoice
 * overrides; both deliberately go through bookingMoney. A legacy booking has
 * neither, so it preserves the long-standing resolveBookingBaseAmount rule:
 * artistRate is already a booking total, and only a real applicant hourly rate
 * may reprice it when the studio changes hours.
 */
export function bookingInvoiceTotals(
  booking: InvoiceBookingPreviewSource,
  hoursOverride?: number | null,
): InvoicePreviewTotals {
  const reimbursements = numberOrZero(booking.reimbursementsTotal);
  const hours = hoursOverride ?? numberOrNull(booking.hours);

  if (hasManualTotals(booking) || isExplicitRateType(booking)) {
    return totalsFromMoney(bookingMoney({
      rateType: isExplicitRateType(booking) ? booking.rateType as RateType : undefined,
      hourlyRate: numberOrNull(booking.hourlyRate ?? booking.artistHourlyRate),
      // Explicit flat bookings own their flatRate. The artist total is only a
      // historical fallback for an incomplete row, never an hourly unit rate.
      flatRate: numberOrNull(booking.flatRate ?? booking.artistRate),
      hours: numberOrNull(booking.hours),
      legacyArtistTotal: numberOrNull(booking.artistRate),
      legacyClientTotal: numberOrNull(booking.clientRate),
      manualArtistTotal: numberOrNull(booking.manualArtistTotal),
      manualClientTotal: numberOrNull(booking.manualClientTotal),
    }, { hoursOverride: hours, reimbursements }));
  }

  const legacy = resolveInvoiceTotals({
    isHourlyRate: booking.isHourlyRate,
    storedTotal: numberOrNull(booking.artistRate),
    unitHourlyRate: numberOrNull(booking.artistHourlyRate ?? booking.hourlyRate),
    storedHours: numberOrNull(booking.hours),
  }, { adjustedHours: hours, reimbursements });
  return {
    baseAmount: legacy.baseAmount,
    reimbursements: legacy.reimbursements,
    processingFee: legacy.processingFee,
    artistTotal: legacy.baseAmount + legacy.reimbursements,
    total: legacy.total,
  };
}

/**
 * Preview an admin booking period invoice.
 *
 * Periods historically stored their fallback artistRate as the hourly unit.
 * Therefore the period path retains its existing hourly fallback when the
 * parent booking has no explicit rate type, while still honoring flat rows and
 * all admin manual totals. This is intentionally distinct from a legacy normal
 * booking, whose artistRate is a whole-booking total.
 */
export function periodInvoicePreviewTotals(
  period: PeriodInvoicePreviewSource,
  hoursOverride?: number | null,
): InvoicePreviewTotals {
  const rateType: RateType = period.rateType === "flat" ? "flat" : "hourly";
  const hours = hoursOverride ?? numberOrNull(period.actualHours ?? period.hours);
  return totalsFromMoney(bookingMoney({
    rateType,
    hourlyRate: numberOrNull(period.hourlyRate ?? period.artistHourlyRate ?? period.artistRate),
    flatRate: numberOrNull(period.flatRate ?? period.artistRate),
    hours: numberOrNull(period.actualHours ?? period.hours),
    legacyArtistTotal: numberOrNull(period.artistRate),
    legacyClientTotal: numberOrNull(period.clientRate),
    manualArtistTotal: numberOrNull(period.manualArtistTotal),
    manualClientTotal: numberOrNull(period.manualClientTotal),
  }, { hoursOverride: hours, reimbursements: numberOrZero(period.reimbursementsTotal) }));
}
