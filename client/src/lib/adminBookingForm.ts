export type AdminBookingRateType = "hourly" | "flat";

type RawNumber = string | number | null | undefined;

export type AdminDerivedRateEditInput = {
  bookingId: number;
  rateType: AdminBookingRateType;
  rate: RawNumber;
  hours?: RawNumber;
  clearManualTotals?: boolean;
  reason?: string;
};

export type AdminDerivedRateEditPayload = {
  bookingId: number;
  rateType: AdminBookingRateType;
  hourlyRate?: number;
  flatRate?: number;
  hours?: number;
  manualArtistTotal?: null;
  manualClientTotal?: null;
  reason?: string;
};

/**
 * The edit endpoint deliberately accepts only a supplied unit field. Sending
 * both is ambiguous: a flat booking used to receive a new `hourlyRate` and no
 * `rateType`, then report success without changing what was charged. Keep the
 * conversion at the UI boundary so the request always names its basis.
 *
 * The current API accepts numeric rate fields but not `null`, so the opposite
 * unit field is intentionally omitted. The server must clear stale metadata
 * when `rateType` changes.
 */
export function adminDerivedRateEditPayload(input: AdminDerivedRateEditInput): AdminDerivedRateEditPayload {
  const numberOrUndefined = (value: RawNumber) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : undefined;
  };

  const rate = numberOrUndefined(input.rate);
  const hours = numberOrUndefined(input.hours);
  return {
    bookingId: input.bookingId,
    rateType: input.rateType,
    ...(input.rateType === "hourly" ? { hourlyRate: rate } : { flatRate: rate }),
    ...(input.rateType === "hourly" && hours !== undefined ? { hours } : {}),
    ...(input.clearManualTotals ? { manualArtistTotal: null, manualClientTotal: null } : {}),
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
  };
}
