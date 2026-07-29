/*
 * ARTSWRK — PUBLIC STUDIO / HIRING PAGE
 * Route: /studio/:userId
 * Shareable page: active jobs + location tabs when the studio has multiple sites.
 */
import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { MapPin, Globe, Instagram, CheckCircle2, Loader2, AlertCircle, Briefcase, ChevronDown, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PublicCompanyPage() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const { data, isLoading, error } = trpc.companies.getPublicPage.useQuery(
    { userId },
    { enabled: userId > 0 }
  );

  // Must be before early returns — hooks can't be called conditionally
  // Filter jobs by location via bubbleClientCompanyId — the reliable join key
  const filteredJobs = useMemo(() => {
    if (!data) return [];
    const { jobs, companies } = data;
    const base = selectedLocationId ? (() => {
      const activeCompany = companies.find((c) => c.id === selectedLocationId);
      if (!activeCompany?.bubbleClientCompanyId) return jobs;
      const matched = jobs.filter((j) => (j as any).bubbleClientCompanyId === activeCompany.bubbleClientCompanyId);
      return matched.length > 0 ? matched : jobs;
    })() : jobs;
    return [...base].sort((a, b) => {
      const aB = !!(a as any).isBoosted; const bB = !!(b as any).isBoosted;
      return aB === bB ? 0 : aB ? -1 : 1;
    });
  }, [data, selectedLocationId]);

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gray-300" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
      <AlertCircle size={36} className="text-red-300" />
      <p className="text-gray-500 text-sm">Studio page not found.</p>
      <Link href="/" className="text-sm font-semibold text-[#F25722] hover:underline">← Artswrk Home</Link>
    </div>
  );

  const { owner, companies } = data;

  // Active location (from tab selection or first company)
  const activeCompany = companies.length > 0
    ? (companies.find((c) => c.id === selectedLocationId) ?? companies[0])
    : null;

  const companyName = activeCompany?.name || owner.clientCompanyName || owner.name || "Studio";
  const logo = fixUrl(activeCompany?.logo) || fixUrl(owner.profilePicture);
  const about = activeCompany?.description;
  const location = activeCompany?.locationAddress || owner.location;
  const website = activeCompany?.website || owner.website;
  const instagram = owner.instagram;
  const isPro = owner.artswrkPro || owner.artswrkBasic;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero banner */}
      <div className="h-48 w-full" style={{ background: "linear-gradient(135deg, #F25722 0%, #FFBC5D 100%)" }} />

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* ── Left: Job Openings ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black text-[#111] mb-1">Open Positions</h1>
            <p className="text-gray-500 mb-5">Apply to our open roles below!</p>

            {/* Location dropdown — only shown when there are multiple */}
            {companies.length > 1 && (
              <div className="relative w-fit mb-6">
                <select
                  value={selectedLocationId ?? ""}
                  onChange={(e) => setSelectedLocationId(e.target.value === "" ? null : Number(e.target.value))}
                  className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 focus:outline-none focus:border-[#F25722] transition-colors cursor-pointer shadow-sm"
                >
                  <option value="">All Locations</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || "Location"}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}

            {filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                <Briefcase size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No open positions right now</p>
                <p className="text-xs mt-1">Check back soon for new opportunities.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <div key={job.id} className={`bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow ${(job as any).isBoosted ? "border-orange-200" : "border-gray-100"}`}>
                    {/* Logo */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                      {logo ? (
                        <img src={logo} alt={companyName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-black text-gray-400">{getInitials(companyName)}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {(job as any).isBoosted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] mb-1">
                          <Zap size={9} className="fill-[#F25722]" /> Priority Listing
                        </span>
                      )}
                      <p className="text-sm font-bold text-[#111] leading-snug">
                        {job.title || "Open Role"}
                      </p>
                      {job.locationAddress && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} />{job.locationAddress}
                        </p>
                      )}
                      {job.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                          {job.description}
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="flex-shrink-0">
                      <Link href={job.slug ? `/jobs/${job.slug}` : "/jobs"}>
                        <button className="px-5 py-2.5 rounded-xl bg-[#111] text-white text-xs font-bold hover:bg-gray-800 transition-colors whitespace-nowrap">
                          Apply Now
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Company Card ─────────────────────────────────────────── */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
              {/* Logo circle */}
              <div className="flex justify-center pt-6 pb-3 px-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md flex items-center justify-center">
                    {logo ? (
                      <img src={logo} alt={companyName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-gray-400">{getInitials(companyName)}</span>
                    )}
                  </div>
                  {isPro && (
                    <div className="absolute bottom-0 right-0">
                      <CheckCircle2 size={22} className="text-[#F25722] fill-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-black text-[#111] flex items-center justify-center gap-1.5">
                    {companyName}
                    {isPro && <CheckCircle2 size={18} className="text-[#F25722] flex-shrink-0" />}
                  </h2>
                  {isPro && (
                    <p className="text-sm font-semibold text-[#F25722] mt-0.5">Artswrk Premium Studio</p>
                  )}
                </div>

                {/* All locations list in card */}
                {companies.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-[#111] mb-2 flex items-center gap-1.5">
                      <MapPin size={11} /> {companies.length > 1 ? "Locations" : "Location"}
                    </h3>
                    <div className="space-y-1.5">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedLocationId(c.id === selectedLocationId ? null : c.id)}
                          className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                            c.id === selectedLocationId
                              ? "bg-orange-50 text-[#F25722]"
                              : "text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <MapPin size={10} className="mt-1 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold leading-snug">{c.name || "Studio"}</p>
                            {c.locationAddress && (
                              <p className="text-[11px] leading-snug opacity-75 mt-0.5">{c.locationAddress}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <Link href="/app/messages">
                    <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      💬 Message
                    </button>
                  </Link>
                  <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    🔖 Save
                  </button>
                </div>

                {/* About */}
                {about && (
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-[#111] mb-2">About</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{about}</p>
                  </div>
                )}

                {/* Links */}
                {(website || instagram) && (
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {website && (
                      <a href={website.startsWith("http") ? website : `https://${website}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#F25722] transition-colors">
                        <Globe size={14} className="flex-shrink-0" />
                        <span className="truncate">{website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    )}
                    {instagram && (
                      <a href={instagram.startsWith("http") ? instagram : `https://instagram.com/${instagram.replace("@","")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#ec008c] transition-colors">
                        <Instagram size={14} className="flex-shrink-0" />
                        <span>{instagram.startsWith("@") ? instagram : `@${instagram}`}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
