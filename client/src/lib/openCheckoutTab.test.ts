/**
 * The tab has to be opened during the click, not after the mutation resolves —
 * that was a live bug: window.open a tick later is silently dropped by popup
 * blockers, and the upgrade click did nothing at all.
 *
 * These cover the three outcomes: a tab we got, a tab we were denied, and a
 * checkout that never produced a URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openPendingTab } from "./openCheckoutTab";

const realOpen = globalThis.window?.open;

function fakeWindow() {
  return {
    closed: false,
    focus: vi.fn(),
    location: { href: "" },
    document: { write: vi.fn(), close: vi.fn() },
    close: vi.fn(function (this: any) { this.closed = true; }),
  };
}

beforeEach(() => {
  (globalThis as any).window ??= {};
  (globalThis as any).window.location = { href: "" };
});
afterEach(() => { if (realOpen) globalThis.window.open = realOpen; });

describe("openPendingTab", () => {
  it("opens the tab immediately, before any URL exists", () => {
    const w = fakeWindow();
    const open = vi.fn(() => w);
    (globalThis as any).window.open = open;

    openPendingTab();

    // The whole point: called during the click, not on go().
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith("", "_blank");
  });

  it("points the already-open tab at the checkout url", () => {
    const w = fakeWindow();
    (globalThis as any).window.open = vi.fn(() => w);

    openPendingTab().go("https://checkout.stripe.com/c/pay/cs_test_1");

    expect(w.location.href).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect((globalThis as any).window.location.href).toBe("");
  });

  it("navigates this tab instead when the popup was blocked", () => {
    (globalThis as any).window.open = vi.fn(() => null);

    openPendingTab().go("https://checkout.stripe.com/c/pay/cs_test_2");

    // Losing the click entirely is the one unacceptable outcome.
    expect((globalThis as any).window.location.href).toBe("https://checkout.stripe.com/c/pay/cs_test_2");
  });

  it("treats a tab that was opened-then-closed as blocked", () => {
    const w = fakeWindow(); w.closed = true;
    (globalThis as any).window.open = vi.fn(() => w);

    openPendingTab().go("https://checkout.stripe.com/c/pay/cs_test_3");

    expect((globalThis as any).window.location.href).toBe("https://checkout.stripe.com/c/pay/cs_test_3");
  });

  it("closes the placeholder when checkout returns no url", () => {
    const w = fakeWindow();
    (globalThis as any).window.open = vi.fn(() => w);

    openPendingTab().go(null);

    expect(w.close).toHaveBeenCalled();
    expect((globalThis as any).window.location.href).toBe("");
  });

  it("closes the placeholder when the mutation fails", () => {
    const w = fakeWindow();
    (globalThis as any).window.open = vi.fn(() => w);

    openPendingTab().cancel();

    expect(w.close).toHaveBeenCalled();
  });
});
