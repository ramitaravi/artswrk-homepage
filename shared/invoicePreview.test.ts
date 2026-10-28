/**
 * The studio is shown exactly what their card will be charged.
 *
 * These cases exercise the same shared calculators invoice.approve uses. A
 * preview may never invent its own fee or re-derive an admin-set total.
 */
import { describe, expect, it } from "vitest";
import { bookingInvoiceTotals, periodInvoicePreviewTotals } from "./invoicePreview";

describe("booking invoice preview", () => {
  it("keeps a legacy hourly booking's stored total — Michael Charles is $210, never $840", () => {
    const totals = bookingInvoiceTotals({
      isHourlyRate: 1, artistRate: 200, hours: 4,
    }, 4);
    expect(totals).toEqual({
      baseAmount: 200, reimbursements: 0, processingFee: 10,
      artistTotal: 200, total: 210,
    });
  });

  it("reprices a legacy hourly booking only from its real unit rate when hours change", () => {
    const unchanged = bookingInvoiceTotals({
      isHourlyRate: 1, artistRate: 200, artistHourlyRate: 50, hours: 4,
    }, 4);
    const adjusted = bookingInvoiceTotals({
      isHourlyRate: 1, artistRate: 200, artistHourlyRate: 50, hours: 4,
    }, 5);
    expect(unchanged.baseAmount).toBe(200);
    expect(adjusted).toMatchObject({ baseAmount: 250, artistTotal: 250, total: 263 });
  });

  it("uses explicit flat rate once, even where the booking records hours", () => {
    const totals = bookingInvoiceTotals({
      rateType: "flat", flatRate: 450, artistRate: 450, hours: 9,
    }, 9);
    expect(totals).toMatchObject({ baseAmount: 450, artistTotal: 450, total: 473 });
  });

  it("quotes an explicit hourly booking's rate × adjusted hours and fees reimbursements", () => {
    const totals = bookingInvoiceTotals({
      rateType: "hourly", hourlyRate: 80, hours: 3, reimbursementsTotal: 36,
    }, 4);
    expect(totals).toEqual({
      baseAmount: 320, reimbursements: 36, processingFee: 18,
      artistTotal: 356, total: 374,
    });
  });

  it("honors manual payout and client totals, with reimbursement on both and no invented 5% fee", () => {
    const totals = bookingInvoiceTotals({
      rateType: "hourly", hourlyRate: 18, hours: 36,
      manualArtistTotal: 720, manualClientTotal: 900, reimbursementsTotal: 50,
    }, 100);
    expect(totals).toEqual({
      baseAmount: 720, reimbursements: 50, processingFee: 180,
      artistTotal: 770, total: 950,
    });
    expect(totals.total - totals.artistTotal).toBe(totals.processingFee);
  });
});

describe("period invoice preview", () => {
  it("retains the period's legacy hourly-rate fallback", () => {
    const totals = periodInvoicePreviewTotals({
      artistRate: 80, clientRate: 80, actualHours: 3, reimbursementsTotal: 50,
    });
    expect(totals).toEqual({
      baseAmount: 240, reimbursements: 50, processingFee: 15,
      artistTotal: 290, total: 305,
    });
  });

  it("uses a period's manual artist/client totals for payout and charge, regardless of edited hours", () => {
    const totals = periodInvoicePreviewTotals({
      rateType: "hourly", hourlyRate: 80, actualHours: 3, reimbursementsTotal: 50,
      manualArtistTotal: 720, manualClientTotal: 900,
    }, 99);
    expect(totals).toEqual({
      baseAmount: 720, reimbursements: 50, processingFee: 180,
      artistTotal: 770, total: 950,
    });
  });
});
