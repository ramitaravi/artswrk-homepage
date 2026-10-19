/**
 * An artist raising their own invoice, end to end: the request they fill in,
 * the booking it becomes, the email the client gets and the card they're
 * charged.
 *
 * This runs the real procedures with the database, Stripe and email mocked, so
 * the money is computed by the same code production uses. Nothing here touches
 * a real account — the one way to exercise this path without emailing a live
 * client a payment link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const stripeMocks = vi.hoisted(() => ({ create: vi.fn() }));
const emailMocks = vi.hoisted(() => ({ payArtist: vi.fn(), simple: vi.fn() }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByOpenId: vi.fn(),
    getUserById: vi.fn(),
    getArtistStripeConnectAccount: vi.fn(),
    getArtistPastClients: vi.fn(),
    createArtistInvoiceBooking: vi.fn(),
    getBookingById: vi.fn(),
    getBookingByInvoiceToken: vi.fn(),
    getReimbursementsByBookingId: vi.fn(),
    markArtswrkInvoiceSubmitted: vi.fn(),
    approveArtswrkInvoice: vi.fn(),
    declineArtswrkInvoice: vi.fn(),
    getOrCreateConversation: vi.fn(),
    sendMessageToConversation: vi.fn(),
  };
});
vi.mock("./stripe", () => ({
  getStripe: vi.fn(() => ({ checkout: { sessions: { create: stripeMocks.create } } })),
  checkoutUrlMatchesMode: vi.fn(() => false),
}));
vi.mock("./email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email")>();
  return { ...actual, sendClientPayArtistEmail: emailMocks.payArtist, sendSimpleEmail: emailMocks.simple };
});

import { appRouter } from "./routers";
import * as db from "./db";

const ARTIST = { id: 781, openId: "artist-open-id", name: "Test Artist", firstName: "Test", email: "artist@example.test" };
// A client that is NOT a studio — the case the wording change exists for.
const CLIENT = { id: 902, name: "Test Dance Competition", clientCompanyName: "Test Dance Competition", email: "client@example.test" };
const NEW_BOOKING_ID = 1400001;

const context = {
  user: { openId: ARTIST.openId },
  req: { protocol: "https", headers: {} },
  res: {},
} as unknown as TrpcContext;

const caller = () => appRouter.createCaller(context);

/** The row createArtistInvoiceBooking would have written, read back. */
function bookingRow(over: Record<string, unknown> = {}) {
  return {
    id: NEW_BOOKING_ID,
    artistUserId: ARTIST.id,
    clientUserId: CLIENT.id,
    rateType: "hourly",
    hourlyRate: 18,
    flatRate: null,
    artistRate: 651,
    clientRate: 651,
    hours: 36.166666666666664,
    bookingStatus: "Confirmed",
    paymentStatus: "Unpaid",
    paymentMethod: "artswrk",
    isAdminBooking: true,
    isRecurring: false,
    recurringSeriesId: null,
    invoicePaidAt: null,
    invoicePaymentToken: null,
    invoiceStripeCheckoutUrl: null,
    artswrkInvoiceSubmittedAt: null,
    startDate: new Date("2026-10-04T17:00:00Z"),
    description: "Admin support, Aug 31 – Oct 4",
    reimbursementsTotal: 0,
    ...over,
  };
}

const HOURLY_INPUT = {
  clientUserId: CLIENT.id,
  rateType: "hourly" as const,
  hourlyRate: 18,
  hours: 36.17,
  workDate: "2026-10-04",
  description: "Admin support, Aug 31 – Oct 4",
  origin: "https://artswrk.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserByOpenId).mockResolvedValue(ARTIST as any);
  vi.mocked(db.getUserById).mockImplementation(async (id: number) =>
    (id === CLIENT.id ? CLIENT : ARTIST) as any);
  vi.mocked(db.getArtistStripeConnectAccount).mockResolvedValue("acct_test_artist");
  vi.mocked(db.getArtistPastClients).mockResolvedValue([
    { clientUserId: CLIENT.id, name: CLIENT.name, logo: null, lastWorkedAt: new Date("2026-09-24"), lastHourlyRate: 18 },
  ] as any);
  vi.mocked(db.createArtistInvoiceBooking).mockResolvedValue(NEW_BOOKING_ID);
  vi.mocked(db.getBookingById).mockResolvedValue(bookingRow() as any);
  vi.mocked(db.getReimbursementsByBookingId).mockResolvedValue([] as any);
  vi.mocked(db.markArtswrkInvoiceSubmitted).mockResolvedValue(true as any);
  stripeMocks.create.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  vi.mocked(db.getOrCreateConversation).mockResolvedValue({ id: 555 } as any);
});
afterEach(() => vi.clearAllMocks());

describe("creating the invoice", () => {
  it("stores the booking and emails the client a payment link", async () => {
    const res = await caller().artistDashboard.createInvoice(HOURLY_INPUT);

    // $18/hr x 36.17 hrs, plus a 5% fee rounded to whole dollars.
    expect(res.artistTotal).toBeCloseTo(651.06, 2);
    expect(res.total).toBeCloseTo(684.06, 2);
    expect(res.bookingId).toBe(NEW_BOOKING_ID);
    expect(res.paymentPageUrl).toBe(`https://artswrk.com/invoice/${res.invoicePaymentToken}`);

    // Hourly, so the per-hour rate is stored as the unit and the legacy
    // columns get the total — the split that caused the $18-vs-$651 bug.
    expect(db.createArtistInvoiceBooking).toHaveBeenCalledWith(expect.objectContaining({
      artistUserId: ARTIST.id, clientUserId: CLIENT.id,
      rateType: "hourly", hourlyRate: 18, flatRate: null,
      hours: 36.17, totalDollars: 651.06,
    }));

    expect(emailMocks.payArtist).toHaveBeenCalledWith(expect.objectContaining({
      to: CLIENT.email,
      artistName: "Test Artist",
      totalClientRate: "$684.06",
      payUrl: res.paymentPageUrl,
    }));
  });

  it("bills a flat amount as given, without multiplying by anything", async () => {
    vi.mocked(db.getBookingById).mockResolvedValue(bookingRow({
      rateType: "flat", hourlyRate: null, flatRate: 400, artistRate: 400, clientRate: 400, hours: null,
    }) as any);

    const res = await caller().artistDashboard.createInvoice({
      ...HOURLY_INPUT, rateType: "flat", hourlyRate: undefined, hours: undefined, flatRate: 400,
    });

    expect(res.artistTotal).toBeCloseTo(400, 2);
    expect(res.total).toBeCloseTo(420, 2);  // $400 + $20 fee
    expect(db.createArtistInvoiceBooking).toHaveBeenCalledWith(expect.objectContaining({
      rateType: "flat", flatRate: 400, hourlyRate: null, hours: null, totalDollars: 400,
    }));
  });
});

describe("what it refuses", () => {
  it("refuses a client the artist has never worked with", async () => {
    await expect(caller().artistDashboard.createInvoice({ ...HOURLY_INPUT, clientUserId: 55555 }))
      .rejects.toThrow(/only invoice a client you've worked with/);
    expect(db.createArtistInvoiceBooking).not.toHaveBeenCalled();
  });

  it("refuses when there's no payout account to send the money to", async () => {
    vi.mocked(db.getArtistStripeConnectAccount).mockResolvedValue(null);
    await expect(caller().artistDashboard.createInvoice(HOURLY_INPUT))
      .rejects.toThrow(/Connect your Stripe payout account/);
    expect(emailMocks.payArtist).not.toHaveBeenCalled();
  });

  it("refuses work dated in the future", async () => {
    const nextYear = new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10);
    await expect(caller().artistDashboard.createInvoice({ ...HOURLY_INPUT, workDate: nextYear }))
      .rejects.toThrow(/can't be in the future/);
  });

  it("refuses an empty amount", async () => {
    await expect(caller().artistDashboard.createInvoice({ ...HOURLY_INPUT, hours: 0 as any }))
      .rejects.toThrow();
    expect(db.createArtistInvoiceBooking).not.toHaveBeenCalled();
  });
});

describe("the client's side", () => {
  const submitted = () => bookingRow({
    invoicePaymentToken: "tok_self_invoice",
    artswrkInvoiceSubmittedAt: new Date("2026-10-08T12:00:00Z"),
    bookingStatus: "Pay Now",
    hours: 36.17,
  });

  it("charges the card $684.06, with $651.06 going to the artist", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(submitted() as any);

    await caller().invoice.approve({ token: "tok_self_invoice" });

    const payload = stripeMocks.create.mock.calls[0][0] as any;
    expect(payload.line_items[0].price_data.unit_amount).toBe(68406);
    expect(payload.payment_intent_data.application_fee_amount).toBe(3300);
    // The artist's own connected account, never the platform's.
    expect(payload.payment_intent_data.transfer_data.destination).toBe("acct_test_artist");
    expect(db.approveArtswrkInvoice).toHaveBeenCalledWith(
      NEW_BOOKING_ID, expect.objectContaining({ invoiceTotalCents: 68406 }),
    );
  });

  it("recomputes from the agreed rate when the client corrects the hours", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(submitted() as any);

    await caller().invoice.approve({ token: "tok_self_invoice", hours: 30 });

    // 30 x $18 = $540, fee $27.
    const payload = stripeMocks.create.mock.calls[0][0] as any;
    expect(payload.line_items[0].price_data.unit_amount).toBe(56700);
    expect(db.approveArtswrkInvoice).toHaveBeenCalledWith(
      NEW_BOOKING_ID, expect.objectContaining({ hours: 30, invoiceTotalCents: 56700 }),
    );
  });
});

describe("sending an invoice back", () => {
  const submitted = (over: Record<string, unknown> = {}) => bookingRow({
    invoicePaymentToken: "tok_self_invoice",
    invoiceStripeCheckoutUrl: null,
    artswrkInvoiceSubmittedAt: new Date("2026-10-08T12:00:00Z"),
    bookingStatus: "Pay Now",
    ...over,
  });

  it("withdraws the invoice so the emailed link can't still be paid", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(submitted() as any);

    const res = await caller().invoice.decline({
      token: "tok_self_invoice",
      reason: "We agreed $15/hr for admin, not $18.",
    });

    expect(res.success).toBe(true);
    expect(db.declineArtswrkInvoice).toHaveBeenCalledWith(NEW_BOOKING_ID);
    // Crucially, no Stripe session is created and nothing is approved.
    expect(stripeMocks.create).not.toHaveBeenCalled();
    expect(db.approveArtswrkInvoice).not.toHaveBeenCalled();
  });

  it("tells the artist why, in their inbox and by email", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(submitted() as any);

    await caller().invoice.decline({ token: "tok_self_invoice", reason: "We agreed $15/hr." });

    expect(db.sendMessageToConversation).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 555,
      senderUserId: CLIENT.id,
      content: expect.stringContaining("We agreed $15/hr."),
    }));
    const toArtist = emailMocks.simple.mock.calls.find((c: any[]) => c[0].to === ARTIST.email);
    expect(toArtist).toBeDefined();
    expect(toArtist![0].subject).toContain("Test Dance Competition");
    expect(toArtist![0].html).toContain("We agreed $15/hr.");
    // And Artswrk sees every dispute.
    expect(emailMocks.simple.mock.calls.some((c: any[]) => c[0].to === "contact@artswrk.com")).toBe(true);
  });

  it("escapes a reason that contains markup before it reaches an inbox", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(submitted() as any);

    await caller().invoice.decline({
      token: "tok_self_invoice",
      reason: '<script>alert("x")</script> wrong rate',
    });

    for (const [arg] of emailMocks.simple.mock.calls as any[]) {
      expect(arg.html).not.toContain("<script>");
      expect(arg.html).toContain("&lt;script&gt;");
    }
  });

  it("refuses to withdraw an invoice that has already been paid", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(
      submitted({ invoicePaidAt: new Date("2026-10-09T09:00:00Z") }) as any);

    await expect(caller().invoice.decline({ token: "tok_self_invoice", reason: "too late" }))
      .rejects.toThrow(/already been paid/);
    expect(db.declineArtswrkInvoice).not.toHaveBeenCalled();
  });

  it("still withdraws the invoice when the notifications fail", async () => {
    vi.mocked(db.getBookingByInvoiceToken).mockResolvedValue(submitted() as any);
    vi.mocked(db.getOrCreateConversation).mockRejectedValue(new Error("messaging down"));
    emailMocks.simple.mockRejectedValue(new Error("smtp down"));

    await expect(caller().invoice.decline({ token: "tok_self_invoice", reason: "wrong rate" }))
      .resolves.toEqual({ success: true });
    expect(db.declineArtswrkInvoice).toHaveBeenCalledWith(NEW_BOOKING_ID);
  });
});
