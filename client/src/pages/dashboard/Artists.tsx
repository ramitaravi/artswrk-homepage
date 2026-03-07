/*
 * ARTSWRK DASHBOARD — ARTISTS
 * Three tabs: Discover (default) | Browse Artists | My Artists
 * Discover matches the original Artswrk Bubble app layout:
 *   - Spotlight cards with color overlays
 *   - Search bar
 *   - Roles filter pills
 *   - Artist grid
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search, Users, ChevronRight, Loader2, AlertCircle,
  CheckCircle2, XCircle, DollarSign, Clock, FileText, ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function getInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function ArtistAvatar({ firstName, lastName, name, profilePicture, seed, size = "md" }: {
  firstName?: string | null; lastName?: string | null; name?: string | null;
  profilePicture?: string | null; seed?: string | null; size?: "sm" | "md" | "lg";
}) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-base" : "w-10 h-10 text-sm";
  const initials = getInitials(firstName, lastName, name);
  const color = getArtistColor(seed ?? firstName);
  if (profilePicture) {
    return (
      <img src={profilePicture} alt={firstName ?? name ?? "Artist"}
        className={`${sz} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fb = el.nextElementSibling as HTMLElement;
          if (fb) fb.style.display = "flex";
        }}
      />
    );
  }
  return (
    <div className={`${sz} rounded-full ${color} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg = {
    Confirmed: { cls: "bg-blue-100 text-blue-700", icon: <CheckCircle2 size={11} /> },
    Declined: { cls: "bg-red-100 text-red-600", icon: <XCircle size={11} /> },
    Interested: { cls: "bg-orange-50 text-[#F25722]", icon: null },
  }[status ?? ""] ?? { cls: "bg-gray-100 text-gray-500", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon}{status ?? "Unknown"}
    </span>
  );
}

// ─── Spotlight data ───────────────────────────────────────────────────────────

const SPOTLIGHT_GROUPS = [
  {
    title: "Broadway Dance Center Faculty",
    count: 24,
    color: "from-purple-600/80 to-purple-900/80",
    bg: "bg-purple-700",
    image: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&q=80",
  },
  {
    title: "Acrobatic Arts Certified Teachers",
    count: 18,
    color: "from-green-500/80 to-teal-700/80",
    bg: "bg-green-600",
    image: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&q=80",
  },
  {
    title: "Alvin Ailey Certified",
    count: 31,
    color: "from-orange-500/80 to-orange-700/80",
    bg: "bg-orange-500",
    image: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&q=80",
  },
  {
    title: "Broadway Performers",
    count: 42,
    color: "from-pink-600/80 to-rose-800/80",
    bg: "bg-pink-600",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
  },
];

const ROLES = [
  "Dance Educator", "Choreographer", "Dancer", "Movement Director",
  "Photographer", "Dance Adjudicator", "Videographer", "Acting Coach",
  "Vocal Coach", "Music Teacher", "Yoga Instructor", "Pilates Instructor",
];

// ─── Discover Tab ─────────────────────────────────────────────────────────────

function DiscoverTab({ onBrowse }: { onBrowse: (role?: string) => void }) {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  // Use the artists already in our DB (from interested_artists + bookings)
  const { data: allApplicants } = trpc.applicants.myApplicants.useQuery({ limit: 200 });

  // Derive unique artists from applicants for the "featured" grid
  const uniqueArtists = useMemo(() => {
    if (!allApplicants) return [];
    const seen = new Set<string>();
    return allApplicants.filter((a) => {
      const key = (a as any).bubbleArtistId ?? String(a.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allApplicants]);

  const filteredArtists = useMemo(() => {
    if (!search) return uniqueArtists.slice(0, 12);
    const q = search.toLowerCase();
    return uniqueArtists.filter((a) => {
      const name = [(a as any).artistFirstName, (a as any).artistLastName, (a as any).artistName]
        .filter(Boolean).join(" ").toLowerCase();
      return name.includes(q);
    }).slice(0, 24);
  }, [uniqueArtists, search]);

  return (
    <div className="space-y-8">
      {/* Discover header */}
      <div>
        <h2 className="text-2xl font-black text-[#111] mb-6">Discover</h2>

        {/* Spotlight */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#111]">Spotlight</h3>
          <button className="text-sm text-gray-400 hover:text-gray-600 transition-colors">View all</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {SPOTLIGHT_GROUPS.map((group) => (
            <button
              key={group.title}
              onClick={() => onBrowse()}
              className="relative rounded-2xl overflow-hidden aspect-[3/4] group cursor-pointer text-left"
            >
              {/* Background image */}
              <img
                src={group.image}
                alt={group.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Color overlay */}
              <div className={`absolute inset-0 bg-gradient-to-b ${group.color}`} />
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-xs font-bold tracking-widest uppercase text-white/70 mb-1">Spotlight</p>
                <p className="text-base font-black leading-snug mb-2">{group.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">{group.count} Artists</span>
                  <ChevronRight size={16} className="text-white/60 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search artists by name or keyword..."
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white shadow-sm"
          />
        </div>

        {/* Roles */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#111]">Roles</h3>
          <button className="text-sm text-gray-400 hover:text-gray-600 transition-colors">View all</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-8">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => onBrowse(role)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-[#111] bg-white hover:border-[#F25722] hover:text-[#F25722] transition-all"
            >
              {role}
            </button>
          ))}
        </div>

        {/* Artists from your network */}
        {uniqueArtists.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#111]">
                {search ? "Search Results" : "Artists You've Worked With"}
              </h3>
              {!search && (
                <button onClick={() => onBrowse()} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  View all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredArtists.map((a) => {
                const firstName = (a as any).artistFirstName as string | null;
                const lastName = (a as any).artistLastName as string | null;
                const name = (a as any).artistName as string | null;
                const photo = (a as any).artistProfilePicture as string | null;
                const slug = (a as any).artistSlug as string | null;
                const displayName = firstName && lastName ? `${firstName} ${lastName}` : name ?? "Artist";
                const role = (a as any).artistType ?? "Artist";

                const artistUserId = (a as any).artistUserId as number | null;
                return (
                  <div key={a.id}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                    onClick={() => artistUserId && navigate(`/dashboard/artists/${artistUserId}`)}
                  >
                    {/* Photo */}
                    <div className="aspect-[4/5] relative overflow-hidden bg-gray-100">
                      {photo ? (
                        <img src={photo} alt={displayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "none";
                            const fb = el.nextElementSibling as HTMLElement;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full ${getArtistColor(firstName)} flex items-center justify-center text-white text-3xl font-black`}
                        style={{ display: photo ? "none" : "flex" }}
                      >
                        {getInitials(firstName, lastName, name)}
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <p className="text-sm font-bold text-[#111] truncate">{displayName}</p>
                      {slug && <p className="text-xs text-gray-400 truncate">@{slug}</p>}
                      {role && role !== "Artist" && (
                        <span className="mt-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-semibold artist-grad-bg text-white">
                          {role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Organization tabs data ──────────────────────────────────────────────────

const ORG_TABS = [
  { key: "all", label: "All Artists", logo: null },
  {
    key: "cli",
    label: "CLI Conservatory",
    logo: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=80&q=80",
    logoText: "CLI",
    color: "bg-purple-600",
  },
  {
    key: "acro",
    label: "Acrobatic Arts",
    logo: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=80&q=80",
    logoText: "AA",
    color: "bg-green-600",
  },
  {
    key: "rider",
    label: "Rider University",
    logo: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=80&q=80",
    logoText: "RU",
    color: "bg-red-700",
  },
  {
    key: "wisc",
    label: "Univ. of Wisconsin",
    logo: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=80&q=80",
    logoText: "UW",
    color: "bg-red-800",
  },
  {
    key: "broadway",
    label: "Broadway Alumni",
    logo: null,
    logoText: "BA",
    color: "bg-amber-600",
  },
];

const SERVICE_TYPES = [
  "Competition Choreography", "Substitute Teacher", "Recurring Classes",
  "Private Lessons", "Master Classes", "Photoshoot", "Videoshoot",
  "Dance Competition Judge", "Acting Coach", "Vocal Coach",
  "Event Choreography", "Event Performers", "Yoga Instructor", "Pilates Instructor",
];

// ─── Browse Artists Tab ───────────────────────────────────────────────────────

function BrowseArtistsTab({ initialRole }: { initialRole?: string }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(initialRole ?? "");
  const [orgTab, setOrgTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [serviceType, setServiceType] = useState("");
  const [, navigate] = useLocation();

  const { data: allApplicants, isLoading } = trpc.applicants.myApplicants.useQuery({ limit: 200 });

  const uniqueArtists = useMemo(() => {
    if (!allApplicants) return [];
    const seen = new Set<string>();
    return allApplicants.filter((a) => {
      const key = (a as any).bubbleArtistId ?? String(a.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allApplicants]);

  const filtered = useMemo(() => {
    return uniqueArtists.filter((a) => {
      const firstName = (a as any).artistFirstName as string | null;
      const lastName = (a as any).artistLastName as string | null;
      const name = (a as any).artistName as string | null;
      const fullName = [firstName, lastName, name].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !search || fullName.includes(search.toLowerCase());
      const artistType = ((a as any).artistType ?? "").toLowerCase();
      const matchesRole = !roleFilter || artistType.includes(roleFilter.toLowerCase());
      const matchesService = !serviceType || artistType.includes(serviceType.toLowerCase());
      return matchesSearch && matchesRole && matchesService;
    });
  }, [uniqueArtists, search, roleFilter, serviceType]);

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-bold text-[#111]">{filtered.length}</span> artists available near you
          </p>
          {/* Grid / List toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"
              }`}
              title="Grid view"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="0" y="0" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="8" y="0" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="0" y="8" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "list" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"
              }`}
              title="List view"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="0" y="0" width="14" height="2.5" rx="1" fill="currentColor"/>
                <rect x="0" y="5.5" width="14" height="2.5" rx="1" fill="currentColor"/>
                <rect x="0" y="11" width="14" height="2.5" rx="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search artists by name or keyword..."
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white shadow-sm"
          />
        </div>

        {/* Organization tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {ORG_TABS.map((org) => (
            <button
              key={org.key}
              onClick={() => setOrgTab(org.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                orgTab === org.key
                  ? "border-[#111] bg-[#111] text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              {org.logo ? (
                <img src={org.logo} alt={org.label} className="w-5 h-5 rounded object-cover" />
              ) : org.logoText ? (
                <span className={`w-5 h-5 rounded text-white text-xs font-black flex items-center justify-center ${
                  orgTab === org.key ? "bg-white/20" : (org as any).color ?? "bg-gray-400"
                }`}>{org.logoText}</span>
              ) : null}
              {org.label}
            </button>
          ))}
        </div>

        {/* Role filter pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setRoleFilter("")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
              !roleFilter ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            All
          </button>
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
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

        {/* Artist grid or list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-3" />
            <span className="text-sm">Loading artists...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No artists found</p>
            <button onClick={() => { setSearch(""); setRoleFilter(""); setServiceType(""); }} className="mt-2 text-xs text-[#F25722] font-semibold hover:opacity-70">
              Clear filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          // ── Grid view: 3 cols on md, 4 on lg ──
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {filtered.map((a) => {
              const firstName = (a as any).artistFirstName as string | null;
              const lastName = (a as any).artistLastName as string | null;
              const name = (a as any).artistName as string | null;
              const photo = (a as any).artistProfilePicture as string | null;
              const displayName = firstName && lastName ? `${firstName} ${lastName}` : name ?? "Artist";
              const role = (a as any).artistType ?? "";
              const location = (a as any).artistLocation ?? "";

              const artistUserId = (a as any).artistUserId as number | null;
              return (
                <div key={a.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => artistUserId && navigate(`/dashboard/artists/${artistUserId}`)}
                >
                  {/* Portrait photo */}
                  <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
                    {photo ? (
                      <img src={photo} alt={displayName}
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
                      className={`w-full h-full ${getArtistColor(firstName)} flex items-center justify-center text-white text-4xl font-black`}
                      style={{ display: photo ? "none" : "flex" }}
                    >
                      {getInitials(firstName, lastName, name)}
                    </div>
                    {/* PRO badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide">PRO</span>
                    </div>
                  </div>
                  {/* Card info */}
                  <div className="p-3">
                    <p className="text-sm font-bold text-[#111] truncate">{displayName}</p>
                    {location && <p className="text-xs text-gray-400 truncate mt-0.5">{location}</p>}
                    {role && (
                      <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ec008c]/10 text-[#ec008c]">
                        {role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── List view ──
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {filtered.map((a) => {
              const firstName = (a as any).artistFirstName as string | null;
              const lastName = (a as any).artistLastName as string | null;
              const name = (a as any).artistName as string | null;
              const photo = (a as any).artistProfilePicture as string | null;
              const displayName = firstName && lastName ? `${firstName} ${lastName}` : name ?? "Artist";
              const role = (a as any).artistType ?? "";
              const location = (a as any).artistLocation ?? "";
              const slug = (a as any).artistSlug as string | null;

              const listArtistUserId = (a as any).artistUserId as number | null;
              return (
                <div key={a.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => listArtistUserId && navigate(`/dashboard/artists/${listArtistUserId}`)}
                >
                  {/* Photo */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    {photo ? (
                      <img src={photo} alt={displayName} className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fb = el.nextElementSibling as HTMLElement;
                          if (fb) fb.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full ${getArtistColor(firstName)} flex items-center justify-center text-white text-sm font-black`}
                      style={{ display: photo ? "none" : "flex" }}
                    >
                      {getInitials(firstName, lastName, name)}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#111] truncate">{displayName}</p>
                      <span className="bg-black/80 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full tracking-wide flex-shrink-0">PRO</span>
                    </div>
                    {location && <p className="text-xs text-gray-400 truncate">{location}</p>}
                  </div>
                  {/* Role tag */}
                  {role && (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ec008c]/10 text-[#ec008c]">
                      {role}
                    </span>
                  )}
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        {/* Post a Job CTA */}
        <div className="bg-pink-50 rounded-2xl p-5 mb-4 border border-pink-100">
          <p className="text-sm font-bold text-[#111] mb-1">Not sure what you're looking for?</p>
          <p className="text-xs text-gray-500 mb-4">Post a FREE Job!</p>
          <button className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
            ☆ Post a Job →
          </button>
        </div>

        {/* Location */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Location</p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search Location..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
            />
          </div>
        </div>

        {/* Service Type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Type</p>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
          >
            <option value="">Select a Service...</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── My Artists Tab ───────────────────────────────────────────────────────────

type StatusFilter = "all" | "Interested" | "Confirmed" | "Declined";

function MyArtistsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [, navigate] = useLocation();

  const { data: stats } = trpc.applicants.myStats.useQuery();
  const { data: applicants, isLoading, error } = trpc.applicants.myApplicants.useQuery({
    limit: 200,
    status: statusFilter === "all" ? undefined : [statusFilter],
  });

  const filtered = (applicants ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = [(a as any).artistFirstName, (a as any).artistLastName].filter(Boolean).join(" ").toLowerCase();
    return fullName.includes(q) || ((a as any).artistName ?? "").toLowerCase().includes(q) || (a.status ?? "").toLowerCase().includes(q);
  });

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats?.total ?? 0 },
    { key: "Interested", label: "Interested", count: stats?.interested ?? 0 },
    { key: "Confirmed", label: "Confirmed", count: stats?.confirmed ?? 0 },
    { key: "Declined", label: "Declined", count: stats?.declined ?? 0 },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Interested", value: stats?.interested ?? 0, color: "text-[#F25722]", bg: "bg-orange-50" },
          { label: "Confirmed", value: stats?.confirmed ?? 0, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Declined", value: stats?.declined ?? 0, color: "text-red-500", bg: "bg-red-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab.key ? "bg-white text-[#111] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count > 0 && <span className="ml-1.5 text-xs text-gray-400">{tab.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by artist name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          <span className="text-sm">Loading applicants...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-400 gap-2">
          <AlertCircle size={20} />
          <span className="text-sm">Failed to load applicants.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No applicants found</p>
          {search && <button onClick={() => setSearch("")} className="mt-2 text-xs text-[#F25722] font-semibold hover:opacity-70">Clear search</button>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-3">Artist</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Job</div>
            <div className="col-span-2">Rate</div>
            <div className="col-span-2">Date</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filtered.map((a) => {
              const firstName = (a as any).artistFirstName as string | null;
              const lastName = (a as any).artistLastName as string | null;
              const name = (a as any).artistName as string | null;
              const photo = (a as any).artistProfilePicture as string | null;
              const slug = (a as any).artistSlug as string | null;
              const displayName = firstName && lastName ? `${firstName} ${lastName}` : name ?? `Artist #${a.bubbleArtistId?.slice(-6) ?? "—"}`;
              const isExpanded = expanded === a.id;

              return (
                <div key={a.id}>
                  <div
                    className="grid grid-cols-12 gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer items-center"
                    onClick={() => {
                      const artistUserId = (a as any).artistUserId as number | null;
                      if (artistUserId) {
                        navigate(`/dashboard/artists/${artistUserId}`);
                      } else {
                        setExpanded(isExpanded ? null : a.id);
                      }
                    }}
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <ArtistAvatar firstName={firstName} lastName={lastName} name={name} profilePicture={photo} seed={a.bubbleArtistId} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111] truncate">{displayName}</p>
                        {slug && <p className="text-xs text-gray-400 truncate hidden sm:block">@{slug}</p>}
                      </div>
                    </div>
                    <div className="col-span-2"><StatusBadge status={a.status} /></div>
                    <div className="col-span-3">
                      {a.jobId ? (
                        <p className="text-xs text-gray-500 truncate">Job #{a.jobId}</p>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="col-span-2">
                      {a.isHourlyRate && a.artistHourlyRate ? (
                        <p className="text-xs font-semibold text-green-600">${a.artistHourlyRate}/hr</p>
                      ) : a.artistFlatRate ? (
                        <p className="text-xs font-semibold text-green-600">${a.artistFlatRate} flat</p>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">{formatDate(a.createdAt) ?? "—"}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      {(a as any).scheduleText && (
                        <div>
                          <p className="text-gray-400 font-semibold mb-0.5 flex items-center gap-1"><Clock size={10} /> Schedule</p>
                          <p className="text-[#111]">{(a as any).scheduleText}</p>
                        </div>
                      )}
                      {(a as any).bookingId && (
                        <div>
                          <p className="text-gray-400 font-semibold mb-0.5">Booking ID</p>
                          <p className="text-[#111] font-mono">{(a as any).bookingId}</p>
                        </div>
                      )}
                      {(a as any).resumeUrl && (
                        <div>
                          <p className="text-gray-400 font-semibold mb-0.5 flex items-center gap-1"><FileText size={10} /> Resume</p>
                          <a href={(a as any).resumeUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[#F25722] font-semibold flex items-center gap-1 hover:opacity-70">
                            <ExternalLink size={10} /> View
                          </a>
                        </div>
                      )}
                      {a.message && (
                        <div className="col-span-2">
                          <p className="text-gray-400 font-semibold mb-0.5">Message</p>
                          <p className="text-[#111] italic">"{a.message}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Artists Page ────────────────────────────────────────────────────────

type Tab = "discover" | "browse" | "my";

export default function Artists() {
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [browseRole, setBrowseRole] = useState<string | undefined>(undefined);

  function handleBrowse(role?: string) {
    setBrowseRole(role);
    setActiveTab("browse");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "discover", label: "Discover" },
    { key: "browse", label: "Browse Artists" },
    { key: "my", label: "My Artists" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-7">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "discover" && <DiscoverTab onBrowse={handleBrowse} />}
      {activeTab === "browse" && <BrowseArtistsTab initialRole={browseRole} />}
      {activeTab === "my" && <MyArtistsTab />}
    </div>
  );
}
