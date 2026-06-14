/**
 * Reusable inline auth form — email → password (or set-password for Bubble imports).
 * Used on job detail pages, lead capture flows, anywhere we need auth without a page redirect.
 *
 * Props:
 *   prefillEmail  — pre-fills the email field (e.g. from a lead capture form)
 *   onSuccess     — called with auth result on successful login; default: window.location.reload()
 *   onNotFound    — called when email has no account; default: redirect to /join
 *   heading / subheading — override display text
 */
import { useState, useRef, useEffect } from "react";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Loader2, Music, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export interface AuthResult {
  isAdmin?: boolean;
  enterprise?: boolean;
  user?: { userRole?: string | null };
}

interface Props {
  prefillEmail?: string;
  heading?: string;
  subheading?: string;
  onSuccess?: (data: AuthResult) => void;
  onNotFound?: (email: string) => void;
}

type Stage = "email" | "password" | "set-password";

interface UserInfo {
  firstName: string | null;
  userRole: string | null;
  profilePicture: string | null;
  clientCompanyName: string | null;
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const isArtist = role === "Artist";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isArtist ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
      {isArtist ? <Music size={10} /> : <Building2 size={10} />}
      {isArtist ? "Artist" : "Client"}
    </span>
  );
}

export default function InlineAuth({
  prefillEmail = "",
  heading = "Welcome back",
  subheading = "Log in to continue",
  onSuccess,
  onNotFound,
}: Props) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "password" || stage === "set-password") {
      const t = setTimeout(() => passwordRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [stage]);

  // If prefillEmail changes (e.g. parent sets it after async call), sync state
  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  function handleAuthSuccess(data: AuthResult) {
    if (onSuccess) {
      onSuccess(data);
    } else {
      window.location.reload();
    }
  }

  const lookupEmail = trpc.auth.lookupEmail.useMutation({
    onSuccess: (data) => {
      setError("");
      if (!data.exists) {
        if (onNotFound) {
          onNotFound(email.trim().toLowerCase());
        } else {
          window.location.href = `/join?email=${encodeURIComponent(email.trim().toLowerCase())}`;
        }
        return;
      }
      setUserInfo({
        firstName: data.firstName,
        userRole: data.userRole,
        profilePicture: data.profilePicture,
        clientCompanyName: data.clientCompanyName,
      });
      setStage(data.hasPassword ? "password" : "set-password");
    },
    onError: (err) => setError(err.message || "Something went wrong."),
  });

  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: (data) => handleAuthSuccess(data),
    onError: (err) => {
      const msg = (err.message ?? "").toLowerCase();
      setError(msg.includes("invalid") || msg.includes("password") ? "Incorrect password." : err.message || "Login failed.");
    },
  });

  const setInitialPassword = trpc.auth.setInitialPassword.useMutation({
    onSuccess: (data) => handleAuthSuccess(data),
    onError: (err) => setError(err.message || "Something went wrong."),
  });

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setError("");
    lookupEmail.mutate({ email: trimmed });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError("Please enter your password."); return; }
    setError("");
    passwordLogin.mutate({ email: email.trim().toLowerCase(), password });
  }

  function handleSetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setError("");
    setInitialPassword.mutate({ email: email.trim().toLowerCase(), password });
  }

  function goBack() {
    setStage("email");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setUserInfo(null);
  }

  const displayName = userInfo?.firstName || email.split("@")[0];
  const isPending = lookupEmail.isPending || passwordLogin.isPending || setInitialPassword.isPending;

  return (
    <div className="space-y-4">
      {/* ── Email stage ── */}
      {stage === "email" && (
        <>
          <div>
            <p className="text-base font-black text-[#111] mb-0.5">{heading}</p>
            <p className="text-xs text-gray-400">{subheading}</p>
          </div>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="you@studio.com"
                required
                autoFocus={!prefillEmail}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {lookupEmail.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Checking...</>
                : <>Continue <ArrowRight size={15} /></>}
            </button>
          </form>
        </>
      )}

      {/* ── Password stage ── */}
      {stage === "password" && userInfo && (
        <>
          <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={12} /> Different email
          </button>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
              {(userInfo.firstName || email)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111] truncate">Welcome back, {displayName}!</p>
              {userInfo.clientCompanyName && <p className="text-xs text-gray-500 truncate">{userInfo.clientCompanyName}</p>}
              <RoleBadge role={userInfo.userRole} />
            </div>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3.5 pr-11 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !password}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {passwordLogin.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Signing in...</>
                : <>Sign In <ArrowRight size={15} /></>}
            </button>
            <p className="text-center">
              <a href="/forgot-password" className="text-xs text-gray-400 hover:text-[#F25722] transition-colors underline underline-offset-2">Forgot password?</a>
            </p>
          </form>
        </>
      )}

      {/* ── Set-password stage (Bubble imports) ── */}
      {stage === "set-password" && userInfo && (
        <>
          <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={12} /> Different email
          </button>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
              {(userInfo.firstName || email)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111] truncate">Hey {displayName}!</p>
              <p className="text-xs text-gray-500">Create a password to sign in for the first time</p>
            </div>
          </div>
          <form onSubmit={handleSetPasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Create password</label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  className="w-full px-4 py-3.5 pr-11 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3.5 pr-11 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !password || !confirmPassword}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {setInitialPassword.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Setting up...</>
                : <>Set Password & Sign In <ArrowRight size={15} /></>}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
