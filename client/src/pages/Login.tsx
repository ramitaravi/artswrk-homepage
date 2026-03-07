/*
 * ARTSWRK LOGIN PAGE
 * Uses tRPC auth.demoLogin mutation → creates real JWT session cookie
 * Font: Poppins
 * Hirer gradient: #FFBC5D → #F25722
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Sparkles, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: () => {
      navigate("/dashboard");
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Invalid email or password.");
    },
  });

  function fillDemo() {
    setEmail("nick+ferrari@artswrk.com");
    setPassword("ArtswrkDemo2024");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    passwordLogin.mutate({ email: email.trim().toLowerCase(), password });
  }

  const loading = passwordLogin.isPending;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <a href="/" className="flex items-center select-none mb-10">
        <span className="font-black text-2xl tracking-tight hirer-grad-text">ARTS</span>
        <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
      </a>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h1 className="text-2xl font-black text-[#111] mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-7">Sign in to your Artswrk account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input
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

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
              Forgot password?
            </a>
          </div>
        </div>

        {/* Demo account box */}
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[#F25722]" />
            <p className="text-xs font-bold text-[#111]">Try the demo account</p>
          </div>
          <div className="space-y-1 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Email</span>
              <span className="font-mono font-semibold text-[#111]">nick+ferrari@artswrk.com</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Password</span>
              <span className="font-mono font-semibold text-[#111]">ArtswrkDemo2024</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Account</span>
              <span className="font-semibold text-[#111]">Phyllis F · Ferrari Dance Center NYC</span>
            </div>
          </div>
          <button
            onClick={fillDemo}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
          >
            Fill Demo Credentials →
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Don't have an account?{" "}
          <a href="#" className="font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
            Sign up free
          </a>
        </p>
      </div>
    </div>
  );
}
