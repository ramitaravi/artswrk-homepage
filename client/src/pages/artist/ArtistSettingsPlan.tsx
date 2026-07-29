/**
 * ARTIST SETTINGS — SUBSCRIPTION
 * Three tiers, stacked: Free / Artswrk Basic / Artswrk PRO.
 * Matches the reference design: plain checklist per tier, a "CURRENT PLAN"
 * badge on whichever tier is active, one primary action button, and two
 * quick links to PRO surfaces.
 */

import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type PlanTier = "free" | "basic" | "pro";

const FREE_FEATURES = ["Free job notifications", "Sharable profile"];

const BASIC_FEATURES = [
  "Unlock Artswrk for 1 year",
  "Apply to unlimited basic jobs",
  "Get connected to $1000+ performing arts employers",
  "Get booked & earn digitally",
];

function Check() {
  return <span className="text-[#ec008c] font-bold flex-shrink-0">✓</span>;
}

function PricePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-pink-50 text-[#ec008c] font-bold text-sm px-3 py-1.5 rounded-lg mt-3 mb-4">
      {children}
    </span>
  );
}

export default function ArtistSettingsPlan() {
  const { data: planData, isLoading: planLoading } = trpc.artistSubscription.getCurrentPlan.useQuery();
  const { data: pricingData, isLoading: pricingLoading } = trpc.artistSubscription.getPricing.useQuery();

  const createBasicCheckout = trpc.artistSubscription.createBasicCheckout.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error("Checkout failed", { description: err.message }),
  });

  const createProCheckout = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error("Checkout failed", { description: err.message }),
  });

  const createPortal = trpc.artistSubscription.createPortalSession.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error("Portal unavailable", { description: err.message }),
  });

  const currentPlan: PlanTier = (planData?.plan as PlanTier) ?? "free";
  const hasStripeCustomer = !!planData?.stripeCustomerId;
  const isBusy = createBasicCheckout.isPending || createProCheckout.isPending || createPortal.isPending;

  function handlePrimaryAction() {
    if (currentPlan === "pro" && hasStripeCustomer) {
      createPortal.mutate({ origin: window.location.origin });
    } else if (currentPlan === "basic" && hasStripeCustomer) {
      createPortal.mutate({ origin: window.location.origin });
    } else {
      createProCheckout.mutate({ interval: "month", origin: window.location.origin });
    }
  }

  const primaryLabel = currentPlan === "free" ? "Upgrade to PRO" : "Manage Subscription";

  const basicPrice = pricingLoading ? "…" : pricingData?.basic?.annual?.dollars ?? "$30";
  const proMonthly = pricingLoading ? "…" : pricingData?.pro?.monthly?.dollars ?? "$10.99";
  const proAnnual = pricingLoading ? "…" : pricingData?.pro?.annual?.dollars ?? "$110";

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-[#111]">Subscription</h2>
      <p className="text-sm text-gray-500 mt-1">Manage your Artswrk subscription and billing information</p>
      <hr className="border-gray-100 my-5" />

      {/* Free */}
      <div className="py-6 border-b border-gray-100">
        <h3 className="text-xl font-black text-[#111]">Free</h3>
        <PricePill>$0/month</PricePill>
        <ul className="space-y-2">
          {FREE_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[15px] text-[#111]">
              <Check /> {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Basic */}
      <div className="py-6 border-b border-gray-100">
        <h3 className="text-xl font-black text-[#111]">Artswrk Basic</h3>
        <PricePill>{basicPrice}/year unlock</PricePill>
        <ul className="space-y-2">
          {BASIC_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[15px] text-[#111]">
              <Check /> {f}
            </li>
          ))}
        </ul>
      </div>

      {/* PRO */}
      <div className="py-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-black text-[#111]">Artswrk PRO</h3>
          {currentPlan === "pro" && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-3 py-1 rounded-full flex-shrink-0">
              Current Plan
            </span>
          )}
        </div>
        <PricePill>{proMonthly}/month or {proAnnual}/year</PricePill>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-[15px] text-[#111]"><Check /> Basic features plus…</li>
          <li className="flex items-start gap-2 text-[15px] text-[#111]">
            <Check /> Access <span className="font-bold text-[#ec008c]">Jobs PRO</span> – highest value jobs $500+ per booking
          </li>
          <li className="flex items-start gap-2 text-[15px] text-[#111]">
            <Check /> Access <span className="font-bold text-[#ec008c]">Benefits PRO</span> – get access to our premium partners and benefits
          </li>
        </ul>
      </div>

      {/* Primary action */}
      <button
        onClick={handlePrimaryAction}
        disabled={isBusy}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
      >
        {isBusy && <Loader2 size={15} className="animate-spin" />}
        {primaryLabel}
      </button>

      {/* Quick links */}
      <div className="space-y-2 mt-3">
        <a
          href="/app/pro-jobs"
          className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-medium text-[#111]">Go to Jobs PRO</span>
          <span className="text-gray-300">›</span>
        </a>
        <a
          href="/app/benefits"
          className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-medium text-[#111]">Go to Benefits Portal</span>
          <span className="text-gray-300">›</span>
        </a>
      </div>
    </div>
  );
}
