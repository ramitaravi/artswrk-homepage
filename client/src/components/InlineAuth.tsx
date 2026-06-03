/**
 * Shared inline auth form — used on job detail pages for logged-out users.
 * Email → existing user shows password field, new user redirects to /join.
 */
import { useState, useRef, useEffect } from "react";
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Props {
  /** URL to redirect to after login / used as ?next= for new users */
  nextUrl: string;
  /** Label above the email input */
  heading?: string;
}

export default function InlineAuth({ nextUrl, heading = "Get Started on Artswrk" }: Props) {
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const checkEmail = trpc.auth.checkEmailExists.useMutation();
  const passwordLogin = trpc.auth.passwordLogin.useMutation();

  useEffect(() => {
    if (step === "password") {
      const t = setTimeout(() => passwordRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);

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
        window.location.href = `/join?next=${encodeURIComponent(nextUrl)}&email=${encodeURIComponent(trimmed)}`;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) { setError("Please enter your password."); return; }
    setError("");
    setLoggingIn(true);
    try {
      await passwordLogin.mutateAsync({ email: email.trim().toLowerCase(), password });
      toast.success("Welcome back!");
      window.location.reload();
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      setError(msg.includes("invalid") || msg.includes("password") ? "Incorrect password." : "Login failed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <p className="text-base font-black text-[#111] mb-1">{heading}</p>
      <p className="text-xs text-gray-400 mb-5">Create a free account or log in to apply</p>

      {step === "email" ? (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div className="relative">
            <input
              ref={emailRef}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              disabled={checking}
              className="w-full px-4 py-3.5 pr-14 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#111] transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={checking || !email.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#111] flex items-center justify-center disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {checking ? <Loader2 size={15} className="text-white animate-spin" /> : <ArrowRight size={15} className="text-white" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-center text-xs text-gray-400">
            Already have an account?{" "}
            <a href="/login" className="text-[#F25722] font-semibold hover:underline">Log in</a>
          </p>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <p className="text-sm font-semibold text-[#111]">{email}</p>
          <div className="relative">
            <input
              ref={passwordRef}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              disabled={loggingIn}
              className="w-full px-4 py-3.5 pr-24 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#111] transition-all disabled:opacity-60"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button type="button" onClick={() => setShowPw(v => !v)} className="text-gray-400 hover:text-gray-600 transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                type="submit"
                disabled={loggingIn || !password.trim()}
                className="w-9 h-9 rounded-lg bg-[#111] flex items-center justify-center disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {loggingIn ? <Loader2 size={15} className="text-white animate-spin" /> : <ArrowRight size={15} className="text-white" />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="button" onClick={() => { setStep("email"); setPassword(""); setError(""); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Different email
          </button>
        </form>
      )}
    </div>
  );
}
