import { describe, expect, it } from "vitest";
import { adminDerivedRateEditPayload } from "./adminBookingForm";

describe("adminDerivedRateEditPayload", () => {
  it("sends an hourly unit and hours with an explicit hourly basis", () => {
    expect(adminDerivedRateEditPayload({
      bookingId: 91,
      rateType: "hourly",
      rate: "65",
      hours: "3.5",
      clearManualTotals: true,
      reason: "Corrected agreement",
    })).toEqual({
      bookingId: 91,
      rateType: "hourly",
      hourlyRate: 65,
      hours: 3.5,
      manualArtistTotal: null,
      manualClientTotal: null,
      reason: "Corrected agreement",
    });
  });

  it("sends only a flat unit and never leaks stale hourly fields", () => {
    expect(adminDerivedRateEditPayload({
      bookingId: 92,
      rateType: "flat",
      rate: "425",
      hours: "8",
    })).toEqual({
      bookingId: 92,
      rateType: "flat",
      flatRate: 425,
    });
  });
});
