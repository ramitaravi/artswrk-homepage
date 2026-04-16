/**
 * ARTSWRK SIGNUP & ONBOARDING FLOW
 *
 * Steps:
 *  1. Account creation (firstName, lastName, email, password)
 *  2. Business or Individual?
 *  3a. Business type (Dance Studio, Dance Competition, Music School, Event Company, Other)
 *  3b. Artist types (for individuals)
 *  4. Business details (Google Places for studios, manual for others)
 *  5. Pricing plan ($30/post or $50/mo for studios; $100/post or $250/mo for enterprise)
 *  6. Post first job? → /post-job or /dashboard
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, Building2, User, Music, Trophy, Calendar, HelpCircle, Sparkles, MapPin, Globe, Phone, Zap, Star } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface AccountData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface OnboardingData {
  businessOrIndividual: "Business" | "Individual" | "";
  hiringCategory: string;
  artistTypes: string[];
  clientCompanyName: string;
  location: string;
  website: string;
  phoneNumber: string;
  placeId: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  { value: "Dance Studio", label: "Dance Studio", icon: Music, color: "from-orange-400 to-amber-400" },
  { value: "Dance Competition", label: "Dance Competition", icon: Trophy, color: "from-pink-500 to-rose-400" },
  { value: "Music School", label: "Music School", icon: Music, color: "from-purple-500 to-violet-400" },
  { value: "Event Company", label: "Event Company", icon: Calendar, color: "from-blue-500 to-cyan-400" },
  { value: "Other", label: "Other", icon: HelpCircle, color: "from-gray-500 to-slate-400" },
];

const ARTIST_TYPES = [
  "Dance Teacher", "Choreographer", "Substitute Teacher", "Competition Coach",
  "Yoga Instructor", "Pilates Instructor", "Fitness Instructor", "Vocal Coach",
  "Music Teacher", "Photographer", "Videographer", "Event Performer",
];

const ENTERPRISE_CATEGORIES = ["Dance Competition", "Event Company", "Other"];
const STUDIO_CATEGORIES = ["Dance Studio", "Music School"];

function isEnterprise(category: string) {
  return ENTERPRISE_CATEGORIES.includes(category);
}

// ─── Google Places Autocomplete Input ─────────────────────────────────────────
function PlacesAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPlaceSelected: (place: { name: string; address: string; website: string; phone: string; placeId: string }) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps script if not already loaded
    const checkMaps = () => {
      if (window.google?.maps?.places) {
        setMapsLoaded(true);
        return true;
      }
      return false;
    };

    if (checkMaps()) return;

    // Poll until loaded (Maps script is loaded by Map.tsx globally)
    const interval = setInterval(() => {
      if (checkMaps()) clearInterval(interval);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment"],
      fields: ["name", "formatted_address", "website", "formatted_phone_number", "place_id"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place.name) return;
      onPlaceSelected({
        name: place.name || "",
        address: place.formatted_address || "",
        website: place.website || "",
        phone: place.formatted_phone_number || "",
        placeId: place.place_id || "",
      });
      onChange(place.name || "");
    });
  }, [mapsLoaded]);

  return (
    <div className="relative">
      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search for your studio..."}
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
      />
    </div>
  );
}

// ─── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 < current
              ? "w-6 bg-[#F25722]"
              : i + 1 === current
              ? "w-10 hirer-grad-bg"
              : "w-6 bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Signup() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState<AccountData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const [onboarding, setOnboarding] = useState<OnboardingData>({
    businessOrIndividual: "",
    hiringCategory: "",
    artistTypes: [],
    clientCompanyName: "",
    location: "",
    website: "",
    phoneNumber: "",
    placeId: "",
  });

  const registerMutation = trpc.signup.register.useMutation();
  const updateOnboardingMutation = trpc.signup.updateOnboarding.useMutation();

  const totalSteps = onboarding.businessOrIndividual === "Individual" ? 5 : 6;

  // ── Step 1: Account creation ──────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerMutation.mutateAsync({
        firstName: account.firstName.trim(),
        lastName: account.lastName.trim(),
        email: account.email.trim(),
        password: account.password,
      });
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Business or Individual ───────────────────────────────────────
  async function handleBusinessOrIndividual(choice: "Business" | "Individual") {
    setOnboarding(prev => ({ ...prev, businessOrIndividual: choice }));
    try {
      await updateOnboardingMutation.mutateAsync({
        businessOrIndividual: choice,
        onboardingStep: 2,
      });
    } catch {}
    setStep(3);
  }

  // ── Step 3: Business type or Artist types ─────────────────────────────────
  async function handleBusinessType(type: string) {
    setOnboarding(prev => ({ ...prev, hiringCategory: type }));
    try {
      await updateOnboardingMutation.mutateAsync({
        hiringCategory: type,
        onboardingStep: 3,
      });
    } catch {}
    setStep(4);
  }

  function toggleArtistType(type: string) {
    setOnboarding(prev => ({
      ...prev,
      artistTypes: prev.artistTypes.includes(type)
        ? prev.artistTypes.filter(t => t !== type)
        : [...prev.artistTypes, type],
    }));
  }

  async function handleArtistTypesContinue() {
    try {
      await updateOnboardingMutation.mutateAsync({
        onboardingStep: 3,
      });
    } catch {}
    setStep(5); // Skip to pricing for individuals
  }

  // ── Step 4: Business details ──────────────────────────────────────────────
  async function handleBusinessDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await updateOnboardingMutation.mutateAsync({
        clientCompanyName: onboarding.clientCompanyName,
        location: onboarding.location,
        website: onboarding.website,
        phoneNumber: onboarding.phoneNumber,
        onboardingStep: 4,
      });
      setStep(5);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 5: Pricing ───────────────────────────────────────────────────────
  function handlePricingContinue() {
    setStep(6);
  }

  // ── Step 6: Post first job ────────────────────────────────────────────────
  function handlePostFirstJob() {
    navigate("/post-job");
  }

  function handleGoToDashboard() {
    navigate("/app");
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <a href="/" className="flex items-center mb-10 select-none">
        <span className="font-black text-2xl tracking-tight hirer-grad-text">ARTS</span>
        <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
      </a>

      <div className="w-full max-w-md">
        {/* ── Step 1: Account ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepIndicator current={1} total={6} />
            <h1 className="text-2xl font-black text-[#111] mb-1">Create your account</h1>
            <p className="text-gray-500 text-sm mb-7">Join 5,000+ studios and artists on Artswrk</p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First name</label>
                  <input
                    type="text"
                    value={account.firstName}
                    onChange={e => setAccount(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Jane"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name</label>
                  <input
                    type="text"
                    value={account.lastName}
                    onChange={e => setAccount(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Smith"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={account.email}
                  onChange={e => setAccount(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@studio.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={account.password}
                    onChange={e => setAccount(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <>Create Account <ArrowRight size={16} /></>
                )}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-5">
              Already have an account?{" "}
              <a href="/login" className="font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
                Sign in
              </a>
            </p>
            <p className="text-center text-xs text-gray-300 mt-3">
              By creating an account you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Privacy Policy</a>
            </p>
          </div>
        )}

        {/* ── Step 2: Business or Individual ──────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepIndicator current={2} total={6} />
            <h1 className="text-2xl font-black text-[#111] mb-1">Who are you hiring for?</h1>
            <p className="text-gray-500 text-sm mb-7">This helps us personalise your experience</p>
            <div className="space-y-3">
              <button
                onClick={() => handleBusinessOrIndividual("Business")}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-[#FFBC5D] hover:bg-amber-50/40 transition-all group text-left"
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
                onClick={() => handleBusinessOrIndividual("Individual")}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-pink-300 hover:bg-pink-50/40 transition-all group text-left"
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

        {/* ── Step 3a: Business type ───────────────────────────────────── */}
        {step === 3 && onboarding.businessOrIndividual === "Business" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepIndicator current={3} total={6} />
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-2xl font-black text-[#111] mb-1">What type of business?</h1>
            <p className="text-gray-500 text-sm mb-7">Select the option that best describes you</p>
            <div className="space-y-2.5">
              {BUSINESS_TYPES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => handleBusinessType(value)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-[#FFBC5D] hover:bg-amber-50/30 transition-all group text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <span className="font-semibold text-[#111] text-sm">{label}</span>
                  <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-[#F25722] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3b: Artist types (Individual) ──────────────────────── */}
        {step === 3 && onboarding.businessOrIndividual === "Individual" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepIndicator current={3} total={5} />
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-2xl font-black text-[#111] mb-1">What are you hiring for?</h1>
            <p className="text-gray-500 text-sm mb-6">Select all that apply</p>
            <div className="flex flex-wrap gap-2 mb-7">
              {ARTIST_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleArtistType(type)}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    onboarding.artistTypes.includes(type)
                      ? "border-[#F25722] bg-orange-50 text-[#F25722]"
                      : "border-gray-200 text-gray-600 hover:border-[#FFBC5D]"
                  }`}
                >
                  {onboarding.artistTypes.includes(type) && <CheckCircle2 size={11} className="inline mr-1" />}
                  {type}
                </button>
              ))}
            </div>
            <button
              onClick={handleArtistTypesContinue}
              disabled={onboarding.artistTypes.length === 0}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step 4: Business details ─────────────────────────────────── */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepIndicator current={4} total={6} />
            <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-2xl font-black text-[#111] mb-1">
              {STUDIO_CATEGORIES.includes(onboarding.hiringCategory) ? "Find your studio" : "Tell us about your business"}
            </h1>
            <p className="text-gray-500 text-sm mb-7">
              {STUDIO_CATEGORIES.includes(onboarding.hiringCategory)
                ? "Search Google to auto-fill your studio details"
                : "We'll use this to set up your account"}
            </p>
            <form onSubmit={handleBusinessDetails} className="space-y-4">
              {/* Studio / Music School: Google Places search */}
              {STUDIO_CATEGORIES.includes(onboarding.hiringCategory) && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Studio name</label>
                    <PlacesAutocompleteInput
                      value={onboarding.clientCompanyName}
                      onChange={v => setOnboarding(prev => ({ ...prev, clientCompanyName: v }))}
                      onPlaceSelected={place => {
                        setOnboarding(prev => ({
                          ...prev,
                          clientCompanyName: place.name,
                          location: place.address,
                          website: place.website,
                          phoneNumber: place.phone,
                          placeId: place.placeId,
                        }));
                      }}
                      placeholder="Search for your studio on Google..."
                    />
                    <p className="text-xs text-gray-400 mt-1.5">We'll auto-fill your address, website, and phone from Google</p>
                  </div>
                  {onboarding.location && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-green-700">Studio found on Google</p>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600 pl-5">
                        <p className="flex items-center gap-1.5"><MapPin size={11} className="text-gray-400" /> {onboarding.location}</p>
                        {onboarding.website && <p className="flex items-center gap-1.5"><Globe size={11} className="text-gray-400" /> {onboarding.website}</p>}
                        {onboarding.phoneNumber && <p className="flex items-center gap-1.5"><Phone size={11} className="text-gray-400" /> {onboarding.phoneNumber}</p>}
                      </div>
                    </div>
                  )}
                  {/* Manual override fields */}
                  {onboarding.clientCompanyName && !onboarding.location && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                      <input
                        type="text"
                        value={onboarding.location}
                        onChange={e => setOnboarding(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="City, State"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Competition / Event Company */}
              {["Dance Competition", "Event Company"].includes(onboarding.hiringCategory) && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      {onboarding.hiringCategory === "Dance Competition" ? "Competition name" : "Company name"}
                    </label>
                    <input
                      type="text"
                      value={onboarding.clientCompanyName}
                      onChange={e => setOnboarding(prev => ({ ...prev, clientCompanyName: e.target.value }))}
                      placeholder={onboarding.hiringCategory === "Dance Competition" ? "e.g. Starpower Dance" : "e.g. Premier Events Co."}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Website</label>
                    <div className="relative">
                      <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="url"
                        value={onboarding.website}
                        onChange={e => setOnboarding(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://yourwebsite.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Other */}
              {onboarding.hiringCategory === "Other" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business name</label>
                    <input
                      type="text"
                      value={onboarding.clientCompanyName}
                      onChange={e => setOnboarding(prev => ({ ...prev, clientCompanyName: e.target.value }))}
                      placeholder="Your business name"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Website</label>
                    <div className="relative">
                      <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="url"
                        value={onboarding.website}
                        onChange={e => setOnboarding(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://yourwebsite.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!onboarding.clientCompanyName)}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <>Continue <ArrowRight size={16} /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 5: Pricing ──────────────────────────────────────────── */}
        {step === 5 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepIndicator current={5} total={onboarding.businessOrIndividual === "Individual" ? 5 : 6} />
            <button onClick={() => setStep(onboarding.businessOrIndividual === "Individual" ? 3 : 4)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-2xl font-black text-[#111] mb-1">Choose your plan</h1>
            <p className="text-gray-500 text-sm mb-7">
              {isEnterprise(onboarding.hiringCategory)
                ? "Enterprise pricing for competitions, events, and companies"
                : "Simple, transparent pricing for studios and schools"}
            </p>

            <div className="space-y-3 mb-6">
              {/* Pay per post */}
              <div className="border-2 border-gray-100 rounded-2xl p-5 hover:border-[#FFBC5D] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-[#111] text-sm">Pay to Post</p>
                    <p className="text-xs text-gray-500 mt-0.5">Post jobs one at a time</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-2xl text-[#111]">
                      ${isEnterprise(onboarding.hiringCategory) ? "100" : "30"}
                    </p>
                    <p className="text-xs text-gray-400">per job post</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> Visible to 5,000+ artists</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> Avg. 3 applicants in 24 hrs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> No subscription required</li>
                </ul>
              </div>

              {/* Subscription */}
              <div className="border-2 border-[#FFBC5D] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-3 right-3 bg-[#F25722] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Star size={9} /> Best Value
                </div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-[#111] text-sm">Subscribe & Save</p>
                    <p className="text-xs text-gray-500 mt-0.5">Unlimited posts, cancel anytime</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-2xl text-[#111]">
                      ${isEnterprise(onboarding.hiringCategory) ? "250" : "50"}
                    </p>
                    <p className="text-xs text-gray-400">per month</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> Unlimited job posts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> PRO badge on all posts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> Priority placement in search</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" /> Card saved for future posts</li>
                </ul>
              </div>

              {/* Enterprise: Talk to Sales */}
              {isEnterprise(onboarding.hiringCategory) && (
                <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gray-50">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap size={16} className="text-[#F25722]" />
                    <p className="font-bold text-[#111] text-sm">Talk to Sales</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Custom pricing for high-volume hiring, white-label options, and dedicated support.</p>
                  <a
                    href="mailto:hello@artswrk.com"
                    className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity underline underline-offset-2"
                  >
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

        {/* ── Step 6: Post first job ───────────────────────────────────── */}
        {step === 6 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <StepIndicator current={6} total={6} />
            <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-5 shadow-lg">
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-[#111] mb-2">You're all set!</h1>
            <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
              {onboarding.clientCompanyName
                ? `Welcome to Artswrk, ${onboarding.clientCompanyName}. Ready to find your first artist?`
                : `Welcome to Artswrk! Ready to find your first artist?`}
            </p>

            <div className="space-y-3">
              <button
                onClick={handlePostFirstJob}
                className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
              >
                <Sparkles size={16} />
                Post My First Job
              </button>
              <button
                onClick={handleGoToDashboard}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-gray-600 border-2 border-gray-100 hover:bg-gray-50 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-5 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> Free to post</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> 5,000+ artists</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> Avg. 3 apps in 24hr</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
