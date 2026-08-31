/*
 * PUBLIC BROWSE ARTISTS PAGE — /browse
 * Lets logged-out users discover artists on Artswrk.
 * Mirrors the /app/artists Browse tab layout with a sign-up CTA.
 */

import { useState } from "react";
import { Link } from "wouter";
import { Search, MapPin, Users, Loader2, ChevronRight, Sparkles, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatLocation } from "@/lib/utils";
import Navbar from "@/components/Navbar";

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
  if (firstName && lastName) return `${firstName} ${lastName[0]}.`;
  if (firstName) return firstName;
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return name;
  }
  return "Artist";
}

function getInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function getNameInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── WRK Experience Data ──────────────────────────────────────────────────────

type WrkArtist = { show: string; name: string; styles: string; rate: string; note?: string };

const WRK_ARTISTS: WrkArtist[] = [
  { show: "Back to the Future", name: "Brendan Sheehan", styles: "BTTF rep", rate: "$300 / 1.5 hrs" },
  { show: "Beauty and the Beast", name: "Danny Gardner", styles: "Tap, musical theater", rate: "$350–400/hr", note: "Lumiere · featured on DWTS!" },
  { show: "Beauty and the Beast", name: "Leigh-Ann Esty", styles: "Ballet, musical theater", rate: "$100+/hr" },
  { show: "Beetlejuice", name: "Nick Signor", styles: "Beetlejuice rep", rate: "$250 / 1.5 hrs" },
  { show: "Hamilton", name: "Kevin Murakami", styles: "Jazz, progressions, contemporary, musical theater, ballet", rate: "$300 / 1 hr + Q&A" },
  { show: "Hamilton", name: "Will Jewett", styles: "Hamilton rep", rate: "$300 / 1.5 hrs" },
  { show: "Hamilton", name: "Miriam Ali", styles: "Hamilton rep", rate: "$300 / 1.5 hrs" },
  { show: "Harry Potter and the Cursed Child", name: "Riley Bocchicchio", styles: "HPCC · Wand Dance combo", rate: "$350–500 / class" },
  { show: "MAMMA MIA!", name: "Sarah Agrusa", styles: "Musical theatre, tap, jazz, lyrical, contemporary, hip hop", rate: "$250 / 1.5 hrs" },
  { show: "MJ The Musical", name: "JoJo Carmichael", styles: "MJ rep", rate: "$300 / 1.5 hrs" },
  { show: "MJ The Musical", name: "Rachel Lockhart", styles: "MJ rep", rate: "$300 / 1.5 hrs" },
  { show: "MJ The Musical", name: "Tyrone Reese", styles: "MJ rep", rate: "$300 / 1.5 hrs" },
  { show: "MJ The Musical", name: "Justin Prescott", styles: "MJ rep, musical theatre jazz", rate: "$300 / 1.5 hrs" },
  { show: "Moulin Rouge!", name: "Amanda Mitchell", styles: "Moulin Rouge rep, jazz, contemporary", rate: "$350 / 1.5 hrs" },
  { show: "Moulin Rouge!", name: "Elyse Niederee", styles: "Jazz, musical theatre", rate: "$150/hr" },
  { show: "Moulin Rouge!", name: "Katie Lombardo", styles: "Moulin Rouge rep, Beetlejuice rep", rate: "$350 / 1.5 hrs + Q&A" },
  { show: "Moulin Rouge!", name: "Kenneth Michael Murray", styles: "Moulin Rouge, Anastasia, An American in Paris, Radio City, Paramour", rate: "$300–500 / class" },
  { show: "Moulin Rouge!", name: "Nathan Fister", styles: "Moulin Rouge rep, theatre jazz, jazz, ballet", rate: "$350 / 1.5 hrs" },
  { show: "Radio City Christmas Spectacular", name: "Alexis Payton", styles: "Precision jazz", rate: "" },
  { show: "Radio City Christmas Spectacular", name: "Meena Jay", styles: "Precision jazz", rate: "$150/hr" },
  { show: "Radio City Christmas Spectacular", name: "Christine Sienicki", styles: "Precision jazz", rate: "$250/hr" },
  { show: "SIX the Musical", name: "Reese Cameron", styles: "SIX rep", rate: "$250 / 1.5 hrs" },
  { show: "Spamalot", name: "Jack Brewer", styles: "Tap, musical theater jazz", rate: "$150–200/hr" },
  { show: "The Great Gatsby", name: "Anna Gassett", styles: "Musical theater, jazz, tap, lyrical, contemporary", rate: "$300 / class" },
  { show: "The Great Gatsby", name: "Dee Tomasetta", styles: "Gatsby rep (tap), musical theater, jazz", rate: "$300–500/hr" },
  { show: "The Lion King", name: "Brenae K. Thomas", styles: "Modern dance, Horton technique", rate: "$200 / 1.5 hrs" },
  { show: "The Lion King", name: "Shaquelle Charles", styles: "Lion King rep", rate: "" },
  { show: "The Lion King", name: "Ellen Akashi", styles: "Ballet/pointe, jazz, contemporary, modern", rate: "$200/hr" },
  { show: "The Lion King", name: "Eric Bean", styles: "Jazz, musical theater, lyrical, contemporary, modern (Horton)", rate: "$250–350/hr" },
  { show: "The Lion King", name: "Maia Schechter", styles: "Lion King rep, Moulin Rouge rep, contemporary", rate: "$250/hr" },
  { show: "The Lion King", name: "Maurice Dawkins", styles: "Contemporary, jazz, classical ballet", rate: "$200–250/hr" },
  { show: "The Lion King", name: "Yuka Notsuka", styles: "Jazz, theater jazz, Horton, contemporary, ballet", rate: "$200–275/hr" },
  { show: "The Outsiders", name: "John Peterson", styles: "Outsiders rep, jazz", rate: "$200/hr" },
  { show: "The Phantom of the Opera", name: "Jennifer Gruener", styles: "Phantom rep, West Side Story rep, ballet, musical theatre", rate: "$250/hr" },
  { show: "The Wiz", name: "Jesse Jones", styles: "Musical theatre, jazz, hip hop, modern", rate: "$200–250/hr" },
  { show: "Wicked", name: "Konnor Kelly", styles: "Wicked rep", rate: "$200/hr" },
  { show: "Wicked", name: "Reagan Davidson", styles: "Contemporary, jazz, lyrical, musical theater", rate: "$200/hr" },
  { show: "Wicked", name: "Sam Buchanan", styles: "Wicked rep", rate: "$300 / 1.5 hrs" },
];

const SHOW_BANNER: Record<string, string> = {
  "Back to the Future": "bg-yellow-500",
  "Beauty and the Beast": "bg-rose-500",
  "Beetlejuice": "bg-gray-900",
  "Hamilton": "bg-amber-800",
  "Harry Potter and the Cursed Child": "bg-indigo-700",
  "MAMMA MIA!": "bg-blue-500",
  "MJ The Musical": "bg-zinc-900",
  "Moulin Rouge!": "bg-red-600",
  "Radio City Christmas Spectacular": "bg-red-700",
  "SIX the Musical": "bg-purple-600",
  "Spamalot": "bg-green-600",
  "The Great Gatsby": "bg-emerald-600",
  "The Lion King": "bg-orange-500",
  "The Outsiders": "bg-stone-600",
  "The Phantom of the Opera": "bg-slate-900",
  "The Wiz": "bg-yellow-400",
  "Wicked": "bg-green-800",
};

// ─── WRK Artist Card ──────────────────────────────────────────────────────────

function WrkArtistCard({ artist }: { artist: WrkArtist }) {
  const bannerColor = SHOW_BANNER[artist.show] ?? "bg-gray-800";
  const initials = getNameInitials(artist.name);

  return (
    <a
      href={`mailto:contact@artswrk.com?subject=WRK%20Experience%20%E2%80%94%20${encodeURIComponent(artist.name)}&body=Hi%2C%20I%27m%20interested%20in%20booking%20a%20WRK%20Experience%20class%20with%20${encodeURIComponent(artist.name)}%20(${encodeURIComponent(artist.show)}).`}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all group block"
    >
      {/* Show banner */}
      <div className={`${bannerColor} px-4 py-2.5`}>
        <p className="text-white text-[10px] font-black uppercase tracking-widest truncate">{artist.show}</p>
      </div>

      <div className="p-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full ${bannerColor} flex items-center justify-center text-white text-sm font-black flex-shrink-0 opacity-90`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-[#111] leading-tight truncate">{artist.name}</p>
            {artist.note && <p className="text-[10px] text-[#F25722] font-semibold mt-0.5 truncate">{artist.note}</p>}
          </div>
        </div>

        {/* Styles */}
        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{artist.styles}</p>

        {/* Rate + CTA row */}
        <div className="flex items-center justify-between">
          {artist.rate ? (
            <p className="text-xs font-bold text-[#111]">{artist.rate}</p>
          ) : <span />}
          <span className="flex items-center gap-0.5 text-xs font-semibold text-[#F25722] group-hover:gap-1.5 transition-all">
            Book <ChevronRight size={11} />
          </span>
        </div>
      </div>
    </a>
  );
}

// ─── WRK Experience Grid ──────────────────────────────────────────────────────

function WrkExperienceGrid() {
  const [showFilter, setShowFilter] = useState("");
  const shows = Array.from(new Set(WRK_ARTISTS.map((a) => a.show))).sort();
  const filtered = showFilter ? WRK_ARTISTS.filter((a) => a.show === showFilter) : WRK_ARTISTS;

  return (
    <div>
      {/* Hero banner */}
      <div className="rounded-3xl bg-[#111] p-7 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 75% 50%, rgba(242,87,34,0.35) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-[11px] font-black tracking-widest text-[#FFBC5D] uppercase mb-2">✦ Artswrk Presents</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">The WRK Experience</h2>
          <p className="text-white/70 text-sm max-w-lg mb-6 leading-relaxed">
            An exclusive in-studio convention featuring cast members from Broadway's biggest shows. Book a master class with a Broadway professional and bring the stage to your studio.
          </p>
          <a
            href="mailto:contact@artswrk.com?subject=WRK%20Experience%20Booking%20Inquiry"
            className="inline-flex items-center gap-2 bg-[#F25722] text-white text-sm font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
          >
            <Star size={14} fill="white" /> Book a Class
          </a>
        </div>
      </div>

      {/* Show filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        <button
          onClick={() => setShowFilter("")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${!showFilter ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
        >
          All Shows
        </button>
        {shows.map((show) => (
          <button
            key={show}
            onClick={() => setShowFilter(showFilter === show ? "" : show)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${showFilter === show ? "bg-[#F25722] text-white border-[#F25722]" : "bg-white text-gray-600 border-gray-200 hover:border-[#F25722] hover:text-[#F25722]"}`}
          >
            {show}
          </button>
        ))}
      </div>

      {/* Artist count */}
      <p className="text-xs text-gray-400 mb-4">
        <span className="font-bold text-[#111]">{filtered.length}</span> artist{filtered.length !== 1 ? "s" : ""}
        {showFilter ? ` from ${showFilter}` : " confirmed"}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((artist, i) => (
          <WrkArtistCard key={i} artist={artist} />
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-10">
        Are you a Broadway professional?{" "}
        <a
          href="mailto:contact@artswrk.com?subject=WRK%20Experience%20Artist%20Inquiry"
          className="text-[#F25722] font-semibold hover:opacity-70"
        >
          Apply to join the roster →
        </a>
      </p>
    </div>
  );
}

// ─── Service type pills (static — no live product-side lookup table yet) ─────

const SERVICE_TYPES = [
  "Competition Choreography", "Substitute Teacher", "Recurring Classes",
  "Private Lessons", "Master Classes", "Photoshoot", "Videoshoot",
  "Dance Competition Judge", "Acting Coach", "Vocal Coach",
  "Event Choreography", "Event Performers", "Yoga Instructor", "Pilates Instructor",
];

// ─── Artist Card ──────────────────────────────────────────────────────────────

function ArtistCard({ artist, blurred }: { artist: any; blurred?: boolean }) {
  const displayName = getDisplayName(artist.firstName, artist.lastName, artist.name);
  const primaryType = artist.typeNames?.[0] ?? "";
  const initials = getInitials(artist.firstName, artist.lastName, artist.name);
  const color = getArtistColor(artist.firstName ?? artist.name);

  return (
    <Link href="/join">
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
              <MapPin size={10} className="flex-shrink-0" />{formatLocation(artist.location)}
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
  const [mode, setMode] = useState<"all" | "wrk">("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.artists.browse.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    artistType: roleFilter || undefined,
  }, { enabled: mode === "all" });

  const { data: typeCounts } = trpc.artists.getArtistTypeCounts.useQuery();
  const roles = (typeCounts ?? []).map((t) => t.type);

  const artists = data?.artists ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const VISIBLE_COUNT = 24;

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleRole = (r: string) => { setRoleFilter(r); setPage(0); };

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />

      {/* Page header */}
      <div className="pt-24 pb-6 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-2">Artswrk Network</p>
            <h1 className="text-3xl md:text-4xl font-black text-[#111]">Browse Artists</h1>
            {mode === "all" && total > 0 && (
              <p className="text-gray-400 text-sm mt-1">
                <span className="font-bold text-[#111]">{total.toLocaleString()}</span> artists available
              </p>
            )}
          </div>
          <Link
            href="/join"
            className="inline-flex items-center gap-2 hirer-grad-bg text-white text-sm font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Sparkles size={15} />
            Join Free to Connect
          </Link>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-0 mb-6">
          <button
            onClick={() => setMode("all")}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px ${
              mode === "all"
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            All Artists
          </button>
          <button
            onClick={() => setMode("wrk")}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px flex items-center gap-1.5 ${
              mode === "wrk"
                ? "border-[#F25722] text-[#F25722]"
                : "border-transparent text-gray-400 hover:text-[#F25722]"
            }`}
          >
            <Star size={13} className={mode === "wrk" ? "fill-[#F25722]" : ""} />
            WRK Experience
          </button>
        </div>

        {/* Search + filters (All Artists only) */}
        {mode === "all" && (
          <>
            <div className="relative mb-5">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search artists by name or keyword..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => handleRole("")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                  !roleFilter ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                All
              </button>
              {roles.map((role) => (
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
          </>
        )}
      </div>

      {/* Main content */}
      <div className="px-5 lg:px-10 max-w-7xl mx-auto pb-20">
        {mode === "wrk" ? (
          <WrkExperienceGrid />
        ) : (
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
                          href="/join"
                          className="bg-white text-[#F25722] font-bold text-sm px-8 py-3 rounded-full hover:bg-orange-50 transition-colors"
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

              {/* WRK Experience promo */}
              <div className="bg-[#111] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 20%, rgba(242,87,34,0.4) 0%, transparent 60%)" }} />
                <div className="relative z-10">
                  <p className="text-[10px] font-black tracking-widest text-[#FFBC5D] uppercase mb-1.5">✦ Featured</p>
                  <p className="text-sm font-black text-white mb-1">The WRK Experience</p>
                  <p className="text-xs text-white/60 mb-3">Broadway master classes at your studio.</p>
                  <button
                    onClick={() => setMode("wrk")}
                    className="w-full py-2 rounded-xl text-xs font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity"
                  >
                    View Artists →
                  </button>
                </div>
              </div>

              {/* Sign-up CTA */}
              <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
                <p className="text-sm font-black text-[#111] mb-1">Ready to hire?</p>
                <p className="text-xs text-gray-500 mb-4">Post a FREE job and get applicants fast.</p>
                <Link
                  href="/post-job"
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  ☆ Post a Job →
                </Link>
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
        )}
      </div>
    </div>
  );
}
