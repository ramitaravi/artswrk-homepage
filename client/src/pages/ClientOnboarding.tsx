/**
 * CLIENT ONBOARDING — /client-onboarding
 *
 * For already-logged-in clients. Resumes from the last saved step
 * using onboardingStep stored on the user record.
 *
 * Step map:
 *   1 → Who are you hiring for? (Business / Individual)
 *   2 → What type of business?
 *   3 → Business details
 *   4 → Choose your plan
 *   5 → Done 🎉
 *
 * onboardingStep in DB tracks progress (1–5) so returning users resume correctly.
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Building2, User, Music, Trophy,
  Calendar, HelpCircle, MapPin, Globe, Phone, Star, Sparkles, Zap,
  LayoutDashboard, Briefcase, CreditCard,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ─────────────────────────────────────────────────────────────────────
type OnboardingStep = 1 | 2 | 3 | 4 | 5;

interface FormState {
  businessOrIndividual: "Business" | "Individual" | "";
  hiringCategory: string;
  clientCompanyName: string;
  location: string;
  website: string;
  phoneNumber: string;
  placeId: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  { value: "Dance Studio",      label: "Dance Studio",      icon: Music,       color: "from-orange-400 to-amber-400" },
  { value: "Dance Competition", label: "Dance Competition", icon: Trophy,      color: "from-pink-500 to-rose-400" },
  { value: "Music School",      label: "Music School",      icon: Music,       color: "from-purple-500 to-violet-400" },
  { value: "Event Company",     label: "Event Company",     icon: Calendar,    color: "from-blue-500 to-cyan-400" },
  { value: "Other",             label: "Other",             icon: HelpCircle,  color: "from-gray-500 to-slate-400" },
];

const ARTIST_TYPES = [
  "Dance Teacher", "Choreographer", "Substitute Teacher", "Competition Coach",
  "Yoga Instructor", "Pilates Instructor", "Fitness Instructor", "Vocal Coach",
  "Music Teacher", "Photographer", "Videographer", "Event Performer",
];

const ENTERPRISE_CATEGORIES = ["Dance Competition", "Event Company", "Other"];
const STUDIO_CATEGORIES = ["Dance Studio", "Music School"];

function isEnterprise(cat: string) { return ENTERPRISE_CATEGORIES.includes(cat); }

// ─── Step metadata (sidebar labels) ───────────────────────────────────────────
const STEPS = [
  { n: 1, label: "Who are you?",     icon: User },
  { n: 2, label: "Business type",   icon: Building2 },
  { n: 3, label: "Your details",    icon: Briefcase },
  { n: 4, label: "Choose a plan",   icon: CreditCard },
  { n: 5, label: "All done!",       icon: Sparkles },
];

// ─── Google Places ─────────────────────────────────────────────────────────────
function PlacesInput({
  value, onChange, onPlaceSelected, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPlaceSelected: (p: { name: string; address: string; website: string; phone: string; placeId: string }) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const check = () => { if (window.google?.maps?.places) { setMapsLoaded(true); return true; } return false; };
    if (check()) return;
    const iv = setInterval(() => { if (check()) clearInterval(iv); }, 300);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || acRef.current) return;
    acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment"],
      fields: ["name", "formatted_address", "website", "formatted_phone_number", "place_id"],
    });
    acRef.current.addListener("place_changed", () => {
      const p = acRef.current!.getPlace();
      if (!p.name) return;
      onPlaceSelected({ name: p.name, address: p.formatted_address || "", website: p.website || "", phone: p.formatted_phone_number || "", placeId: p.place_id || "" });
      onChange(p.name);
    });
  }, [mapsLoaded]);

  return (
    <div className="relative">
      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input ref={inputRef} type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "Search for your studio..."}
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
    </div>
  );
}

// ─── Sidebar step indicator ────────────────────────────────────────────────────
function StepSidebar({ current, businessOrIndividual }: { current: OnboardingStep; businessOrIndividual: string }) {
  // For individuals: skip step 2 (business type) and step 3 (business details)
  const isIndividual = businessOrIndividual === "Individual";
  const visibleSteps = isIndividual
    ? STEPS.filter(s => s.n !== 2 && s.n !== 3)
    : STEPS;

  // Map the actual step number to a display index for individual flow
  function displayIndex(n: number) {
    if (!isIndividual) return n;
    if (n === 1) return 1;
    if (n === 4) return 2;
    if (n === 5) return 3;
    return n;
  }

  return (
    <div className="hidden lg:flex flex-col w-64 shrink-0">
      <a href="/" className="flex items-center mb-10 select-none">
        <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
        <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
      </a>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Setup</p>
      <div className="space-y-1">
        {visibleSteps.map((s, idx) => {
          const displayN = displayIndex(s.n);
          const isCurrent = current === s.n;
          const isDone = current > s.n;
          return (
            <div key={s.n} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isCurrent ? "bg-orange-50" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                isDone ? "bg-[#F25722] text-white" : isCurrent ? "bg-[#111] text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? <CheckCircle2 size={14} /> : displayN}
              </div>
              <span className={`text-sm font-semibold transition-colors ${isCurrent ? "text-[#111]" : isDone ? "text-gray-500" : "text-gray-300"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-8 space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Progress</span>
          <span>{Math.round(((current - 1) / 4) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full hirer-grad-bg rounded-full transition-all duration-500"
            style={{ width: `${((current - 1) / 4) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Mobile progress bar ───────────────────────────────────────────────────────
function MobileProgress({ current }: { current: OnboardingStep }) {
  return (
    <div className="lg:hidden mb-6">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span className="font-semibold text-[#111]">{STEPS.find(s => s.n === current)?.label}</span>
        <span>Step {current} of 5</span>
      </div>
      <div className="flex gap-1">
        {STEPS.map(s => (
          <div key={s.n} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
            s.n < current ? "bg-[#F25722]" : s.n === current ? "hirer-grad-bg" : "bg-gray-200"
          }`} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    businessOrIndividual: "",
    hiringCategory: "",
    clientCompanyName: "",
    location: "",
    website: "",
    phoneNumber: "",
    placeId: "",
  });
  const [artistTypes, setArtistTypes] = useState<string[]>([]);

  const updateOnboarding = trpc.signup.updateOnboarding.useMutation();

  // ── Load saved state on mount ──────────────────────────────────────────────
  const { data: status } = trpc.signup.getOnboardingStatus.useQuery(undefined, {
    enabled: !!user,
  });

  useEffect(() => {
    if (!status || dataLoaded) return;
    setDataLoaded(true);

    // Pre-fill saved data
    setForm(prev => ({
      ...prev,
      businessOrIndividual: (status.businessOrIndividual as any) || "",
      hiringCategory: status.hiringCategory || "",
      clientCompanyName: status.clientCompanyName || "",
      location: status.location || "",
      website: status.website || "",
      phoneNumber: status.phoneNumber || "",
    }));

    // Resume from last saved step (onboardingStep in DB maps to our step numbers)
    // DB onboardingStep: 0=not started, 1=bio/individual, 2=business/individual selected,
    // 3=type selected, 4=details done, 5=pricing seen, 6+=complete
    const savedStep = status.onboardingStep ?? 0;
    if (savedStep >= 6) { navigate("/app"); return; }
    if (savedStep >= 5) { setStep(5); return; }
    if (savedStep >= 4) { setStep(4); return; }
    if (savedStep >= 3) { setStep(3); return; }
    if (savedStep >= 2) { setStep(2); return; }
    setStep(1);
  }, [status]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate("/login?next=/client-onboarding");
  }, [authLoading, user]);

  // ── Save helper ────────────────────────────────────────────────────────────
  async function save(data: Parameters<typeof updateOnboarding.mutateAsync>[0]) {
    try { await updateOnboarding.mutateAsync(data); } catch {}
  }

  // ── Step 1: Business or Individual ────────────────────────────────────────
  async function handleWhoAreYou(choice: "Business" | "Individual") {
    setForm(prev => ({ ...prev, businessOrIndividual: choice }));
    await save({ businessOrIndividual: choice, onboardingStep: 2 });
    setStep(2);
  }

  // ── Step 2: Business type ─────────────────────────────────────────────────
  async function handleBusinessType(type: string) {
    setForm(prev => ({ ...prev, hiringCategory: type }));
    await save({ hiringCategory: type, onboardingStep: 3 });
    setStep(3);
  }

  async function handleArtistTypesContinue() {
    await save({ onboardingStep: 3 });
    setStep(4); // individuals skip details step
  }

  // ── Step 3: Business details ──────────────────────────────────────────────
  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await save({
        clientCompanyName: form.clientCompanyName,
        location: form.location,
        website: form.website,
        phoneNumber: form.phoneNumber,
        onboardingStep: 4,
      });
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 4: Pricing ───────────────────────────────────────────────────────
  async function handlePricingContinue() {
    await save({ onboardingStep: 5 });
    setStep(5);
  }

  // ── Step 5: Done ─────────────────────────────────────────────────────────
  async function handleFinish(goPostJob = false) {
    await save({ onboardingStep: 6, userSignedUp: true });
    navigate(goPostJob ? "/post-job" : "/app");
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (authLoading || !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isIndividual = form.businessOrIndividual === "Individual";

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12 flex gap-16">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <StepSidebar current={step} businessOrIndividual={form.businessOrIndividual} />

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="flex-1 max-w-md">
          {/* Mobile logo */}
          <a href="/" className="lg:hidden flex items-center mb-8 select-none">
            <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
          </a>

          <MobileProgress current={step} />

          {/* ── Step 1: Who are you? ────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h1 className="text-2xl font-black text-[#111] mb-1">
                {status?.firstName ? `Hi ${status.firstName}! Who are you hiring for?` : "Who are you hiring for?"}
              </h1>
              <p className="text-gray-500 text-sm mb-7">This helps us personalise your experience</p>
              <div className="space-y-3">
                <button
                  onClick={() => handleWhoAreYou("Business")}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all group text-left ${
                    form.businessOrIndividual === "Business"
                      ? "border-[#FFBC5D] bg-amber-50/40"
                      : "border-gray-100 hover:border-[#FFBC5D] hover:bg-amber-50/40"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl hirer-grad-bg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Building2 size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-[#111] text-sm">A Business</p>
                    <p className="text-xs text-gray-500 mt-0.5">Studio, school, competition, or company</p>
                  </div>
                  <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-[#F25722] transition-colors" />
                </button>

                <button
                  onClick={() => handleWhoAreYou("Individual")}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all group text-left ${
                    form.businessOrIndividual === "Individual"
                      ? "border-pink-300 bg-pink-50/40"
                      : "border-gray-100 hover:border-pink-300 hover:bg-pink-50/40"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl artist-grad-bg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <User size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-[#111] text-sm">Myself (Individual)</p>
                    <p className="text-xs text-gray-500 mt-0.5">Personal hire for a one-off or recurring need</p>
                  </div>
                  <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-pink-400 transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Business type / Artist types ────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>

              {!isIndividual ? (
                <>
                  <h1 className="text-2xl font-black text-[#111] mb-1">What type of business?</h1>
                  <p className="text-gray-500 text-sm mb-7">Select the option that best describes you</p>
                  <div className="space-y-2.5">
                    {BUSINESS_TYPES.map(({ value, label, icon: Icon, color }) => (
                      <button
                        key={value}
                        onClick={() => handleBusinessType(value)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all group text-left ${
                          form.hiringCategory === value
                            ? "border-[#FFBC5D] bg-amber-50/30"
                            : "border-gray-100 hover:border-[#FFBC5D] hover:bg-amber-50/30"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={18} className="text-white" />
                        </div>
                        <span className="font-semibold text-[#111] text-sm">{label}</span>
                        {form.hiringCategory === value && <CheckCircle2 size={16} className="ml-auto text-[#F25722]" />}
                        {form.hiringCategory !== value && <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-[#F25722] transition-colors" />}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-black text-[#111] mb-1">What are you hiring for?</h1>
                  <p className="text-gray-500 text-sm mb-6">Select all that apply</p>
                  <div className="flex flex-wrap gap-2 mb-7">
                    {ARTIST_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setArtistTypes(prev =>
                          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                        )}
                        className={`px-3.5 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                          artistTypes.includes(type)
                            ? "border-[#F25722] bg-orange-50 text-[#F25722]"
                            : "border-gray-200 text-gray-600 hover:border-[#FFBC5D]"
                        }`}
                      >
                        {artistTypes.includes(type) && <CheckCircle2 size={11} className="inline mr-1" />}
                        {type}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleArtistTypesContinue}
                    disabled={artistTypes.length === 0}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Business details ─────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <h1 className="text-2xl font-black text-[#111] mb-1">
                {STUDIO_CATEGORIES.includes(form.hiringCategory) ? "Find your studio" : "Tell us about your business"}
              </h1>
              <p className="text-gray-500 text-sm mb-7">
                {STUDIO_CATEGORIES.includes(form.hiringCategory)
                  ? "Search Google to auto-fill your studio details"
                  : "We'll use this to personalise your account"}
              </p>

              <form onSubmit={handleDetails} className="space-y-4">
                {/* Studio / Music School: Google Places */}
                {STUDIO_CATEGORIES.includes(form.hiringCategory) && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Studio name</label>
                      <PlacesInput
                        value={form.clientCompanyName}
                        onChange={v => setForm(p => ({ ...p, clientCompanyName: v }))}
                        onPlaceSelected={place => setForm(p => ({
                          ...p,
                          clientCompanyName: place.name,
                          location: place.address,
                          website: place.website,
                          phoneNumber: place.phone,
                          placeId: place.placeId,
                        }))}
                        placeholder="Search for your studio on Google..."
                      />
                      <p className="text-xs text-gray-400 mt-1.5">We'll auto-fill your address, website, and phone</p>
                    </div>
                    {form.location && (
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <p className="text-xs font-semibold text-green-700">Studio found on Google</p>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600 pl-5">
                          <p className="flex items-center gap-1.5"><MapPin size={11} className="text-gray-400" /> {form.location}</p>
                          {form.website && <p className="flex items-center gap-1.5"><Globe size={11} className="text-gray-400" /> {form.website}</p>}
                          {form.phoneNumber && <p className="flex items-center gap-1.5"><Phone size={11} className="text-gray-400" /> {form.phoneNumber}</p>}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Competition / Event Company */}
                {["Dance Competition", "Event Company"].includes(form.hiringCategory) && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {form.hiringCategory === "Dance Competition" ? "Competition name" : "Company name"}
                      </label>
                      <input type="text" value={form.clientCompanyName}
                        onChange={e => setForm(p => ({ ...p, clientCompanyName: e.target.value }))}
                        placeholder={form.hiringCategory === "Dance Competition" ? "e.g. Starpower Dance" : "e.g. Premier Events Co."}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Website</label>
                      <div className="relative">
                        <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input type="url" value={form.website}
                          onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                          placeholder="https://yourwebsite.com"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone (optional)</label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input type="tel" value={form.phoneNumber}
                          onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
                          placeholder="(555) 000-0000"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Other */}
                {form.hiringCategory === "Other" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business name</label>
                      <input type="text" value={form.clientCompanyName}
                        onChange={e => setForm(p => ({ ...p, clientCompanyName: e.target.value }))}
                        placeholder="Your business name"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Website (optional)</label>
                      <div className="relative">
                        <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input type="url" value={form.website}
                          onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                          placeholder="https://yourwebsite.com"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={saving || !form.clientCompanyName}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                    : <>Continue <ArrowRight size={16} /></>
                  }
                </button>
              </form>
            </div>
          )}

          {/* ── Step 4: Choose a plan ────────────────────────────────────── */}
          {step === 4 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <button onClick={() => setStep(isIndividual ? 2 : 3)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <h1 className="text-2xl font-black text-[#111] mb-1">Choose your plan</h1>
              <p className="text-gray-500 text-sm mb-7">
                {isEnterprise(form.hiringCategory)
                  ? "Enterprise pricing for competitions, events, and companies"
                  : "Simple, transparent pricing for studios and schools"}
              </p>

              <div className="space-y-3 mb-6">
                <div className="border-2 border-gray-100 rounded-2xl p-5 hover:border-[#FFBC5D] transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-[#111] text-sm">Pay to Post</p>
                      <p className="text-xs text-gray-500 mt-0.5">Post jobs one at a time</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-[#111]">${isEnterprise(form.hiringCategory) ? "100" : "30"}</p>
                      <p className="text-xs text-gray-400">per job post</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-600">
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> Visible to 5,000+ artists</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> Avg. 3 applicants in 24 hrs</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> No subscription required</li>
                  </ul>
                </div>

                <div className="border-2 border-[#FFBC5D] rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-3 right-3 bg-[#F25722] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Star size={9} /> Best Value
                  </div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-[#111] text-sm">Subscribe & Save</p>
                      <p className="text-xs text-gray-500 mt-0.5">Unlimited posts, cancel anytime</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-[#111]">${isEnterprise(form.hiringCategory) ? "250" : "50"}</p>
                      <p className="text-xs text-gray-400">per month</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-600">
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> Unlimited job posts</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> PRO badge on all posts</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> Priority placement in search</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 shrink-0" /> Card saved for future posts</li>
                  </ul>
                </div>

                {isEnterprise(form.hiringCategory) && (
                  <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap size={16} className="text-[#F25722]" />
                      <p className="font-bold text-[#111] text-sm">Talk to Sales</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Custom pricing for high-volume hiring, white-label options, and dedicated support.</p>
                    <a href="mailto:hello@artswrk.com" className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity underline underline-offset-2">
                      Contact us → hello@artswrk.com
                    </a>
                  </div>
                )}
              </div>

              <button
                onClick={handlePricingContinue}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={16} />
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">You'll choose your plan when you post your first job</p>
            </div>
          )}

          {/* ── Step 5: Done ────────────────────────────────────────────── */}
          {step === 5 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-5 shadow-lg">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-black text-[#111] mb-2">You're all set!</h1>
              <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
                {form.clientCompanyName
                  ? `Welcome to Artswrk, ${form.clientCompanyName}. Ready to find your first artist?`
                  : "Welcome to Artswrk! Ready to find your first artist?"}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleFinish(true)}
                  className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
                >
                  <Sparkles size={16} />
                  Post My First Job
                </button>
                <button
                  onClick={() => handleFinish(false)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-gray-600 border-2 border-gray-100 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <LayoutDashboard size={15} />
                  Go to Dashboard
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-5 text-xs text-gray-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> Free to start</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> 5,000+ artists</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> Avg. 3 apps in 24hr</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
