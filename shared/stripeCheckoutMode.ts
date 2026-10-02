export type CheckoutMode = "test" | "live" | "unknown";

/** Stripe Checkout Session IDs are mode-scoped; a test link can never collect a live payment. */
export function checkoutUrlMode(url: string | null | undefined): CheckoutMode {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "checkout.stripe.com") return "unknown";
    const id = parsed.pathname.match(/(?:^|\/)cs_(test|live)_[A-Za-z0-9]+(?:$|\/)/);
    return (id?.[1] as CheckoutMode | undefined) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function canReuseCheckoutUrl(url: string | null | undefined, activeMode: CheckoutMode): boolean {
  return !!url && checkoutUrlMode(url) === activeMode && activeMode !== "unknown";
}

/** Never give a production customer a test-mode payment session again. */
export function assertProductionStripeMode(mode: CheckoutMode, nodeEnv: string | undefined): void {
  if (nodeEnv === "production" && mode !== "live") {
    throw new Error("Online payments are temporarily unavailable: live Stripe configuration is required.");
  }
}
