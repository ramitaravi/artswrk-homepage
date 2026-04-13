/**
 * Post a Job — 3-step flow
 * Step 1: Natural language input
 * Step 2: AI-autofilled summary form (editable)
 * Step 3: Payment ($30 one-time or Subscribe & Save)
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
import { Separator } from "@/components/ui/separator";
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
  RefreshCw,
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
    { n: 3, label: "Publish" },
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
  const [text, setText] = useState("");
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
          $30 to post
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
  const { user, isAuthenticated } = useAuth();

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

  // Update studio name when user loads
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
          AI autofilled your job details
        </div>
        <h2 className="text-2xl font-black text-[#111] mb-1">
          Review & confirm your listing
        </h2>
        <p className="text-gray-500 text-sm">
          We've filled in the details — edit anything before posting.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {/* Job title */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Job Title
          </label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Ballet Substitute Teacher"
            className="text-base font-semibold"
          />
        </div>

        {/* Description */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Description
          </label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="min-h-[100px] text-sm resize-none"
          />
        </div>

        {/* Studio + Location */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1">
                Studio / Company Name
                {user?.clientCompanyName && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 ml-1">
                    from account
                  </Badge>
                )}
              </span>
            </label>
            <Input
              value={form.studioName}
              onChange={(e) => set("studioName", e.target.value)}
              placeholder="Your studio or company name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1">
                <MapPin size={11} className="text-gray-400" />
                Location
              </span>
            </label>
            <Input
              value={form.locationAddress}
              onChange={(e) => set("locationAddress", e.target.value)}
              placeholder="City, State or full address"
            />
          </div>
        </div>

        {/* Date type */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            <span className="flex items-center gap-1">
              <Calendar size={11} className="text-gray-400" />
              Schedule Type
            </span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {(["Single Date", "Ongoing", "Recurring"] as const).map((dt) => (
              <button
                key={dt}
                onClick={() => set("dateType", dt)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  form.dateType === dt
                    ? "bg-[#111] text-white border-[#111]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {dt}
              </button>
            ))}
          </div>

          {/* Date fields */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                {isOngoing ? "Start Date" : "Start Date & Time"}
              </label>
              <Input
                type={isOngoing ? "date" : "datetime-local"}
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            {!isOngoing && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  End Date & Time
                </label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </div>
            )}
            {isOngoing && (
              <div className="flex items-end pb-1">
                <p className="text-sm text-gray-400 italic">
                  Dates flexible — ongoing or recurring schedule
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rate */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            <span className="flex items-center gap-1">
              <DollarSign size={11} className="text-gray-400" />
              Compensation
            </span>
          </label>

          {/* Rate type toggle */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => set("isHourly", true)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                form.isHourly
                  ? "bg-[#111] text-white border-[#111]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Hourly Rate
            </button>
            <button
              onClick={() => set("isHourly", false)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                !form.isHourly && !form.openRate
                  ? "bg-[#111] text-white border-[#111]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Flat Rate
            </button>
            <button
              onClick={() => set("openRate", !form.openRate)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                form.openRate
                  ? "bg-[#111] text-white border-[#111]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Open Rate
            </button>
          </div>

          {!form.openRate && (
            <div className="flex items-center gap-3 max-w-xs">
              <span className="text-gray-400 font-bold text-lg">$</span>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.isHourly ? form.clientHourlyRate : form.clientFlatRate}
                onChange={(e) =>
                  set(
                    form.isHourly ? "clientHourlyRate" : "clientFlatRate",
                    e.target.value
                  )
                }
                placeholder={form.isHourly ? "e.g. 50" : "e.g. 200"}
                className="text-lg font-semibold"
              />
              {form.isHourly && (
                <span className="text-gray-400 text-sm whitespace-nowrap">/hr</span>
              )}
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
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-none px-5"
        >
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
          Continue to Payment
          <ChevronRight size={18} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Payment ──────────────────────────────────────────────────────────

function Step3({
  form,
  onBack,
}: {
  form: FormData;
  onBack: () => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const createAndCheckout = trpc.postJob.createAndCheckout.useMutation({
    onSuccess: (data) => {
      // Open Stripe in a new tab
      window.open(data.checkoutUrl, "_blank");
      toast.success("Redirecting to secure checkout...");
    },
    onError: (err) => {
      toast.error(`Payment setup failed: ${err.message}`);
    },
  });

  function handlePay(plan: "one_time" | "subscription") {
    if (!isAuthenticated) {
      // Save intent and redirect to login
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

  const hasSavedCard = !!user?.clientStripeCustomerId;
  const isPro = user?.clientPremium;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-[#111] mb-1">
          Publish your job
        </h2>
        <p className="text-gray-500 text-sm">
          Choose how you'd like to post — one-time or subscribe and save.
        </p>
      </div>

      {/* Job summary */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Your listing
        </p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {(form.studioName || form.title || "J")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[#111] text-sm">
              {form.title || form.description.slice(0, 60) + "..."}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
              {form.studioName && <span>{form.studioName}</span>}
              {form.locationAddress && (
                <>
                  <span>·</span>
                  <MapPin size={10} />
                  <span>{form.locationAddress}</span>
                </>
              )}
              {form.dateType && (
                <>
                  <span>·</span>
                  <span>{form.dateType}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Already PRO */}
      {isPro && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-100 flex items-center gap-3">
          <Crown size={20} className="text-[#F25722] flex-shrink-0" />
          <div>
            <p className="font-bold text-[#111] text-sm">
              You're an Artswrk PRO subscriber!
            </p>
            <p className="text-xs text-gray-500">
              Unlimited job posts are included in your plan.
            </p>
          </div>
          <Button
            onClick={() => handlePay("subscription")}
            disabled={createAndCheckout.isPending}
            className="ml-auto flex-none hirer-grad-bg border-0 hover:opacity-90"
          >
            {createAndCheckout.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>Post Now <ArrowRight size={14} className="ml-1" /></>
            )}
          </Button>
        </div>
      )}

      {/* Pricing cards */}
      {!isPro && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* One-time */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Zap size={16} className="text-gray-600" />
              </div>
              <p className="font-bold text-[#111]">Single Post</p>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-black text-[#111]">$30</span>
              <span className="text-gray-400 text-sm ml-1">one-time</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Post one job to 5,000+ artists in the Artswrk network.
            </p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {[
                "Instant visibility",
                "Avg. 3 applicants in 24hrs",
                "Manage applications in dashboard",
                hasSavedCard ? "Charge saved card" : "Secure Stripe checkout",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handlePay("one_time")}
              disabled={createAndCheckout.isPending}
              variant="outline"
              className="w-full font-bold border-2 border-[#111] text-[#111] hover:bg-[#111] hover:text-white transition-colors"
            >
              {createAndCheckout.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Pay $30
                  {hasSavedCard && (
                    <span className="ml-1.5 text-xs font-normal opacity-70">
                      · saved card
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-2xl border-2 border-[#F25722] p-5 flex flex-col relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <Badge className="hirer-grad-bg text-white border-0 text-[10px] font-bold">
                BEST VALUE
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg hirer-grad-bg flex items-center justify-center">
                <Crown size={16} className="text-white" />
              </div>
              <p className="font-bold text-[#111]">PRO Subscription</p>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-black text-[#111]">$29</span>
              <span className="text-gray-400 text-sm ml-1">/month</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Unlimited posts + PRO features. Cancel anytime.
            </p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {[
                "Unlimited job posts",
                "PRO badge on your listings",
                "Priority placement in search",
                "Advanced applicant filters",
                hasSavedCard ? "Charge saved card" : "Secure Stripe checkout",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle2 size={12} className="text-[#F25722] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handlePay("subscription")}
              disabled={createAndCheckout.isPending}
              className="w-full font-bold hirer-grad-bg border-0 hover:opacity-90 transition-opacity"
            >
              {createAndCheckout.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Subscribe & Save
                  {hasSavedCard && (
                    <span className="ml-1.5 text-xs font-normal opacity-70">
                      · saved card
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Not logged in warning */}
      {!isAuthenticated && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-800">
          <span className="text-amber-500">⚠️</span>
          You'll be asked to log in or create an account before payment.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack} className="flex-none px-5">
          <ChevronLeft size={16} className="mr-1" />
          Back
        </Button>
        <p className="text-xs text-gray-400 flex-1 text-center">
          🔒 Secure payment via Stripe · Test card: 4242 4242 4242 4242
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

  const verify = trpc.postJob.verifyCheckout.useMutation();

  useEffect(() => {
    if (sessionId) {
      verify.mutate({ sessionId });
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-6 shadow-lg">
          <CheckCircle2 size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-[#111] mb-3">
          Your job is live! 🎉
        </h1>
        <p className="text-gray-500 mb-2">
          Your listing has been sent to{" "}
          <span className="font-bold text-[#111]">5,000+ artists</span> in the
          Artswrk network.
        </p>
        {isPro && (
          <p className="text-sm text-[#F25722] font-semibold mb-2">
            Welcome to Artswrk PRO! Unlimited posts are now active.
          </p>
        )}
        {verify.isPending && (
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5 mb-4">
            <Loader2 size={12} className="animate-spin" />
            Activating your listing...
          </p>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <Button
            onClick={() => navigate("/dashboard/jobs")}
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
  const params = new URLSearchParams(window.location.search);
  const isSuccess = window.location.pathname.includes("/success");

  if (isSuccess) return <SuccessPage />;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [form, setForm] = useState<FormData | null>(null);

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
                href="/dashboard"
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
