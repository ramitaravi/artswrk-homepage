/*
 * ARTSWRK DASHBOARD — ARTISTS
 * Two tabs: Browse Artists | My Artists
 * Browse: real artists with affiliation + role filters
 * My Artists: Applied / Hired / Favorites (same as Overview ArtistsTab)
 */

import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Search, Users, ChevronRight, Loader2,
  Heart, ArrowRight, CalendarCheck, Lock, Sparkles, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { PremiumGate } from "@/components/PremiumGate";
import { useUpgrade } from "@/lib/useUpgrade";
import { trpc } from "@/lib/trpc";
import { formatLocation } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import LocationAutocompleteInput from "@/components/LocationAutocompleteInput";
import { DEFAULT_RADIUS_MILES, RADIUS_OPTIONS } from "@shared/location";

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

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function getShortName(a: any): string {
  if (a.artistFirstName && a.artistLastName) return `${a.artistFirstName} ${a.artistLastName[0]}.`;
  return a.artistFirstName ?? a.artistName ?? "Artist";
}

// ─── Artist Card (for My Artists tab) ────────────────────────────────────────

function ArtistCard({
  artistUserId, name, profilePicture, location, bio,
  countLabel, isSaved, onToggleSave,
}: {
  artistUserId: number | null | undefined;
  name: string;
  profilePicture?: string | null;
  location?: string | null;
  bio?: string | null;
  countLabel?: string;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const url = fixUrl(profilePicture);
  const cityLine = formatLocation(location);
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const color = getArtistColor(name);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-5 hover:shadow-md transition-shadow">
      <div className={`w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 ${!url ? color : "bg-gray-100"} flex items-center justify-center`}>
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-black text-2xl">{initials}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-[#111]">{name}</p>
        {cityLine && <p className="text-sm text-gray-500 mt-0.5">{cityLine}</p>}
        {bio && <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{bio}</p>}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {artistUserId && (
            <Link href={`/app/artists/${artistUserId}`}>
              <button className="text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:border-gray-400 transition-colors">
                Details
              </button>
            </Link>
          )}
          {countLabel && artistUserId && (
            <Link href={`/app/artists/${artistUserId}`}>
              <button className="text-xs text-[#F25722] border border-[#F25722] rounded-full px-3 py-1 hover:bg-[#fff3ee] transition-colors flex items-center gap-1">
                {countLabel} <ArrowRight size={11} />
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 flex-shrink-0 pt-1">
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
          className="hover:scale-110 transition-transform"
          title={isSaved ? "Remove from favorites" : "Save to favorites"}
        >
          <Heart
            size={16}
            className={isSaved ? "text-[#F25722] fill-[#F25722]" : "text-gray-300 hover:text-[#F25722] transition-colors"}
          />
        </button>
        {artistUserId && (
          <Link href={`/app/artists/${artistUserId}`}>
            <ChevronRight size={16} className="text-gray-300 hover:text-[#F25722] transition-colors" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── My Artists Tab (Applied / Hired / Favorites) ─────────────────────────────

type ArtistFilter = "applied" | "hired" | "favorites";

function MyArtistsTab() {
  const [filter, setFilter] = useState<ArtistFilter>("applied");

  const { data: applicants, isLoading: appsLoading } = trpc.applicants.myApplicants.useQuery({ limit: 200 });
  const { data: myBookings, isLoading: bookingsLoading } = trpc.bookings.myBookings.useQuery({ limit: 200 });
  const { data: savedData, isLoading: savedLoading } = trpc.savedArtists.mySaved.useQuery();
  const utils = trpc.useUtils();
  const toggleSave = trpc.savedArtists.toggle.useMutation({
    onSuccess: () => utils.savedArtists.mySaved.invalidate(),
  });

  const savedSet = new Set((savedData ?? []).map((s: any) => s.artistUserId as number));

  function handleToggle(artistUserId: number) {
    toggleSave.mutate({ artistUserId });
  }

  // Applied: dedupe by artistUserId
  const appliedMap = (applicants ?? []).reduce<Record<number, { data: any; count: number }>>((acc, a) => {
    const key = (a as any).artistUserId as number;
    if (!key) return acc;
    if (!acc[key]) acc[key] = { data: a, count: 0 };
    acc[key].count++;
    return acc;
  }, {});
  const appliedList = Object.values(appliedMap).sort((a, b) => b.count - a.count);

  // Hired: dedupe bookings by artistUserId (fallback to bubbleArtistId), exclude Cancelled
  const hiredMap = ((myBookings ?? []) as any[])
    .filter(b => b.bookingStatus !== "Cancelled")
    .reduce<Record<string, { data: any; count: number }>>((acc, b) => {
      const key = b.artistUserId
        ? String(b.artistUserId)
        : b.bubbleArtistId
        ? `bubble_${b.bubbleArtistId}`
        : null;
      if (!key) return acc;
      if (!acc[key]) acc[key] = { data: b, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
  const hiredList = Object.values(hiredMap).sort((a, b) => b.count - a.count);

  const isLoading =
    (filter === "applied" && appsLoading) ||
    (filter === "hired" && bookingsLoading) ||
    (filter === "favorites" && savedLoading);

  const filters: { id: ArtistFilter; label: string; count: number }[] = [
    { id: "applied", label: "Applied", count: appliedList.length },
    { id: "hired", label: "Hired", count: hiredList.length },
    { id: "favorites", label: "Favorites", count: savedSet.size },
  ];

  function renderList() {
    if (isLoading) return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );

    if (filter === "applied") {
      if (!appliedList.length) return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No applicants yet</p>
          <p className="text-xs">Artists who apply to your jobs will appear here.</p>
        </div>
      );
      return (
        <div className="space-y-5">
          {appliedList.map(({ data: a, count }) => (
            <ArtistCard
              key={(a as any).artistUserId ?? (a as any).bubbleArtistId ?? a.id}
              artistUserId={(a as any).artistUserId}
              name={getShortName(a)}
              profilePicture={(a as any).artistProfilePicture}
              location={(a as any).artistLocation}
              bio={(a as any).artistBio}
              countLabel={`Applied to you ${count} time${count !== 1 ? "s" : ""}`}
              isSaved={savedSet.has((a as any).artistUserId)}
              onToggleSave={() => (a as any).artistUserId && handleToggle((a as any).artistUserId)}
            />
          ))}
        </div>
      );
    }

    if (filter === "hired") {
      if (!hiredList.length) return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <CalendarCheck size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No hired artists yet</p>
          <p className="text-xs">Artists you've booked will appear here.</p>
        </div>
      );
      return (
        <div className="space-y-5">
          {hiredList.map(({ data: b, count }) => (
            <ArtistCard
              key={b.artistUserId ?? b.id}
              artistUserId={b.artistUserId}
              name={getShortName(b)}
              profilePicture={b.artistProfilePicture}
              location={b.artistLocation}
              bio={b.artistBio}
              countLabel={`Hired ${count} time${count !== 1 ? "s" : ""}`}
              isSaved={savedSet.has(b.artistUserId)}
              onToggleSave={() => b.artistUserId && handleToggle(b.artistUserId)}
            />
          ))}
        </div>
      );
    }

    // Favorites
    if (!savedData?.length) return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Heart size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-semibold text-gray-600 mb-1">No favorites yet</p>
        <p className="text-xs">Click the heart icon on any artist card to save them here.</p>
      </div>
    );
    return (
      <div className="space-y-5">
        {(savedData as any[]).map((s: any) => (
          <ArtistCard
            key={s.artistUserId}
            artistUserId={s.artistUserId}
            name={getShortName(s)}
            profilePicture={s.artistProfilePicture}
            location={s.artistLocation}
            bio={s.artistBio}
            isSaved={true}
            onToggleSave={() => handleToggle(s.artistUserId)}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border flex-shrink-0 ${
              filter === f.id
                ? "bg-[#F25722] text-white border-[#F25722]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#F25722] hover:text-[#F25722]"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                filter === f.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {renderList()}
    </div>
  );
}

// ─── Browse Artists Tab ───────────────────────────────────────────────────────

function FeaturedStrip() {
  const { data: featured = [] } = trpc.artists.getFeatured.useQuery();
  const [, navigate] = useLocation();

  if (!featured.length) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-black text-[#111]">✦ Featured Artists</span>
        <span className="text-xs text-gray-400 font-medium">Artists with media portfolios</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {(featured as any[]).map((a: any) => {
          const displayName = getDisplayName(a.firstName, a.lastName, a.name);
          const firstPhoto = (() => {
            try {
              const parsed = JSON.parse(a.mediaPhotos ?? "[]");
              return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
            } catch { return null; }
          })();
          const photo = fixUrl(firstPhoto) || fixUrl(a.profilePicture);
          const primaryType = a.typeNames?.[0] ?? "";
          return (
            <div
              key={a.id}
              className="flex-shrink-0 w-36 cursor-pointer group"
              onClick={() => navigate(`/app/artists/${a.id}`)}
            >
              <div className="w-36 h-48 rounded-2xl overflow-hidden relative bg-gray-100">
                {photo ? (
                  <img src={photo} alt={displayName}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className={`w-full h-full ${getArtistColor(a.firstName ?? a.name)} flex items-center justify-center text-white text-3xl font-black`}>
                    {getInitials(a.firstName, a.lastName, a.name)}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <p className="text-white text-xs font-bold truncate leading-tight">{displayName}</p>
                  {primaryType && <p className="text-white/70 text-[10px] truncate">{primaryType}</p>}
                </div>
                {a.artswrkPro && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-black/75 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">PRO</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrowseArtistsTab({ initialRole }: { initialRole?: string }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(initialRole ?? "");
  const [affiliationFilter, setAffiliationFilter] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  // Location is its own filter rather than part of the free-text search: only a
  // real Places selection carries the coordinates a radius search needs.
  const [locationFilter, setLocationFilter] = useState<{ query: string; lat?: number; lng?: number }>({ query: "" });
  const [radiusMiles, setRadiusMiles] = useState<number>(DEFAULT_RADIUS_MILES);
  const [, navigate] = useLocation();

  const { user } = useAuth();
  const planTier = (user as any)?.planTier;
  const canConnect = planTier === "client_premium" || planTier === "enterprise_subscription";

  const { start: startUpgrade, pending: upgradePending } = useUpgrade();

  function handleArtistClick(artistId: number) {
    if (canConnect) {
      navigate(`/app/artists/${artistId}`);
    } else {
      startUpgrade({ audience: "client" });
    }
  }

  const PAGE_SIZE = 48;

  const { data: affiliations } = trpc.artists.getAffiliations.useQuery();
  const { data: serviceTypes } = trpc.artists.getMasterServiceTypes.useQuery();

  const { data, isLoading } = trpc.artists.browse.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    artistType: roleFilter || undefined,
    affiliationId: affiliationFilter,
    locationQuery: locationFilter.query || undefined,
    locationLat: locationFilter.lat,
    locationLng: locationFilter.lng,
    radiusMiles: locationFilter.lat ? radiusMiles : undefined,
  });

  const artists = data?.artists ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleRole = (r: string) => { setRoleFilter(r); setPage(0); };
  const handleAffiliation = (id: number | undefined) => { setAffiliationFilter(id); setPage(0); };
  const handleLocation = (place: { formatted: string; lat?: number; lng?: number }) => {
    setLocationFilter({ query: place.formatted, lat: place.lat, lng: place.lng });
    setPage(0);
  };

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Featured strip — only when no active filters */}
        {!search && !roleFilter && !affiliationFilter && !locationFilter.query && <FeaturedStrip />}

        {/* Subscribe CTA — on-demand clients can browse but can't view full
            profiles or connect with artists until they subscribe */}
        {!canConnect && (
          <div className="flex items-center justify-between gap-4 mb-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-[#111] to-[#2a2a2a]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-[#FFBC5D]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Subscribe to connect with these artists</p>
                <p className="text-xs text-white/60">Premium unlocks full profiles, contact info, and direct messaging.</p>
              </div>
            </div>
            <button
              onClick={() => startUpgrade({ audience: "client" })}
              disabled={upgradePending}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-[#111] bg-white hover:bg-gray-100 transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {upgradePending && <Loader2 size={13} className="animate-spin" />}
              Subscribe — $65/mo
            </button>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-bold text-[#111]">{total}</span> artists on Artswrk
          </p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"}`}
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
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"}`}
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

        {/* Search + location */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search artists by name..."
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white shadow-sm"
            />
          </div>
          <div className="relative flex-1">
            <MapPin size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <LocationAutocompleteInput
              value={locationFilter.query}
              onChange={handleLocation}
              placeholder="Anywhere"
              icon={false}
              inputClassName="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white shadow-sm"
            />
          </div>
          {/* Radius only means something once a real place is selected. */}
          {locationFilter.lat !== undefined && (
            <select
              value={radiusMiles}
              onChange={(e) => { setRadiusMiles(Number(e.target.value)); setPage(0); }}
              className="sm:w-36 flex-shrink-0 px-3 py-3.5 rounded-2xl border border-gray-200 text-sm text-gray-600 bg-white shadow-sm focus:outline-none focus:border-[#FFBC5D] cursor-pointer"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>Within {r} mi</option>
              ))}
            </select>
          )}
        </div>

        {/* Affiliation chips */}
        {affiliations && affiliations.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => handleAffiliation(undefined)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                !affiliationFilter ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              All Schools
            </button>
            {affiliations.map((aff: any) => {
              const active = affiliationFilter === aff.id;
              return (
                <button
                  key={aff.id}
                  onClick={() => handleAffiliation(active ? undefined : aff.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                    active
                      ? "bg-[#ec008c] text-white border-[#ec008c]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#ec008c] hover:text-[#ec008c]"
                  }`}
                >
                  {aff.logoUrl ? (
                    <img
                      src={aff.logoUrl.startsWith("//") ? `https:${aff.logoUrl}` : aff.logoUrl}
                      alt={aff.display}
                      className="w-4 h-4 rounded-sm object-contain flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-sm bg-gray-200 flex items-center justify-center text-[8px] font-black text-gray-500 flex-shrink-0">
                      {(aff.display ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  {aff.display}
                </button>
              );
            })}
          </div>
        )}

        {/* Service type filter pills (from master_service_types) */}
        {serviceTypes && serviceTypes.length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => handleRole("")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                !roleFilter ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              All
            </button>
            {serviceTypes.map((st: any) => (
              <button
                key={st.id}
                onClick={() => handleRole(roleFilter === st.name ? "" : st.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                  roleFilter === st.name
                    ? "bg-[#F25722] text-white border-[#F25722]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#F25722] hover:text-[#F25722]"
                }`}
              >
                {st.name}
              </button>
            ))}
          </div>
        )}

        {/* Artist grid or list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-3" />
            <span className="text-sm">Loading artists...</span>
          </div>
        ) : artists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No artists found</p>
            <button onClick={() => { handleSearch(""); handleRole(""); handleAffiliation(undefined); }} className="mt-2 text-xs text-[#F25722] font-semibold hover:opacity-70">
              Clear filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {artists.map((a) => {
              const displayName = getDisplayName(a.firstName, a.lastName, a.name);
              const primaryType = a.typeNames?.[0] ?? "";
              return (
                <div key={a.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => handleArtistClick(a.id)}
                >
                  <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
                    {a.profilePicture ? (
                      // Deliberately NOT blurred: blurring the photo itself read
                      // as a low-quality image rather than locked content. The
                      // frosted scrim below does the gating instead.
                      <img src={a.profilePicture} alt={displayName}
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
                      className={`w-full h-full ${getArtistColor(a.firstName ?? a.name)} flex items-center justify-center text-white text-4xl font-black`}
                      style={{ display: a.profilePicture ? "none" : "flex" }}
                    >
                      {getInitials(a.firstName, a.lastName, a.name)}
                    </div>
                    {a.artswrkPro && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide">PRO</span>
                      </div>
                    )}
                    {!canConnect && (
                      // A crisp chip rather than a scrim over the photo: any
                      // blur/wash over a headshot reads as a low-quality image,
                      // not as locked content. What's actually gated is the
                      // click-through, so the lock is signalled, not simulated.
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="flex items-center gap-1 bg-white/95 backdrop-blur-sm shadow-sm text-[#111] text-[10px] font-bold px-2 py-1 rounded-full">
                          <Lock size={10} className="flex-shrink-0" />
                          Subscribe to connect
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-[#111] truncate">{displayName}</p>
                    {a.location && <p className="text-xs text-gray-400 truncate mt-0.5">{formatLocation(a.location)}</p>}
                    {primaryType && (
                      <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ec008c]/10 text-[#ec008c]">
                        {primaryType}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {artists.map((a) => {
              const displayName = getDisplayName(a.firstName, a.lastName, a.name);
              const primaryType = a.typeNames?.[0] ?? "";
              return (
                <div key={a.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => handleArtistClick(a.id)}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    {a.profilePicture ? (
                      <img src={a.profilePicture} alt={displayName} className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fb = el.nextElementSibling as HTMLElement;
                          if (fb) fb.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full ${getArtistColor(a.firstName ?? a.name)} flex items-center justify-center text-white text-sm font-black`}
                      style={{ display: a.profilePicture ? "none" : "flex" }}
                    >
                      {getInitials(a.firstName, a.lastName, a.name)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#111] truncate">{displayName}</p>
                      {a.artswrkPro && <span className="bg-black/80 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full tracking-wide flex-shrink-0">PRO</span>}
                    </div>
                    {a.location && <p className="text-xs text-gray-400 truncate">{formatLocation(a.location)}</p>}
                  </div>
                  {primaryType && (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ec008c]/10 text-[#ec008c]">
                      {primaryType}
                    </span>
                  )}
                  {canConnect ? (
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                  ) : (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-gray-400 group-hover:text-[#ec008c] transition-colors">
                      <Lock size={11} /> Subscribe
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
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
      </div>

      {/* Right sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="bg-pink-50 rounded-2xl p-5 mb-4 border border-pink-100">
          <p className="text-sm font-bold text-[#111] mb-1">Not sure what you're looking for?</p>
          <p className="text-xs text-gray-500 mb-4">Post a FREE Job!</p>
          <Link href="/post-job">
            <button className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              ☆ Post a Job →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Artists Page ────────────────────────────────────────────────────────

type Tab = "browse" | "my";

export default function Artists() {
  // The tab lives in the URL, not just in state. The sidebar links straight to
  // ?tab=my, and it highlights the row that matches the query — so if an
  // in-page tab click didn't update the URL, the sidebar would keep pointing at
  // the tab you just left.
  const search = useSearch();
  const [, navigate] = useLocation();
  const tab: Tab = new URLSearchParams(search).get("tab") === "my" ? "my" : "browse";
  const setTab = (t: Tab) => navigate(t === "my" ? "/app/artists?tab=my" : "/app/artists");

  const tabs: { key: Tab; label: string }[] = [
    { key: "browse", label: "Browse Artists" },
    { key: "my", label: "My Artists" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Tab nav */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 mb-8 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? "bg-white text-[#111] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Browse is a teaser, not a wall. It was behind a full PremiumGate, which
          showed a free account nothing at all — and the roster is the single
          most persuasive thing we have. The tab already gates the part that
          matters (opening a profile or messaging prompts the upgrade), and the
          pricing source of truth puts "browse artists sitewide" on every client
          tier, with favourites as the Premium line. So: show the grid, sell on
          top of it. */}
      {tab === "browse" && <BrowseArtistsTab />}

      {/* My Artists stays a hard gate: favouriting and saved rosters are the
          Premium line in the pricing doc, and there's nothing to preview until
          someone has one. */}
      {tab === "my" && (
        <PremiumGate
          title="Keep your own roster of artists"
          blurb="The teachers who already work for you, in one place — who applied, who you hired, and the favourites you want back."
          bullets={[
            "Everyone who has applied to your jobs, in one list",
            "Every artist you have hired, with their history",
            "Favourite the ones you trust and rebook them fast",
            "Message any of them directly from your roster",
          ]}
        >
          <MyArtistsTab />
        </PremiumGate>
      )}
    </div>
  );
}
