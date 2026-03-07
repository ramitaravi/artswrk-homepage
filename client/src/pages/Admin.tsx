/*
 * ARTSWRK ADMIN PAGE — /admin
 * Owner-only panel for managing user passwords and accounts.
 * Protected: only accessible when logged in as the app owner.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, Search, Key, CheckCircle2, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Admin() {
  const { user, loading } = useAuth();

  const [searchEmail, setSearchEmail] = useState("");
  const [queriedEmail, setQueriedEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isTemporary, setIsTemporary] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Look up the user by email
  const userQuery = trpc.artswrkUsers.getByEmail.useQuery(
    { email: queriedEmail! },
    { enabled: !!queriedEmail }
  );

  // Set password mutation
  const setPasswordMutation = trpc.admin.setPassword.useMutation({
    onSuccess: (data) => {
      setSuccessMsg(data.message);
      setNewPassword("");
      setConfirmPassword("");
      setErrorMsg("");
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to set password.");
      setSuccessMsg("");
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setQueriedEmail(searchEmail.trim().toLowerCase());
  }

  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setPasswordMutation.mutate({
      email: queriedEmail!,
      password: newPassword,
      isTemporary,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-6 h-6 border-2 border-[#F25722]/40 border-t-[#F25722] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <Shield size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">You must be logged in to access this page.</p>
          <Link href="/login">
            <button className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hirer-grad-bg">
              Go to Login
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const foundUser = userQuery.data;

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-10">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard">
            <button className="p-2 rounded-xl text-gray-400 hover:bg-white hover:text-gray-700 transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#111]">Admin Panel</h1>
              <p className="text-xs text-gray-400">Logged in as {user.email}</p>
            </div>
          </div>
        </div>

        {/* Step 1: Look up user */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2">
            <Search size={15} className="text-[#F25722]" />
            Step 1 — Find User
          </h2>
          <p className="text-xs text-gray-400 mb-4">Enter the email address of the account you want to manage.</p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hirer-grad-bg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Look Up
            </button>
          </form>

          {/* User result */}
          {queriedEmail && (
            <div className="mt-4">
              {userQuery.isLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin" />
                  Looking up user...
                </div>
              )}

              {userQuery.isSuccess && !foundUser && (
                <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">
                  <AlertCircle size={14} />
                  No user found with email <strong>{queriedEmail}</strong>
                </div>
              )}

              {foundUser && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full hirer-grad-bg flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5">
                    {((foundUser.firstName || foundUser.name || "?")[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111]">
                      {foundUser.firstName && foundUser.lastName
                        ? `${foundUser.firstName} ${foundUser.lastName}`
                        : foundUser.name || foundUser.email}
                    </p>
                    <p className="text-xs text-gray-500">{foundUser.email}</p>
                    {foundUser.clientCompanyName && (
                      <p className="text-xs text-gray-400">{foundUser.clientCompanyName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        foundUser.userRole === "Client"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-pink-100 text-pink-600"
                      }`}>
                        {foundUser.userRole || "User"}
                      </span>
                      {foundUser.clientPremium && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
                          Premium
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        foundUser.passwordHash
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {foundUser.passwordHash ? "Has password" : "No password set"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Set password (only shown when a user is found) */}
        {foundUser && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2">
              <Key size={15} className="text-[#F25722]" />
              Step 2 — Set Password
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Set a password for <strong>{foundUser.email}</strong>. They can use this to log in immediately.
            </p>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <input
                  type="checkbox"
                  id="isTemporary"
                  checked={isTemporary}
                  onChange={(e) => setIsTemporary(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#F25722]"
                />
                <label htmlFor="isTemporary" className="text-xs text-gray-600 cursor-pointer">
                  <span className="font-semibold text-[#111]">Mark as temporary</span>
                  {" "}— user will be prompted to change it on next login
                </label>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-green-700">
                  <CheckCircle2 size={14} className="flex-shrink-0" />
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={setPasswordMutation.isPending}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {setPasswordMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  <>
                    <Key size={15} />
                    Set Password for {foundUser.firstName || foundUser.email?.split("@")[0]}
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
