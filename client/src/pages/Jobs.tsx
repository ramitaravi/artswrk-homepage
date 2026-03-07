/*
 * ARTSWRK JOBS PAGE
 * Layout: Full-screen split — left sidebar (filters + job list) | right map panel
 * Font: Poppins
 * Artist gradient: #ec008c → #ff7171
 * Hirer gradient: #FFBC5D → #F25722
 * Real data from DB via tRPC
 */

import { useState, useMemo } from "react";
import { Search, MapPin, Clock, ChevronDown, X, Star, SlidersHorizontal, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DisplayJob {
  id: number;
  title: string;
  location: string;
  postedAgo: string;
  datetime: string;
  rate: string | null;
  dateType: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "recently";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "recently";
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "a day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function formatDateRange(start: Date | null | undefined, end: Date | null | undefined, dateType: string | null | undefined): string {
  if (dateType === "Ongoing") return "Ongoing";
  if (dateType === "Recurring") return "Recurring";
  if (start) {
    const s = new Date(start);
    if (!isNaN(s.getTime())) {
      const dateStr = s.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", year: "2-digit" });
      const timeStr = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${dateStr}, ${timeStr}`;
    }
  }
  return dateType ?? "Flexible";
}

function extractTitle(description: string | null | undefined): string {
  if (!description) return "Open Position";
  const firstLine = description.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length < 80) return firstLine;
  // Try to extract a job type from the text
  const patterns: [RegExp, string][] = [
    [/sub(stitute)?\s+teacher/i, "Substitute Teacher"],
    [/ballet/i, "Ballet Teacher"],
    [/hip\s*hop/i, "Hip Hop Instructor"],
    [/tap/i, "Tap Teacher"],
    [/jazz/i, "Jazz Teacher"],
    [/lyrical/i, "Lyrical Teacher"],
    [/contemporary/i, "Contemporary Teacher"],
    [/acro/i, "Acro Teacher"],
    [/piano/i, "Piano Teacher"],
    [/violin/i, "Violin Teacher"],
    [/voice|vocal/i, "Vocal Coach"],
    [/judge|adjudicat/i, "Dance Adjudicator"],
    [/choreograph/i, "Choreographer"],
    [/photograph/i, "Photographer"],
    [/videograph/i, "Videographer"],
    [/yoga/i, "Yoga Instructor"],
    [/pilates/i, "Pilates Instructor"],
    [/recurring|weekly|instructor/i, "Dance Instructor"],
    [/teacher|coach/i, "Dance Teacher"],
  ];
  for (const [re, label] of patterns) {
    if (re.test(description)) return label;
  }
  return "Open Position";
}

const ARTIST_TYPES = ["Dance Educator", "Photographer", "Dance Adjudicator", "Videographer", "Acting Coach", "Vocal Coach", "Music Teacher"];

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14">
      <div className="mx-auto px-5 lg:px-8 max-w-full h-full">
        <div className="flex items-center justify-between h-full">
          <Link href="/" className="flex items-center select-none">
            <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <Link href="/jobs" className="text-sm font-semibold text-[#111] border-b-2 border-[#F25722]">Jobs</Link>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">About</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">For Hirers</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">For Artists</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Login</Link>
            <Link href="/login" className="text-sm font-semibold text-white bg-[#111] px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors">Join</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, isSelected, onClick }: { job: DisplayJob; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#F25722] bg-orange-50 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold artist-grad-bg">
            {job.title[0]}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[#111] text-sm truncate">{job.title}</h3>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="flex-shrink-0" />
              <span className="truncate">{job.location}</span>
              <span className="text-gray-300">·</span>
              <span className="flex-shrink-0">Posted {job.postedAgo}</span>
            </p>
          </div>
        </div>
        <button
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold text-white artist-grad-bg hover:opacity-90 transition-opacity"
          onClick={(e) => { e.stopPropagation(); }}
        >
          Apply
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
        <span className="flex items-center gap-1">
          <Clock size={10} className="flex-shrink-0" />
          <span className="truncate max-w-[160px]">{job.datetime}</span>
        </span>
        <span className="ml-auto font-semibold text-[#111] flex-shrink-0">
          {job.rate ?? <span className="text-gray-400 font-normal">Open rate</span>}
        </span>
      </div>
    </div>
  );
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────
function MapPanel({ selectedJob }: { selectedJob: DisplayJob | null }) {
  return (
    <div className="relative w-full h-full bg-gray-100 overflow-hidden">
      {/* Stylized map background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(200,210,220,0.4) 1px, transparent 1px),
          linear-gradient(90deg, rgba(200,210,220,0.4) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        backgroundColor: "#e8edf2"
      }} />

      {/* Road-like lines */}
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="35%" x2="100%" y2="30%" stroke="#b0bec5" strokeWidth="8" />
        <line x1="0" y1="60%" x2="100%" y2="65%" stroke="#b0bec5" strokeWidth="5" />
        <line x1="25%" y1="0" x2="30%" y2="100%" stroke="#b0bec5" strokeWidth="6" />
        <line x1="65%" y1="0" x2="60%" y2="100%" stroke="#b0bec5" strokeWidth="4" />
        <line x1="0" y1="15%" x2="100%" y2="20%" stroke="#b0bec5" strokeWidth="3" />
        <line x1="45%" y1="0" x2="50%" y2="100%" stroke="#b0bec5" strokeWidth="3" />
        <rect x="20%" y="25%" width="15%" height="20%" fill="#d0d8e0" rx="4" />
        <rect x="55%" y="40%" width="12%" height="15%" fill="#d0d8e0" rx="4" />
        <rect x="35%" y="55%" width="18%" height="12%" fill="#d0d8e0" rx="4" />
      </svg>

      {/* Map pins */}
      <div className="absolute inset-0">
        {[
          { top: "30%", left: "28%", label: "NY" },
          { top: "45%", left: "52%", label: "NJ" },
          { top: "25%", left: "65%", label: "CT" },
          { top: "60%", left: "38%", label: "NY" },
          { top: "38%", left: "72%", label: "NJ" },
          { top: "55%", left: "20%", label: "NY" },
          { top: "20%", left: "45%", label: "NY" },
          { top: "70%", left: "60%", label: "NJ" },
        ].map((pin, i) => (
          <div
            key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{ top: pin.top, left: pin.left }}
          >
            <div className="w-8 h-8 rounded-full artist-grad-bg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <MapPin size={14} className="text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Selected job tooltip */}
      {selectedJob && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-xl p-4 w-72 border border-gray-100 z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg artist-grad-bg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {selectedJob.title[0]}
            </div>
            <div>
              <p className="font-bold text-sm text-[#111]">{selectedJob.title}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin size={10} />{selectedJob.location}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{selectedJob.datetime}</span>
            <span className="font-bold text-[#111]">{selectedJob.rate ?? "Open rate"}</span>
          </div>
          {selectedJob.description && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{selectedJob.description}</p>
          )}
          <button className="w-full mt-3 py-2 rounded-lg text-xs font-semibold text-white artist-grad-bg hover:opacity-90 transition-opacity">
            Apply Now →
          </button>
        </div>
      )}

      {/* Map attribution */}
      <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded">
        Map data preview
      </div>
    </div>
  );
}

// ─── Main Jobs Page ───────────────────────────────────────────────────────────
export default function Jobs() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [artistType, setArtistType] = useState("");
  const [selectedJob, setSelectedJob] = useState<DisplayJob | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch real jobs from DB
  const { data: rawJobs, isLoading } = trpc.jobs.publicList.useQuery({ limit: 100 });

  // Transform DB jobs to display format
  const allJobs: DisplayJob[] = useMemo(() => {
    if (!rawJobs) return [];
    return rawJobs.map((j) => ({
      id: j.id,
      title: extractTitle(j.description),
      location: j.locationAddress
        ? j.locationAddress.split(",").slice(0, 2).join(",").trim()
        : "Location TBD",
      postedAgo: timeAgo(j.bubbleCreatedAt),
      datetime: formatDateRange(j.startDate, j.endDate, j.dateType),
      rate: j.artistHourlyRate ? `$${j.artistHourlyRate}.00/hr` : j.openRate ? "Open rate" : null,
      dateType: j.dateType,
      description: j.description,
      lat: j.locationLat ? parseFloat(j.locationLat) : null,
      lng: j.locationLng ? parseFloat(j.locationLng) : null,
    }));
  }, [rawJobs]);

  const filtered = useMemo(() => {
    return allJobs.filter((job) => {
      const matchSearch = !search || job.title.toLowerCase().includes(search.toLowerCase()) || job.location.toLowerCase().includes(search.toLowerCase()) || (job.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchLocation = !location || job.location.toLowerCase().includes(location.toLowerCase());
      return matchSearch && matchLocation;
    });
  }, [allJobs, search, location]);

  const hasFilters = search || location || artistType;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Navbar />

      {/* Main content below navbar */}
      <div className="flex flex-1 overflow-hidden pt-14">

        {/* ── Left Panel ── */}
        <div className="w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col border-r border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-black text-[#111]">
                Jobs For You{" "}
                {!isLoading && (
                  <span className="text-base font-semibold text-gray-400">({filtered.length})</span>
                )}
              </h1>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors md:hidden ${
                  hasFilters ? "border-[#F25722] text-[#F25722] bg-orange-50" : "border-gray-200 text-gray-500"
                }`}
              >
                <SlidersHorizontal size={12} />
                Filters {hasFilters ? `(${[search, location, artistType].filter(Boolean).length})` : ""}
              </button>
            </div>

            {/* Search row */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Jobs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
              <div className="relative flex-1">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Filter row */}
            <div className={`flex gap-2 items-center flex-wrap ${filtersOpen || "hidden md:flex"}`}>
              <div className="relative flex-1 min-w-[120px]">
                <select
                  value={artistType}
                  onChange={(e) => setArtistType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                >
                  <option value="">Artist Type</option>
                  {ARTIST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setLocation(""); setArtistType(""); }}
                  className="flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:text-[#d44a1a] transition-colors whitespace-nowrap"
                >
                  <X size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* PRO Banner */}
          <div className="mx-4 mt-3 mb-1 px-4 py-3 rounded-xl bg-[#111] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-bold">Jobs PRO</span>
              <span className="text-yellow-400 text-xs">⭐️</span>
            </div>
            <button className="text-xs font-semibold text-white border border-white/30 px-3 py-1 rounded-full hover:bg-white/10 transition-colors">
              View PRO Jobs →
            </button>
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading jobs...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Search size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No jobs found</p>
                <p className="text-xs text-gray-300 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right Map Panel ── */}
        <div className="hidden md:flex flex-1 relative">
          <MapPanel selectedJob={selectedJob} />
        </div>
      </div>
    </div>
  );
}
