/*
 * ARTSWRK — THE UPGRADE FLOW
 *
 * One modal behind every "upgrade" button on the site.
 *
 * Before this, a premium CTA did one of four different things depending on
 * where you clicked it: some fired Stripe checkout immediately with no warning
 * and no prices shown, some linked to /join (a marketing page), some linked to
 * /app/settings, and some just showed a toast. Two of those never reached
 * checkout at all. Nobody saw what they were buying before their card was
 * asked for.
 *
 * Now every one of them opens this: what the plan costs, what it includes,
 * then a button to Stripe. `feature` names the thing they just tried to use,
 * so the pitch answers the question they actually asked.
 *
 * COPY IS NOT FREEHAND. Prices and bullets below are transcribed from
 * docs/pricing-copy-source-of-truth.html (locked Aug 30 2026, "use it verbatim
 * wherever a tier appears"). Change that doc first, then here.
 */
import { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Crown, Check, Loader2, Star, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type UpgradeAudience = "artist" | "client";

export interface UpgradeRequest {
  audience: UpgradeAudience;
  /** The feature they just tried to use, e.g. "Browse Artists". Optional. */
  feature?: string;
  /** Where Stripe sends them back to. Defaults to the current page. */
  returnPath?: string;
}

// ── Plan copy ────────────────────────────────────────────────────────────────

const PLANS = {
  artist: {
    name: "Artswrk PRO",
    // PRO is annual-only. The source of truth is explicit: "no monthly PRO
    // option exists; strip it anywhere it still shows."
    price: "$110",
    unit: "/yr unlock",
    note: "7-day free trial",
    ribbon: "Most popular",
    money: "One PRO booking pays for the year 5x over.",
    accent: "#ec008c",
    tint: "bg-pink-50 border-pink-200 text-[#ec008c]",
    bullets: [
      "PRO jobs ($500+/booking)",
      "First dibs on all jobs",
      "Unlimited media browse",
      "Connect with clients directly",
      "Priority placement and discovery",
      "Partner discounts (Benefits Portal)",
    ],
  },
  client: {
    name: "Artswrk Premium",
    price: "$65",
    unit: "/mo",
    note: "or $650/yr",
    ribbon: "Best value",
    money: "Posting more than one job? Premium costs less than unlocking them one by one.",
    accent: "#F25722",
    tint: "bg-orange-50 border-orange-100 text-[#F25722]",
    bullets: [
      "Unlimited applicant unlocks across all your job postings",
      "Browse artists sitewide",
      "Favorite artists and rebook them fast",
      "Customized hiring page for your business",
      "Benefits Portal — discounts that pay back the annual subscription 3x over",
    ],
  },
} as const;

// ── Context ──────────────────────────────────────────────────────────────────

const UpgradeCtx = createContext<(req: UpgradeRequest) => void>(() => {});

/** Opens the upgrade modal. Available anywhere under <UpgradeProvider>. */
export function useUpgrade() {
  const open = useContext(UpgradeCtx);
  return { open };
}

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<UpgradeRequest | null>(null);
  const open = useCallback((r: UpgradeRequest) => setReq(r), []);

  return (
    <UpgradeCtx.Provider value={open}>
      {children}
      {req && <UpgradeModal req={req} onClose={() => setReq(null)} />}
    </UpgradeCtx.Provider>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

function UpgradeModal({ req, onClose }: { req: UpgradeRequest; onClose: () => void }) {
  const plan = PLANS[req.audience];
  const [interval, setInterval] = useState<"month" | "year">("month");

  const onCheckoutError = (err: { message: string }) =>
    toast.error("Couldn't open checkout", { description: err.message });

  // Same-tab redirect, deliberately: window.open is swallowed by popup blockers
  // when it lands a tick after a click, which is exactly what an async mutation
  // does. People were clicking upgrade and getting nothing at all.
  const goTo = (url?: string | null) => {
    if (url) window.location.href = url;
    else toast.error("Couldn't open checkout", { description: "Please try again, or email contact@artswrk.com." });
  };

  const clientCheckout = trpc.clientJobs.createSubscriptionCheckout.useMutation({
    onSuccess: (d) => goTo(d.url),
    onError: onCheckoutError,
  });
  const artistCheckout = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: (d) => goTo(d.url),
    onError: onCheckoutError,
  });

  const pending = clientCheckout.isPending || artistCheckout.isPending;

  const start = () => {
    if (pending) return;
    const origin = window.location.origin;
    const returnPath = req.returnPath ?? window.location.pathname + window.location.search;
    if (req.audience === "artist") artistCheckout.mutate({ origin, returnPath });
    else clientCheckout.mutate({ origin, interval });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Upgrade to ${plan.name}`}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <div className="px-7 pt-7 pb-6">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${plan.tint}`}>
            {req.audience === "artist" ? <Star size={11} /> : <Crown size={11} />} {plan.ribbon}
          </span>

          {req.feature && (
            <p className="mt-4 text-sm font-semibold text-gray-500">
              {req.feature} is part of {plan.name}.
            </p>
          )}

          <h2 className="mt-1 text-2xl font-black leading-tight text-[#111]">
            {req.audience === "artist" ? "Get first dibs on the best work" : "Unlock the whole platform"}
          </h2>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl font-black text-[#111]">
              {req.audience === "client" && interval === "year" ? "$650" : plan.price}
            </span>
            <span className="text-sm font-semibold text-gray-400">
              {req.audience === "client" && interval === "year" ? "/yr" : plan.unit}
            </span>
          </div>
          {req.audience === "artist" ? (
            <p className="mt-1 text-sm font-semibold" style={{ color: plan.accent }}>{plan.note}</p>
          ) : (
            <div className="mt-3 inline-flex rounded-xl bg-gray-100 p-1">
              {(["month", "year"] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInterval(i)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    interval === i ? "bg-white text-[#111] shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {i === "month" ? "Monthly" : "Yearly"}
                  {i === "year" && <span className="ml-1 text-[#F25722]">save $130</span>}
                </button>
              ))}
            </div>
          )}

          <ul className="mt-5 space-y-2.5">
            {plan.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-gray-700">
                <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: plan.accent }} />
                {b}
              </li>
            ))}
          </ul>

          <p className="mt-5 text-sm font-semibold text-gray-500">{plan.money}</p>

          <button
            onClick={start}
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: plan.accent }}
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            {pending
              ? "Opening checkout…"
              : req.audience === "artist"
                ? "Start 7-day free trial →"
                : "Continue to checkout →"}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Secure checkout via Stripe. Cancel anytime.{" "}
            <a href="mailto:contact@artswrk.com" className="underline">Questions?</a>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
