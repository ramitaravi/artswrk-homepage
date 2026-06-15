/**
 * Shared auth-aware Navbar used across all pages.
 * Shows logged-in banner + logout when authenticated,
 * Login/Join buttons when logged out.
 */

import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artswrk-logo-gradient_8e560567.png";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hirersOpen, setHirersOpen] = useState(false);
  const [artistsOpen, setArtistsOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Timeout refs to delay closing so users can move mouse into the dropdown
  const hirersTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artistsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openHirers() {
    if (hirersTimeout.current) clearTimeout(hirersTimeout.current);
    setHirersOpen(true);
  }
  function closeHirers() {
    hirersTimeout.current = setTimeout(() => setHirersOpen(false), 120);
  }
  function openArtists() {
    if (artistsTimeout.current) clearTimeout(artistsTimeout.current);
    setArtistsOpen(true);
  }
  function closeArtists() {
    artistsTimeout.current = setTimeout(() => setArtistsOpen(false), 120);
  }

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      navigate("/");
      window.location.reload();
    },
  });

  // Display name: prefer firstName + lastName, fall back to name or email
  const displayName = user
    ? (user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user as any).name || user.email)
    : "";
  const accountLabel = (user as any)?.clientCompanyName || (user as any)?.location || "";

  return (
    <>
      {/* Logged-in account banner */}
      {isAuthenticated && user && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-[#111] text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          <span>
            Logged in as <span className="font-bold">{displayName}</span>
            {accountLabel ? <span className="text-white/60"> · {accountLabel}</span> : null}
          </span>
          <Link href="/app" className="ml-3 flex items-center gap-1 text-white/70 hover:text-white transition-colors underline underline-offset-2">
            <LayoutDashboard size={11} /> Dashboard
          </Link>
        </div>
      )}

      <nav className={`fixed left-0 right-0 z-50 bg-white border-b border-gray-100 ${isAuthenticated && user ? "top-7" : "top-0"}`}>
        <div className="mx-auto px-5 lg:px-10 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            {/* Logo — goes to /app when logged in */}
            <a href={isAuthenticated ? "/app" : "/"} className="flex items-center select-none">
              <img src={LOGO_URL} alt="Artswrk" className="h-9 w-auto" />
            </a>

            <div className="hidden md:flex items-center gap-6">
              <Link href="/jobs" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Jobs</Link>
              <Link href="/browse" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Browse Artists</Link>
              <Link href="/about" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">About</Link>

              {/* For Hirers dropdown */}
              <div
                className="relative"
                onMouseEnter={openHirers}
                onMouseLeave={closeHirers}
              >
                <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black transition-colors py-2">
                  For Hirers <ChevronDown size={14} className={`transition-transform ${hirersOpen ? "rotate-180" : ""}`} />
                </button>
                {hirersOpen && (
                  <div
                    className="absolute top-full left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                    onMouseEnter={openHirers}
                    onMouseLeave={closeHirers}
                  >
                    <a href="/post-job" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">Post a Job</a>
                    <a href="/jobs" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">Browse Artists</a>
                    <a href="/dance-competitions" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">Dance Competitions</a>
                    <a href="/dance-studios" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">Dance Studios</a>
                    <a href="/music-schools" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">Music Schools</a>
                  </div>
                )}
              </div>

              {/* For Artists dropdown */}
              <div
                className="relative"
                onMouseEnter={openArtists}
                onMouseLeave={closeArtists}
              >
                <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black transition-colors py-2">
                  For Artists <ChevronDown size={14} className={`transition-transform ${artistsOpen ? "rotate-180" : ""}`} />
                </button>
                {artistsOpen && (
                  <div
                    className="absolute top-full left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                    onMouseEnter={openArtists}
                    onMouseLeave={closeArtists}
                  >
                    <a href="/login" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">Create Profile</a>
                    <a href="/jobs" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">Find Jobs</a>
                    <a href="/dance-teachers" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">Dance Teachers</a>
                    <a href="/dance-judges" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">Dance Judges</a>
                    <a href="/music-teachers" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">Music Teachers</a>
                    <a href="/production" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">Production</a>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated && user ? (
                <button
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  <LogOut size={14} />
                  {logout.isPending ? "Logging out…" : "Log Out"}
                </button>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Login</Link>
                  <Link href="/join" className="text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full hover:bg-gray-800 transition-colors">Join</Link>
                </>
              )}
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-3">
            <a href="/jobs" className="block text-sm font-medium text-gray-700 py-1">Jobs</a>
            <a href="/browse" className="block text-sm font-medium text-gray-700 py-1">Browse Artists</a>
            <a href="/about" className="block text-sm font-medium text-gray-700 py-1">About</a>
            <a href="/dance-competitions" className="block text-sm font-medium text-gray-700 py-1">Dance Competitions</a>
            <a href="/dance-studios" className="block text-sm font-medium text-gray-700 py-1">Dance Studios</a>
            <a href="/music-schools" className="block text-sm font-medium text-gray-700 py-1">Music Schools</a>
            <a href="/dance-teachers" className="block text-sm font-medium text-gray-700 py-1">Dance Teachers</a>
            <a href="/dance-judges" className="block text-sm font-medium text-gray-700 py-1">Dance Judges</a>
            <a href="/music-teachers" className="block text-sm font-medium text-gray-700 py-1">Music Teachers</a>
            <a href="/production" className="block text-sm font-medium text-gray-700 py-1">Production</a>
            <div className="flex gap-3 pt-2">
              {isAuthenticated && user ? (
                <button
                  onClick={() => logout.mutate()}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full"
                >
                  <LogOut size={14} /> Log Out
                </button>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-gray-700">Login</Link>
                  <Link href="/join" className="text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full">Join</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
