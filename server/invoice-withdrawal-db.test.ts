import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), limit: vi.fn(), expire: vi.fn() }));
vi.mock("mysql2/promise", () => ({ default: { createPool: () => ({ on: vi.fn() }) } }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({
  execute: mocks.execute,
  select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
}) }));
vi.mock("./invoiceInvalidation", () => ({ expireUnpaidInvoiceCheckout: mocks.expire }));
import { withdrawBookingInvoice, withdrawBookingPeriodInvoice } from "./db";
const originalDatabase = process.env.DATABASE_URL;
beforeAll(() => { process.env.DATABASE_URL = "mysql://unit-test-placeholder"; });
afterAll(() => { process.env.DATABASE_URL = originalDatabase; });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue([{ id: 7, bookingId: 10, status: "artist_submitted", invoicePaidAt: null, invoiceStripeCheckoutUrl: "mock-hosted-checkout", actualHours: 3 }]);
  mocks.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
  mocks.expire.mockResolvedValue(undefined);
});
const request = { periodId: 7, actorUserId: 42, actorRole: "artist", reason: "expense removed" };
const query = () => new MySqlDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql;

describe("weekly invoice withdrawal database contract", () => {
  it("expires the hosted link first, clears invoice fields, reopens the period, and keeps actual hours", async () => {
    await withdrawBookingPeriodInvoice(request);
    expect(mocks.expire).toHaveBeenCalledWith("mock-hosted-checkout");
    expect(mocks.expire.mock.invocationCallOrder[0]).toBeLessThan(mocks.execute.mock.invocationCallOrder[0]);
    expect(query()).toMatch(/UPDATE booking_periods/);
    expect(query()).toMatch(/status = 'open'/);
    expect(query()).toMatch(/invoicePaymentToken = NULL/);
    expect(query()).toMatch(/invoiceTotalCents = NULL/);
    expect(query()).toMatch(/invoiceStripeCheckoutUrl = NULL/);
    expect(query()).toMatch(/invoicePaidAt IS NULL/);
    expect(query()).not.toMatch(/actualHours\s*=/);
    expect(mocks.execute).toHaveBeenCalledTimes(2); // update + audit
  });
  it.each([{ status: "client_paid", invoicePaidAt: null }, { status: "artist_submitted", invoicePaidAt: new Date() }])("never changes a paid period %j", async (paid) => {
    mocks.limit.mockResolvedValue([{ id: 7, bookingId: 10, ...paid }]);
    await expect(withdrawBookingPeriodInvoice(request)).rejects.toThrow(/has been paid/);
    expect(mocks.expire).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not change records when hosted-session expiration fails", async () => {
    mocks.expire.mockRejectedValueOnce(new Error("payment already completed"));
    await expect(withdrawBookingPeriodInvoice(request)).rejects.toThrow(/payment already completed/);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not write an audit saying withdrawn if the paid-state update guard rejects the change", async () => {
    mocks.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(withdrawBookingPeriodInvoice(request)).rejects.toThrow(/reload before editing/);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it("also disables hosted links when the normal booking invoice is withdrawn", async () => {
    mocks.limit.mockResolvedValue([{ id: 10, invoicePaidAt: null, paymentStatus: "Unpaid", invoiceStripeCheckoutUrl: "mock-hosted-checkout" }]);
    await withdrawBookingInvoice({ bookingId: 10, actorRole: "admin", reason: "rate edited" });
    expect(mocks.expire).toHaveBeenCalledWith("mock-hosted-checkout");
    expect(mocks.expire.mock.invocationCallOrder[0]).toBeLessThan(mocks.execute.mock.invocationCallOrder[0]);
    expect(query()).toMatch(/LOWER\(COALESCE\(paymentStatus/);
  });
});
