/**
 * ProJobGateModal — shown to logged-out users when they click Apply on a PRO job.
 *
 * Shows compelling job details (title, full description, location, budget) with
 * the company identity withheld, then prompts email → login / join.
 */

import { useState, useRef, useEffect } from "react";
import { X, MapPin, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface ProGateJob {
  id: number;
  title: string;
  location: string;
  budget: string | null;
  description: string | null;
  detailUrl: string;
}

interface Props {
  job: ProGateJob;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

type Step = "email" | "password";

export default function ProJobGateModal({ job, onClose, onLoginSuccess }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const checkEmail = trpc.auth.checkEmailExists.useMutation();
  const passwordLogin = trpc.auth.passwordLogin.useMutation();

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (step === "password") {
      const t = setTimeout(() => passwordRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

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
        setStep("password");
      } else {
        const next = encodeURIComponent(job.detailUrl);
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
      await passwordLogin.mutateAsync({ email: email.trim().toLowerCase(), password });
      onLoginSuccess?.();
      onClose();
      toast.success("Welcome back!");
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      setError(msg.includes("invalid") || msg.includes("password") ? "Incorrect password." : "Login failed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={handleBackdrop}
    >
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ fontFamily: "Poppins, sans-serif", maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>

        <div className="px-6 pt-7 pb-6">
          {/* ArtswrkPRO branding */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-lg font-black text-[#111]">✦ Artswrk</span>
            <span className="text-lg font-black" style={{ color: "#c8f542" }}>PRO</span>
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: "#c8f542" }} />
          </div>

          {/* Job preview card */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-4">
              {/* Blurred avatar — company identity withheld */}
              <div className="w-10 h-10 rounded-full bg-gray-300 blur-sm flex-shrink-0" />
              <p className="font-bold text-[#111] text-sm leading-tight">{job.title}</p>
            </div>

            {/* Description — fully shown to be compelling */}
            {job.description && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#111] mb-1">Description</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {job.description}
                </p>
              </div>
            )}

            {/* Location */}
            <div className="mb-3">
              <p className="text-xs font-bold text-[#111] mb-1">Location</p>
              <p className="text-sm text-gray-600 flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                {job.location}
              </p>
            </div>

            {/* Budget */}
            {job.budget && (
              <div>
                <p className="text-xs font-bold text-[#111] mb-1">Budget</p>
                <p className="text-sm text-gray-600">{job.budget}</p>
              </div>
            )}
          </div>

          {/* Auth form */}
          {step === "email" ? (
            <div>
              <h3 className="text-xl font-black text-[#111] mb-4 flex items-center gap-1">
                Get Started on Artswrk
                <span className="text-gray-400 font-normal text-base ml-1">↙</span>
              </h3>
              <form onSubmit={handleEmailSubmit}>
                <div className="relative">
                  <input
                    ref={emailRef}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#111] flex items-center justify-center disabled:opacity-40 transition-opacity hover:opacity-80"
                    aria-label="Continue"
                  >
                    {checking ? (
                      <Loader2 size={16} className="text-white animate-spin" />
                    ) : (
                      <ArrowRight size={16} className="text-white" />
                    )}
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              </form>
              <p className="mt-3 text-center text-xs text-gray-400">
                Already have an account?{" "}
                <a href="/login" className="text-[#F25722] font-semibold hover:underline">Log in</a>
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-black text-[#111] mb-1">Welcome back! 👋</h3>
              <p className="text-sm text-gray-400 mb-4">{email}</p>
              <form onSubmit={handlePasswordSubmit}>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    disabled={loggingIn}
                    className="w-full px-4 py-3.5 pr-24 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all disabled:opacity-60 bg-white"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      type="submit"
                      disabled={loggingIn || !password.trim()}
                      className="w-9 h-9 rounded-lg bg-[#111] flex items-center justify-center disabled:opacity-40 transition-opacity hover:opacity-80"
                      aria-label="Log in"
                    >
                      {loggingIn ? (
                        <Loader2 size={16} className="text-white animate-spin" />
                      ) : (
                        <ArrowRight size={16} className="text-white" />
                      )}
                    </button>
                  </div>
                </div>
                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              </form>
              <button
                onClick={() => { setStep("email"); setPassword(""); setError(""); }}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
