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
import { Zap, ChevronRight } from "lucide-react";
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


export default function BoostJobModal({ jobId, jobTitle, open, onClose }: BoostJobModalProps) {
  const [dailyBudget, setDailyBudget] = useState(15);
  const [durationDays, setDurationDays] = useState(7);

  const createCheckout = trpc.boost.createCheckout.useMutation();

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
      // Use location.href, not window.open — async callbacks lose the user-gesture
      // context needed for window.open to bypass popup blockers.
      window.location.href = result.checkoutUrl;
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
        <div className="px-6 py-6 space-y-6">
          {/* Daily Budget */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-[#111]">Daily Ad Budget</span>
              <span className="text-xs text-gray-400">Recommended: $20–35</span>
            </div>

            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden mb-3">
              <span className="px-4 py-3 bg-gray-50 text-gray-500 font-semibold border-r border-gray-200">$</span>
              <span className="flex-1 px-4 py-3 text-lg font-bold text-[#111]">{dailyBudget}</span>
              <span className="px-4 py-3 bg-gray-50 text-gray-400 text-sm border-l border-gray-200">per day</span>
            </div>

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

          {/* Performance indicator */}
          {(() => {
            const tiers = [
              { min: 5,  max: 15, label: "Starting",    filledSegments: 2, color: "bg-gray-400",   labelColor: "text-gray-500" },
              { min: 15, max: 30, label: "Good",        filledSegments: 3, color: "bg-yellow-400", labelColor: "text-yellow-600" },
              { min: 30, max: 50, label: "Great",       filledSegments: 5, color: "bg-[#F25722]",  labelColor: "text-[#F25722]" },
              { min: 50, max: 75, label: "Excellent",   filledSegments: 7, color: "bg-orange-600", labelColor: "text-orange-600" },
              { min: 75, max: Infinity, label: "Outstanding", filledSegments: 8, color: "bg-green-500", labelColor: "text-green-600" },
            ];
            const tier = tiers.find(t => dailyBudget >= t.min && dailyBudget < t.max) ?? tiers[0];
            return (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ad Performance</span>
                  <span className={`text-sm font-black ${tier.labelColor}`}>{tier.label}</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-3 rounded-full transition-all duration-300 ${i < tier.filledSegments ? tier.color : "bg-gray-200"}`}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
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
