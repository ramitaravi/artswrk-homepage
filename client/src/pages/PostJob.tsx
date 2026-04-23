/*
 * Post a Job — 3-step flow (redesigned)
 * Step 1: Natural language input
 * Step 2: AI-autofilled summary form (editable) → "Post Job Free"
 * Step 3: Job is live! + Connect/Boost/PRO pricing (pay to UNLOCK candidates)
 *
 * Model: Free to post. $30 to connect with candidates (unlock applicants).
 * Optional +$15 boost for priority placement. Or $29/mo PRO for unlimited.
 */

import { useState, useRef, useEffect, useMemo } from "react";
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
  Building2,
  Plus,
  AlertTriangle,
  CalendarDays,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateType = "Single Date" | "Weekly" | "Multiple Dates" | "Dates Flexible" | "Ongoing";

interface ParsedJob {
  title: string | null;
  description: string;
  locationAddress: string | null;
  dateType: DateType;
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
  selectedCompanyId: number | null;
  locationAddress: string;
  dateType: DateType;
  startDate: string;
  endDate: string;
  multipleDates: string[];
  isHourly: boolean;
  openRate: boolean;
  clientHourlyRate: string;
  clientFlatRate: string;
  transportation: boolean;
  transportationInstructions: string;
  serviceType: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an ISO UTC date string to a local datetime-local input value.
 * Avoids the UTC offset bug where "4:30 PM" shows as "8:30 PM".
 */
function isoToLocalDatetimeInput(isoString: string | null): string {
  if (!isoString) return "";
  // Parse the ISO string as a Date, then format in local time
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    { n: 3, label: "Share" },
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
          HIRE NOW ON ARTSWRK
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[#111] mb-3">
          Post Your Job on Artswrk
        </h1>
        <p className="text-gray-500 text-base">
          Describe your job below — we'll turn it into a professional listing and send it to our vetted network of{" "}
          <span className="font-semibold text-[#111]">5,000+ artists</span> looking for work.
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
          <CheckCircle2 size={12} />
          Pay Only When You Match
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
  const { user, isAuthenticated } = useAuth();

  // ── Queries ──
  const companiesQuery = trpc.postJob.getMyCompanies.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const lastJobQuery = trpc.postJob.getLastJobDefaults.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const companies = companiesQuery.data?.companies ?? [];
  const userFullName = companiesQuery.data?.userFullName ?? (user?.name || user?.firstName || "");

  // ── Form state ──
  const [form, setForm] = useState<FormData>(() => ({
    description: parsed.description || rawText,
    title: parsed.title || "",
    studioName: user?.clientCompanyName || "",
    selectedCompanyId: null,
    locationAddress: parsed.locationAddress || user?.location || "",
    dateType: (parsed.dateType as DateType) || "Single Date",
    startDate: isoToLocalDatetimeInput(parsed.startDate),
    endDate: isoToLocalDatetimeInput(parsed.endDate),
    multipleDates: [],
    isHourly: parsed.isHourly,
    openRate: parsed.openRate,
    clientHourlyRate: parsed.clientHourlyRate?.toString() || "",
    clientFlatRate: parsed.clientFlatRate?.toString() || "",
    transportation: parsed.transportation,
    transportationInstructions: "",
    serviceType: parsed.serviceType || "",
  }));

  // ── Auto-populate from last job on first load ──
  const [lastJobApplied, setLastJobApplied] = useState(false);
  useEffect(() => {
    if (lastJobApplied || !lastJobQuery.data) return;
    const d = lastJobQuery.data;
    setForm((f) => ({
      ...f,
      isHourly: d.isHourly ?? f.isHourly,
      openRate: d.openRate ?? f.openRate,
      clientHourlyRate: d.clientHourlyRate ? String(d.clientHourlyRate) : f.clientHourlyRate,
      transportation: d.transportation ?? f.transportation,
    }));
    setLastJobApplied(true);
  }, [lastJobQuery.data, lastJobApplied]);

     // Auto-select first company on load ──
  const [companyAutoSelected, setCompanyAutoSelected] = useState(false);
  useEffect(() => {
    if (companyAutoSelected || companies.length === 0) return;
    // Auto-select the first (most recently used) company
    const first = companies[0];
    setForm((f) => ({
      ...f,
      studioName: first.name,
      selectedCompanyId: first.id,
      locationAddress: first.locationAddress || f.locationAddress,
      // Auto-populate transport from company settings
      transportation: first.transportReimbursed ?? f.transportation,
      transportationInstructions: first.transportDetails || f.transportationInstructions,
    }));
    setCompanyAutoSelected(true);
  }, [companies, companyAutoSelected]);

  // ── Location conflict flag ──
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.selectedCompanyId) ?? null,
    [companies, form.selectedCompanyId]
  );
  const locationConflict = useMemo(() => {
    if (!selectedCompany?.locationAddress || !parsed.locationAddress) return false;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalize(selectedCompany.locationAddress) !== normalize(parsed.locationAddress);
  }, [selectedCompany, parsed.locationAddress]);

  // ── Add Company inline form ──
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyLocation, setNewCompanyLocation] = useState("");
  const addCompanyMutation = trpc.postJob.addCompany.useMutation({
    onSuccess: (data) => {
      const newCompany = data.companies.find((c: { id: number; name: string; locationAddress: string | null; transportReimbursed: boolean | null; transportDetails: string | null }) => c.id === data.newCompanyId);
      if (newCompany) {
        setForm((f) => ({
          ...f,
          studioName: newCompany.name,
          selectedCompanyId: newCompany.id,
          locationAddress: newCompany.locationAddress || f.locationAddress,
        }));
      }
      setShowAddCompany(false);
      setNewCompanyName("");
      setNewCompanyLocation("");
      companiesQuery.refetch();
      toast.success("Company added!");
    },
    onError: (err: { message: string }) => toast.error(`Failed to add company: ${err.message}`),
  });

  // ── Multiple dates picker ──
  const [newMultiDate, setNewMultiDate] = useState("");

  const set = (key: keyof FormData, value: string | boolean | number | null | string[]) =>
    setForm((f) => ({ ...f, [key]: value }));

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
      dateType: form.dateType as any,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isHourly: form.isHourly,
      openRate: form.openRate,
      clientHourlyRate: form.clientHourlyRate ? parseFloat(form.clientHourlyRate) : undefined,
      clientFlatRate: form.clientFlatRate ? parseFloat(form.clientFlatRate) : undefined,
      transportation: form.transportation,
      transportationInstructions: form.transportationInstructions || undefined,
      studioName: form.studioName || undefined,
    });
  }

  const isFlexible = form.dateType === "Dates Flexible" || form.dateType === "Ongoing";
  const isWeekly = form.dateType === "Weekly";
  const isMultiple = form.dateType === "Multiple Dates";
  const isSingle = form.dateType === "Single Date";

  const DATE_TYPES: { key: DateType; label: string; hint: string }[] = [
    { key: "Single Date", label: "Single Date", hint: "One specific date/time" },
    { key: "Weekly", label: "Weekly", hint: "Recurring weekly classes" },
    { key: "Multiple Dates", label: "Multiple Dates", hint: "Several specific dates" },
    { key: "Dates Flexible", label: "Dates Flexible", hint: "No specific date yet" },
  ];

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

        {/* Studio / Company — logo-card dropdown for logged-in users */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Posting On Behalf Of
          </label>
          {user ? (
            <div className="space-y-3">
              {/* Company cards */}
              {companiesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 size={12} className="animate-spin" />
                  Loading your companies...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {/* Each company as a card */}
                  {companies.map((company: import('../../../drizzle/schema').ClientCompany) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          studioName: company.name,
                          selectedCompanyId: company.id,
                          locationAddress: company.locationAddress || f.locationAddress,
                          // Auto-populate transport from company settings
                          transportation: company.transportReimbursed ?? f.transportation,
                          transportationInstructions: company.transportDetails || f.transportationInstructions,
                        }));
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
                        form.selectedCompanyId === company.id
                          ? "border-[#F25722] bg-orange-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {company.logo ? (
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-[#F25722]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate max-w-[140px] ${
                          form.selectedCompanyId === company.id ? "text-[#F25722]" : "text-[#111]"
                        }`}>
                          {company.name}
                        </p>
                        {company.locationAddress && (
                          <p className="text-[10px] text-gray-400 truncate max-w-[140px]">
                            {company.locationAddress}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Post as individual */}
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        studioName: userFullName,
                        selectedCompanyId: null,
                      }));
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                      form.selectedCompanyId === null && form.studioName === userFullName
                        ? "border-[#F25722] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Users size={14} className="text-gray-500" />
                    </div>
                    <p className={`text-xs font-semibold ${
                      form.selectedCompanyId === null && form.studioName === userFullName
                        ? "text-[#F25722]"
                        : "text-[#111]"
                    }`}>
                      {userFullName} (Individual)
                    </p>
                  </button>

                  {/* Add New Company */}
                  <button
                    type="button"
                    onClick={() => setShowAddCompany(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 hover:border-[#F25722] hover:text-[#F25722] transition-all text-gray-400"
                  >
                    <Plus size={14} />
                    <span className="text-xs font-semibold">Add Company</span>
                  </button>
                </div>
              )}

              {/* Add Company inline form */}
              {showAddCompany && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#111]">New Company</p>
                    <button
                      type="button"
                      onClick={() => setShowAddCompany(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <Input
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Company / Studio name"
                    className="border-gray-200 text-sm"
                    autoFocus
                  />
                  <Input
                    value={newCompanyLocation}
                    onChange={(e) => setNewCompanyLocation(e.target.value)}
                    placeholder="City, State (optional)"
                    className="border-gray-200 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newCompanyName.trim()) {
                        toast.error("Company name is required");
                        return;
                      }
                      addCompanyMutation.mutate({
                        name: newCompanyName.trim(),
                        locationAddress: newCompanyLocation.trim() || undefined,
                      });
                    }}
                    disabled={addCompanyMutation.isPending}
                    className="hirer-grad-bg border-0 hover:opacity-90 text-xs"
                  >
                    {addCompanyMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin mr-1" />
                    ) : (
                      <Plus size={12} className="mr-1" />
                    )}
                    Add Company
                  </Button>
                </div>
              )}

              {/* Custom name input if not matching any company or individual */}
              {form.selectedCompanyId === null &&
                form.studioName !== userFullName &&
                !showAddCompany && (
                  <Input
                    value={form.studioName}
                    onChange={(e) => set("studioName", e.target.value)}
                    placeholder="Enter studio or company name"
                    className="border-gray-200 focus:border-[#F25722]"
                  />
                )}
            </div>
          ) : (
            <Input
              value={form.studioName}
              onChange={(e) => set("studioName", e.target.value)}
              placeholder="Your studio or company name"
              className="border-gray-200 focus:border-[#F25722]"
            />
          )}
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
          {/* Location conflict flag */}
          {locationConflict && selectedCompany?.locationAddress && (
            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Your AI-parsed location differs from{" "}
                <span className="font-semibold">{selectedCompany.name}</span>'s address (
                {selectedCompany.locationAddress}). The field above shows the AI-parsed location — update it if needed.
              </p>
            </div>
          )}
        </div>

        {/* Date type */}
        <div className="p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            <Calendar size={11} className="inline mr-1" />
            Date Type
          </label>
          <div className="flex gap-2 flex-wrap">
            {DATE_TYPES.map((dt) => (
              <button
                key={dt.key}
                onClick={() => set("dateType", dt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.dateType === dt.key
                    ? "hirer-grad-bg text-white border-transparent"
                    : "border-gray-200 text-gray-600 hover:border-[#F25722] hover:text-[#F25722]"
                }`}
                title={dt.hint}
              >
                {dt.label}
              </button>
            ))}
          </div>

          {/* Single Date inputs */}
          {isSingle && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Start</label>
                <Input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  className="border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">End (optional)</label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                  className="border-gray-200 text-sm"
                />
              </div>
            </div>
          )}

          {/* Weekly date inputs */}
          {isWeekly && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={form.startDate ? form.startDate.slice(0, 10) : ""}
                    onChange={(e) => set("startDate", e.target.value)}
                    className="border-gray-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">End Date (optional)</label>
                  <Input
                    type="date"
                    value={form.endDate ? form.endDate.slice(0, 10) : ""}
                    onChange={(e) => set("endDate", e.target.value)}
                    className="border-gray-200 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                <CalendarDays size={11} className="inline mr-1" />
                Weekly recurring — artists will see this as an ongoing weekly commitment.
              </p>
            </div>
          )}

          {/* Multiple Dates picker */}
          {isMultiple && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={newMultiDate}
                  onChange={(e) => setNewMultiDate(e.target.value)}
                  className="border-gray-200 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!newMultiDate) return;
                    setForm((f) => ({
                      ...f,
                      multipleDates: [...f.multipleDates, newMultiDate],
                    }));
                    setNewMultiDate("");
                  }}
                  className="flex-shrink-0"
                >
                  <Plus size={14} />
                  Add
                </Button>
              </div>
              {form.multipleDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.multipleDates.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-[#F25722] text-xs font-medium"
                    >
                      {new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            multipleDates: f.multipleDates.filter((_, j) => j !== i),
                          }))
                        }
                        className="hover:opacity-70"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {form.multipleDates.length === 0 && (
                <p className="text-xs text-gray-400">Add each date/time above.</p>
              )}
            </div>
          )}

          {/* Dates Flexible */}
          {isFlexible && (
            <p className="mt-3 text-xs text-gray-500 italic">
              No specific date — artists will see "Dates Flexible" on the listing.
            </p>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                value={form.clientHourlyRate}
                onChange={(e) => set("clientHourlyRate", e.target.value)}
                placeholder="0.00"
                className="pl-7 border-gray-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/hr</span>
            </div>
          )}
          {!form.openRate && !form.isHourly && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                value={form.clientFlatRate}
                onChange={(e) => set("clientFlatRate", e.target.value)}
                placeholder="0.00"
                className="pl-7 border-gray-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">flat</span>
            </div>
          )}
          {form.openRate && (
            <p className="text-sm text-gray-500 italic">
              Rate is open — artists will see "Open rate" on the listing.
            </p>
          )}
        </div>

        {/* Transportation */}
        <div className="p-5">
          <div className="flex items-center justify-between">
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
              className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${
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

          {/* Transportation instructions */}
          {form.transportation && (
            <div className="mt-3">
              <label className="text-xs text-gray-400 block mb-1">
                Transportation / Parking Instructions (optional)
              </label>
              <Textarea
                value={form.transportationInstructions}
                onChange={(e) => set("transportationInstructions", e.target.value)}
                placeholder="e.g. Free parking in lot B, take the Red Line to Clark/Division..."
                className="min-h-[70px] border-gray-200 focus:border-[#F25722] resize-none text-sm"
              />
            </div>
          )}
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
                <Badge className="bg-orange-100 text-[#F25722] border-0 text-xs">Open rate</Badge>
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
                <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">Travel covered</Badge>
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
const TIERS = [
  {
    id: "connect",
    label: "Connect",
    price: 30,
    priceLabel: "$30",
    description: "Unlock all applicants for this job",
    features: ["View all applicants", "Message artists directly", "One-time fee"],
    icon: <Unlock size={20} className="text-white" />,
    gradient: "hirer-grad-bg",
    plan: "one_time" as const,
  },
  {
    id: "pro",
    label: "PRO",
    price: 29,
    priceLabel: "$29/mo",
    description: "Unlimited unlocks for all your jobs",
    features: ["Unlimited applicant unlocks", "Priority listing placement", "Cancel anytime"],
    icon: <Crown size={20} className="text-white" />,
    gradient: "hirer-grad-bg",
    plan: "subscription" as const,
    badge: "Best Value",
  },
];

function Step3({
  form,
  jobId,
  onBack,
}: {
  form: FormData;
  jobId: number | null;
  onBack: () => void;
}) {
  const [, navigate] = useLocation();
  const [selectedTier, setSelectedTier] = useState<string>("connect");
  const [isLoading, setIsLoading] = useState(false);

  // sub-step: "almost_ready" → "sponsor"
  const [subStep, setSubStep] = useState<"almost_ready" | "sponsor">("almost_ready");

  const createAndCheckout = trpc.postJob.createAndCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (err) => {
      setIsLoading(false);
      toast.error(`Checkout failed: ${err.message}`);
    },
  });

  // boost.createCheckout is available via trpc.boost.createCheckout

  function handleSponsor() {
    if (!jobId) {
      toast.error("Job ID missing — please try again.");
      return;
    }
    setIsLoading(true);
    const tier = TIERS.find((t) => t.id === selectedTier);
    if (!tier) return;

    createAndCheckout.mutate({
      description: form.description,
      locationAddress: form.locationAddress || undefined,
      dateType: form.dateType as "Single Date" | "Weekly" | "Multiple Dates" | "Dates Flexible" | "Ongoing" | "Recurring",
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isHourly: form.isHourly,
      openRate: form.openRate,
      clientHourlyRate: form.clientHourlyRate ? parseFloat(form.clientHourlyRate) : undefined,
      clientFlatRate: form.clientFlatRate ? parseFloat(form.clientFlatRate) : undefined,
      transportation: form.transportation,
      plan: tier.plan,
      origin: window.location.origin,
    });
  }

  // ── Sub-step: Almost Ready ──────────────────────────────────────────────────
  if (subStep === "almost_ready") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <h2 className="text-3xl font-black text-[#111] mb-2">Your job is live!</h2>
          <p className="text-gray-500 text-base max-w-md mx-auto">
            Artists are already seeing your listing. Unlock applicants to start messaging them directly.
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5 mb-6">
          <p className="text-xs font-semibold text-[#F25722] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Eye size={11} />
            Your listing is now live
          </p>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              {(form.studioName || form.title || "J")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#111] text-sm">{form.title || "Your Job"}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {form.studioName || "Your Studio"}
                {form.locationAddress && ` · ${form.locationAddress}`}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{form.dateType}</Badge>
                {form.transportation && (
                  <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">Travel covered</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/app/jobs")}
            className="flex-1 py-4"
          >
            View My Jobs
          </Button>
          <Button
            onClick={() => setSubStep("sponsor")}
            className="flex-1 py-4 hirer-grad-bg border-0 hover:opacity-90 font-bold"
          >
            Unlock Applicants
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Sub-step: Sponsor ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-[#111] mb-1">Unlock your applicants</h2>
        <p className="text-gray-500 text-sm">
          Choose a plan to see who applied and start messaging them.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${
              selectedTier === tier.id
                ? "border-[#F25722] bg-orange-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {tier.badge && (
              <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full hirer-grad-bg text-white text-[10px] font-bold">
                {tier.badge}
              </span>
            )}
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${tier.gradient} flex items-center justify-center flex-shrink-0`}>
                {tier.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-[#111] text-base">{tier.label}</p>
                  <p className="font-black text-[#F25722] text-lg">{tier.priceLabel}</p>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{tier.description}</p>
                <ul className="mt-2 space-y-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

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
