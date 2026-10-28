import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), expire: vi.fn() }));
vi.mock("./stripe", () => ({ getStripe: () => ({ checkout: { sessions: mocks } }) }));
import { expireUnpaidInvoiceCheckout } from "./invoiceInvalidation";
const originalKey = ENV.stripeSecretKey;
beforeEach(() => {
  vi.clearAllMocks();
  ENV.stripeSecretKey = "sk_live_unit_test_placeholder";
  mocks.retrieve.mockResolvedValue({ status: "open", payment_status: "unpaid" });
  mocks.expire.mockResolvedValue({ status: "expired" });
});
afterEach(() => { ENV.stripeSecretKey = originalKey; });

describe("withdrawn invoice Checkout links", () => {
  it("expires the same-mode unpaid session before its invoice can change", async () => {
    await expireUnpaidInvoiceCheckout("https://checkout.stripe.com/c/pay/cs_live_invoice#fragment");
    expect(mocks.retrieve).toHaveBeenCalledWith("cs_live_invoice");
    expect(mocks.expire).toHaveBeenCalledWith("cs_live_invoice");
  });
  it.each([null, "https://checkout.stripe.com/c/pay/cs_test_invoice", "https://bubble.example/pay", "https://checkout.stripe.com.evil.example/cs_live_invoice"])("never calls Stripe for missing, other-mode, or non-Stripe link %s", async (url) => {
    await expireUnpaidInvoiceCheckout(url);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.expire).not.toHaveBeenCalled();
  });
  it.each([{ status: "complete", payment_status: "unpaid" }, { status: "open", payment_status: "paid" }])("refuses payment completed ahead of the webhook %j", async (session) => {
    mocks.retrieve.mockResolvedValue(session);
    await expect(expireUnpaidInvoiceCheckout("https://checkout.stripe.com/c/pay/cs_live_invoice")).rejects.toThrow(/payment has completed/);
    expect(mocks.expire).not.toHaveBeenCalled();
  });
  it("treats an already expired session as safely invalidated", async () => {
    mocks.retrieve.mockResolvedValue({ status: "expired", payment_status: "unpaid" });
    await expireUnpaidInvoiceCheckout("https://checkout.stripe.com/c/pay/cs_live_invoice");
    expect(mocks.expire).not.toHaveBeenCalled();
  });
  it("fails closed if expiration loses a race with payment", async () => {
    mocks.expire.mockRejectedValue(new Error("session already complete"));
    await expect(expireUnpaidInvoiceCheckout("https://checkout.stripe.com/c/pay/cs_live_invoice")).rejects.toThrow(/already complete/);
  });
});
