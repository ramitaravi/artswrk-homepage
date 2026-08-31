/*
 * ARTSWRK — THE UPGRADE FLOW
 *
 * One hook behind every "upgrade" button on the site. Click it, you go to
 * Stripe. That's the whole contract, and it's the same everywhere.
 *
 * Before this, a premium CTA did one of four different things depending on
 * which page you clicked it from: some fired checkout, some linked to /join (a
 * marketing page, from inside the logged-in dashboard), some linked to
 * /app/settings, one showed a toast first. Two of them never reached checkout
 * at all. The inconsistency was the bug — not the directness.
 *
 * Stripe's own checkout page names the plan, the price and the trial before
 * anyone types a card number, so going straight there doesn't hide anything.
 * Surfaces that want to make the case first — the plan pages, PremiumGate,
 * the PRO teaser — still do, and then call this.
 *
 * Checkout opens in a NEW TAB so nobody loses the page they were on. That
 * needs care: window.open called after the mutation resolves is what popup
 * blockers kill, so the tab is opened synchronously during the click and
 * pointed at the URL when it arrives — see lib/openCheckoutTab.ts.
 *
 * PRO is annual-only. The pricing source of truth is explicit that no monthly
 * PRO exists; don't add an interval for artists.
 */
import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { openPendingTab, type PendingTab } from "@/lib/openCheckoutTab";

export type UpgradeAudience = "artist" | "client";

export interface UpgradeRequest {
  audience: UpgradeAudience;
  /** Artist only. Defaults to "pro"; "basic" is the $30/yr apply-only unlock. */
  tier?: "basic" | "pro";
  /** Client only. Premium is $65/mo or $650/yr; artists have no interval. */
  interval?: "month" | "year";
  /** Where Stripe returns them. Defaults to the page they left. */
  returnPath?: string;
  /** Client only: ties the subscription back to the job they were unlocking. */
  jobId?: number;
}

export function useUpgrade() {
  // Holds the tab opened during the click until the session URL arrives.
  const pending = useRef<PendingTab | null>(null);

  const onError = (err: { message: string }) => {
    pending.current?.cancel();
    pending.current = null;
    toast.error("Couldn't open checkout", { description: err.message });
  };

  const goTo = (url?: string | null) => {
    const tab = pending.current;
    pending.current = null;
    if (url) { tab ? tab.go(url) : (window.location.href = url); return; }
    tab?.cancel();
    toast.error("Couldn't open checkout", {
      description: "Please try again, or email contact@artswrk.com.",
    });
  };

  const clientCheckout = trpc.clientJobs.createSubscriptionCheckout.useMutation({
    onSuccess: (d) => goTo(d.url),
    onError,
  });
  const artistProCheckout = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: (d) => goTo(d.url),
    onError,
  });
  const artistBasicCheckout = trpc.artistSubscription.createBasicCheckout.useMutation({
    onSuccess: (d) => goTo(d.url),
    onError,
  });

  const busy = clientCheckout.isPending
    || artistProCheckout.isPending
    || artistBasicCheckout.isPending;

  const start = (req: UpgradeRequest) => {
    if (busy) return;
    // Synchronously, before any await — this is the only moment the browser
    // will let us open a tab.
    pending.current = openPendingTab();
    const origin = window.location.origin;
    if (req.audience === "artist") {
      const returnPath = req.returnPath ?? window.location.pathname + window.location.search;
      if (req.tier === "basic") artistBasicCheckout.mutate({ origin, returnPath });
      else artistProCheckout.mutate({ origin, returnPath });
    } else {
      clientCheckout.mutate({
        origin,
        interval: req.interval ?? "month",
        jobId: req.jobId,
        returnPath: req.returnPath ?? window.location.pathname,
      });
    }
  };

  return { start, pending: busy };
}
