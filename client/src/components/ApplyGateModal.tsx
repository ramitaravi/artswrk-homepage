/**
 * ApplyGateModal — shown to logged-out users when they click "Apply"
 *
 * Flow:
 *   1. User enters email
 *   2a. Existing user → show inline password field → log in right here (no redirect)
 *   2b. New user      → redirect to /join?next=<applyUrl>
 *
 * Share button copies the current page URL to clipboard with a toast.
 */

import { useState, useRef, useEffect } from "react";
import { X, ArrowRight, MapPin, Clock, Share2, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface ApplyGateJob {
  title: string;
  companyName?: string | null;
  location: string;
  datetime?: string | null;
  rate?: string | null;
  description?: string | null;
  /** The URL to redirect to after login/join, e.g. /jobs/new-york-ny/dance-teacher-1234/apply */
  applyUrl: string;
}

interface Props {
  job: ApplyGateJob;
  onClose: () => void;
  /** Called when the user successfully logs in inline */
  onLoginSuccess?: () => void;
}

type Step = "email" | "password" | "join";

export default function ApplyGateModal({ job, onClose, onLoginSuccess }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const checkEmail = trpc.auth.checkEmailExists.useMutation();
  const passwordLogin = trpc.auth.passwordLogin.useMutation();

  // Focus email input on open
  useEffect(() => {
    const t = setTimeout(() => emailInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Focus password input when step changes to password
  useEffect(() => {
    if (step === "password") {
      const t = setTimeout(() => passwordInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setChecking(true);
    try {
      const result = await checkEmail.mutateAsync({ email: trimmed });
      if (result.exists) {
        // Existing user → show inline password step
        setStep("password");
      } else {
        // New user → redirect to join
        const next = encodeURIComponent(job.applyUrl);
        window.location.href = `/join?next=${next}&email=${encodeURIComponent(trimmed)}`;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }
    setError("");
    setLoggingIn(true);
    try {
      await passwordLogin.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
      });
      // Success — close modal and notify parent to refresh auth state
      onLoginSuccess?.();
      onClose();
      toast.success("Welcome back! You're now logged in.");
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("password")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoggingIn(false);
    }
  }

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback for older browsers
        const el = document.createElement("textarea");
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  // Truncate description for the teaser — show ~2 lines then blur
  const descPreview = job.description
    ? job.description.slice(0, 120) + (job.description.length > 120 ? "…" : "")
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={handleBackdrop}
    >
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ fontFamily: "Poppins, sans-serif", maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>

        <div className="px-6 pt-7 pb-6">
          {/* Header */}
          <h2 className="text-2xl font-black text-[#111] mb-5 flex items-center gap-2">
            {step === "password" ? "Welcome back! 👋" : "Apply Now ⭐"}
          </h2>

          {/* Job teaser card */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 relative overflow-hidden">
            {/* Title + location row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                <span className="text-pink-500 font-black text-sm">
                  {(job.title || "?")[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-bold text-[#111] text-sm leading-tight truncate max-w-[220px]">
                  {job.title}
                </p>
                <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                  <MapPin size={10} className="flex-shrink-0" />
                  {job.location}
                </p>
              </div>
            </div>

            {/* Date */}
            {job.datetime && (
              <div className="mb-3">
                <p className="text-xs font-bold text-[#111] mb-0.5">Date</p>
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-400 flex-shrink-0" />
                  {job.datetime}
                </p>
              </div>
            )}

            {/* Description — partially visible, then blurred */}
            {descPreview && (
              <div className="mb-3 relative">
                <p className="text-xs font-bold text-[#111] mb-0.5">Description</p>
                <div className="relative">
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                    {descPreview}
                  </p>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                    style={{
                      background: "linear-gradient(to bottom, transparent 0%, rgba(249,250,251,0.95) 100%)",
                    }}
                  />
                </div>
                <div className="mt-1 space-y-1.5 select-none pointer-events-none">
                  <div className="h-3 rounded-full bg-gray-200 blur-[3px] w-full" />
                  <div className="h-3 rounded-full bg-gray-200 blur-[3px] w-4/5" />
                  <div className="h-3 rounded-full bg-gray-200 blur-[3px] w-3/5" />
                </div>
              </div>
            )}

            {/* Budget / Rate */}
            <div>
              <p className="text-xs font-bold text-[#111] mb-0.5">Budget</p>
              {job.rate ? (
                <p className="text-sm text-gray-600">{job.rate}</p>
              ) : (
                <div className="h-4 rounded-full bg-gray-200 blur-[3px] w-24 select-none" />
              )}
            </div>
          </div>

          {/* ── Step: Email ── */}
          {step === "email" && (
            <div className="mb-2">
              <h3 className="text-xl font-black text-[#111] mb-4 flex items-center gap-1">
                Get Started on Artswrk
                <span className="text-gray-400 font-normal text-base ml-1">↙</span>
              </h3>

              <form onSubmit={handleEmailSubmit}>
                <div className="relative">
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    disabled={checking}
                    className="w-full px-4 py-3.5 pr-14 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all disabled:opacity-60 bg-white"
                  />
                  <button
                    type="submit"
                    disabled={checking || !email.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg hirer-grad-bg flex items-center justify-center disabled:opacity-40 transition-opacity hover:opacity-90"
                    aria-label="Continue"
                  >
                    {checking ? (
                      <Loader2 size={16} className="text-white animate-spin" />
                    ) : (
                      <ArrowRight size={16} className="text-white" />
                    )}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-red-500 mt-1.5 pl-1">{error}</p>
                )}
              </form>

              <p className="text-xs text-gray-400 mt-2 text-center">
                Already have an account?{" "}
                <a
                  href={`/login?next=${encodeURIComponent(job.applyUrl)}`}
                  className="text-[#F25722] font-semibold hover:underline"
                >
                  Log in
                </a>
              </p>
            </div>
          )}

          {/* ── Step: Password (existing user inline login) ── */}
          {step === "password" && (
            <div className="mb-2">
              <p className="text-sm text-gray-500 mb-4">
                Enter your password for <span className="font-semibold text-[#111]">{email}</span>
              </p>

              <form onSubmit={handlePasswordSubmit}>
                <div className="relative mb-3">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    disabled={loggingIn}
                    className="w-full px-4 py-3.5 pr-20 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all disabled:opacity-60 bg-white"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-red-500 mb-2 pl-1">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loggingIn || !password.trim()}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loggingIn ? (
                    <><Loader2 size={16} className="animate-spin" /> Logging in...</>
                  ) : (
                    <>Log In & Apply <ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <button
                  onClick={() => { setStep("email"); setPassword(""); setError(""); }}
                  className="hover:text-gray-600 transition-colors"
                >
                  ← Use a different email
                </button>
                <a
                  href={`/login?next=${encodeURIComponent(job.applyUrl)}&email=${encodeURIComponent(email)}`}
                  className="text-[#F25722] font-semibold hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Share footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-center">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle size={15} className="text-green-500" />
                <span className="text-green-600 font-semibold">Link copied!</span>
              </>
            ) : (
              <>
                Share this job <Share2 size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
