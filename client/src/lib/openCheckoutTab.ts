/*
 * Opens Stripe Checkout in a new tab, without losing it to a popup blocker.
 *
 * The naive version — await the mutation, then window.open(url) — is exactly
 * the shape blockers kill: by the time the URL comes back, the click that
 * authorised the popup is over, and the browser silently drops it. That was a
 * live bug here; some number of upgrade clicks simply did nothing.
 *
 * So the tab is opened SYNCHRONOUSLY inside the click handler, while the user
 * gesture is still live, showing a placeholder. When the session URL arrives
 * we point that already-open tab at it.
 *
 *   const tab = openPendingTab();      // must be called during the click
 *   const { url } = await createSession();
 *   tab.go(url);                       // or tab.cancel() if it failed
 *
 * If the browser blocked us anyway, go() falls back to navigating this tab —
 * better to leave the site than to swallow the click.
 */
export interface PendingTab {
  /** Point the tab at the checkout URL, or navigate here if it was blocked. */
  go: (url?: string | null) => void;
  /** Checkout never happened — close the placeholder. */
  cancel: () => void;
}

const PLACEHOLDER = `<!doctype html><meta charset="utf-8"><title>Opening secure checkout…</title>
<body style="margin:0;display:grid;place-items:center;height:100vh;font:500 15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#666;background:#fff">
Opening secure checkout…</body>`;

export function openPendingTab(): PendingTab {
  const tab = window.open("", "_blank");

  // Some blockers return a window that is immediately closed rather than null.
  const usable = !!tab && !tab.closed;
  if (usable) {
    try {
      tab!.document.write(PLACEHOLDER);
      tab!.document.close();
    } catch {
      // Cross-origin about:blank quirks in some browsers — harmless, the tab
      // still navigates fine below.
    }
  }

  return {
    go(url) {
      if (!url) { this.cancel(); return; }
      if (usable && tab && !tab.closed) { tab.location.href = url; tab.focus?.(); }
      else window.location.href = url;
    },
    cancel() {
      if (usable && tab && !tab.closed) tab.close();
    },
  };
}
