/**
 * BoostJobModal
 * Reusable modal for boosting a job post.
 * Shows a daily budget slider, duration selector, live performance preview,
 * and a "Launch Boost" CTA that opens Stripe Checkout.
 *
 * Usage:
 *   <BoostJobModal jobId={123} jobTitle="Sub Teacher" open={open} onClose={() => setOpen(false)} />
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, TrendingUp, Users, Star, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface BoostJobModalProps {
  jobId: number;
  jobTitle?: string;
  open: boolean;
  onClose: () => void;
}

// Duration options
const DURATION_OPTIONS = [
  { value: 3, label: "3 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "1 month" },
];

// Performance tier based on daily budget
function getPerformanceTier(dailyBudget: number): {
  tier: "Low" | "Moderate" | "High" | "Premium";
  color: string;
  textColor: string;
  message: string;
  featuredPlacements: boolean;
  progressPct: number;
} {
  if (dailyBudget < 10) {
    return {
      tier: "Low",
      color: "#e5e7eb",
      textColor: "#6b7280",
      message: "Increase to $15+ for better reach.",
      featuredPlacements: false,
      progressPct: 15,
    };
  } else if (dailyBudget < 25) {
    return {
      tier: "Moderate",
      color: "#F25722",
      textColor: "#F25722",
      message: "Your budget is moderate. Increase to $25+ to be competitive.",
      featuredPlacements: false,
      progressPct: 40,
    };
  } else if (dailyBudget < 50) {
    return {
      tier: "High",
      color: "#16a34a",
      textColor: "#16a34a",
      message: "Great reach! You'll appear near the top of results.",
      featuredPlacements: true,
      progressPct: 70,
    };
  } else {
    return {
      tier: "Premium",
      color: "#7c3aed",
      textColor: "#7c3aed",
      message: "Maximum visibility — featured placement guaranteed.",
      featuredPlacements: true,
      progressPct: 100,
    };
  }
}

function estimateViews(dailyBudget: number, durationDays: number) {
  const min = Math.round(dailyBudget * 15) * durationDays;
  const max = Math.round(dailyBudget * 25) * durationDays;
  return `${min.toLocaleString()}–${max.toLocaleString()}`;
}

function estimateApplicants(dailyBudget: number, durationDays: number) {
  const min = Math.max(1, Math.round(dailyBudget * durationDays * 0.5));
  const max = Math.max(2, Math.round(dailyBudget * durationDays * 1.0));
  return `${min}–${max}`;
}

export default function BoostJobModal({ jobId, jobTitle, open, onClose }: BoostJobModalProps) {
  const [dailyBudget, setDailyBudget] = useState(15);
  const [durationDays, setDurationDays] = useState(7);

  const createCheckout = trpc.boost.createCheckout.useMutation();

  const perf = getPerformanceTier(dailyBudget);
  const totalCost = dailyBudget * durationDays;
  const selectedDuration = DURATION_OPTIONS.find(d => d.value === durationDays) ?? DURATION_OPTIONS[1];

  async function handleLaunch() {
    try {
      const result = await createCheckout.mutateAsync({
        jobId,
        dailyBudget,
        durationDays,
        origin: window.location.origin,
      });
      toast.info("Redirecting to checkout…");
      window.open(result.checkoutUrl, "_blank");
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create boost checkout");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-2xl font-black text-[#111] flex items-center gap-2">
            <Zap size={22} className="text-[#F25722]" />
            Boost Your Job Ad
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Set your daily budget for maximum visibility
            {jobTitle && <span className="font-semibold text-[#111]"> — {jobTitle}</span>}
          </p>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1 px-6 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-[#111]" />
          ))}
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-6">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Daily Budget */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#111]">Daily Ad Budget</span>
                <span className="text-xs text-gray-400">Recommended: $20–35</span>
              </div>

              {/* Budget input display */}
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden mb-3">
                <span className="px-4 py-3 bg-gray-50 text-gray-500 font-semibold border-r border-gray-200">$</span>
                <span className="flex-1 px-4 py-3 text-lg font-bold text-[#111]">{dailyBudget}</span>
                <span className="px-4 py-3 bg-gray-50 text-gray-400 text-sm border-l border-gray-200">per day</span>
              </div>

              {/* Slider */}
              <Slider
                min={5}
                max={100}
                step={5}
                value={[dailyBudget]}
                onValueChange={([v]) => setDailyBudget(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>$5</span>
                <span>$100</span>
              </div>
            </div>

            {/* Duration */}
            <div>
              <span className="font-bold text-[#111] block mb-2">Ad Duration</span>
              <Select
                value={durationDays.toString()}
                onValueChange={(v) => setDurationDays(parseInt(v))}
              >
                <SelectTrigger className="w-full rounded-xl border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-2">You can pause or close your job at any time.</p>
            </div>

            {/* Total cost summary */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Total Budget ({selectedDuration.label}):</p>
              <p className="text-3xl font-black text-[#111]">${totalCost.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">Actual cost may be lower based on performance</p>
            </div>
          </div>

          {/* Right: Performance Preview */}
          <div className="space-y-4">
            <span className="font-bold text-[#111] block">Ad Performance Preview</span>

            {/* Performance tier card */}
            <div
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: perf.tier === "Low" ? "#f9fafb" : perf.tier === "Moderate" ? "#fff7ed" : perf.tier === "High" ? "#f0fdf4" : "#faf5ff",
                borderColor: perf.tier === "Low" ? "#e5e7eb" : perf.tier === "Moderate" ? "#fed7aa" : perf.tier === "High" ? "#bbf7d0" : "#e9d5ff",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Performance:</span>
                <span className="font-bold text-sm" style={{ color: perf.textColor }}>{perf.tier}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-200 rounded-full mb-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${perf.progressPct}%`, backgroundColor: perf.color }}
                />
              </div>
              <p className="text-xs" style={{ color: perf.textColor }}>{perf.message}</p>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TrendingUp size={14} className="text-gray-400" />
                  Expected Views
                </div>
                <span className="font-bold text-[#111] text-sm">{estimateViews(dailyBudget, durationDays)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users size={14} className="text-gray-400" />
                  Expected Applicants
                </div>
                <span className="font-bold text-[#111] text-sm">{estimateApplicants(dailyBudget, durationDays)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Star size={14} className="text-gray-400" />
                  Featured Placements
                </div>
                <span
                  className="font-bold text-sm"
                  style={{ color: perf.featuredPlacements ? "#16a34a" : "#9ca3af" }}
                >
                  {perf.featuredPlacements ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {/* Budget tiers hint */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700 mb-1">Budget tiers:</p>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> $5–9/day — Low reach</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> $10–24/day — Moderate reach</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> $25–49/day — High reach + featured</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> $50+/day — Premium placement</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onClose}
            disabled={createCheckout.isPending}
          >
            Back
          </Button>
          <Button
            className="flex-1 rounded-xl bg-[#111] hover:bg-gray-800 text-white font-bold"
            onClick={handleLaunch}
            disabled={createCheckout.isPending}
          >
            {createCheckout.isPending ? (
              "Processing…"
            ) : (
              <>
                <Zap size={16} className="mr-2" />
                Launch Job Ad — ${totalCost.toFixed(2)}
                <ChevronRight size={16} className="ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
