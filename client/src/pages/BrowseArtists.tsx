/*
 * PUBLIC BROWSE ARTISTS PAGE — /browse
 * Lets logged-out users discover artists on Artswrk.
 * Mirrors the /app/artists Browse tab layout with a sign-up CTA.
 */

import { useState } from "react";
import { Link } from "wouter";
import { Search, MapPin, Users, Loader2, ChevronRight, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { getLoginUrl } from "@/const";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
  "bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-lime-500",
];

function getArtistColor(seed: string | null | undefined) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getDisplayName(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (name) return name;
  return "Artist";
}

function getInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

// ─── Role filter pills ────────────────────────────────────────────────────────

const ROLES = [
  "Dance Educator", "Choreographer", "Dancer", "Movement Director",
  "Photographer", "Dance Adjudicator", "Videographer", "Acting Coach",
  "Vocal Coach", "Music Teacher", "Yoga Instructor", "Pilates Instructor",
];

const SERVICE_TYPES = [
  "Competition Choreography", "Substitute Teacher", "Recurring Classes",
  "Private Lessons", "Master Classes", "Photoshoot", "Videoshoot",
  "Dance Competition Judge", "Acting Coach", "Vocal Coach",
  "Event Choreography", "Event Performers", "Yoga Instructor", "Pilates Instructor",
];

// ─── Artist Card ──────────────────────────────────────────────────────────────

function ArtistCard({ artist, blurred }: { artist: any; blurred?: boolean }) {
  const displayName = getDisplayName(artist.firstName, artist.lastName, artist.name);
  const primaryType = (() => {
    try { return JSON.parse(artist.masterArtistTypes ?? "[]")[0] ?? ""; } catch { return ""; }
  })();
  const initials = getInitials(artist.firstName, artist.lastName, artist.name);
  const color = getArtistColor(artist.firstName ?? artist.name);

  return (
    <Link href={getLoginUrl()}>
      <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer relative ${blurred ? "opacity-60" : ""}`}>
        <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
          {artist.profilePicture ? (
            <img
              src={artist.profilePicture}
              alt={displayName}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const fb = el.nextElementSibling as HTMLElement;
                if (fb) fb.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`w-full h-full ${color} flex items-center justify-center text-white text-4xl font-black`}
            style={{ display: artist.profilePicture ? "none" : "flex" }}
          >
            {initials}
          </div>
          {artist.artswrkPro && (
            <div className="absolute top-2.5 right-2.5">
              <span className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide">PRO</span>
            </div>
          )}
          {blurred && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center px-3">
                <Sparkles size={20} className="mx-auto mb-1 text-[#F25722]" />
                <p className="text-xs font-bold text-[#111]">Join to view</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-bold text-[#111] truncate">{displayName}</p>
          {artist.location && (
            <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1">
              <MapPin size={10} className="flex-shrink-0" />{artist.location}
            </p>
          )}
          {primaryType && (
            <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ec008c]/10 text-[#ec008c]">
              {primaryType}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 48;

export default function BrowseArtists() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.artists.browse.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    artistType: roleFilter || undefined,
  });

  const artists = data?.artists ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Show first 24 clearly, blur the rest as a teaser
  const VISIBLE_COUNT = 24;

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleRole = (r: string) => { setRoleFilter(r); setPage(0); };

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />

      {/* Page header */}
      <div className="pt-24 pb-8 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-2">Artswrk Network</p>
            <h1 className="text-3xl md:text-4xl font-black text-[#111]">Browse Artists</h1>
            {total > 0 && (
              <p className="text-gray-400 text-sm mt-1">
                <span className="font-bold text-[#111]">{total.toLocaleString()}</span> artists available
              </p>
            )}
          </div>
          <Link
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 hirer-grad-bg text-white text-sm font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Sparkles size={15} />
            Join Free to Connect
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search artists by name or keyword..."
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white shadow-sm"
          />
        </div>

        {/* Role filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => handleRole("")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
              !roleFilter ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            All
          </button>
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => handleRole(roleFilter === role ? "" : role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                roleFilter === role
                  ? "bg-[#F25722] text-white border-[#F25722]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#F25722] hover:text-[#F25722]"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="px-5 lg:px-10 max-w-7xl mx-auto pb-20">
        <div className="flex gap-8">
          {/* Artist grid */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 text-gray-400">
                <Loader2 size={24} className="animate-spin mr-3" />
                <span className="text-sm">Loading artists...</span>
              </div>
            ) : artists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Users size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No artists found</p>
                <button
                  onClick={() => { handleSearch(""); handleRole(""); }}
                  className="mt-2 text-xs text-[#F25722] font-semibold hover:opacity-70"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {artists.map((a, idx) => (
                    <ArtistCard
                      key={a.id}
                      artist={a}
                      blurred={idx >= VISIBLE_COUNT}
                    />
                  ))}
                </div>

                {/* Sign-up CTA banner after first 24 */}
                {artists.length > VISIBLE_COUNT && (
                  <div className="mt-8 rounded-3xl hirer-grad-bg p-8 text-center text-white">
                    <Sparkles size={28} className="mx-auto mb-3 opacity-80" />
                    <h2 className="text-2xl font-black mb-2">
                      See all {total.toLocaleString()}+ artists
                    </h2>
                    <p className="text-white/80 text-sm mb-6 max-w-md mx-auto">
                      Create a free account to browse full profiles, message artists directly, and post your first job in under 60 seconds.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link
                            href={getLoginUrl()}
                className="bg-white text-[#F25722]722] font-bold text-sm px-8 py-3 rounded-full hover:bg-orange-50 transition-colors"
                      >
                        Join Free — It's Quick
                      </Link>
                      <Link
                        href="/login"
                        className="text-white/80 text-sm font-medium hover:text-white transition-colors"
                      >
                        Already have an account? Log in →
                      </Link>
                    </div>
                  </div>
                )}

                {/* Pagination (only when logged in / showing all) */}
                {totalPages > 1 && artists.length <= VISIBLE_COUNT && (
                  <div className="flex items-center justify-center gap-3 mt-8">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div className="hidden lg:flex flex-col gap-4 w-60 flex-shrink-0">
            {/* Sign-up CTA */}
            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
              <p className="text-sm font-black text-[#111] mb-1">Ready to hire?</p>
              <p className="text-xs text-gray-500 mb-4">Post a FREE job and get applicants fast.</p>
              <Link
                 href={getLoginUrl()}
              className="w-full py-2.55 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                ☆ Post a Job →
              </Link>
            </div>

            {/* Service type filter */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Type</p>
              <select
                onChange={(e) => handleRole(e.target.value)}
                value={roleFilter}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
              >
                <option value="">All Service Types</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Platform Stats</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total Artists</span>
                  <span className="text-sm font-black text-[#111]">6,000+</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Cities</span>
                  <span className="text-sm font-black text-[#111]">50+</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Avg. Response</span>
                  <span className="text-sm font-black text-[#111]">24 hrs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
