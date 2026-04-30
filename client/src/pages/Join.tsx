/**
 * ARTSWRK UNIFIED JOIN PAGE
 *
 * Step 0: Role selection — Artist or Client
 * Artist path  → account → artist types → plan
 * Client path  → account → business type → details → pricing → done
 */
import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2,
  Building2, Music, Trophy, Calendar, HelpCircle,
  MapPin, Globe, Phone, Zap, Star, Sparkles, Lock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";

// ─── Shared constants ──────────────────────────────────────────────────────────
const ARTIST_TYPES = [
  "Dance Teacher", "Choreographer", "Substitute Teacher", "Competition Coach",
  "Yoga Instructor", "Pilates Instructor", "Fitness Instructor", "Vocal Coach",
  "Music Teacher", "Photographer", "Videographer", "Event Performer",
];

const BUSINESS_TYPES = [
  { value: "Dance Studio",      label: "Dance Studio",      icon: Music,        color: "from-orange-400 to-amber-400" },
  { value: "Dance Competition", label: "Dance Competition", icon: Trophy,       color: "from-pink-500 to-rose-400" },
  { value: "Music School",      label: "Music School",      icon: Music,        color: "from-purple-500 to-violet-400" },
  { value: "Event Company",     label: "Event Company",     icon: Calendar,     color: "from-blue-500 to-cyan-400" },
  { value: "Other",             label: "Other",             icon: HelpCircle,   color: "from-gray-500 to-slate-400" },
];

const STUDIO_CATEGORIES    = ["Dance Studio", "Music School"];
const ENTERPRISE_CATEGORIES = ["Dance Competition", "Event Company", "Other"];
function isEnterprise(cat: string) { return ENTERPRISE_CATEGORIES.includes(cat); }

// ─── Tiny helpers ──────────────────────────────────────────────────────────────
function StepDots({ current, total, artist }: { current: number; total: number; artist: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-7">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
          i + 1 < current  ? "w-6 bg-[#F25722]"
          : i + 1 === current ? `w-10 ${artist ? "artist-grad-bg" : "hirer-grad-bg"}`
          : "w-6 bg-gray-200"
        }`} />
      ))}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors">
      <ArrowLeft size={14} /> Back
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">{msg}</div>;
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />;
}

// ─── Google Places Input ───────────────────────────────────────────────────────
function PlacesInput({ value, onChange, onPlaceSelected }: {
  value: string;
  onChange: (v: string) => void;
  onPlaceSelected: (p: { name: string; address: string; website: string; phone: string; placeId: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef    = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => { if (window.google?.maps?.places) { setReady(true); return true; } return false; };
    if (check()) return;
    const t = setInterval(() => { if (check()) clearInterval(t); }, 300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;
    acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment"],
      fields: ["name", "formatted_address", "website", "formatted_phone_number", "place_id"],
    });
    acRef.current.addListener("place_changed", () => {
      const p = acRef.current!.getPlace();
      if (!p.name) return;
      onPlaceSelected({ name: p.name, address: p.formatted_address ?? "", website: p.website ?? "", phone: p.formatted_phone_number ?? "", placeId: p.place_id ?? "" });
      onChange(p.name);
    });
  }, [ready]);

  return (
    <div className="relative">
      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input ref={inputRef} type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Search for your studio on Google..."
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
type Role  = "artist" | "client" | null;
type Stage =
  | "role"           // step 0: pick artist / client
  | "account"        // step 1: name + email + password
  | "artist-types"   // artist step 2
  | "artist-plan"    // artist step 3
  | "client-biz"     // client step 2: business type
  | "client-details" // client step 3: business details
  | "client-pricing" // client step 4: pricing
  | "done";          // client step 5

export default function Join() {
  const [, navigate]  = useLocation();
  const searchStr     = useSearch();
  const params        = new URLSearchParams(searchStr);
  const next          = params.get("next") ?? "";
  const prefillEmail  = params.get("email") ?? "";

  // ── State ──────────────────────────────────────────────────────────────────
  const [stage,       setStage]       = useState<Stage>("role");
  const [role,        setRole]        = useState<Role>(null);
  const [error,       setError]       = useState("");
  const [busy,        setBusy]        = useState(false);
  const [showPw,      setShowPw]      = useState(false);

  // account
  const [firstName, setFirstName]     = useState("");
  const [lastName,  setLastName]      = useState("");
  const [email,     setEmail]         = useState(prefillEmail);
  const [password,  setPassword]      = useState("");

  // artist
  const [artistTypes, setArtistTypes] = useState<string[]>([]);

  // client
  const [bizType,     setBizType]     = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location,    setLocation]    = useState("");
  const [website,     setWebsite]     = useState("");
  const [phone,       setPhone]       = useState("");
  const [placeId,     setPlaceId]     = useState("");

  const registerMutation  = trpc.signup.register.useMutation();
  const onboardingMutation = trpc.signup.updateOnboarding.useMutation();

  const isArtist = role === "artist";

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Step 0 → Step 1
  function selectRole(r: Role) {
    setRole(r);
    setStage("account");
  }

  // Step 1: create account
  async function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await registerMutation.mutateAsync({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim().toLowerCase(),
        password,
      });
      if (isArtist) {
        await onboardingMutation.mutateAsync({ businessOrIndividual: "Individual", onboardingStep: 1 });
        setStage("artist-types");
      } else {
        setStage("client-biz");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Artist: types → plan
  function toggleArtistType(t: string) {
    setArtistTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleArtistTypesDone() {
    setBusy(true);
    try { await onboardingMutation.mutateAsync({ onboardingStep: 2 }); } catch {}
    setBusy(false);
    setStage("artist-plan");
  }

  function handleArtistPlan(plan: "basic" | "pro") {
    const dest = next || "/app";
    navigate(`/subscribe/${plan}?next=${encodeURIComponent(dest)}`);
  }

  function handleArtistSkip() {
    navigate(next || "/jobs");
  }

  // Client: biz type → details
  async function handleBizType(type: string) {
    setBizType(type);
    try { await onboardingMutation.mutateAsync({ hiringCategory: type, onboardingStep: 2 }); } catch {}
    setStage("client-details");
  }

  async function handleClientDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onboardingMutation.mutateAsync({
        clientCompanyName: companyName,
        location,
        website,
        phoneNumber: phone,
        onboardingStep: 3,
      });
      setStage("client-pricing");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full";

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center px-4 pt-28 pb-12">
      <Navbar />
      <div className="w-full max-w-md">

        {/* ── STEP 0: Role picker ─────────────────────────────────────────── */}
        {stage === "role" && (
          <div>
            <h1 className="text-3xl font-black text-[#111] mb-8 leading-tight">
              Join as an Artist<br />or Client
              <span className="inline-block ml-2 text-2xl" style={{ transform: "scaleX(-1) rotate(-10deg)", display: "inline-block" }}>↵</span>
            </h1>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Artist card */}
              <button
                onClick={() => setRole("artist")}
                className={`rounded-2xl border-2 p-5 text-left transition-all hover:border-[#111] hover:shadow-sm ${
                  role === "artist" ? "border-[#111] bg-white shadow-sm" : "border-gray-200 bg-white"
                }`}
              >
                <p className="font-bold text-[#111] text-sm mb-1">Join as Artist</p>
                <p className="text-xs text-gray-500 leading-snug">I want to earn money as an artist</p>
              </button>

              {/* Client card */}
              <button
                onClick={() => setRole("client")}
                className={`rounded-2xl border-2 p-5 text-left transition-all hover:border-[#111] hover:shadow-sm ${
                  role === "client" ? "border-[#111] bg-white shadow-sm" : "border-gray-200 bg-white"
                }`}
              >
                <p className="font-bold text-[#111] text-sm mb-1">Join as Client</p>
                <p className="text-xs text-gray-500 leading-snug">I want to book artists</p>
              </button>
            </div>

            {/* JOIN button — advances only after role is selected */}
            <div className="space-y-3">
              <button
                onClick={() => role && setStage("account")}
                disabled={!role}
                className={`w-full py-4 rounded-2xl text-sm font-bold text-white transition-opacity disabled:opacity-40 ${
                  role === "artist" ? "artist-grad-bg" : "hirer-grad-bg"
                }`}
              >
                JOIN
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-5">
              Already have an account?{" "}
              <a
                href="/login"
                className="font-semibold hover:opacity-70 transition-opacity"
                style={{ color: role === "artist" ? "#EC008C" : "#F25722" }}
              >Sign In</a>.
            </p>
          </div>
        )}

        {/* ── STEP 1: Account creation ────────────────────────────────────── */}
        {stage === "account" && (
          <div className={card}>
            <StepDots current={1} total={isArtist ? 3 : 4} artist={!!isArtist} />
            <BackBtn onClick={() => setStage("role")} />

            <h1 className="text-2xl font-black text-[#111] mb-1">
              {isArtist ? "Join now. Start earning on Artswrk 💰" : "Join now. Hire instantly on Artswrk ⭐"}
            </h1>
            <p className="text-gray-500 text-sm mb-7">
              {isArtist ? "Join 5,000+ artists already on Artswrk" : "Join 5,000+ studios and artists on Artswrk"}
            </p>

            <form onSubmit={handleAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                    placeholder="Smith" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com" required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters" required minLength={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all pr-11" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <button type="submit" disabled={busy}
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 ${
                  isArtist ? "artist-grad-bg hover:opacity-90" : "hirer-grad-bg hover:opacity-90"
                }`}>
                {busy ? <><Spinner /> Creating account...</> : <>Join <ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-5">
              Already have an account?{" "}
              <a href="/login" className="font-semibold text-[#F25722] hover:opacity-70 transition-opacity">Sign in</a>.
            </p>
            <p className="text-center text-xs text-gray-300 mt-2">
              By joining you agree to our{" "}
              <a href="/terms" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Terms</a>
              {" "}and{" "}
              <a href="/privacy-policy" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Privacy Policy</a>
            </p>
          </div>
        )}

        {/* ── ARTIST: types ───────────────────────────────────────────────── */}
        {stage === "artist-types" && (
          <div className={card}>
            <StepDots current={2} total={3} artist />
            <BackBtn onClick={() => setStage("account")} />
            <h1 className="text-2xl font-black text-[#111] mb-1">What do you do?</h1>
            <p className="text-gray-500 text-sm mb-6">Select all that apply — helps hirers find you</p>
            <div className="flex flex-wrap gap-2 mb-7">
              {ARTIST_TYPES.map(t => (
                <button key={t} onClick={() => toggleArtistType(t)}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    artistTypes.includes(t)
                      ? "border-[#F25722] bg-orange-50 text-[#F25722]"
                      : "border-gray-200 text-gray-600 hover:border-pink-300"
                  }`}>
                  {artistTypes.includes(t) && <CheckCircle2 size={11} className="inline mr-1" />}
                  {t}
                </button>
              ))}
            </div>
            <button onClick={handleArtistTypesDone} disabled={artistTypes.length === 0 || busy}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40">
              {busy ? <><Spinner /> Saving...</> : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        )}

        {/* ── ARTIST: plan ────────────────────────────────────────────────── */}
        {stage === "artist-plan" && (
          <div className={card}>
            <StepDots current={3} total={3} artist />
            <BackBtn onClick={() => setStage("artist-types")} />
            <h1 className="text-2xl font-black text-[#111] mb-1">Choose your plan</h1>
            <p className="text-gray-500 text-sm mb-7">Subscribe to apply to jobs and get discovered</p>

            <div className="space-y-3 mb-5">
              {/* Basic */}
              <div className="rounded-2xl border-2 border-[#F25722] bg-[#FFF8F5] p-5 relative">
                <div className="absolute top-3 right-3 bg-[#F25722] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Most Popular</div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F25722] flex items-center justify-center">
                    <Zap size={15} className="text-white fill-white" />
                  </div>
                  <p className="font-black text-[#111] text-sm">Artswrk Basic</p>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600 mb-4">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[#F25722]" /> Apply to all marketplace jobs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[#F25722]" /> Public artist profile</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[#F25722]" /> Get discovered by hirers</li>
                </ul>
                <button onClick={() => handleArtistPlan("basic")}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors flex items-center justify-center gap-2">
                  Get Basic <ArrowRight size={15} />
                </button>
              </div>

              {/* PRO */}
              <div className="rounded-2xl border border-gray-200 bg-[#111] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                    <Star size={15} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <p className="font-black text-white text-sm">Artswrk PRO</p>
                </div>
                <ul className="space-y-1.5 text-xs text-white/70 mb-4">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-yellow-400" /> Everything in Basic</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-yellow-400" /> Access PRO &amp; enterprise jobs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-yellow-400" /> Priority in search results</li>
                </ul>
                <button onClick={() => handleArtistPlan("pro")}
                  className="w-full py-3 rounded-xl text-sm font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2">
                  Get PRO <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <button onClick={handleArtistSkip}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2">
              <Lock size={11} /> Browse jobs without a plan (view only)
            </button>
          </div>
        )}

        {/* ── CLIENT: business type ────────────────────────────────────────── */}
        {stage === "client-biz" && (
          <div className={card}>
            <StepDots current={2} total={4} artist={false} />
            <BackBtn onClick={() => setStage("account")} />
            <h1 className="text-2xl font-black text-[#111] mb-1">What type of business?</h1>
            <p className="text-gray-500 text-sm mb-7">Select the option that best describes you</p>
            <div className="space-y-2.5">
              {BUSINESS_TYPES.map(({ value, label, icon: Icon, color }) => (
                <button key={value} onClick={() => handleBizType(value)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-[#FFBC5D] hover:bg-amber-50/30 transition-all group text-left">
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

        {/* ── CLIENT: business details ─────────────────────────────────────── */}
        {stage === "client-details" && (
          <div className={card}>
            <StepDots current={3} total={4} artist={false} />
            <BackBtn onClick={() => setStage("client-biz")} />
            <h1 className="text-2xl font-black text-[#111] mb-1">
              {STUDIO_CATEGORIES.includes(bizType) ? "Find your studio" : "Tell us about your business"}
            </h1>
            <p className="text-gray-500 text-sm mb-7">
              {STUDIO_CATEGORIES.includes(bizType) ? "Search Google to auto-fill your details" : "We'll use this to set up your account"}
            </p>
            <form onSubmit={handleClientDetails} className="space-y-4">
              {STUDIO_CATEGORIES.includes(bizType) && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Studio name</label>
                    <PlacesInput value={companyName} onChange={setCompanyName}
                      onPlaceSelected={p => { setCompanyName(p.name); setLocation(p.address); setWebsite(p.website); setPhone(p.phone); setPlaceId(p.placeId); }} />
                    <p className="text-xs text-gray-400 mt-1.5">We'll auto-fill your address, website, and phone from Google</p>
                  </div>
                  {location && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <p className="text-xs font-semibold text-green-700">Studio found on Google</p>
                      </div>
                      <p className="text-xs text-gray-600 flex items-center gap-1.5 pl-5"><MapPin size={11} className="text-gray-400" />{location}</p>
                      {website && <p className="text-xs text-gray-600 flex items-center gap-1.5 pl-5"><Globe size={11} className="text-gray-400" />{website}</p>}
                      {phone && <p className="text-xs text-gray-600 flex items-center gap-1.5 pl-5"><Phone size={11} className="text-gray-400" />{phone}</p>}
                    </div>
                  )}
                </>
              )}

              {["Dance Competition", "Event Company", "Other"].includes(bizType) && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      {bizType === "Dance Competition" ? "Competition name" : bizType === "Event Company" ? "Company name" : "Business name"}
                    </label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                      placeholder={bizType === "Dance Competition" ? "e.g. Starpower Dance" : "e.g. Premier Events Co."} required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Website</label>
                    <div className="relative">
                      <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
                    </div>
                  </div>
                </>
              )}

              {error && <ErrorBox msg={error} />}

              <button type="submit" disabled={busy || !companyName}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40">
                {busy ? <><Spinner /> Saving...</> : <>Continue <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── CLIENT: pricing ──────────────────────────────────────────────── */}
        {stage === "client-pricing" && (
          <div className={card}>
            <StepDots current={4} total={4} artist={false} />
            <BackBtn onClick={() => setStage("client-details")} />
            <h1 className="text-2xl font-black text-[#111] mb-1">Choose your plan</h1>
            <p className="text-gray-500 text-sm mb-7">
              {isEnterprise(bizType) ? "Enterprise pricing for competitions, events, and companies" : "Simple, transparent pricing"}
            </p>

            <div className="space-y-3 mb-6">
              <div className="border-2 border-gray-100 rounded-2xl p-5 hover:border-[#FFBC5D] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-[#111] text-sm">Pay to Post</p>
                    <p className="text-xs text-gray-500 mt-0.5">Post jobs one at a time</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-2xl text-[#111]">${isEnterprise(bizType) ? "100" : "30"}</p>
                    <p className="text-xs text-gray-400">per job post</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Visible to 5,000+ artists</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Avg. 3 applicants in 24 hrs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> No subscription required</li>
                </ul>
              </div>

              <div className="border-2 border-[#FFBC5D] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-3 right-3 bg-[#F25722] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Star size={9} /> Best Value
                </div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-[#111] text-sm">Subscribe &amp; Save</p>
                    <p className="text-xs text-gray-500 mt-0.5">Unlimited posts, cancel anytime</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-2xl text-[#111]">${isEnterprise(bizType) ? "250" : "50"}</p>
                    <p className="text-xs text-gray-400">per month</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Unlimited job posts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> PRO badge on all posts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Priority placement in search</li>
                </ul>
              </div>

              {isEnterprise(bizType) && (
                <div className="border-2 border-gray-100 rounded-2xl p-5 bg-gray-50">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap size={16} className="text-[#F25722]" />
                    <p className="font-bold text-[#111] text-sm">Talk to Sales</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Custom pricing for high-volume hiring and dedicated support.</p>
                  <a href="mailto:hello@artswrk.com" className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity underline underline-offset-2">
                    Contact us → hello@artswrk.com
                  </a>
                </div>
              )}
            </div>

            <button onClick={() => setStage("done")}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              Continue <ArrowRight size={16} />
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">You'll choose your plan when you post your first job</p>
          </div>
        )}

        {/* ── CLIENT: done ─────────────────────────────────────────────────── */}
        {stage === "done" && (
          <div className={`${card} text-center`}>
            <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-5 shadow-lg">
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-[#111] mb-2">You're all set!</h1>
            <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
              {companyName ? `Welcome to Artswrk, ${companyName}. Ready to find your first artist?` : "Welcome to Artswrk! Ready to find your first artist?"}
            </p>
            <div className="space-y-3">
              <button onClick={() => { window.location.href = "/post-job"; }}
                className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md">
                <Sparkles size={16} /> Post My First Job
              </button>
              <button onClick={() => { window.location.href = "/app"; }}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-gray-600 border-2 border-gray-100 hover:bg-gray-50 transition-colors">
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
