import { describe, expect, it } from "vitest";
import {
  buildFeedRows,
  isAuthorizedFeedRequest,
  type FeedSourceBooking,
  type FeedSourcePeriod,
} from "./financeFeed";

const NOW = new Date("2026-11-18T05:00:00Z"); // 2026-11-18 00:00 Eastern

function booking(over: Partial<FeedSourceBooking>): FeedSourceBooking {
  return {
    id: 1,
    bookingStatus: "Confirmed",
    paymentStatus: "Unpaid",
    paymentMethod: "artswrk",
    startDate: "2026-12-05T15:00:00Z",
    rateType: null,
    hourlyRate: null,
    flatRate: null,
    hours: null,
    artistRate: null,
    clientRate: null,
    manualArtistTotal: null,
    manualClientTotal: null,
    isAdminBooking: 0,
    isRecurring: 0,
    recurringSeriesId: null,
    clientName: "Studio A",
    artistName: "Jane Doe",
    ...over,
  };
}

describe("buildFeedRows", () => {
  it("prices an hourly booking with the invoice math: rate x hours + 5%", () => {
    const [r] = buildFeedRows([booking({ rateType: "hourly", hourlyRate: 85, hours: 5, artistRate: 425 })], [], NOW);
    expect(r).toMatchObject({ bucket: "Upcoming", month: "2026-12", artistTotal: 425, clientTotal: 446, artswrkRevenue: 446, artswrkGrossProfit: 21 });
  });

  it("never multiplies a legacy total by hours", () => {
    const [r] = buildFeedRows([booking({ artistRate: 250, clientRate: 250, hours: 5 })], [], NOW);
    expect(r.artistTotal).toBe(250);
    expect(r.clientTotal).toBe(263); // 250 + round(12.5)
  });

  it("uses admin-set totals when present", () => {
    const [r] = buildFeedRows([booking({ rateType: "flat", flatRate: 300, manualArtistTotal: 300, manualClientTotal: 360 })], [], NOW);
    expect(r).toMatchObject({ clientTotal: 360, artistTotal: 300, artswrkGrossProfit: 60, manualTotals: true });
  });

  it("gives direct-pay bookings zero Artswrk revenue but keeps their value", () => {
    const [r] = buildFeedRows([booking({ paymentMethod: "direct", rateType: "flat", flatRate: 200 })], [], NOW);
    expect(r).toMatchObject({ paymentMethod: "direct", clientTotal: 210, artswrkRevenue: 0, artswrkGrossProfit: 0 });
  });

  it("skips paid, cancelled, unconfirmed-future and very old bookings", () => {
    const rows = buildFeedRows([
      booking({ id: 1, paymentStatus: "Paid", flatRate: 100, rateType: "flat" }),
      booking({ id: 2, bookingStatus: "Cancelled", flatRate: 100, rateType: "flat" }),
      booking({ id: 3, bookingStatus: "Pay Now", flatRate: 100, rateType: "flat" }),
      booking({ id: 4, startDate: "2024-01-01T15:00:00Z", flatRate: 100, rateType: "flat" }),
      booking({ id: 5, startDate: null }),
    ], [], NOW);
    expect(rows).toEqual([]);
  });

  it("marks a delivered, unpaid booking as a receivable", () => {
    const [r] = buildFeedRows([booking({ bookingStatus: "Pay Now", startDate: "2026-11-10T15:00:00Z", rateType: "flat", flatRate: 100 })], [], NOW);
    expect(r).toMatchObject({ bucket: "Delivered - unpaid", date: "2026-11-10" });
  });

  it("dates by the Eastern calendar day", () => {
    const [r] = buildFeedRows([booking({ startDate: "2027-01-01T03:00:00Z", rateType: "flat", flatRate: 100 })], [], NOW);
    expect(r).toMatchObject({ date: "2026-12-31", month: "2026-12" });
  });

  it("splits a weekly admin class into one row per unpaid week, using actual hours when submitted", () => {
    const b = booking({ id: 9, isAdminBooking: 1, isRecurring: 1, paymentStatus: "Paid", rateType: "hourly", hourlyRate: 50, hours: 2 });
    const periods: FeedSourcePeriod[] = [
      { bookingId: 9, periodNumber: 1, periodStart: "2026-11-25T15:00:00Z", actualHours: null },
      { bookingId: 9, periodNumber: 2, periodStart: "2026-12-02T15:00:00Z", actualHours: 3 },
    ];
    const rows = buildFeedRows([b], periods, NOW);
    expect(rows.map((r) => [r.rowType, r.periodNumber, r.artistTotal, r.clientTotal])).toEqual([
      ["Recurring week", 1, 100, 105],
      ["Recurring week", 2, 150, 158],
    ]);
  });
});

describe("isAuthorizedFeedRequest", () => {
  it("accepts only the exact key, and nothing when no key is set", () => {
    expect(isAuthorizedFeedRequest("Bearer abc123", "abc123")).toBe(true);
    expect(isAuthorizedFeedRequest("abc123", "abc123")).toBe(true);
    expect(isAuthorizedFeedRequest("Bearer abc124", "abc123")).toBe(false);
    expect(isAuthorizedFeedRequest(undefined, "abc123")).toBe(false);
    expect(isAuthorizedFeedRequest("Bearer ", "")).toBe(false);
  });
});
