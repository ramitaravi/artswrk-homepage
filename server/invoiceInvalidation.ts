import { canReuseCheckoutUrl } from "../shared/stripeCheckoutMode";
import { ENV } from "./_core/env";
import { getStripeMode } from "./stripe-products";
import { getStripe } from "./stripe";

/**
 * Clearing our token does not disable an already-issued hosted Stripe link.
 * Expire it before changing any invoice amounts. Never try a different mode's
 * session, and fail closed if payment completed or Stripe cannot expire it.
 */
export async function expireUnpaidInvoiceCheckout(url: string | null | undefined): Promise<void> {
  if (!canReuseCheckoutUrl(url, getStripeMode(ENV.stripeSecretKey))) return;
  const sessionId = new URL(url!).pathname.match(/(?:^|\/)(cs_(?:live|test)_[A-Za-z0-9]+)(?:$|\/)/)?.[1];
  if (!sessionId) throw new Error("Cannot safely withdraw this invoice's payment link.");
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === "complete" || session.payment_status === "paid") {
    throw new Error("This invoice's payment has completed, so it cannot be changed.");
  }
  if (session.status === "expired") return;
  if (session.status !== "open") throw new Error("Cannot safely withdraw this invoice's payment link.");
  // An in-flight payment may win this race; Stripe rejects expiration then,
  // and we propagate that rejection without changing any booking or expense.
  await stripe.checkout.sessions.expire(sessionId);
}
