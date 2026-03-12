/*
 * ARTSWRK JOBS PAGE — ARTIST VIEW
 * Three tabs: Jobs Near Me (map + list) | PRO Jobs | Applications
 * Map: real Google Maps with job pin markers
 * Data: real DB via tRPC publicList
 */
import { useState, useMemo, useRef, useCallback } from "react";
import {
  Search, MapPin, Clock, ChevronDown, X, Star, Loader2,
  Briefcase, CheckCircle, AlertCircle, Lock, ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayJob {
  id: number;
  title: string;
  companyName: string | null;
  location: string;
  postedAgo: string;
  datetime: string;
  rate: string | null;
  dateType: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  isDirect: boolean;
  clientProfilePicture: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "recently";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "recently";
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function formatDatetime(
  start: Date | null | undefined,
  dateType: string | null | undefined
): string {
  if (dateType === "Ongoing") return "Ongoing";
  if (dateType === "Recurring") return "Recurring";
  if (start) {
    const s = new Date(start);
    if (!isNaN(s.getTime())) {
      return (
        s.toLocaleDateString("en-US", {
          weekday: "short",
          month: "numeric",
          day: "numeric",
          year: "2-digit",
        }) +
        ", " +
        s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      );
    }
  }
  return dateType ?? "Flexible";
}

function extractTitle(description: string | null | undefined): string {
  if (!description) return "Open Position";
  const first = description.split("\n")[0].trim();
  if (first.length > 0 && first.length <= 80) return first;
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
  return first.slice(0, 60) + (first.length > 60 ? "…" : "");
}

function formatRate(
  isHourly: boolean | null | undefined,
  openRate: boolean | null | undefined,
  artistHourlyRate: number | null | undefined,
  clientHourlyRate: number | null | undefined
): string | null {
  if (openRate) return "Open rate";
  const rate = clientHourlyRate ?? artistHourlyRate;
  if (!rate) return null;
  return isHourly ? `$${rate}/hr` : `$${rate}`;
}

const ARTIST_TYPES = [
  "Dance Teacher",
  "Choreographer",
  "Performer",
  "Yoga Instructor",
  "Pilates Instructor",
  "Fitness Instructor",
  "Music Teacher",
  "Vocalist",
  "Photographer",
  "Videographer",
];

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl h-full flex items-center justify-between">
        <Link href="/" className="flex items-center select-none">
          <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
          <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">
            WRK
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-5">
          <Link
            href="/jobs"
            className="text-sm font-semibold text-[#111] border-b-2 border-[#F25722]"
          >
            Jobs
          </Link>
          <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            About
          </a>
          <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            For Hirers
          </a>
          <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            For Artists
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-black transition-colors"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-white bg-[#111] px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors"
          >
            Join
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Job Card (Jobs Near Me) ──────────────────────────────────────────────────

function JobCard({
  job,
  isSelected,
  onClick,
}: {
  job: DisplayJob;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#F25722] bg-orange-50 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      {/* Company avatar */}
      <div className="flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
        {job.clientProfilePicture ? (
          <img
            src={job.clientProfilePicture}
            alt={job.companyName ?? ""}
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fb = el.nextElementSibling as HTMLElement;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center text-white text-sm font-black artist-grad-bg"
          style={{ display: job.clientProfilePicture ? "none" : "flex" }}
        >
          {(job.companyName ?? job.title)[0]?.toUpperCase() ?? "?"}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <h3 className="font-bold text-[#111] text-sm leading-tight truncate">{job.title}</h3>
            {job.companyName && (
              <p className="text-xs text-gray-500 truncate">{job.companyName}</p>
            )}
          </div>
          <button
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Apply →
          </button>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <MapPin size={10} className="flex-shrink-0" />
          <span className="truncate">{job.location}</span>
          <span className="text-gray-200 mx-1">·</span>
          <span className="flex-shrink-0">Posted {job.postedAgo}</span>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-[#F25722] font-medium">
            <Clock size={10} />
            {job.datetime}
          </span>
          <span
            className={`font-medium border rounded-full px-2 py-0.5 ${
              job.rate ? "text-gray-600 border-gray-200" : "text-gray-400 border-gray-100"
            }`}
          >
            {job.rate ?? "Open rate"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PRO Job Card ─────────────────────────────────────────────────────────────

function ProJobCard({ job }: { job: DisplayJob }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-200 bg-amber-50 hover:border-yellow-300 hover:shadow-sm transition-all cursor-pointer">
      <div className="flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-yellow-100 flex items-center justify-center">
        {job.clientProfilePicture ? (
          <img
            src={job.clientProfilePicture}
            alt={job.companyName ?? ""}
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fb = el.nextElementSibling as HTMLElement;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center text-white text-sm font-black hirer-grad-bg"
          style={{ display: job.clientProfilePicture ? "none" : "flex" }}
        >
          {(job.companyName ?? job.title)[0]?.toUpperCase() ?? "?"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Star size={11} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
              <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">PRO</span>
            </div>
            <h3 className="font-bold text-[#111] text-sm leading-tight truncate">{job.title}</h3>
            {job.companyName && (
              <p className="text-xs text-gray-500 truncate">{job.companyName}</p>
            )}
          </div>
          <button
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            Apply →
          </button>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <MapPin size={10} className="flex-shrink-0" />
          <span className="truncate">{job.location}</span>
          <span className="text-gray-200 mx-1">·</span>
          <span className="flex-shrink-0">Posted {job.postedAgo}</span>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-[#F25722] font-medium">
            <Clock size={10} />
            {job.datetime}
          </span>
          {job.rate && (
            <span className="font-medium border border-yellow-200 rounded-full px-2 py-0.5 bg-white text-gray-600">
              {job.rate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

type AppStatus = "Interested" | "Confirmed" | "Declined";

const APP_STATUS_CONFIG: Record<
  AppStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  Interested: {
    label: "Applied",
    icon: <Briefcase size={11} />,
    className: "text-blue-600 bg-blue-50",
  },
  Confirmed: {
    label: "Confirmed",
    icon: <CheckCircle size={11} />,
    className: "text-green-600 bg-green-50",
  },
  Declined: {
    label: "Declined",
    icon: <AlertCircle size={11} />,
    className: "text-red-500 bg-red-50",
  },
};

function ApplicationCard({ job, status }: { job: DisplayJob; status: AppStatus }) {
  const cfg = APP_STATUS_CONFIG[status] ?? APP_STATUS_CONFIG.Interested;
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all">
      <div className="flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
        {job.clientProfilePicture ? (
          <img
            src={job.clientProfilePicture}
            alt={job.companyName ?? ""}
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fb = el.nextElementSibling as HTMLElement;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center text-white text-sm font-black artist-grad-bg"
          style={{ display: job.clientProfilePicture ? "none" : "flex" }}
        >
          {(job.companyName ?? job.title)[0]?.toUpperCase() ?? "?"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <h3 className="font-bold text-[#111] text-sm leading-tight truncate">{job.title}</h3>
            {job.companyName && (
              <p className="text-xs text-gray-500 truncate">{job.companyName}</p>
            )}
          </div>
          <span
            className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.className}`}
          >
            {cfg.icon} {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <MapPin size={10} className="flex-shrink-0" />
          <span className="truncate">{job.location}</span>
          <span className="text-gray-200 mx-1">·</span>
          <span className="flex-shrink-0">Posted {job.postedAgo}</span>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-[#F25722] font-medium">
            <Clock size={10} />
            {job.datetime}
          </span>
          {job.rate && (
            <span className="text-gray-500 font-medium border border-gray-100 rounded-full px-2 py-0.5">
              {job.rate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Map Panel with real Google Maps ─────────────────────────────────────────

function JobsMapPanel({
  jobs,
  selectedJob,
  onSelectJob,
}: {
  jobs: DisplayJob[];
  selectedJob: DisplayJob | null;
  onSelectJob: (job: DisplayJob) => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const prevJobsLenRef = useRef(0);

  const jobsWithCoords = useMemo(
    () => jobs.filter((j) => j.lat !== null && j.lng !== null),
    [jobs]
  );

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];

      if (jobsWithCoords.length === 0) return;

      const bounds = new google.maps.LatLngBounds();

      jobsWithCoords.forEach((job) => {
        const pos = { lat: job.lat!, lng: job.lng! };
        bounds.extend(pos);

        // Custom red teardrop pin
        const pin = document.createElement("div");
        pin.style.cssText = `
          width: 24px; height: 24px;
          background: #F25722;
          border: 2.5px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        `;

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: pos,
          title: job.title,
          content: pin,
        });

        marker.addListener("click", () => {
          onSelectJob(job);
          map.panTo(pos);
          map.setZoom(13);
        });

        markersRef.current.push(marker);
      });

      map.fitBounds(bounds, { top: 50, right: 50, bottom: 80, left: 50 });
      prevJobsLenRef.current = jobsWithCoords.length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobsWithCoords.length]
  );

  // Pan to selected job when it changes
  const prevSelectedIdRef = useRef<number | null>(null);
  if (
    selectedJob &&
    selectedJob.lat !== null &&
    selectedJob.lng !== null &&
    mapRef.current &&
    prevSelectedIdRef.current !== selectedJob.id
  ) {
    prevSelectedIdRef.current = selectedJob.id;
    mapRef.current.panTo({ lat: selectedJob.lat!, lng: selectedJob.lng! });
    mapRef.current.setZoom(13);
  }

  return (
    <MapView
      initialCenter={{ lat: 40.7128, lng: -74.006 }}
      initialZoom={10}
      onMapReady={handleMapReady}
      className="w-full h-full"
    />
  );
}

// ─── Main Jobs Page ───────────────────────────────────────────────────────────

type Tab = "near-me" | "pro" | "applications";

export default function Jobs() {
  const [tab, setTab] = useState<Tab>("near-me");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [artistType, setArtistType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [selectedJob, setSelectedJob] = useState<DisplayJob | null>(null);

  const { data: rawJobs, isLoading } = trpc.jobs.publicList.useQuery({ limit: 100 });

  const allJobs: DisplayJob[] = useMemo(() => {
    if (!rawJobs) return [];
    return rawJobs.map((j) => ({
      id: j.id,
      title: extractTitle(j.description),
      companyName: null,
      location: j.locationAddress
        ? j.locationAddress.split(",").slice(0, 2).join(",").trim()
        : "Work From Anywhere",
      postedAgo: timeAgo(j.bubbleCreatedAt),
      datetime: formatDatetime(j.startDate, j.dateType),
      rate: formatRate(j.isHourly, j.openRate, j.artistHourlyRate, j.clientHourlyRate),
      dateType: j.dateType ?? null,
      description: j.description ?? null,
      lat: j.locationLat ? parseFloat(j.locationLat) : null,
      lng: j.locationLng ? parseFloat(j.locationLng) : null,
      isDirect: j.direct ?? false,
      clientProfilePicture: null,
    }));
  }, [rawJobs]);

  // PRO jobs: use "direct" flag as proxy
  const proJobs = useMemo(
    () => allJobs.filter((j) => j.isDirect),
    [allJobs]
  );

  const filtered = useMemo(() => {
    return allJobs.filter((j) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !j.title.toLowerCase().includes(q) &&
          !j.location.toLowerCase().includes(q) &&
          !(j.description ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (location) {
        if (!j.location.toLowerCase().includes(location.toLowerCase())) return false;
      }
      return true;
    });
  }, [allJobs, search, location]);

  const hasFilters = !!(search || location || artistType || serviceType);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "near-me", label: "Jobs Near Me", count: allJobs.length },
    { id: "pro", label: "PRO Jobs", count: proJobs.length },
    { id: "applications", label: "Applications" },
  ];

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Navbar />

      {/* Page header + tabs */}
      <div className="pt-14 flex-shrink-0 bg-white border-b border-gray-100">
        <div className="px-5 lg:px-10 py-4 max-w-full">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h1 className="text-xl font-black text-[#111]">
                {tab === "near-me"
                  ? `Jobs For You${!isLoading && allJobs.length > 0 ? ` (${filtered.length})` : ""}`
                  : tab === "pro"
                  ? "PRO Jobs"
                  : "Applications"}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Exclusive Discounts for Artswrk Subscribers
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-[#111] text-white"
                    : "text-gray-500 hover:text-[#111] hover:bg-gray-100"
                }`}
              >
                {t.id === "pro" && (
                  <Star
                    size={12}
                    className={
                      tab === t.id ? "text-yellow-400 fill-yellow-400" : "text-gray-400"
                    }
                  />
                )}
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tab === t.id
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab: Jobs Near Me ── */}
      {tab === "near-me" && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: filters + job list */}
          <div className="w-full md:w-[420px] lg:w-[480px] flex flex-col border-r border-gray-100 flex-shrink-0">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Jobs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                  />
                </div>
                <div className="relative flex-1">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="New York, NY, USA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <select
                    value={artistType}
                    onChange={(e) => setArtistType(e.target.value)}
                    className="w-full appearance-none pl-3 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                  >
                    <option value="">Artist Type</option>
                    {ARTIST_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                <div className="relative flex-1">
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full appearance-none pl-3 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                  >
                    <option value="">Service Type</option>
                    <option value="teaching">Teaching</option>
                    <option value="performance">Performance</option>
                    <option value="choreography">Choreography</option>
                    <option value="judging">Judging / Adjudicating</option>
                    <option value="photography">Photography</option>
                    <option value="videography">Videography</option>
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                {hasFilters && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setLocation("");
                      setArtistType("");
                      setServiceType("");
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:text-[#d44a1a] transition-colors whitespace-nowrap"
                  >
                    <X size={12} /> Reset
                  </button>
                )}
              </div>
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
                    onClick={() =>
                      setSelectedJob(selectedJob?.id === job.id ? null : job)
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Google Map */}
          <div className="hidden md:flex flex-1 relative">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <Loader2 size={24} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <JobsMapPanel
                jobs={filtered}
                selectedJob={selectedJob}
                onSelectJob={(job) => setSelectedJob(job)}
              />
            )}

            {/* Selected job floating card */}
            {selectedJob && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-black artist-grad-bg">
                    {selectedJob.title[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[#111] text-sm truncate">
                      {selectedJob.title}
                    </h4>
                    <p className="text-xs text-gray-400 truncate">{selectedJob.location}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-[#F25722] font-medium">
                        {selectedJob.datetime}
                      </span>
                      {selectedJob.rate && (
                        <span className="text-xs font-semibold text-[#111]">
                          {selectedJob.rate}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors">
                  Apply →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: PRO Jobs ── */}
      {tab === "pro" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6">
            {/* PRO upsell banner */}
            <div className="rounded-2xl bg-[#111] p-5 mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                  <Star size={20} className="text-yellow-400 fill-yellow-400" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">Artswrk PRO</p>
                  <p className="text-white/60 text-xs">
                    Exclusive jobs from top studios — only visible to PRO members
                  </p>
                </div>
              </div>
              <button className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors px-4 py-2 rounded-full">
                Upgrade <ArrowRight size={12} />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading PRO jobs...</span>
              </div>
            ) : proJobs.length > 0 ? (
              <div className="space-y-3">
                {proJobs.map((job) => (
                  <ProJobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              /* Locked state — blurred preview */
              <div className="relative">
                <div className="space-y-3 pointer-events-none select-none">
                  {[
                    {
                      title: "Competition Choreographer",
                      company: "Elite Dance Academy",
                      location: "New York, NY",
                      rate: "$120/hr",
                    },
                    {
                      title: "Ballet Instructor — Recurring",
                      company: "Manhattan Dance Center",
                      location: "New York, NY",
                      rate: "$85/hr",
                    },
                    {
                      title: "Adjudicator — Spring Showcase",
                      company: "Regional Dance Alliance",
                      location: "Newark, NJ",
                      rate: "$200/event",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 rounded-xl border border-yellow-200 bg-amber-50 blur-sm"
                    >
                      <div className="w-11 h-11 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black flex-shrink-0">
                        {item.title[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Star size={11} className="text-yellow-500 fill-yellow-500" />
                          <span className="text-[10px] font-bold text-yellow-600 uppercase">
                            PRO
                          </span>
                        </div>
                        <p className="font-bold text-[#111] text-sm">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.company}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {item.location} · {item.rate}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center mb-3">
                    <Lock size={20} className="text-yellow-400" />
                  </div>
                  <p className="font-black text-[#111] text-base mb-1">PRO Jobs are locked</p>
                  <p className="text-xs text-gray-500 mb-4 text-center max-w-xs">
                    Upgrade to Artswrk PRO to unlock exclusive high-paying jobs from top studios.
                  </p>
                  <button className="flex items-center gap-1.5 text-sm font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors px-6 py-2.5 rounded-full">
                    Upgrade to PRO <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Applications ── */}
      {tab === "applications" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-[#111]">Your Applications</h2>
              <Link
                href="/login"
                className="text-xs font-semibold text-[#F25722] hover:underline"
              >
                Login to see all →
              </Link>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading applications...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Demo: first 3 jobs as sample applications with different statuses */}
                {allJobs.slice(0, 3).map((job, i) => (
                  <ApplicationCard
                    key={job.id}
                    job={job}
                    status={
                      (["Interested", "Confirmed", "Declined"] as AppStatus[])[i % 3]
                    }
                  />
                ))}

                {/* Login CTA */}
                <div className="mt-6 p-5 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <p className="text-sm font-semibold text-[#111] mb-1">
                    See all your applications
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Log in to track your full application history and status updates.
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors px-5 py-2 rounded-full"
                  >
                    Login to Artswrk <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
