/*
 * ARTSWRK RESET PASSWORD PAGE
 * Validates the token from the URL and lets the user set a new password.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setError("No reset token found. Please request a new password reset link.");
    } else {
      setToken(t);
    }
  }, []);

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      // Redirect to login after 2.5 seconds
      setTimeout(() => navigate("/login"), 2500);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Something went wrong. Please try again.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    resetPassword.mutate({ token, password });
  }

  const loading = resetPassword.isPending;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <a href="/" className="flex items-center select-none mb-10">
        <span className="font-black text-2xl tracking-tight hirer-grad-text">ARTS</span>
        <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
      </a>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {success ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h1 className="text-2xl font-black text-[#111] mb-2">Password updated!</h1>
              <p className="text-gray-500 text-sm">
                Your password has been reset. Redirecting you to sign in…
              </p>
            </div>
          ) : !token ? (
            /* ── No token / invalid link ── */
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <XCircle size={28} className="text-red-400" />
              </div>
              <h1 className="text-2xl font-black text-[#111] mb-2">Invalid link</h1>
              <p className="text-gray-500 text-sm mb-6">{error}</p>
              <a
                href="/forgot-password"
                className="text-sm font-semibold text-[#F25722] hover:opacity-80 transition-opacity underline underline-offset-2"
              >
                Request a new reset link
              </a>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h1 className="text-2xl font-black text-[#111] mb-1">Set new password</h1>
              <p className="text-gray-500 text-sm mb-7">
                Choose a strong password — at least 8 characters.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoFocus
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      required
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
