import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const stripeMocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getBookingByInvoiceToken: vi.fn(),
    getArtistStripeConnectAccount: vi.fn(),
    getUserById: vi.fn(),
    approveArtswrkInvoice: vi.fn(),
  };
});
vi.mock("./stripe", () => ({
  getStripe: vi.fn(() => ({ checkout: { sessions: { create: stripeMocks.create } } })),
  // A stored checkout URL is only reused when it matches the server's Stripe
  // mode; these cases start with no stored URL, so a fresh session is created.
  checkoutUrlMatchesMode: vi.fn(() => false),
}));

import { appRouter } from "./routers";
import * as db from "./db";

const context = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: {},
} as unknown as TrpcContext;

const invoice = {
  id: 1201, artistUserId: 7, clientUserId: 9,
  bookingStatus: "Pay Now", paymentStatus: "Unpaid",
  invoicePaidAt: null, invoiceStripeCheckoutUrl: null, invoicePaymentToken: "token",
  recurringSeriesId: 1201, rateType: "hourly", hourlyRate: 80,
  artistRate: 80, hours: 3, reimbursementsTotal: 50,
  startDate: new Date("2026-09-14T15:00:00Z"),
};

describe("per-class invoice checkout", () => {
  const originalStripeKey = ENV.stripeSecretKey;
  beforeEach(() => {
    ENV.stripeSecretKey = originalStripeKey;
    vi.clearAllMocks();
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(invoice as any);
    vi.mocked(db.getArtistStripeConnectAccount).mockResolvedValue("acct_test");
    vi.mocked(db.getUserById).mockImplementation(async (id) => (
      id === 9 ? { name: "Studio", email: "studio@example.com" } : { name: "Artist", email: "artist@example.com" }
    ) as any);
    stripeMocks.create.mockResolvedValue({ url: "https://checkout.stripe.test/test" });
  });
  afterEach(() => { ENV.stripeSecretKey = originalStripeKey; });

  it("charges 3 hours × $80 plus $50 expense and the 5% fee", async () => {
    const result = await appRouter.createCaller(context).invoice.approve({ token: "token" });
    expect(result.checkoutUrl).toBe("https://checkout.stripe.test/test");
    const payload = stripeMocks.create.mock.calls[0][0] as any;
    expect(payload.line_items[0].price_data.unit_amount).toBe(30500);
    expect(payload.payment_intent_data.application_fee_amount).toBe(1500);
    expect(payload.metadata.booking_id).toBe("1201");
    expect(db.approveArtswrkInvoice).toHaveBeenCalledWith(1201, expect.objectContaining({ hours: 3, invoiceTotalCents: 30500 }));
  });

  it("recomputes from the same contracted rate when the studio adjusts hours", async () => {
    await appRouter.createCaller(context).invoice.approve({ token: "token", hours: 4 });
    const payload = stripeMocks.create.mock.calls[0][0] as any;
    expect(payload.line_items[0].price_data.unit_amount).toBe(38900);
    expect(db.approveArtswrkInvoice).toHaveBeenCalledWith(1201, expect.objectContaining({ hours: 4, invoiceTotalCents: 38900 }));
  });

  it("replaces an unpaid test Checkout link after switching the app to live mode", async () => {
    ENV.stripeSecretKey = "sk_live_unit_test_placeholder";
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue({
      ...invoice,
      invoiceStripeCheckoutUrl: "https://checkout.stripe.com/c/pay/cs_test_oldsession",
    } as any);
    const result = await appRouter.createCaller(context).invoice.approve({ token: "token" });
    expect(result.checkoutUrl).toBe("https://checkout.stripe.test/test");
    expect(stripeMocks.create).toHaveBeenCalledOnce();
    expect(db.approveArtswrkInvoice).toHaveBeenCalledWith(1201, expect.objectContaining({ invoiceTotalCents: 30500 }));
  });

  it("never recreates an unpaid session that already belongs to the active mode", async () => {
    ENV.stripeSecretKey = "sk_live_unit_test_placeholder";
    const liveUrl = "https://checkout.stripe.com/c/pay/cs_live_existing";
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue({ ...invoice, invoiceStripeCheckoutUrl: liveUrl } as any);
    const result = await appRouter.createCaller(context).invoice.approve({ token: "token" });
    expect(result.checkoutUrl).toBe(liveUrl);
    expect(stripeMocks.create).not.toHaveBeenCalled();
  });
});

describe("class-date booking detail", () => {
  it("shows the agreed $80 hourly rate and the real $305 total, not $80 as the subtotal", () => {
    const pricing = db.buildClientPricing({
      _recurringSeriesId: 1201, _hourlyRate: 80,
      clientRate: 80, _artistRate: 80, hours: 3,
      reimbursementsTotal: 50, invoiceTotalCents: 30500,
    });
    expect(pricing).toEqual({
      isHourly: true, unitRate: 80, hours: 3, subtotal: 240,
      reimbursements: 50, processingFee: 15, total: 305,
      hasProcessingFee: true,
    });
  });
});
