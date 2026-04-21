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
  onNext: (form: FormData) => void;
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
          onClick={() => {
            if (!form.description.trim()) {
              toast.error("Please add a job description.");
              return;
            }
            onNext(form);
          }}
          className="flex-1 py-5 font-bold rounded-xl hirer-grad-bg border-0 hover:opacity-90 transition-opacity"
        >
          <CheckCircle2 size={18} className="mr-2" />
          Post Job Free
          <ChevronRight size={18} className="ml-2" />
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-3">
        Free to post · No credit card required
      </p>
    </div>
  );
}

// ─── Step 3: Job Live + Connect Pricing ───────────────────────────────────────

// Simulated applicant count that increments over time for social proof
function useSimulatedApplicants() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Simulate 1-4 applicants arriving over 8 seconds
    const target = Math.floor(Math.random() * 3) + 1;
    let current = 0;
    const interval = setInterval(() => {
      if (current < target) {
        current++;
        setCount(current);
      } else {
        clearInterval(interval);
      }
    }, 2200);
    return () => clearInterval(interval);
  }, []);
  return count;
}

function Step3({
  form,
  onBack,
}: {
  form: FormData;
  onBack: () => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [boostEnabled, setBoostEnabled] = useState(false);
  const applicantCount = useSimulatedApplicants();
  const isPro = user?.clientPremium;

  const createAndCheckout = trpc.postJob.createAndCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.success("Redirecting to secure checkout...");
    },
    onError: (err) => {
      toast.error(`Checkout failed: ${err.message}`);
    },
  });

  function handleConnect(plan: "one_time" | "subscription") {
    if (!isAuthenticated) {
      sessionStorage.setItem("postJobPending", JSON.stringify(form));
      navigate(getLoginUrl());
      return;
    }
    createAndCheckout.mutate({
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
      plan,
      origin: window.location.origin,
    });
  }

  const isLoading = createAndCheckout.isPending;
  const connectPrice = boostEnabled ? 45 : 30;

  // Fake blurred applicant profiles for the locked preview
  const fakeApplicants = [
    { initials: "AK", color: "bg-pink-400" },
    { initials: "MJ", color: "bg-purple-400" },
    { initials: "TL", color: "bg-blue-400" },
    { initials: "SR", color: "bg-green-400" },
    { initials: "DN", color: "bg-amber-400" },
  ];

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Job Live Banner ── */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 mb-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-black text-[#111] mb-1">Your job is live! 🎉</h2>
        <p className="text-sm text-gray-500 mb-3">
          <span className="font-bold text-[#111]">{form.title || "Your listing"}</span> is now visible to 5,000+ artists in the Artswrk network.
        </p>
        {applicantCount > 0 && (
          <div className="inline-flex items-center gap-2 bg-white border border-green-200 rounded-full px-4 py-1.5 text-sm font-semibold text-green-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {applicantCount} artist{applicantCount !== 1 ? "s" : ""} already applied
          </div>
        )}
      </div>

      {/* ── Locked Applicants Preview ── */}
      <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-400" />
            <span className="text-sm font-bold text-[#111]">Applicants</span>
            {applicantCount > 0 && (
              <span className="bg-[#F25722] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {applicantCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Lock size={12} />
            Locked
          </div>
        </div>

        {/* Blurred applicant rows */}
        <div className="relative">
          <div className="divide-y divide-gray-50">
            {fakeApplicants.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3 select-none">
                <div className={`w-9 h-9 rounded-full ${a.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 blur-[3px]`}>
                  {a.initials}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded-full w-32 blur-[3px]" />
                  <div className="h-2.5 bg-gray-100 rounded-full w-48 blur-[3px]" />
                </div>
                <div className="h-6 w-16 bg-gray-100 rounded-lg blur-[3px]" />
              </div>
            ))}
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/70 to-white flex flex-col items-center justify-end pb-5 px-5">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={16} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">
                Unlock to see who applied
              </p>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Pay only when you're ready to connect with candidates.
            </p>
          </div>
        </div>
      </div>

      {/* ── Headline ── */}
      <div className="text-center mb-5">
        <p className="text-lg font-black text-[#111]">Ready to connect with your artists?</p>
        <p className="text-sm text-gray-500 mt-1">Pay only when you want to unlock candidates. No rush.</p>
      </div>

      {/* ── PRO subscriber fast-track ── */}
      {isPro && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-100 flex items-center gap-3">
          <Crown size={20} className="text-[#F25722] flex-shrink-0" />
          <div>
            <p className="font-bold text-[#111] text-sm">You're an Artswrk PRO subscriber!</p>
            <p className="text-xs text-gray-500">Unlimited candidate unlocks are included in your plan.</p>
          </div>
          <Button
            onClick={() => handleConnect("subscription")}
            disabled={isLoading}
            className="ml-auto flex-none hirer-grad-bg border-0 hover:opacity-90 text-sm"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <>Unlock Now <Unlock size={14} className="ml-1" /></>}
          </Button>
        </div>
      )}

      {/* ── Pricing Cards ── */}
      {!isPro && (
        <div className="space-y-4 mb-6">

          {/* ── Connect card (primary) ── */}
          <div className="bg-white rounded-2xl border-2 border-[#F25722] p-5 relative overflow-hidden shadow-sm">
            <div className="absolute top-3 right-3">
              <Badge className="hirer-grad-bg text-white border-0 text-[10px] font-bold px-2">MOST POPULAR</Badge>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center">
                <Unlock size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-[#111] text-base leading-tight">Connect with Candidates</p>
                <p className="text-xs text-gray-400">One-time · this job only · no commitment</p>
              </div>
            </div>

            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-[#111]">${connectPrice}</span>
              <span className="text-gray-400 text-sm">one-time</span>
              {boostEnabled && (
                <span className="text-xs text-gray-400 ml-1">($30 + $15 boost)</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Pay only when you're ready. Unlock all applicants for this job.
            </p>

            <ul className="space-y-2 mb-5">
              {[
                "Unlock all applicants for this job",
                "Message candidates directly",
                "Manage in your dashboard",
                "No subscription required",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 size={14} className="text-[#F25722] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Boost toggle */}
            <div
              onClick={() => setBoostEnabled(!boostEnabled)}
              className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all mb-4 ${
                boostEnabled
                  ? "border-[#F25722] bg-orange-50"
                  : "border-dashed border-gray-200 hover:border-gray-300 bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${boostEnabled ? "hirer-grad-bg" : "bg-gray-200"}`}>
                  <Zap size={13} className={boostEnabled ? "text-white" : "text-gray-400"} />
                </div>
                <div>
                  <p className={`text-sm font-bold leading-tight ${boostEnabled ? "text-[#111]" : "text-gray-600"}`}>
                    Boost this post
                  </p>
                  <p className="text-[11px] text-gray-400">Priority placement for 7 days · +$15</p>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${boostEnabled ? "hirer-grad-bg" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${boostEnabled ? "left-5" : "left-0.5"}`} />
              </div>
            </div>

            <Button
              onClick={() => handleConnect("one_time")}
              disabled={isLoading}
              className="w-full py-5 font-bold text-base hirer-grad-bg border-0 hover:opacity-90 transition-opacity"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Unlock size={16} className="mr-2" />
                  Unlock Candidates · ${connectPrice}
                </>
              )}
            </Button>
          </div>

          {/* ── PRO subscription card ── */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111] flex items-center justify-center">
                <Crown size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-[#111] text-base leading-tight">PRO Subscription</p>
                <p className="text-xs text-gray-400">Unlimited unlocks · cancel anytime</p>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#111]">$29</span>
              <span className="text-gray-400 text-sm">/month</span>
            </div>

            <ul className="space-y-2">
              {[
                "Unlimited candidate unlocks",
                "Priority placement in search",
                "PRO badge on all your listings",
                "Advanced applicant filters",
                "Don't pay anything until you get candidates",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 size={14} className="text-gray-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleConnect("subscription")}
              disabled={isLoading}
              variant="outline"
              className="w-full font-bold border-2 border-[#111] text-[#111] hover:bg-[#111] hover:text-white transition-colors bg-transparent py-4"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Subscribe & Save — $29/mo</>
              )}
            </Button>
          </div>

          {/* ── Stay free option ── */}
          <div className="text-center py-2">
            <button
              onClick={() => navigate("/app/jobs")}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
            >
              Stay free for now — I'll unlock candidates later
            </button>
            <p className="text-xs text-gray-300 mt-1">Your job stays live. You can unlock anytime from your dashboard.</p>
          </div>
        </div>
      )}

      {/* Not logged in note */}
      {!isAuthenticated && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-800">
          <span>⚠️</span>
          You'll be asked to log in or create a free account before checkout.
        </div>
      )}

      <div className="flex items-center gap-3 mt-2">
        <Button variant="outline" onClick={onBack} className="flex-none px-5">
          <ChevronLeft size={16} className="mr-1" />
          Edit listing
        </Button>
        <p className="text-xs text-gray-400 flex-1 text-center">
          🔒 Secure payment via Stripe
        </p>
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
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="mx-auto px-5 lg:px-10 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center select-none">
              <span className="font-black text-2xl tracking-tight hirer-grad-text">
                ARTS
              </span>
              <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">
                WRK
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/jobs"
                className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                Browse Jobs
              </Link>
              <Link
                href="/app"
                className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

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
            onNext={(formData) => {
              setForm(formData);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && form && (
          <Step3
            form={form}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
