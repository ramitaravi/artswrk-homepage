/**
 * Fires once per page load if the URL carries a Stripe `session_id` (i.e. we
 * just landed back from a Checkout redirect). Verifies the session server-side
 * and applies its effects immediately, instead of waiting on the async webhook
 * to flip plan/access flags. Mounted once at the app root so every checkout
 * flow's success_url is covered without per-page wiring.
 *
 * `/post-job/success` has its own dedicated verify calls (job activation vs.
 * boost need different success messaging), so it's skipped here to avoid a
 * redundant duplicate call.
 *
 * Checkout opens in a new tab, so the verify happens THERE. Two consequences,
 * both handled here: the tab the user came from would otherwise sit on a
 * stale, locked page, and they would be left with two tabs on the same thing.
 * On success we tell the other tabs to refetch and — once one confirms it
 * heard us — this tab closes, dropping the user back where they started.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { announceVerified, listenForPlanChange, wasOpenedByUs } from "@/lib/planSync";

export default function CheckoutSessionVerifier() {
  const utils = trpc.useUtils();
  const hasRun = useRef(false);

  // Another tab finished a checkout — pick up the new plan without a reload.
  useEffect(() => listenForPlanChange(() => { utils.invalidate(); }), [utils]);

  const verifySession = trpc.checkout.verifySession.useMutation({
    onSuccess: async () => {
      utils.invalidate();

      // Hand back to the tab they came from, but only once it has confirmed it
      // heard us. If nothing acks — BroadcastChannel unsupported, or the
      // original tab is gone — this is the only tab showing the result, so it
      // stays open.
      const handedOff = await announceVerified();
      if (handedOff && wasOpenedByUs()) window.close();
    },
    onError: (err) => {
      console.error("[CheckoutSessionVerifier]", err.message);
      toast.error("We couldn't confirm your payment yet — refresh in a moment, or contact support if this persists.");
    },
  });

  useEffect(() => {
    if (hasRun.current) return;
    if (window.location.pathname === "/post-job/success") return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    hasRun.current = true;
    verifySession.mutate({ sessionId });

    // Strip session_id so a refresh doesn't re-verify or re-show one-time state.
    params.delete("session_id");
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", newUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
