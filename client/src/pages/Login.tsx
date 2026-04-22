/*
 * ARTSWRK SMART LOGIN
 *
 * Stage flow:
 *   email → (lookup) → password       (known user, has password)
 *                    → set-password   (known user, no password — imported from Bubble)
 *                    → not-found      (unknown email → join as artist or client)
 */

import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, ArrowRight, ArrowLeft, Music, Building2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";

type Stage = "email" | "password" | "set-password" | "not-found";

interface UserInfo {
  firstName: string | null;
  userRole: string | null;
  profilePicture: string | null;
  clientCompanyName: string | null;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const isArtist = role === "Artist";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isArtist
          ? "bg-purple-100 text-purple-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {isArtist ? <Music size={11} /> : <Building2 size={11} />}
      {isArtist ? "Artist" : "Client"}
    </span>
  );
}

function Avatar({ info, email }: { info: UserInfo; email: string }) {
  const initials = info.firstName
    ? info.firstName[0].toUpperCase()
    : email[0].toUpperCase();

  if (info.profilePicture) {
    return (
      <img
        src={info.profilePicture}
        alt={info.firstName ?? "User"}
        className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow"
      />
    );
  }
  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xl font-black shadow">
      {initials}
    </div>
  );
}

function Logo() {
  return (
    <a href="/" className="flex items-center select-none mb-10">
      <span className="font-black text-2xl tracking-tight hirer-grad-text">ARTS</span>
      <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
    </a>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Login() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const next = new URLSearchParams(searchStr).get("next");

  function getDestination(data: { isAdmin?: boolean; enterprise?: boolean; user?: { userRole?: string | null } }) {
    // Explicit ?next= param always wins (e.g. deep links before login)
    if (next) return next;
    if (data.isAdmin) return "/admin-dashboard";
    if (data.enterprise) return "/enterprise";
    if (data.user?.userRole === "Artist") return "/app";
    return "/app"; // regular client
  }

  // Focus the password field when stage changes
  useEffect(() => {
    if (stage === "password" || stage === "set-password") {
      setTimeout(() => passwordRef.current?.focus(), 50);
    }
  }, [stage]);

  const lookupEmail = trpc.auth.lookupEmail.useMutation({
    onSuccess: (data) => {
      setError("");
      if (!data.exists) {
        setStage("not-found");
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
    onSuccess: (data) => navigate(getDestination(data)),
    onError: (err) => setError(err.message || "Invalid email or password."),
  });

  const setInitialPassword = trpc.auth.setInitialPassword.useMutation({
    onSuccess: (data) => navigate(getDestination(data)),
    onError: (err) => setError(err.message || "Something went wrong."),
  });

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    lookupEmail.mutate({ email: email.trim().toLowerCase() });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    passwordLogin.mutate({ email: email.trim().toLowerCase(), password });
  }

  function handleSetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setInitialPassword.mutate({ email: email.trim().toLowerCase(), password });
  }

  function goBack() {
    setStage("email");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setUserInfo(null);
    setTimeout(() => emailRef.current?.focus(), 50);
  }

  const displayName = userInfo?.firstName
    ? userInfo.firstName
    : email.split("@")[0];

  // ── Shared email pill shown after step 1 ──────────────────────────────────

  function EmailPill() {
    return (
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#F25722] transition-colors mb-6 group"
      >
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-medium truncate max-w-[220px]">{email}</span>
        <span className="text-gray-400">· change</span>
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center px-4 pt-28 pb-12">
      <Navbar />

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

          {/* ── Stage: email ───────────────────────────────────────────── */}
          {stage === "email" && (
            <>
              <h1 className="text-2xl font-black text-[#111] mb-1">Sign in</h1>
              <p className="text-gray-500 text-sm mb-7">Enter your email to continue</p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                  />
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={lookupEmail.isPending}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {lookupEmail.isPending ? <><Spinner /> Checking...</> : <>Continue <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          )}

          {/* ── Stage: password ────────────────────────────────────────── */}
          {stage === "password" && userInfo && (
            <>
              <EmailPill />

              {/* Welcome card */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
                <Avatar info={userInfo} email={email} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#111] truncate">
                    Welcome back, {displayName}!
                  </p>
                  {userInfo.clientCompanyName && (
                    <p className="text-xs text-gray-500 truncate">{userInfo.clientCompanyName}</p>
                  )}
                  <div className="mt-1">
                    <RoleBadge role={userInfo.userRole} />
                  </div>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
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

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={passwordLogin.isPending}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {passwordLogin.isPending ? <><Spinner /> Signing in...</> : <>Sign In <ArrowRight size={16} /></>}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-[#F25722] transition-colors underline underline-offset-2">
                  Forgot password?
                </Link>
              </div>
            </>
          )}

          {/* ── Stage: set-password ────────────────────────────────────── */}
          {stage === "set-password" && userInfo && (
            <>
              <EmailPill />

              {/* Welcome card */}
              <div className="flex items-center gap-3 mb-2 p-4 bg-gray-50 rounded-xl">
                <Avatar info={userInfo} email={email} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#111] truncate">
                    Hey {displayName}!
                  </p>
                  {userInfo.clientCompanyName && (
                    <p className="text-xs text-gray-500 truncate">{userInfo.clientCompanyName}</p>
                  )}
                  <div className="mt-1">
                    <RoleBadge role={userInfo.userRole} />
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-6 mt-3">
                Your account is ready — just create a password to log in for the first time.
              </p>

              <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Create password</label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
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

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={setInitialPassword.isPending}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {setInitialPassword.isPending ? <><Spinner /> Setting up...</> : <><CheckCircle2 size={16} /> Set Password & Sign In</>}
                </button>
              </form>
            </>
          )}

          {/* ── Stage: not-found ───────────────────────────────────────── */}
          {stage === "not-found" && (
            <>
              <EmailPill />

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤔</span>
                </div>
                <h2 className="text-lg font-black text-[#111] mb-1">No account found</h2>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-[#111]">{email}</span> isn't in our system yet.
                  <br />Join free as an artist or a client.
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href={`/signup?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Building2 size={16} />
                  Join as a Client
                </a>
                <a
                  href={`/join?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-[#111] bg-gray-100 hover:bg-gray-150 transition-colors flex items-center justify-center gap-2"
                >
                  <Music size={16} />
                  Join as an Artist
                </a>
              </div>
            </>
          )}
        </div>

        {/* Bottom hint — only show on email stage */}
        {stage === "email" && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Don't have an account?{" "}
            <a
              href={`/join${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-semibold text-[#F25722] hover:opacity-70 transition-opacity"
            >
              Join free
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
      {message}
    </div>
  );
}
