/*
 * ARTSWRK DASHBOARD — ARTISTS (Applicants)
 * Real data from the interested_artists table, sourced from Bubble.
 */

import { useState } from "react";
import { Search, Users, Filter, ChevronRight, Loader2, AlertCircle, ExternalLink, Clock, DollarSign, CheckCircle2, XCircle, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
  "bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-lime-500",
];

function getArtistColor(bubbleId: string | null | undefined) {
  if (!bubbleId) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < bubbleId.length; i++) {
    hash = (hash * 31 + bubbleId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getArtistInitials(firstName: string | null | undefined, lastName: string | null | undefined, bubbleId: string | null | undefined) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (bubbleId) return bubbleId.slice(-2).toUpperCase();
  return "?";
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
      {cfg.icon}
      {status ?? "Unknown"}
    </span>
  );
}

type StatusFilter = "all" | "Interested" | "Confirmed" | "Declined";

export default function Artists() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: stats } = trpc.applicants.myStats.useQuery();
  const { data: applicants, isLoading, error } = trpc.applicants.myApplicants.useQuery({
    limit: 200,
    status: statusFilter === "all" ? undefined : [statusFilter],
  });

  // Client-side search filter on artist name, status, or job ID
  const filtered = (applicants ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = [a.artistFirstName, a.artistLastName].filter(Boolean).join(" ").toLowerCase();
    return (
      fullName.includes(q) ||
      (a.artistName ?? "").toLowerCase().includes(q) ||
      (a.bubbleArtistId ?? "").toLowerCase().includes(q) ||
      (a.status ?? "").toLowerCase().includes(q) ||
      (a.bubbleRequestId ?? "").toLowerCase().includes(q)
    );
  });

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats?.total ?? 0 },
    { key: "Interested", label: "Interested", count: stats?.interested ?? 0 },
    { key: "Confirmed", label: "Confirmed", count: stats?.confirmed ?? 0 },
    { key: "Declined", label: "Declined", count: stats?.declined ?? 0 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">Artists</h1>
        <p className="text-gray-500 text-sm mt-1">
          Artists who have applied to your jobs — {stats?.total ?? "…"} total applicants
        </p>
      </div>

      {/* Stats row */}
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
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab.key
                  ? "bg-white text-[#111] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-xs ${statusFilter === tab.key ? "text-gray-400" : "text-gray-400"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by artist name or status..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          <span className="text-sm">Loading applicants...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-400 gap-2">
          <AlertCircle size={20} />
          <span className="text-sm">Failed to load applicants. Please try again.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No applicants found</p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-2 text-xs text-[#F25722] font-semibold hover:opacity-70">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-3">Artist</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Job</div>
            <div className="col-span-2">Rate</div>
            <div className="col-span-2">Date</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {filtered.map((a) => (
              <div key={a.id}>
                <div
                  className="grid grid-cols-12 gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer group items-center"
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                >
                  {/* Artist avatar + name */}
                  <div className="col-span-3 flex items-center gap-3">
                    {(a as any).artistProfilePicture ? (
                      <img
                        src={(a as any).artistProfilePicture}
                        alt={(a as any).artistName ?? "Artist"}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fallback = el.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-9 h-9 rounded-full ${getArtistColor(a.bubbleArtistId)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                      style={{ display: (a as any).artistProfilePicture ? "none" : "flex" }}
                    >
                      {getArtistInitials((a as any).artistFirstName, (a as any).artistLastName, a.bubbleArtistId)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111] truncate">
                        {(a as any).artistFirstName && (a as any).artistLastName
                          ? `${(a as any).artistFirstName} ${(a as any).artistLastName}`
                          : (a as any).artistName ?? `Artist #${a.bubbleArtistId?.slice(-6) ?? "—"}`}
                      </p>
                      {(a as any).artistSlug && (
                        <p className="text-xs text-gray-400 truncate hidden sm:block">
                          @{(a as any).artistSlug}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <StatusBadge status={a.status} />
                    {a.converted && (
                      <span className="block mt-1 text-xs text-green-600 font-medium">Converted</span>
                    )}
                  </div>

                  {/* Job link */}
                  <div className="col-span-3">
                    {a.jobId ? (
                      <p className="text-xs text-gray-500 truncate">
                        Job #{a.jobId}
                        {a.bubbleRequestId && (
                          <span className="text-gray-300 ml-1">({a.bubbleRequestId.slice(-6)})</span>
                        )}
                      </p>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>

                  {/* Rate */}
                  <div className="col-span-2">
                    {a.isHourlyRate ? (
                      <div>
                        {a.artistHourlyRate && (
                          <p className="text-xs font-semibold text-green-600">${a.artistHourlyRate}/hr</p>
                        )}
                        {a.clientHourlyRate && a.clientHourlyRate !== a.artistHourlyRate && (
                          <p className="text-xs text-gray-400">Client: ${a.clientHourlyRate}/hr</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {a.artistFlatRate && (
                          <p className="text-xs font-semibold text-green-600">${a.artistFlatRate} flat</p>
                        )}
                      </div>
                    )}
                    {!a.artistHourlyRate && !a.artistFlatRate && (
                      <span className="text-xs text-gray-300">Open rate</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="col-span-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      {formatDate(a.bubbleCreatedAt) ?? "—"}
                    </p>
                    <ChevronRight
                      size={14}
                      className={`text-gray-300 transition-transform ${expanded === a.id ? "rotate-90" : ""}`}
                    />
                  </div>
                </div>

                {/* Expanded detail row */}
                {expanded === a.id && (
                  <div className="px-5 pb-5 pt-2 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      {/* Scheduling */}
                      {(a.startDate || a.endDate) && (
                        <div className="flex items-start gap-2">
                          <Clock size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-600 mb-0.5">Schedule</p>
                            {a.startDate && <p className="text-gray-500">Start: {formatDate(a.startDate)}</p>}
                            {a.endDate && <p className="text-gray-500">End: {formatDate(a.endDate)}</p>}
                            {a.totalHours && <p className="text-gray-500">{a.totalHours} hours total</p>}
                          </div>
                        </div>
                      )}

                      {/* Booking */}
                      {a.bubbleBookingId && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-600 mb-0.5">Booking</p>
                            <p className="text-gray-500 font-mono">{a.bubbleBookingId.slice(-12)}</p>
                          </div>
                        </div>
                      )}

                      {/* Resume */}
                      {a.resumeLink && (
                        <div className="flex items-start gap-2">
                          <FileText size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-600 mb-0.5">Resume / Portfolio</p>
                            <a
                              href={a.resumeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#F25722] hover:opacity-70 transition-opacity flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View file <ExternalLink size={11} />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Message */}
                      {a.message && (
                        <div className="sm:col-span-3 flex items-start gap-2">
                          <div className="w-4 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-600 mb-0.5">Message</p>
                            <p className="text-gray-500 leading-relaxed">{a.message}</p>
                          </div>
                        </div>
                      )}

                      {/* Availability */}
                      {(a as any).artistAvailability && (
                        <div className="flex items-start gap-2">
                          <div className="w-4 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-600 mb-0.5">Availability</p>
                            <p className="text-gray-500">{(a as any).artistAvailability}</p>
                          </div>
                        </div>
                      )}

                      {/* Bubble IDs for reference */}
                      <div className="sm:col-span-3 pt-2 border-t border-gray-200 text-gray-300 font-mono text-xs">
                        <span className="mr-4">Artist: {a.bubbleArtistId}</span>
                        <span>Record: {a.bubbleId}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {filtered.length} of {applicants?.length ?? 0} applicants
            </p>
            {search && (
              <button onClick={() => setSearch("")} className="text-xs text-[#F25722] font-semibold hover:opacity-70">
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
