/*
 * ARTSWRK DASHBOARD — BROWSE COMPANIES (artist side, PRO-gated)
 * Lets PRO artists discover studios/companies hiring on Artswrk: name, logo,
 * location, description, website, and transport-reimbursement info.
 * Mirrors the Browse Artists layout (grid/list + search), plus an optional
 * map view since most companies have lat/lng on file.
 */

import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  Search, Building2, Loader2, MapPin, ExternalLink,
  Sparkles, Lock, Car, Map as MapIcon, Grid as GridIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatLocation } from "@/lib/utils";
import { MapView } from "@/components/Map";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) || "?";
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
];

function companyColor(seed: string | null | undefined) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type Company = {
  id: number;
  name: string | null;
  logo: string | null;
  website: string | null;
  description: string | null;
  locationAddress: string | null;
  locationLat: string | null;
  locationLng: string | null;
  transportReimbursed: boolean | null;
  transportDetails: string | null;
};

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: Company }) {
  const logoUrl = fixUrl(company.logo);
  const name = company.name ?? "Studio";
  const websiteUrl = company.website ? (company.website.startsWith("http") ? company.website : `https://${company.website}`) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              className="w-full h-full object-contain p-1"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={`w-full h-full ${companyColor(name)} flex items-center justify-center text-white font-black text-sm`}>
              {initials(name)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#111] text-base leading-snug truncate">{name}</h3>
          {company.locationAddress && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin size={11} className="flex-shrink-0" />
              {formatLocation(company.locationAddress) ?? company.locationAddress}
            </p>
          )}
          {company.description && (
            <p className="text-sm text-gray-600 leading-relaxed mt-2 line-clamp-2">{company.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {company.transportReimbursed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600">
                <Car size={11} /> Reimburses Transport
              </span>
            )}
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ec008c]/10 text-[#ec008c] hover:bg-[#ec008c]/20 transition-colors"
              >
                Visit Website <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Locked (non-PRO) state ────────────────────────────────────────────────────

function LockedState() {
  return (
    <div className="rounded-3xl bg-[#111] p-8 md:p-12 relative overflow-hidden text-center">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, rgba(236,0,140,0.35) 0%, transparent 60%)" }} />
      <div className="relative z-10 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
          <Lock size={22} className="text-white" />
        </div>
        <p className="text-[11px] font-black tracking-widest text-[#ec008c] uppercase mb-2">✦ PRO Feature</p>
        <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Browse Companies is a PRO feature</h2>
        <p className="text-white/60 text-sm mb-7 leading-relaxed">
          Upgrade to Artswrk PRO to get full access to studio profiles — locations, transport policies, websites, and more — so you always know who you're working with before you apply.
        </p>
        <Link
          href="/subscribe/pro"
          className="inline-flex items-center gap-2 bg-[#ec008c] text-white text-sm font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
        >
          <Sparkles size={15} /> Upgrade to PRO
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 48;

export default function BrowseCompanies() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"grid" | "map">("grid");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const { data, isLoading } = trpc.companies.browse.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
  });

  const locked = data?.locked ?? false;
  const companies = (data?.companies ?? []) as Company[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };

  const geoCompanies = companies.filter((c) => c.locationLat && c.locationLng);

  const plotMarkers = useCallback((map: google.maps.Map) => {
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    geoCompanies.forEach((c) => {
      const lat = parseFloat(c.locationLat!);
      const lng = parseFloat(c.locationLng!);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        title: c.name ?? "Studio",
      });
      markersRef.current.push(marker);
    });
    if (geoCompanies.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      geoCompanies.forEach((c) => bounds.extend({ lat: parseFloat(c.locationLat!), lng: parseFloat(c.locationLng!) }));
      map.fitBounds(bounds);
    }
  }, [geoCompanies]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-[#ec008c] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Sparkles size={13} /> PRO Feature
          </p>
          <h1 className="text-3xl font-black text-[#111]">Browse Companies</h1>
          {!locked && total > 0 && (
            <p className="text-gray-400 text-sm mt-1">
              <span className="font-bold text-[#111]">{total.toLocaleString()}</span> studios on Artswrk
            </p>
          )}
        </div>
        {!locked && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 flex-shrink-0">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${view === "grid" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"}`}
            >
              <GridIcon size={13} /> List
            </button>
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${view === "map" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"}`}
            >
              <MapIcon size={13} /> Map
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          <span className="text-sm">Loading companies...</span>
        </div>
      ) : locked ? (
        <LockedState />
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-5">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search companies by name or location..."
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#ec008c] transition-all bg-white shadow-sm"
            />
          </div>

          {companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Building2 size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No companies found</p>
              {search && (
                <button onClick={() => handleSearch("")} className="mt-2 text-xs text-[#ec008c] font-semibold hover:opacity-70">
                  Clear search
                </button>
              )}
            </div>
          ) : view === "map" ? (
            geoCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <MapIcon size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No mapped locations on this page</p>
              </div>
            ) : (
              <MapView
                className="rounded-2xl border border-gray-100 shadow-sm"
                initialCenter={{ lat: parseFloat(geoCompanies[0].locationLat!), lng: parseFloat(geoCompanies[0].locationLng!) }}
                onMapReady={(map) => { mapRef.current = map; plotMarkers(map); }}
              />
            )
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {companies.map((c) => <CompanyCard key={c.id} company={c} />)}
              </div>

              {totalPages > 1 && (
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
        </>
      )}
    </div>
  );
}
