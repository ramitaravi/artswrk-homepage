/**
 * StudioJobWizard — reusable email→auth→parse→redirect wizard.
 *
 * Props:
 *   heading / subheading   — card header text
 *   businessType           — displayed in the company field label and placeholder
 *                            e.g. "Dance Studio", "Acrobatic Arts Studio", "Music School"
 *   companyFieldLabel      — overrides the company field label if you need something different
 *
 * Flow:
 *   1. Email + optional job description
 *   2a. Existing account → password login
 *   2b. Bubble-imported account without password → set password
 *   2c. New email → inline signup (name, company, password) — no redirect to /join
 *   3.  AI parse → sessionStorage → /post-job Step 2
 */
import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface StudioJobWizardProps {
  heading?: string;
  subheading?: string;
  /** e.g. "Dance Studio", "Acrobatic Arts Studio", "Music School" */
  businessType?: string;
  /** Override the company/studio field label */
  companyFieldLabel?: string;
}

type FlowStep = "input" | "has-account" | "set-password" | "signup" | "parsing";

interface UserInfo {
  firstName: string | null;
  clientCompanyName: string | null;
}

export function StudioJobWizard({
  heading = "Post a Job in Minutes",
  subheading = "Describe what you need — our AI will build your listing and send it to 6,000+ artists.",
  businessType = "Studio",
  companyFieldLabel,
}: StudioJobWizardProps) {
  const [step, setStep] = useState<FlowStep>("input");
  const [email, setEmail] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Auth fields (existing user)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Signup fields (new user)
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  const [error, setError] = useState("");

  const passwordRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "has-account" || step === "set-password") {
      setTimeout(() => passwordRef.current?.focus(), 80);
    }
    if (step === "signup") {
      setTimeout(() => fullNameRef.current?.focus(), 80);
    }
  }, [step]);

  const companyLabel = companyFieldLabel ?? `${businessType} name`;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const parseText = trpc.postJob.parseText.useMutation({
    onSuccess: (data) => {
      sessionStorage.setItem("postJobParsed", JSON.stringify({ parsed: data, rawText: jobDescription.trim() }));
      window.location.href = "/post-job";
    },
    onError: () => {
      sessionStorage.setItem("postJobPrefill", jobDescription.trim());
      window.location.href = "/post-job";
    },
  });

  function saveDescriptionAndRedirect() {
    if (jobDescription.trim()) {
      setStep("parsing");
      parseText.mutate({ text: jobDescription.trim() });
    } else {
      window.location.href = "/post-job";
    }
  }

  const lookupEmail = trpc.auth.lookupEmail.useMutation({
    onSuccess: (data) => {
      setError("");
      if (!data.exists) { setStep("signup"); return; }
      setUserInfo({ firstName: data.firstName, clientCompanyName: data.clientCompanyName });
      setStep(data.hasPassword ? "has-account" : "set-password");
    },
    onError: (err) => setError(err.message || "Something went wrong."),
  });

  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: () => saveDescriptionAndRedirect(),
    onError: (err) => {
      const msg = (err.message ?? "").toLowerCase();
      setError(msg.includes("invalid") || msg.includes("password") ? "Incorrect password." : err.message || "Login failed.");
    },
  });

  const setInitialPassword = trpc.auth.setInitialPassword.useMutation({
    onSuccess: () => saveDescriptionAndRedirect(),
    onError: (err) => setError(err.message || "Something went wrong."),
  });

  const studioOnboard = trpc.artswrkUsers.studioOnboard.useMutation({
    onSuccess: () => saveDescriptionAndRedirect(),
    onError: (err) => setError(err.message || "Something went wrong."),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleEmailNext(e: React.FormEvent) {
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
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setError("");
    setInitialPassword.mutate({ email: email.trim().toLowerCase(), password });
  }

  function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signupPassword !== signupConfirm) { setError("Passwords don't match."); return; }
    if (signupPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    studioOnboard.mutate({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: signupPassword,
      companyName: companyName.trim() || undefined,
    });
  }

  function goBack() {
    setStep("input");
    setPassword("");
    setConfirmPassword("");
    setSignupPassword("");
    setSignupConfirm("");
    setError("");
  }

  const displayName = userInfo?.firstName || email.split("@")[0];
  const isPending = lookupEmail.isPending || passwordLogin.isPending || setInitialPassword.isPending || studioOnboard.isPending;

  return (
    <div className="w-full">
      {(heading || subheading) && (
        <div className="text-center mb-8">
          {heading && <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-3">{heading}</h2>}
          {subheading && <p className="text-gray-500 text-sm">{subheading}</p>}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-8">

        {/* ── Step 1: Email + Job Description ───────────────────────── */}
        {step === "input" && (
          <form onSubmit={handleEmailNext} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="you@studio.com"
                required
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Describe the job you need to fill
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="e.g. Looking for a ballet sub for Tuesday mornings at our Midtown studio. Class is 45 min, ages 5–8. Pay is $45/class..."
                rows={4}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none leading-relaxed"
              />
              <p className="text-xs text-gray-400 mt-1.5">Our AI extracts the title, date, rate & more automatically</p>
            </div>

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {lookupEmail.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Checking...</>
                : <>Next <ArrowRight size={15} /></>}
            </button>

            <p className="text-center text-xs text-gray-400">Free to post · No credit card required</p>
          </form>
        )}

        {/* ── Step 2a: Has Account — Sign In ────────────────────────── */}
        {step === "has-account" && userInfo && (
          <div className="space-y-5">
            <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={13} /> Back
            </button>

            <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-full hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {(userInfo.firstName || email)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111]">Welcome back, {displayName}!</p>
                {userInfo.clientCompanyName && (
                  <p className="text-xs text-gray-500 truncate">{userInfo.clientCompanyName}</p>
                )}
                <p className="text-xs text-gray-400 truncate">{email}</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {passwordLogin.isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Signing in...</>
                  : <>Sign In & Post Job <ArrowRight size={15} /></>}
              </button>

              <p className="text-center">
                <a href="/forgot-password" className="text-xs text-gray-400 hover:text-[#F25722] transition-colors underline underline-offset-2">
                  Forgot password?
                </a>
              </p>
            </form>
          </div>
        )}

        {/* ── Step 2b: Set Password (Bubble imports without a password) ── */}
        {step === "set-password" && userInfo && (
          <div className="space-y-5">
            <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={13} /> Back
            </button>

            <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-full hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {(userInfo.firstName || email)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111]">Hey {displayName}!</p>
                <p className="text-xs text-gray-500">Create a password to access your account</p>
              </div>
            </div>

            <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Create a password</label>
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
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={isPending || !password || !confirmPassword}
                className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {setInitialPassword.isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Setting up...</>
                  : <>Set Password & Post Job <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2c: New user — inline signup ─────────────────────── */}
        {step === "signup" && (
          <div className="space-y-5">
            <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={13} /> Back
            </button>

            <div>
              <p className="text-base font-black text-[#111] mb-0.5">Create your free account</p>
              <p className="text-xs text-gray-400">Just a few details and you're ready to post.</p>
            </div>

            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your name</label>
                <input
                  ref={fullNameRef}
                  type="text"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setError(""); }}
                  placeholder="First Last"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {companyLabel}
                  <span className="font-normal text-gray-400 ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder={`e.g. ${businessType === "Studio" ? "Broadway Dance Center" : businessType}`}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Create a password</label>
                <div className="relative">
                  <input
                    type={showSignupPw ? "text" : "password"}
                    value={signupPassword}
                    onChange={e => { setSignupPassword(e.target.value); setError(""); }}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    className="w-full px-4 py-3.5 pr-11 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                  />
                  <button type="button" onClick={() => setShowSignupPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSignupPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm password</label>
                <div className="relative">
                  <input
                    type={showSignupConfirm ? "text" : "password"}
                    value={signupConfirm}
                    onChange={e => { setSignupConfirm(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3.5 pr-11 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                  />
                  <button type="button" onClick={() => setShowSignupConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSignupConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={isPending || !fullName.trim() || !signupPassword || !signupConfirm}
                className="w-full py-4 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {studioOnboard.isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Creating account...</>
                  : <>Create Account & Post Job <ArrowRight size={15} /></>}
              </button>

              <p className="text-center text-xs text-gray-400">
                By creating an account you agree to our{" "}
                <a href="/terms" className="underline hover:text-gray-600">Terms</a>
                {" & "}
                <a href="/privacy-policy" className="underline hover:text-gray-600">Privacy Policy</a>
              </p>
            </form>
          </div>
        )}

        {/* ── Parsing: AI is extracting job details ─────────────────── */}
        {step === "parsing" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full hirer-grad-bg flex items-center justify-center mx-auto">
              <Loader2 size={24} className="text-white animate-spin" />
            </div>
            <div>
              <p className="text-base font-black text-[#111] mb-1">Setting up your job post...</p>
              <p className="text-sm text-gray-400">Our AI is reading your description — just a moment</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
