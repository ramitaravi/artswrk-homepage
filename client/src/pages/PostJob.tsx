/**
 * Post a Job — 3-step flow (redesigned)
 * Step 1: Natural language input
 * Step 2: AI-autofilled summary form (editable) → "Post Job Free"
 * Step 3: Job is live! + Connect/Boost/PRO pricing (pay to UNLOCK candidates)
 *
 * Model: Free to post. $30 to connect with candidates (unlock applicants).
 * Optional +$15 boost for priority placement. Or $29/mo PRO for unlimited.
 */

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import SharedNavbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Car,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Crown,
  Zap,
  Star,
  ArrowRight,
  Users,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedJob {
  title: string | null;
  description: string;
  locationAddress: string | null;
  dateType: "Single Date" | "Ongoing" | "Recurring";
  startDate: string | null;
  endDate: string | null;
  isHourly: boolean;
  openRate: boolean;
  clientHourlyRate: number | null;
  clientFlatRate: number | null;
  transportation: boolean;
  serviceType: string | null;
}

interface FormData {
  description: string;
  title: string;
  studioName: string;
  locationAddress: string;
  dateType: "Single Date" | "Ongoing" | "Recurring";
  startDate: string;
  endDate: string;
  isHourly: boolean;
  openRate: boolean;
  clientHourlyRate: string;
  clientFlatRate: string;
  transportation: boolean;
  serviceType: string;
}

// ─── Example prompts ──────────────────────────────────────────────────────────

const EXAMPLES = [
  "Looking for a sub in Mount Pleasant, Wisconsin tonight! Three ballet classes from 4:30 PM to 8 PM. Level 3, level 2, and level 5! Great kids and competitive pay. Will pay for travel as well. Please message me if interested. 😊",
  "Need a hip hop choreographer for our spring showcase on April 20th in Chicago, IL. One day event, 10am-5pm. $200 flat rate. Ages 8-18.",
  "Hiring a competition judge for our dance competition May 3rd in Oak Park. All day event. Open rate, travel covered. Please reach out!",
  "Looking for a recurring yoga instructor for Tuesday/Thursday mornings 7-8am. Flexible start date. $50/hr. Studio in Brooklyn, NY.",
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Describe" },
    { n: 2, label: "Review" },
    { n: 3, label: "Connect" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step > s.n
                  ? "hirer-grad-bg text-white"
                  : step === s.n
                  ? "bg-[#111] text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {step > s.n ? <CheckCircle2 size={16} /> : s.n}
            </div>
            <span
              className={`text-xs font-medium ${
                step >= s.n ? "text-[#111]" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-16 h-0.5 mb-4 mx-1 transition-all ${
                step > s.n ? "hirer-grad-bg" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Input ────────────────────────────────────────────────────────────

function Step1({
  onNext,
}: {
  onNext: (text: string, parsed: ParsedJob) => void;
}) {
  const [text, setText] = useState(() => {
    const prefill = sessionStorage.getItem("postJobPrefill");
    if (prefill) {
      sessionStorage.removeItem("postJobPrefill");
      return prefill;
    }
    return "";
  });
  const [exampleIdx, setExampleIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parseText = trpc.postJob.parseText.useMutation({
    onSuccess: (data) => {
      onNext(text, data as ParsedJob);
    },
    onError: (err) => {
      toast.error("Failed to parse job description. Please try again.");
      console.error(err);
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (!text) setExampleIdx((i) => (i + 1) % EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-[#F25722] text-xs font-semibold mb-4">
          <Sparkles size={12} />
          AI-Powered Job Posting
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[#111] mb-3">
          Describe your job in plain English
        </h1>
        <p className="text-gray-500 text-base">
          Just tell us what you need — we'll turn it into a professional listing
          and send it to{" "}
          <span className="font-semibold text-[#111]">5,000+ artists</span>.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLES[exampleIdx]}
            className="min-h-[140px] text-base border-0 shadow-none resize-none focus-visible:ring-0 p-0 placeholder:text-gray-300"
          />
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50">
          <button
            onClick={() => {
              setText(EXAMPLES[exampleIdx]);
              textareaRef.current?.focus();
            }}
            className="flex items-center gap-1.5 text-xs text-[#F25722] font-medium hover:opacity-80 transition-opacity"
          >
            <Sparkles size={12} />
            Try an example
          </button>
          <span className="text-xs text-gray-400">
            {text.length}/2000 characters
          </span>
        </div>
      </div>

      <Button
        onClick={() => {
          if (text.trim().length < 10) {
            toast.error("Please describe your job in at least 10 characters.");
            return;
          }
          parseText.mutate({ text: text.trim() });
        }}
        disabled={parseText.isPending || text.trim().length < 10}
        className="w-full mt-4 py-6 text-base font-bold rounded-xl hirer-grad-bg border-0 hover:opacity-90 transition-opacity"
      >
        {parseText.isPending ? (
          <>
            <Loader2 size={18} className="animate-spin mr-2" />
            Analyzing your job...
          </>
        ) : (
          <>
            <Sparkles size={18} className="mr-2" />
            Preview My Job Post
            <ChevronRight size={18} className="ml-2" />
          </>
        )}
      </Button>

      {/* Trust signals */}
      <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          5,000+ artists
        </span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className="flex items-center gap-1.5">
          <Zap size={12} />
          Avg. 3 applicants in 24hrs
        </span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={12} />
          Free to post
        </span>
      </div>
    </div>
  );
}

// ─── Step 2: Review form ──────────────────────────────────────────────────────

function Step2({
  rawText,
  parsed,
  onNext,
  onBack,
}: {
  rawText: string;
  parsed: ParsedJob;
  onNext: (form: FormData, jobId: number) => void;
  onBack: () => void;
}) {
  const { user } = useAuth();

  const [form, setForm] = useState<FormData>({
    description: parsed.description || rawText,
    title: parsed.title || "",
    studioName: user?.clientCompanyName || "",
    locationAddress: parsed.locationAddress || user?.location || "",
    dateType: parsed.dateType || "Single Date",
    startDate: parsed.startDate
      ? new Date(parsed.startDate).toISOString().slice(0, 16)
      : "",
    endDate: parsed.endDate
      ? new Date(parsed.endDate).toISOString().slice(0, 16)
      : "",
    isHourly: parsed.isHourly,
    openRate: parsed.openRate,
    clientHourlyRate: parsed.clientHourlyRate?.toString() || "",
    clientFlatRate: parsed.clientFlatRate?.toString() || "",
    transportation: parsed.transportation,
    serviceType: parsed.serviceType || "",
  });

  useEffect(() => {
    if (user?.clientCompanyName && !form.studioName) {
      setForm((f) => ({ ...f, studioName: user.clientCompanyName || "" }));
    }
  }, [user]);

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { isAuthenticated } = useAuth();

  const createFreeJob = trpc.postJob.createFreeJob.useMutation({
    onSuccess: (data) => {
      onNext(form, data.jobId);
    },
    onError: (err) => {
      toast.error(`Failed to post job: ${err.message}`);
    },
  });

  function handlePostFree() {
    if (!form.description.trim()) {
      toast.error("Please add a job description.");
      return;
    }
    if (!isAuthenticated) {
      sessionStorage.setItem("postJobPending", JSON.stringify(form));
      window.location.href = getLoginUrl();
      return;
    }
    createFreeJob.mutate({
      description: form.description,
      locationAddress: form.locationAddress || undefined,
      dateType: form.dateType,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isHourly: form.isHourly,
      openRate: form.openRate,
      clientHourlyRate: form.clientHourlyRate ? parseFloat(form.clientHourlyRate) : undefined,
      clientFlatRate: form.clientFlatRate ? parseFloat(form.clientFlatRate) : undefined,
      transportation: form.transportation,
    });
  }

  const isOngoing = form.dateType === "Ongoing" || form.dateType === "Recurring";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-xs font-semibold mb-3">
          <CheckCircle2 size={12} />
          Looking good! Review and confirm.
        </div>
        <h2 className="text-2xl font-black text-[#111] mb-1">
          Review your listing
        </h2>
        <p className="text-gray-500 text-sm">
          We filled in the details — edit anything that looks off.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {/* Title */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Job Title
          </label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Hip Hop Sub Teacher"
            className="border-gray-200 focus:border-[#F25722]"
          />
        </div>

        {/* Studio / Company */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Studio / Company Name
          </label>
          <Input
            value={form.studioName}
            onChange={(e) => set("studioName", e.target.value)}
            placeholder="Your studio or company name"
            className="border-gray-200 focus:border-[#F25722]"
          />
        </div>

        {/* Description */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Job Description
          </label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="min-h-[100px] border-gray-200 focus:border-[#F25722] resize-none"
          />
        </div>

        {/* Location */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            <MapPin size={11} className="inline mr-1" />
            Location
          </label>
          <Input
            value={form.locationAddress}
            onChange={(e) => set("locationAddress", e.target.value)}
            placeholder="City, State or full address"
            className="border-gray-200 focus:border-[#F25722]"
          />
        </div>

        {/* Date type */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            <Calendar size={11} className="inline mr-1" />
            Date Type
          </label>
          <div className="flex gap-2 flex-wrap">
            {(["Single Date", "Recurring", "Ongoing"] as const).map((dt) => (
              <button
                key={dt}
                onClick={() => set("dateType", dt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.dateType === dt
                    ? "hirer-grad-bg text-white border-transparent"
                    : "border-gray-200 text-gray-600 hover:border-[#F25722] hover:text-[#F25722]"
                }`}
              >
                {dt}
              </button>
            ))}
          </div>
          {!isOngoing && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Start
                </label>
                <Input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  className="border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  End (optional)
                </label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                  className="border-gray-200 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Rate */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            <DollarSign size={11} className="inline mr-1" />
            Rate
          </label>
          <div className="flex gap-2 mb-3 flex-wrap">
            {[
              { key: "isHourly", label: "Hourly", active: form.isHourly && !form.openRate },
              { key: "flat", label: "Flat Rate", active: !form.isHourly && !form.openRate },
              { key: "openRate", label: "Open Rate", active: form.openRate },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  if (opt.key === "openRate") {
                    set("openRate", true);
                    set("isHourly", false);
                  } else if (opt.key === "isHourly") {
                    set("isHourly", true);
                    set("openRate", false);
                  } else {
                    set("isHourly", false);
                    set("openRate", false);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  opt.active
                    ? "hirer-grad-bg text-white border-transparent"
                    : "border-gray-200 text-gray-600 hover:border-[#F25722] hover:text-[#F25722]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {!form.openRate && form.isHourly && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <Input
                type="number"
                value={form.clientHourlyRate}
                onChange={(e) => set("clientHourlyRate", e.target.value)}
                placeholder="0.00"
                className="pl-7 border-gray-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                /hr
              </span>
            </div>
          )}
          {!form.openRate && !form.isHourly && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <Input
                type="number"
                value={form.clientFlatRate}
                onChange={(e) => set("clientFlatRate", e.target.value)}
                placeholder="0.00"
                className="pl-7 border-gray-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                flat
              </span>
            </div>
          )}
          {form.openRate && (
            <p className="text-sm text-gray-500 italic">
              Rate is open — artists will see "Open rate" on the listing.
            </p>
          )}
        </div>

        {/* Transportation */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Car size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111]">
                Travel / Transportation Covered
              </p>
              <p className="text-xs text-gray-400">
                Artists will see this as a perk
              </p>
            </div>
          </div>
          <button
            onClick={() => set("transportation", !form.transportation)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              form.transportation ? "hirer-grad-bg" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                form.transportation ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Preview card */}
      <div className="mt-5 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-4">
        <p className="text-xs font-semibold text-[#F25722] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Star size={11} />
          How artists will see your listing
        </p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {(form.studioName || form.title || "J")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[#111] text-sm">
              {form.title || "Your Job Title"}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              {form.studioName || "Your Studio"}
              {form.locationAddress && (
                <>
                  <span className="mx-1">·</span>
                  <MapPin size={10} />
                  {form.locationAddress}
                </>
              )}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {form.openRate ? (
                <Badge className="bg-orange-100 text-[#F25722] border-0 text-xs">
                  Open rate
                </Badge>
              ) : form.isHourly && form.clientHourlyRate ? (
                <Badge className="bg-orange-100 text-[#F25722] border-0 text-xs">
                  ${form.clientHourlyRate}/hr
                </Badge>
              ) : form.clientFlatRate ? (
                <Badge className="bg-orange-100 text-[#F25722] border-0 text-xs">
                  ${form.clientFlatRate} flat
                </Badge>
              ) : null}
              <Badge variant="secondary" className="text-xs">
                {form.dateType}
              </Badge>
              {form.transportation && (
                <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">
                  Travel covered
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <Button variant="outline" onClick={onBack} className="flex-none px-5">
          <ChevronLeft size={16} className="mr-1" />
          Back
        </Button>
        <Button
          onClick={handlePostFree}
          disabled={createFreeJob.isPending}
          className="flex-1 py-5 font-bold rounded-xl hirer-grad-bg border-0 hover:opacity-90 transition-opacity"
        >
          {createFreeJob.isPending ? (
            <><Loader2 size={18} className="animate-spin mr-2" />Posting your job...</>
          ) : (
            <><CheckCircle2 size={18} className="mr-2" />Post Job Free<ChevronRight size={18} className="ml-2" /></>
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-3">
        Free to post · No credit card required
      </p>
    </div>
  );
}

// ─── Step 3: Indeed-style "almost ready" + sponsor flow ──────────────────────

// Budget tier config
const BUDGET_TIERS = [
  { daily: 0,  label: "Free",        days: 0,  performance: "Standard",    perfColor: "text-gray-500",   needle: 5 },
  { daily: 5,  label: "$5/day",      days: 7,  performance: "Good",         perfColor: "text-yellow-600", needle: 30 },
  { daily: 10, label: "$10/day",     days: 14, performance: "Strong",       perfColor: "text-orange-500", needle: 60 },
  { daily: 20, label: "$20/day",     days: 21, performance: "Very Strong",  perfColor: "text-green-600",  needle: 85 },
];

function getTierForBudget(daily: number) {
  if (daily <= 0) return BUDGET_TIERS[0];
  if (daily < 10) return BUDGET_TIERS[1];
  if (daily < 20) return BUDGET_TIERS[2];
  return BUDGET_TIERS[3];
}

// SVG Speedometer gauge
function Gauge({ needleDeg }: { needleDeg: number }) {
  // Arc from 180° to 0° (left to right), needle rotates from -90 to +90
  const r = 70;
  const cx = 90;
  const cy = 90;
  // Arc segments: red (0-33%), yellow (33-66%), green (66-100%)
  function arcPath(startDeg: number, endDeg: number) {
    const toRad = (d: number) => ((d - 180) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  }
  // Needle: needleDeg is 0-100 mapped to -90 to +90 degrees from top
  const needleAngle = -90 + (needleDeg / 100) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;
  const nx = cx + 55 * Math.sin(needleRad);
  const ny = cy - 55 * Math.cos(needleRad);
  return (
    <svg width="180" height="100" viewBox="0 0 180 100">
      <path d={arcPath(0, 60)} fill="none" stroke="#fca5a5" strokeWidth="12" strokeLinecap="round" />
      <path d={arcPath(60, 120)} fill="none" stroke="#fcd34d" strokeWidth="12" strokeLinecap="round" />
      <path d={arcPath(120, 180)} fill="none" stroke="#86efac" strokeWidth="12" strokeLinecap="round" />
      <line
        x1={cx} y1={cy}
        x2={nx} y2={ny}
        stroke="#111" strokeWidth="3" strokeLinecap="round"
        style={{ transition: "all 0.5s ease" }}
      />
      <circle cx={cx} cy={cy} r="5" fill="#111" />
    </svg>
  );
}

function Step3({
  form,
  jobId,
  onBack,
}: {
  form: FormData;
  jobId: number | null;
  onBack: () => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isPro = user?.clientPremium;
  // sub-step: "almost_ready" → "sponsor"
  const [subStep, setSubStep] = useState<"almost_ready" | "sponsor">("almost_ready");
  const [dailyBudget, setDailyBudget] = useState(5);
  const [duration, setDuration] = useState<"7" | "14" | "30" | "continuous">("7");

  const boostCheckout = trpc.boost.createCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.success("Redirecting to secure checkout...");
    },
    onError: (err) => {
      toast.error(`Checkout failed: ${err.message}`);
    },
  });

  function handleSponsor() {
    if (!jobId) {
      toast.error("Job not found. Please go back and try again.");
      return;
    }
    const days = duration === "continuous" ? 30 : parseInt(duration);
    boostCheckout.mutate({
      jobId,
      dailyBudget,
      durationDays: days,
      origin: window.location.origin,
    });
  }

  const isLoading = boostCheckout.isPending;
  const tier = getTierForBudget(dailyBudget);
  const durationDays = duration === "continuous" ? null : parseInt(duration);
  const totalCost = durationDays ? dailyBudget * durationDays : null;

  // ── Sub-step: Almost Ready ──────────────────────────────────────────────────
  if (subStep === "almost_ready") {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-black text-[#111] mb-6">Your job is live!</h1>
        <div className="mb-8">
          <p className="font-bold text-[#111] mb-3">With your job, here's what happens next:</p>
          <ul className="space-y-3">
            {[
              "Your listing goes live immediately on Artswrk.",
              "Artists in our network will be notified about your post.",
              "You'll receive applicants directly in your dashboard.",
              "Sponsor your post to stay pinned at the top of search results.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => setSubStep("sponsor")}
            className="hirer-grad-bg border-0 hover:opacity-90 font-bold px-8 py-5 rounded-xl text-base"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // ── Sub-step: Sponsor ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black text-[#111]">Sponsor job</h1>
        <button
          onClick={() => navigate("/pricing")}
          className="text-sm text-[#F25722] font-semibold flex items-center gap-1 hover:underline"
        >
          <TrendingUp size={14} /> Switch to plans
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left: budget controls */}
          <div className="flex-1">
            <h2 className="font-bold text-[#111] mb-1">Choose your daily budget</h2>
            <p className="text-sm text-gray-500 mb-4">
              We recommend starting at{" "}
              <span className="font-bold text-[#111] underline decoration-dotted">$5.00 average daily budget.</span>
            </p>

            {/* Budget input */}
            <div className="flex items-stretch border border-gray-300 rounded-xl overflow-hidden mb-4 focus-within:border-[#F25722] transition-colors">
              <span className="flex items-center px-4 text-gray-500 bg-gray-50 border-r border-gray-300 font-medium">$</span>
              <input
                type="number"
                min={5}
                step={1}
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Math.max(5, parseInt(e.target.value) || 5))}
                className="flex-1 px-4 py-3 text-lg font-bold text-[#111] outline-none"
              />
              <span className="flex items-center px-4 text-gray-500 bg-gray-50 border-l border-gray-300 text-sm">daily average</span>
            </div>

            {/* Quick budget buttons */}
            <div className="flex gap-2 mb-6">
              {[5, 10, 20, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDailyBudget(amt)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    dailyBudget === amt
                      ? "hirer-grad-bg text-white border-transparent"
                      : "border-gray-200 text-gray-600 hover:border-[#F25722] hover:text-[#F25722]"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-bold text-[#111] mb-2">Ad duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as typeof duration)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-[#111] focus:outline-none focus:border-[#F25722] transition-colors"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="continuous">Runs continuously</option>
              </select>
            </div>
          </div>

          {/* Right: gauge + performance card */}
          <div className="flex flex-col items-center justify-start md:w-48">
            <Gauge needleDeg={tier.needle} />
            <div className="w-full bg-gray-50 rounded-xl p-4 mt-2 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-600">Ad performance:</span>
                <span className={`font-bold ${tier.perfColor}`}>{tier.performance}</span>
              </div>
              {dailyBudget >= 5 ? (
                <p className="text-gray-600">
                  Your post will be{" "}
                  <span className="font-bold text-[#111]">
                    pinned for {durationDays ?? "continuous"}{durationDays ? " days" : ""}
                  </span>.
                </p>
              ) : (
                <p className="text-gray-500">Set a daily budget to pin your post to the top.</p>
              )}
              {dailyBudget >= 20 && (
                <p className="text-gray-500 mt-2 text-xs">
                  Looking to hire even faster?{" "}
                  <button
                    onClick={() => setDailyBudget(dailyBudget + 10)}
                    className="text-[#F25722] font-semibold hover:underline"
                  >
                    Add $10/day
                  </button>{" "}
                  for maximum visibility.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Budget summary */}
        {totalCost && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-sm text-gray-700">
              <span className="font-bold">Max budget:</span> ${totalCost.toFixed(2)} total for {durationDays} days
            </p>
            <p className="text-xs text-gray-400 mt-0.5">You can change the amount, pause, or close your job at any time.</p>
          </div>
        )}
        {duration === "continuous" && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-sm text-gray-700">
              <span className="font-bold">Max budget:</span> ${(dailyBudget * 7).toFixed(2)} per week
            </p>
            <p className="text-xs text-gray-400 mt-0.5">You can change the amount, pause, or close your job at any time.</p>
          </div>
        )}
      </div>

      {/* Not logged in warning */}
      {!isAuthenticated && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-800">
          <span>⚠️</span>
          You'll be asked to log in or create a free account before checkout.
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/app/jobs")}
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors px-2 py-2"
        >
          No thanks
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSubStep("almost_ready")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Back
          </button>
          <Button
            onClick={handleSponsor}
            disabled={isLoading}
            className="hirer-grad-bg border-0 hover:opacity-90 font-bold px-8 py-5 rounded-xl text-base"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>Save and continue →</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Success page ─────────────────────────────────────────────────────────────

function SuccessPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const isPro = params.get("plan") === "pro";
  const isBoosted = params.get("boosted") === "1";

  const verify = trpc.postJob.verifyCheckout.useMutation({});

  useEffect(() => {
    if (sessionId) {
      verify.mutate({ sessionId });
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Unlock size={36} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-[#111] mb-3">
          Candidates unlocked! 🎉
        </h1>
        <p className="text-gray-500 mb-2">
          You can now view and message all applicants for this job from your{" "}
          <span className="font-bold text-[#111]">dashboard</span>.
        </p>
        {isPro && (
          <p className="text-sm text-[#F25722] font-semibold mb-2">
            Welcome to Artswrk PRO! Unlimited unlocks are now active.
          </p>
        )}
        {isBoosted && (
          <p className="text-sm text-purple-600 font-semibold mb-2">
            ⚡ Your job is now boosted for maximum visibility!
          </p>
        )}
        {verify.isPending && (
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5 mb-4">
            <Loader2 size={12} className="animate-spin" />
            Activating your access...
          </p>
        )}

        <div className="flex gap-3 justify-center mt-6">
          <Button
            onClick={() => navigate("/app/jobs")}
            className="hirer-grad-bg border-0 hover:opacity-90 font-bold"
          >
            View My Jobs
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/post-job")}
          >
            Post Another Job
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PostJob() {
  const isSuccess = window.location.pathname.includes("/success");

  if (isSuccess) return <SuccessPage />;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [form, setForm] = useState<FormData | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      <SharedNavbar />

      <div className="pt-24 pb-16 px-5">
        <StepIndicator step={step} />

        {step === 1 && (
          <Step1
            onNext={(text, parsedData) => {
              setRawText(text);
              setParsed(parsedData);
              setStep(2);
            }}
          />
        )}

        {step === 2 && parsed && (
          <Step2
            rawText={rawText}
            parsed={parsed}
            onNext={(formData, newJobId) => {
              setForm(formData);
              setJobId(newJobId);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && form && (
          <Step3
            form={form}
            jobId={jobId}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
