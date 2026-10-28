import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
vi.mock("./db", async (original) => ({
  ...await original<typeof import("./db")>(),
  getUserByOpenId: vi.fn(), getUserById: vi.fn(), getBookingById: vi.fn(),
  getBookingPeriodById: vi.fn(), getReimbursementById: vi.fn(),
  deleteReimbursement: vi.fn(), withdrawBookingInvoice: vi.fn(),
  withdrawBookingPeriodInvoice: vi.fn(), recordBookingAudit: vi.fn(), applyBookingEdit: vi.fn(),
}));
vi.mock("./email", async (original) => ({ ...await original<typeof import("./email")>(), sendSimpleEmail: vi.fn() }));
import { appRouter } from "./routers";
import * as db from "./db";
const ctx = {
  user: { id: 42, openId: "release-regression-admin", role: "admin", userRole: "Artist" },
  req: { protocol: "https", headers: {} }, res: {},
} as unknown as TrpcContext;
const booking = {
  id: 10, artistUserId: 42, clientUserId: 99, rateType: "flat", flatRate: 200,
  artistRate: 200, clientRate: 210, hours: 4, paymentMethod: "artswrk",
  paymentStatus: "Unpaid", bookingStatus: "Confirmed", invoicePaidAt: null,
  artswrkInvoiceSubmittedAt: null, manualArtistTotal: null, manualClientTotal: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserByOpenId).mockResolvedValue(ctx.user as any);
  vi.mocked(db.getUserById).mockResolvedValue(undefined);
  vi.mocked(db.getBookingById).mockResolvedValue(booking as any);
  vi.mocked(db.getBookingPeriodById).mockResolvedValue(null);
  vi.mocked(db.getReimbursementById).mockResolvedValue({ id: 1, artistUserId: 42, bookingId: 10, bookingPeriodId: 7, value: 25 } as any);
});

describe("removing an expense from an approved weekly invoice", () => {
  it("withdraws the PERIOD invoice before deleting, not the un-invoiced season parent", async () => {
    vi.mocked(db.getBookingPeriodById).mockResolvedValue({ id: 7, bookingId: 10, status: "artist_submitted", invoicePaymentToken: "mock-token", invoiceStripeCheckoutUrl: "mock-checkout", invoicePaidAt: null } as any);
    const result = await appRouter.createCaller(ctx).artistDashboard.removeReimbursement({ id: 1 });
    expect(result.invoiceWithdrawn).toBe(true);
    expect(db.withdrawBookingPeriodInvoice).toHaveBeenCalledWith(expect.objectContaining({ periodId: 7, actorUserId: 42 }));
    expect(db.withdrawBookingInvoice).not.toHaveBeenCalled();
    expect(db.withdrawBookingPeriodInvoice.mock.invocationCallOrder[0]).toBeLessThan(db.deleteReimbursement.mock.invocationCallOrder[0]);
  });
  it("does not delete when Stripe or invoice invalidation fails", async () => {
    vi.mocked(db.getBookingPeriodById).mockResolvedValue({ id: 7, bookingId: 10, status: "artist_submitted", invoicePaidAt: null } as any);
    vi.mocked(db.withdrawBookingPeriodInvoice).mockRejectedValueOnce(new Error("payment completed"));
    await expect(appRouter.createCaller(ctx).artistDashboard.removeReimbursement({ id: 1 })).rejects.toThrow(/payment completed/);
    expect(db.deleteReimbursement).not.toHaveBeenCalled();
  });
  it("never withdraws or deletes a paid period with a lagging status", async () => {
    vi.mocked(db.getBookingPeriodById).mockResolvedValue({ id: 7, bookingId: 10, status: "artist_submitted", invoicePaidAt: new Date() } as any);
    await expect(appRouter.createCaller(ctx).artistDashboard.removeReimbursement({ id: 1 })).rejects.toThrow(/has been paid/);
    expect(db.withdrawBookingPeriodInvoice).not.toHaveBeenCalled();
    expect(db.deleteReimbursement).not.toHaveBeenCalled();
  });
});

describe("admin booking edits", () => {
  it("recomputes both payable totals for a flat-rate change rather than reporting a successful no-op", async () => {
    await appRouter.createCaller(ctx).bookingEdits.edit({ bookingId: 10, rateType: "flat", flatRate: 300, hours: 4 });
    expect(db.applyBookingEdit).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.objectContaining({ artistRate: 300, clientRate: 315, totalArtistRate: 300, totalClientRate: 315, hourlyRate: null }) }));
  });
  it("can explicitly switch from flat to hourly without leaving stale flat metadata", async () => {
    await appRouter.createCaller(ctx).bookingEdits.edit({ bookingId: 10, rateType: "hourly", hourlyRate: 50, hours: 4 });
    expect(db.applyBookingEdit).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.objectContaining({ artistRate: 200, clientRate: 210, flatRate: null }) }));
  });
  it("clearing both manual overrides restores the flat calculation", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue({ ...booking, manualArtistTotal: 700, manualClientTotal: 800 } as any);
    await appRouter.createCaller(ctx).bookingEdits.edit({ bookingId: 10, manualArtistTotal: null, manualClientTotal: null });
    expect(db.applyBookingEdit).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.objectContaining({ artistRate: 200, clientRate: 210, manualTotalsSetAt: null }) }));
  });
  it("rejects manual totals that would pay the artist more than the client charge", async () => {
    await expect(appRouter.createCaller(ctx).bookingEdits.edit({ bookingId: 10, manualArtistTotal: 300, manualClientTotal: 200 })).rejects.toThrow(/below the artist payout/);
    expect(db.applyBookingEdit).not.toHaveBeenCalled();
  });
});
