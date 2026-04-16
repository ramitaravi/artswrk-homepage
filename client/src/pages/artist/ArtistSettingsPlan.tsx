/**
 * ARTIST SETTINGS — PLAN MANAGEMENT
 * Three tiers: Free / Basic / PRO
 * - Free: browse only, no apply
 * - Basic: apply to all marketplace jobs
 * - PRO: apply to all jobs including PRO/enterprise + priority placement
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, Sparkles, Zap, Star, Shield, ChevronRight,
  ExternalLink, Loader2, Crown, Lock, Calendar, CreditCard, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

// ─── Plan feature lists ───────────────────────────────────────────────────────

const FREE_FEATURES = [
  "Browse all job listings",
  "Build your artist profile",
  "View job details & requirements",
];

const BASIC_FEATURES = [
  "Everything in Free",
  "Apply to all marketplace jobs",
  "Job application tracking",
  "Email alerts for new jobs",
  "Basic profile visibility",
];

const PRO_FEATURES = [
  "Everything in Basic",
  "Access PRO & enterprise-only jobs",
  "Priority placement in search results",
  "Profile boost & featured badge",
  "Advanced application analytics",
  "Early access to new features",
  "Priority support",
];

type BillingInterval = "month" | "year";
type PlanTier = "free" | "basic" | "pro";

// ─── Plan card component ──────────────────────────────────────────────────────

interface PlanCardProps {
  tier: PlanTier;
  currentPlan: PlanTier;
  billingInterval: BillingInterval;
  onUpgrade: (tier: "basic" | "pro") => void;
  isLoading: boolean;
  loadingTier: "basic" | "pro" | null;
  pricing?: {
    basic: { monthly: { dollars: string | null }; annual: { dollars: string | null } };
    pro: { monthly: { dollars: string | null }; annual: { dollars: string | null } };
  } | null;
  pricingLoading?: boolean;
}

function PlanCard({ tier, currentPlan, billingInterval, onUpgrade, isLoading, loadingTier, pricing, pricingLoading }: PlanCardProps) {
  const isCurrent = tier === currentPlan;
  const isDowngrade = (tier === "basic" && currentPlan === "pro") || (tier === "free" && currentPlan !== "free");

  const features = tier === "free" ? FREE_FEATURES : tier === "basic" ? BASIC_FEATURES : PRO_FEATURES;
  const isPro = tier === "pro";
  const isBasic = tier === "basic";

  const planLabel = tier === "free" ? "Free" : tier === "basic" ? "Basic" : "PRO";
  const planDesc = tier === "free"
    ? "Forever free"
    : billingInterval === "year"
    ? "Billed annually — save ~20%"
    : "Billed monthly, cancel anytime";

  const isThisLoading = loadingTier === tier;

  // Resolve real price from Stripe
  function getDisplayPrice(): string {
    if (tier === "free") return "$0";
    if (pricingLoading) return "…";
    if (!pricing) return "—";
    const planPricing = tier === "basic" ? pricing.basic : pricing.pro;
    const price = billingInterval === "year" ? planPricing.annual : planPricing.monthly;
    return price.dollars ?? "—";
  }

  const displayPrice = getDisplayPrice();

  return (
    <div className={`rounded-2xl border-2 p-6 flex flex-col relative overflow-hidden transition-shadow ${
      isPro
        ? "border-amber-300 bg-gradient-to-b from-amber-50 to-white shadow-md"
        : isBasic
        ? "border-pink-200 bg-gradient-to-b from-pink-50 to-white"
        : "border-gray-100 bg-white"
    }`}>
      {/* Badges */}
      {isPro && (
        <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
          Most Popular
        </div>
      )}
      {isCurrent && (
        <div className={`absolute top-0 ${isPro ? "right-24" : "right-0"} text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl ${
          isPro ? "bg-amber-600 text-white" : isBasic ? "bg-pink-500 text-white" : "bg-gray-200 text-gray-600"
        }`}>
          Current
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {isPro && <Star size={14} className="text-amber-500 fill-amber-500" />}
        {isBasic && <Zap size={14} className="text-pink-500" />}
        {tier === "free" && <Shield size={14} className="text-gray-400" />}
        <p className={`text-sm font-bold uppercase tracking-widest ${
          isPro ? "text-amber-700" : isBasic ? "text-pink-600" : "text-gray-400"
        }`}>
          {planLabel}
        </p>
      </div>

      {/* Price */}
      <div className="flex items-end gap-1 mt-1">
        <p className={`text-3xl font-black text-gray-900 transition-opacity ${pricingLoading && tier !== "free" ? "opacity-40" : ""}`}>
          {displayPrice}
        </p>
        {tier !== "free" && (
          <span className="text-base font-semibold text-gray-400 mb-0.5">
            /{billingInterval === "month" ? "mo" : "yr"}
          </span>
        )}
        {pricingLoading && tier !== "free" && (
          <Loader2 size={14} className="animate-spin text-gray-300 mb-1 ml-1" />
        )}
      </div>
      <p className={`text-sm mb-5 ${
        isPro ? "text-amber-600" : isBasic ? "text-pink-500" : "text-gray-400"
      }`}>
        {planDesc}
      </p>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 size={15} className={`flex-shrink-0 mt-0.5 ${
              isPro ? "text-amber-500" : isBasic ? "text-pink-400" : "text-gray-400"
            }`} />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-6">
        {isCurrent ? (
          <div className={`py-2.5 rounded-xl text-sm font-semibold text-center border ${
            isPro ? "border-amber-200 bg-amber-50 text-amber-700"
            : isBasic ? "border-pink-200 bg-pink-50 text-pink-600"
            : "border-gray-100 bg-gray-50 text-gray-400"
          }`}>
            Your current plan
          </div>
        ) : isDowngrade ? (
          <div className="py-2.5 rounded-xl text-sm font-semibold text-center border border-gray-100 bg-gray-50 text-gray-400 flex items-center justify-center gap-1.5">
            <Lock size={13} />
            Manage via billing portal
          </div>
        ) : tier === "free" ? (
          <div className="py-2.5 rounded-xl text-sm font-semibold text-center border border-gray-100 bg-gray-50 text-gray-400">
            Always free
          </div>
        ) : (
          <button
            onClick={() => onUpgrade(tier as "basic" | "pro")}
            disabled={isLoading}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 ${
              isPro ? "" : "bg-gradient-to-r from-pink-500 to-rose-500"
            }`}
            style={isPro ? { background: "linear-gradient(90deg,#FFBC5D,#F25722)" } : undefined}
          >
            {isThisLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {isThisLoading ? "Redirecting…" : `Upgrade to ${planLabel}`}
            {!isThisLoading && <ChevronRight size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArtistSettingsPlan() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [loadingTier, setLoadingTier] = useState<"basic" | "pro" | null>(null);

  const { data: planData, isLoading: planLoading } = trpc.artistSubscription.getCurrentPlan.useQuery();
  const { data: pricingData, isLoading: pricingLoading } = trpc.artistSubscription.getPricing.useQuery();

  const createBasicCheckout = trpc.artistSubscription.createBasicCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      setLoadingTier(null);
      toast.success("Redirecting to checkout…", { description: "Complete your Basic subscription in the new tab." });
    },
    onError: (err) => {
      setLoadingTier(null);
      toast.error("Checkout failed", { description: err.message });
    },
  });

  const createProCheckout = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      setLoadingTier(null);
      toast.success("Redirecting to checkout…", { description: "Complete your PRO subscription in the new tab." });
    },
    onError: (err) => {
      setLoadingTier(null);
      toast.error("Checkout failed", { description: err.message });
    },
  });

  const createPortal = trpc.artistSubscription.createPortalSession.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      toast.success("Opening billing portal…", { description: "Manage your subscription in the new tab." });
    },
    onError: (err) => {
      toast.error("Portal unavailable", { description: err.message });
    },
  });

  function handleUpgrade(tier: "basic" | "pro") {
    setLoadingTier(tier);
    if (tier === "basic") {
      createBasicCheckout.mutate({ interval: billingInterval, origin: window.location.origin });
    } else {
      createProCheckout.mutate({ interval: billingInterval, origin: window.location.origin });
    }
  }

  function handleManageBilling() {
    createPortal.mutate({ origin: window.location.origin });
  }

  const currentPlan = planData?.plan ?? "free";
  const isPaid = currentPlan !== "free";
  const hasStripeCustomer = !!planData?.stripeCustomerId;
  const isLoading = loadingTier !== null;

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900">Plan & Billing</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your Artswrk subscription and billing details.</p>
      </div>

      {/* Current Plan Badge */}
      <div className={`rounded-2xl border-2 p-5 flex items-center gap-4 ${
        currentPlan === "pro"
          ? "border-amber-200 bg-amber-50"
          : currentPlan === "basic"
          ? "border-pink-200 bg-pink-50"
          : "border-gray-100 bg-gray-50"
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          currentPlan === "pro" ? "bg-amber-100"
          : currentPlan === "basic" ? "bg-pink-100"
          : "bg-gray-100"
        }`}>
          {currentPlan === "pro" ? <Crown size={22} className="text-amber-600" /> :
           currentPlan === "basic" ? <Zap size={22} className="text-pink-500" /> :
           <Shield size={22} className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Current Plan</p>
          <p className="text-xl font-black text-gray-900 mt-0.5">
            {currentPlan === "pro" ? "Artswrk PRO"
             : currentPlan === "basic" ? "Artswrk Basic"
             : "Free"}
          </p>
          {/* Live billing details from Stripe */}
          {planData?.billing ? (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-sm">
                <CreditCard size={13} className="text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-gray-800">
                  {planData.billing.formattedPrice}
                </span>
                <span className="text-gray-500">
                  / {planData.billing.interval === "year" ? "year" : "month"}
                </span>
                <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  planData.billing.intervalLabel === "Annual"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-50 text-blue-600"
                }`}>
                  {planData.billing.intervalLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                {planData.billing.cancelAtPeriodEnd ? (
                  <span className="text-orange-600 font-medium">
                    Cancels on {new Date(planData.billing.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                ) : (
                  <span>
                    Renews {new Date(planData.billing.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className={`text-sm mt-0.5 ${
              currentPlan === "pro" ? "text-amber-700"
              : currentPlan === "basic" ? "text-pink-600"
              : "text-gray-500"
            }`}>
              {currentPlan === "pro" ? "You have full access to all PRO features."
               : currentPlan === "basic" ? "You can apply to all marketplace jobs."
               : "Upgrade to apply to jobs and unlock more features."}
            </p>
          )}
        </div>
        {isPaid && hasStripeCustomer && (
          <button
            onClick={handleManageBilling}
            disabled={createPortal.isPending}
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors flex-shrink-0 ${
              currentPlan === "pro" ? "text-amber-700 hover:text-amber-900"
              : "text-pink-600 hover:text-pink-800"
            }`}
          >
            {createPortal.isPending ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Manage Billing
          </button>
        )}
      </div>

      {/* Billing toggle */}
      {currentPlan !== "pro" && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Billing:</span>
          <div className="flex items-center bg-gray-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setBillingInterval("month")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                billingInterval === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("year")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
                billingInterval === "year" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Annual
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                Save ~20%
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PlanCard
          tier="free"
          currentPlan={currentPlan}
          billingInterval={billingInterval}
          onUpgrade={handleUpgrade}
          isLoading={isLoading}
          loadingTier={loadingTier}
          pricing={pricingData}
          pricingLoading={pricingLoading}
        />
        <PlanCard
          tier="basic"
          currentPlan={currentPlan}
          billingInterval={billingInterval}
          onUpgrade={handleUpgrade}
          isLoading={isLoading}
          loadingTier={loadingTier}
          pricing={pricingData}
          pricingLoading={pricingLoading}
        />
        <PlanCard
          tier="pro"
          currentPlan={currentPlan}
          billingInterval={billingInterval}
          onUpgrade={handleUpgrade}
          isLoading={isLoading}
          loadingTier={loadingTier}
          pricing={pricingData}
          pricingLoading={pricingLoading}
        />
      </div>

      {/* PRO — already subscribed: feature list */}
      {currentPlan === "pro" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <h3 className="text-base font-bold text-gray-900">PRO Features Unlocked</h3>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          {hasStripeCustomer && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleManageBilling}
                disabled={createPortal.isPending}
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                {createPortal.isPending ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Manage subscription, invoices & payment method
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAQ */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Frequently Asked Questions</h3>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">Can I cancel anytime?</p>
            <p className="mt-0.5">Yes. Cancel your subscription at any time from the billing portal. You'll retain access until the end of your billing period.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Can I upgrade from Basic to PRO later?</p>
            <p className="mt-0.5">Absolutely. You can upgrade at any time and we'll prorate the difference. Manage everything from the billing portal.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What's the difference between monthly and annual?</p>
            <p className="mt-0.5">Annual billing gives you ~20% off compared to monthly. Both include all plan features.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What payment methods are accepted?</p>
            <p className="mt-0.5">All major credit and debit cards via Stripe. Your payment info is never stored on our servers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
