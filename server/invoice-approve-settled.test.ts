/**
 * invoice.approve must never open a second checkout for a booking that was
 * settled elsewhere. invoicePaidAt only records payments made through this
 * invoice; a booking paid via a legacy Bubble payment link keeps its token but
 * is marked paid on the booking itself (Fancy Feet × Andrea B., Sept 2026).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getBookingByInvoiceToken: vi.fn(), getArtistStripeConnectAccount: vi.fn() };
});

import { appRouter } from "./routers";
import * as db from "./db";

const mocked = <T>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const publicCtx = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: {},
} as unknown as TrpcContext;

const openInvoice = {
  id: 1, artistUserId: 2, clientUserId: 3, artistRate: 510, hours: 6, isHourlyRate: null,
  invoicePaidAt: null, invoiceStripeCheckoutUrl: null, invoicePaymentToken: "tok", reimbursementsTotal: 0,
};
const approve = () => appRouter.createCaller(publicCtx).invoice.approve({ token: "tok" });

describe("invoice.approve on a booking settled elsewhere", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a booking already marked paid, before going near Stripe", async () => {
    mocked(db.getBookingByInvoiceToken).mockResolvedValue({ ...openInvoice, paymentStatus: "Paid", bookingStatus: "Completed" });
    await expect(approve()).rejects.toThrow(/already been paid/);
    expect(db.getArtistStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("refuses a cancelled booking", async () => {
    mocked(db.getBookingByInvoiceToken).mockResolvedValue({ ...openInvoice, paymentStatus: "Unpaid", bookingStatus: "Cancelled" });
    await expect(approve()).rejects.toThrow(/cancelled/);
    expect(db.getArtistStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("lets an unpaid booking through to the next check", async () => {
    mocked(db.getBookingByInvoiceToken).mockResolvedValue({ ...openInvoice, paymentStatus: "Unpaid", bookingStatus: "Pay Now" });
    mocked(db.getArtistStripeConnectAccount).mockResolvedValue(null);
    await expect(approve()).rejects.toThrow(/payout account/);
    expect(db.getArtistStripeConnectAccount).toHaveBeenCalledOnce();
  });
});
