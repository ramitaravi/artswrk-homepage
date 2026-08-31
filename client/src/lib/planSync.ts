/*
 * Cross-tab handoff after a checkout completes.
 *
 * Checkout opens in a new tab, so Stripe returns the user THERE and the plan
 * is verified THERE. That leaves two problems:
 *
 *   1. The tab they came from still shows the locked page.
 *   2. They end up with two tabs open on the same thing.
 *
 * announce() fixes both: it tells the other tabs to refetch, waits for one to
 * say it heard, and resolves true. The checkout tab can then close itself,
 * dropping the user back where they started — now unlocked.
 *
 * The ack matters. Without it, closing is a gamble: if nothing was listening
 * (BroadcastChannel unsupported, or the original tab already closed) we would
 * shut the only tab showing the result.
 */
const CHANNEL = "artswrk:plan-changed";

type Msg =
  | { type: "verified"; id: string; from: string }
  | { type: "ack"; id: string; from: string };

export function supportsPlanSync(): boolean {
  return typeof BroadcastChannel !== "undefined";
}

/**
 * A BroadcastChannel never delivers to the channel object that posted — but it
 * DOES deliver to other channel objects in the same tab, and this tab holds
 * two: the listener mounted at app root, and the one announce() opens. So
 * every message carries the id of the tab that sent it, and a tab ignores its
 * own. Without that, the checkout tab's listener acks its own announcement,
 * the handshake always "succeeds", and the tab closes even when nothing else
 * is open — the exact failure the ack exists to prevent.
 *
 * `tabId` is injectable so tests can stand up two independent "tabs" inside
 * one process.
 */
export function createPlanSync(tabId: string) {
  return {
    /**
     * Listen for another tab completing a checkout. `onChange` should refetch
     * whatever depends on the plan. Returns an unsubscribe function.
     */
    listen(onChange: () => void): () => void {
      if (!supportsPlanSync()) return () => {};
      const ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (e: MessageEvent<Msg>) => {
        if (e.data?.type !== "verified" || e.data.from === tabId) return;
        onChange();
        ch.postMessage({ type: "ack", id: e.data.id, from: tabId } satisfies Msg);
      };
      return () => ch.close();
    },

    /**
     * Announce that this tab verified a checkout. Resolves true if a DIFFERENT
     * tab acknowledged within `timeoutMs`.
     */
    announce(timeoutMs = 1200): Promise<boolean> {
      if (!supportsPlanSync()) return Promise.resolve(false);

      const id = Math.random().toString(36).slice(2);
      const ch = new BroadcastChannel(CHANNEL);

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (heard: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          ch.close();
          resolve(heard);
        };

        ch.onmessage = (e: MessageEvent<Msg>) => {
          if (e.data?.type !== "ack" || e.data.id !== id) return;
          if (e.data.from === tabId) return;
          finish(true);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);

        ch.postMessage({ type: "verified", id, from: tabId } satisfies Msg);
      });
    },
  };
}

/** The instance the app uses — one identity per browser tab. */
const planSync = createPlanSync(Math.random().toString(36).slice(2));

export const listenForPlanChange = planSync.listen;
export const announceVerified = planSync.announce;

/**
 * Was this tab opened by our own checkout flow (rather than typed or
 * bookmarked)? window.open sets opener, and it survives the round trip through
 * Stripe. Only such a tab may close itself — script cannot close a tab the
 * user opened themselves.
 */
export function wasOpenedByUs(): boolean {
  try {
    return !!window.opener && !window.opener.closed;
  } catch {
    // Cross-origin opener access can throw; treat as "not ours" and stay put.
    return false;
  }
}
