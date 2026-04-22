/*
 * ARTSWRK ARTIST JOIN PAGE
 * Lightweight signup for artists who discover Artswrk via the jobs page.
 * Steps:
 *   1. Account (name, email, password)
 *   2. Artist type selection
 *   3. Plan choice (Basic / PRO) → redirects to subscribe or ?next
 *
 * Font: Poppins
 * Artist gradient: pink → purple (artist-grad-bg / artist-grad-text)
 */
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, Zap, Star, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";

const ARTIST_TYPES = [
  "Dance Teacher", "Choreographer", "Substitute Teacher", "Competition Coach",
  "Yoga Instructor", "Pilates Instructor", "Fitness Instructor", "Vocal Coach",
  "Music Teacher", "Photographer", "Videographer", "Event Performer",
];

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 < current
              ? "w-6 bg-[#F25722]"
              : i + 1 === current
              ? "w-10 artist-grad-bg"
              : "w-6 bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function ArtistJoin() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const next = new URLSearchParams(searchStr).get("next") ?? "/jobs";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [artistTypes, setArtistTypes] = useState<string[]>([]);

  const registerMutation = trpc.signup.register.useMutation();
  const updateOnboardingMutation = trpc.signup.updateOnboarding.useMutation();

  // ── Step 1: Account creation ───────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerMutation.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      // Mark as Individual artist
      await updateOnboardingMutation.mutateAsync({
        businessOrIndividual: "Individual",
        onboardingStep: 1,
      });
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Artist types ───────────────────────────────────────────────────
  function toggleType(type: string) {
    setArtistTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleTypesContinue() {
    setLoading(true);
    try {
      await updateOnboardingMutation.mutateAsync({ onboardingStep: 2 });
    } catch {}
    setLoading(false);
    setStep(3);
  }

  // ── Step 3: Plan choice ────────────────────────────────────────────────────
  function handlePlan(plan: "basic" | "pro") {
    navigate(`/subscribe/${plan}?next=${encodeURIComponent(next)}`);
  }

  function handleSkip() {
    navigate(next);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 pt-28 pb-12" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Navbar />

      <div className="w-full max-w-md">

        {/* ── Step 1: Account ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepDots current={1} total={3} />
            <h1 className="text-2xl font-black text-[#111] mb-1">Create your artist account</h1>
            <p className="text-gray-500 text-sm mb-7">Join 5,000+ artists already on Artswrk</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-pink-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-pink-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-pink-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-pink-400 transition-all pr-11"
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
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
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
              <Link
                href={`/login${next !== "/jobs" ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="font-semibold text-[#F25722] hover:opacity-70 transition-opacity"
              >
                Sign in
              </Link>
            </p>
            <p className="text-center text-xs text-gray-300 mt-3">
              By joining you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Terms</a>
              {" "}and{" "}
              <a href="#" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Privacy Policy</a>
            </p>
          </div>
        )}

        {/* ── Step 2: Artist types ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepDots current={2} total={3} />
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-2xl font-black text-[#111] mb-1">What do you do?</h1>
            <p className="text-gray-500 text-sm mb-6">Select all that apply — helps hirers find you</p>

            <div className="flex flex-wrap gap-2 mb-7">
              {ARTIST_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    artistTypes.includes(type)
                      ? "border-[#F25722] bg-orange-50 text-[#F25722]"
                      : "border-gray-200 text-gray-600 hover:border-pink-300"
                  }`}
                >
                  {artistTypes.includes(type) && <CheckCircle2 size={11} className="inline mr-1" />}
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={handleTypesContinue}
              disabled={artistTypes.length === 0 || loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
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
          </div>
        )}

        {/* ── Step 3: Plan ─────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <StepDots current={3} total={3} />
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-2xl font-black text-[#111] mb-1">Choose your plan</h1>
            <p className="text-gray-500 text-sm mb-7">Subscribe to apply to jobs and get discovered by hirers</p>

            <div className="space-y-3 mb-5">
              {/* Basic */}
              <div className="rounded-2xl border-2 border-[#F25722] bg-[#FFF8F5] p-5 relative">
                <div className="absolute top-3 right-3 bg-[#F25722] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  Most Popular
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F25722] flex items-center justify-center">
                    <Zap size={15} className="text-white fill-white" />
                  </div>
                  <div>
                    <p className="font-black text-[#111] text-sm">Artswrk Basic</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600 mb-4">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[#F25722] flex-shrink-0" /> Apply to all marketplace jobs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[#F25722] flex-shrink-0" /> Public artist profile</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[#F25722] flex-shrink-0" /> Get discovered by hirers</li>
                </ul>
                <button
                  onClick={() => handlePlan("basic")}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors flex items-center justify-center gap-2"
                >
                  Get Basic <ArrowRight size={15} />
                </button>
              </div>

              {/* PRO */}
              <div className="rounded-2xl border border-gray-200 bg-[#111] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                    <Star size={15} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <div>
                    <p className="font-black text-white text-sm">Artswrk PRO</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-white/70 mb-4">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-yellow-400 flex-shrink-0" /> Everything in Basic</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-yellow-400 flex-shrink-0" /> Access PRO &amp; enterprise jobs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-yellow-400 flex-shrink-0" /> Priority in search results</li>
                </ul>
                <button
                  onClick={() => handlePlan("pro")}
                  className="w-full py-3 rounded-xl text-sm font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2"
                >
                  Get PRO <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <button
              onClick={handleSkip}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              <Lock size={11} /> Browse jobs without a plan (view only)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
