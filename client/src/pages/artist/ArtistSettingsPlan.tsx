/**
 * ARTIST SETTINGS — PLAN MANAGEMENT
 * Shows the artist's current plan (Free / PRO) and lets them upgrade or manage billing.
 * PRO plans: Monthly ($X/mo) or Annual ($X/yr) — uses existing Stripe product/prices.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Sparkles, Zap, Star, Shield, ChevronRight, ExternalLink, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";

const PRO_FEATURES = [
  "Apply to all marketplace jobs",
  "Access PRO & enterprise-only jobs",
  "Priority placement in search results",
  "Profile boost & featured badge",
  "Advanced application analytics",
  "Early access to new features",
  "Priority support",
];

const FREE_FEATURES = [
  "Browse all job listings",
  "Build your artist profile",
  "View job details & requirements",
];

type BillingInterval = "month" | "year";

export default function ArtistSettingsPlan() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: planData, isLoading: planLoading, refetch } = trpc.artistSubscription.getCurrentPlan.useQuery();

  const createCheckout = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      setIsRedirecting(false);
      toast.success("Redirecting to checkout…", { description: "Complete your subscription in the new tab." });
    },
    onError: (err) => {
      setIsRedirecting(false);
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

  function handleUpgrade() {
    setIsRedirecting(true);
    createCheckout.mutate({
      interval: billingInterval,
      origin: window.location.origin,
    });
  }

  function handleManageBilling() {
    createPortal.mutate({ origin: window.location.origin });
  }

  const currentPlan = planData?.plan ?? "free";
  const isPro = currentPlan === "pro";
  const hasStripeCustomer = !!planData?.stripeCustomerId;

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900">Plan & Billing</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your Artswrk subscription and billing details.</p>
      </div>

      {/* Current Plan Badge */}
      <div className={`rounded-2xl border-2 p-5 flex items-center gap-4 ${
        isPro
          ? "border-amber-200 bg-amber-50"
          : "border-gray-100 bg-gray-50"
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPro ? "bg-amber-100" : "bg-gray-100"
        }`}>
          {isPro ? <Crown size={22} className="text-amber-600" /> : <Shield size={22} className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Current Plan</p>
          <p className="text-xl font-black text-gray-900 mt-0.5">
            {isPro ? "Artswrk PRO" : currentPlan === "basic" ? "Artswrk Basic" : "Free"}
          </p>
          {isPro && (
            <p className="text-sm text-amber-700 mt-0.5">You have full access to all PRO features.</p>
          )}
          {!isPro && (
            <p className="text-sm text-gray-500 mt-0.5">Upgrade to PRO to unlock all features.</p>
          )}
        </div>
        {isPro && hasStripeCustomer && (
          <button
            onClick={handleManageBilling}
            disabled={createPortal.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors flex-shrink-0"
          >
            {createPortal.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ExternalLink size={14} />
            )}
            Manage Billing
          </button>
        )}
      </div>

      {/* Plan Cards */}
      {!isPro && (
        <>
          {/* Billing toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Billing:</span>
            <div className="flex items-center bg-gray-100 rounded-full p-1 gap-1">
              <button
                onClick={() => setBillingInterval("month")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  billingInterval === "month"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("year")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  billingInterval === "year"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Annual
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free Plan */}
            <div className="rounded-2xl border-2 border-gray-100 bg-white p-6 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Free</p>
                <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Current</span>
              </div>
              <p className="text-3xl font-black text-gray-900 mt-1">$0</p>
              <p className="text-sm text-gray-400 mb-5">Forever free</p>

              <ul className="space-y-2.5 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6 py-2.5 rounded-xl text-sm font-semibold text-gray-400 text-center border border-gray-100 bg-gray-50">
                Your current plan
              </div>
            </div>

            {/* PRO Plan */}
            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white p-6 flex flex-col relative overflow-hidden">
              {/* Popular badge */}
              <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                Most Popular
              </div>

              <div className="flex items-center gap-2 mb-1">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <p className="text-sm font-bold text-amber-700 uppercase tracking-widest">PRO</p>
              </div>
              <p className="text-3xl font-black text-gray-900 mt-1">
                {billingInterval === "month" ? "$X" : "$X"}
                <span className="text-base font-semibold text-gray-400 ml-1">
                  /{billingInterval === "month" ? "mo" : "yr"}
                </span>
              </p>
              <p className="text-sm text-amber-600 mb-5">
                {billingInterval === "year" ? "Billed annually — save 20%" : "Billed monthly, cancel anytime"}
              </p>

              <ul className="space-y-2.5 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={isRedirecting || createCheckout.isPending}
                className="mt-6 w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(90deg,#FFBC5D,#F25722)" }}
              >
                {isRedirecting || createCheckout.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {isRedirecting || createCheckout.isPending ? "Redirecting…" : "Upgrade to PRO"}
                {!isRedirecting && !createCheckout.isPending && <ChevronRight size={16} />}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">No commitment · Cancel anytime</p>
            </div>
          </div>
        </>
      )}

      {/* PRO — already subscribed: manage billing */}
      {isPro && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
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
                {createPortal.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ExternalLink size={14} />
                )}
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
            <p className="mt-0.5">Yes. You can cancel your PRO subscription at any time from the billing portal. You'll retain access until the end of your billing period.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What payment methods are accepted?</p>
            <p className="mt-0.5">All major credit and debit cards are accepted via Stripe. Your payment info is never stored on our servers.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What's the difference between monthly and annual?</p>
            <p className="mt-0.5">Annual billing gives you ~20% off compared to monthly. Both plans include all PRO features.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
