/*
 * ARTSWRK FORGOT PASSWORD PAGE
 * Sends a password reset email with a 1-hour expiring link.
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Something went wrong. Please try again.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    forgotPassword.mutate({
      email: email.trim().toLowerCase(),
      origin: window.location.origin,
    });
  }

  const loading = forgotPassword.isPending;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center px-4 pt-28 pb-12">
      <Navbar />

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {submitted ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h1 className="text-2xl font-black text-[#111] mb-2">Check your inbox</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                If an account exists for <span className="font-semibold text-[#111]">{email}</span>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Didn't receive it? Check your spam folder, or{" "}
                <button
                  onClick={() => { setSubmitted(false); setEmail(""); }}
                  className="text-[#F25722] underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  try again
                </button>.
              </p>
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#111] transition-colors"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h1 className="text-2xl font-black text-[#111] mb-1">Forgot your password?</h1>
              <p className="text-gray-500 text-sm mb-7">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#111] transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
