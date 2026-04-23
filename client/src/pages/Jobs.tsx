/*
 * ARTSWRK JOBS PAGE — ARTIST VIEW
 * Three tabs: Jobs Near Me (map + list) | PRO Jobs | Applications
 * Map: real Google Maps with job pin markers
 * Data: real DB via tRPC (enriched jobs + PRO jobs + artist applications)
 */
import { useState, useMemo, useRef, useCallback } from "react";
import {
  Search, MapPin, Clock, ChevronDown, X, Star, Loader2,
  Briefcase, CheckCircle, AlertCircle, Lock, ArrowRight, Zap,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { useAuth } from "@/_core/hooks/useAuth";
import { toJobUrl } from "./JobDetail";
import { toProJobUrl } from "./ProJobDetail";
import SharedNavbar from "@/components/Navbar";
import ApplyGateModal, { type ApplyGateJob } from "@/components/ApplyGateModal";

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
  detailUrl: string;
}

interface DisplayProJob {
  id: number;
  title: string;
  company: string | null;
  logo: string | null;
  location: string;
  budget: string | null;
  postedAgo: string;
  workFromAnywhere: boolean;
  detailUrl: string;
}

interface DisplayApplication {
  id: number;
  title: string;
  companyName: string | null;
  location: string;
  postedAgo: string;
  datetime: string;    // formatted date/time of the job
  rate: string | null;
  status: string | null;
  jobId: number | null;
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

// ─── Subscription Paywall Modal ───────────────────────────────────────────────

function SubscriptionPaywallModal({
  isOpen,
  onClose,
  isLoggedIn,
}: {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#F25722] to-[#FF8C42]" />

        <div className="p-7">
          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF3EE] flex items-center justify-center mb-4">
              <Lock size={24} className="text-[#F25722]" />
            </div>
            <h2 className="text-xl font-black text-[#111] leading-tight mb-1.5">
              Subscribe to Apply
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Join Artswrk to unlock job applications and connect with top clients in the performing arts.
            </p>
          </div>

          {/* Plan cards */}
          <div className="space-y-3 mb-6">
            {/* Basic plan */}
            <div className="rounded-2xl border-2 border-[#F25722] bg-[#FFF8F5] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F25722] flex items-center justify-center">
                    <Zap size={13} className="text-white fill-white" />
                  </div>
                  <span className="font-black text-[#111] text-sm">Artswrk Basic</span>
                </div>
                <span className="text-xs font-bold text-[#F25722] bg-white border border-[#F25722]/20 px-2.5 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 mb-3">
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-[#F25722] flex-shrink-0" />
                  Apply to all marketplace jobs
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-[#F25722] flex-shrink-0" />
                  Get discovered by hirers
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-[#F25722] flex-shrink-0" />
                  Public artist profile
                </li>
              </ul>
              <Link
                href={isLoggedIn ? "/subscribe/basic" : "/join?next=/subscribe/basic"}
                className="block w-full text-center text-xs font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors py-2.5 rounded-xl"
              >
                Get Basic <ArrowRight size={12} className="inline ml-1" />
              </Link>
            </div>

            {/* PRO plan */}
            <div className="rounded-2xl border border-gray-200 bg-[#111] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                  <Star size={13} className="text-yellow-400 fill-yellow-400" />
                </div>
                <span className="font-black text-white text-sm">Artswrk PRO</span>
              </div>
              <ul className="text-xs text-white/70 space-y-1.5 mb-3">
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-yellow-400 flex-shrink-0" />
                  Everything in Basic
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-yellow-400 flex-shrink-0" />
                  Access PRO &amp; enterprise jobs
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-yellow-400 flex-shrink-0" />
                  Priority in search results
                </li>
              </ul>
              <Link
                href={isLoggedIn ? "/subscribe/pro" : "/join?next=/subscribe/pro"}
                className="block w-full text-center text-xs font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors py-2.5 rounded-xl"
              >
                Get PRO <ArrowRight size={12} className="inline ml-1" />
              </Link>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Navbar: using shared auth-aware component ─────────────────────────────────────────────
const Navbar = SharedNavbar;

// ─── Job Card (Jobs Near Me) ──────────────────────────────────────────────────

function JobCard({
  job,
  isSelected,
  onClick,
  canApply,
  onPaywall,
}: {
  job: DisplayJob;
  isSelected: boolean;
  onClick: () => void;
  canApply: boolean;
  onPaywall: () => void;
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
            <h3 className="font-semibold text-[#111] text-sm leading-tight truncate">{job.title}</h3>
            {job.companyName && (
              <p className="text-xs text-gray-500 truncate">{job.companyName}</p>
            )}
          </div>
          {canApply ? (
            <Link
              href={job.detailUrl}
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Apply →
            </Link>
          ) : (
            <button
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors"
              onClick={(e) => { e.stopPropagation(); onPaywall(); }}
            >
              <Lock size={10} /> Apply
            </button>
          )}
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

function ProJobCard({ job }: { job: DisplayProJob }) {
  return (
    <Link href={job.detailUrl}>
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-200 bg-amber-50 hover:border-yellow-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-yellow-100 flex items-center justify-center">
          {job.logo ? (
            <img
              src={job.logo}
              alt={job.company ?? ""}
              className="w-full h-full object-contain p-1"
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
            style={{ display: job.logo ? "none" : "flex" }}
          >
            {(job.company ?? job.title)[0]?.toUpperCase() ?? "?"}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Star size={11} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">PRO</span>
              </div>
              <h3 className="font-semibold text-[#111] text-sm leading-tight truncate">{job.title}</h3>
              {job.company && (
                <p className="text-xs text-gray-500 truncate">{job.company}</p>
              )}
            </div>
            <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold text-white hirer-grad-bg">
              View →
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
            <MapPin size={10} className="flex-shrink-0" />
            <span className="truncate">{job.location}</span>
            {job.workFromAnywhere && (
              <span className="text-green-500 font-medium ml-1">· Remote OK</span>
            )}
            <span className="text-gray-200 mx-1">·</span>
            <span className="flex-shrink-0">Posted {job.postedAgo}</span>
          </div>
          {job.budget && (
            <span className="font-medium border border-yellow-200 rounded-full px-2 py-0.5 bg-white text-gray-600 text-xs">
              {job.budget}
            </span>
          )}
        </div>
      </div>
    </Link>
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

function ApplicationCard({ job, status }: { job: DisplayApplication; status: AppStatus }) {
  const cfg = APP_STATUS_CONFIG[status as AppStatus] ?? APP_STATUS_CONFIG.Interested;
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
            <h3 className="font-semibold text-[#111] text-sm leading-tight truncate">{job.title}</h3>
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
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const initialTab = (searchParams.get("tab") as Tab) ?? "near-me";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [artistType, setArtistType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [selectedJob, setSelectedJob] = useState<DisplayJob | null>(null);

  const { user, isAuthenticated } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [gateJob, setGateJob] = useState<ApplyGateJob | null>(null);

  // Subscription access checks
  const isBasic = !!(user as any)?.artswrkBasic;
  const isPro = !!(user as any)?.artswrkPro;
  const canApplyToJobs = isBasic || isPro;   // Basic OR PRO can apply to regular jobs
  const canApplyToProJobs = isPro;            // Only PRO can apply to PRO jobs

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: rawJobs, isLoading: jobsLoading } = trpc.jobs.publicListEnriched.useQuery({ limit: 200 });
  const { data: rawProJobs, isLoading: proJobsLoading } = trpc.artistDashboard.getProJobsFeed.useQuery({ limit: 50 });
  const { data: rawApplications, isLoading: appsLoading } = trpc.jobs.myApplications.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const isLoading = jobsLoading;

  // ── Map regular jobs ──────────────────────────────────────────────────────
  const allJobs: DisplayJob[] = useMemo(() => {
    if (!rawJobs) return [];
    return rawJobs.map((j: any) => ({
      id: j.id,
      title: extractTitle(j.description),
      companyName: j.clientCompanyName ?? j.clientName ?? null,
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
      clientProfilePicture: j.clientProfilePicture ?? null,
      detailUrl: toJobUrl({ id: j.id, locationAddress: j.locationAddress, description: j.description }),
    }));
  }, [rawJobs]);

  // ── Map PRO jobs ──────────────────────────────────────────────────────────
  const proJobs: DisplayProJob[] = useMemo(() => {
    if (!rawProJobs) return [];
    return (rawProJobs as any[]).map((j) => ({
      id: j.id,
      title: j.serviceType ?? "Open Position",
      company: j.company ?? null,
      logo: j.logo ?? null,
      location: j.workFromAnywhere ? "Work From Anywhere" : (j.location ?? "Location TBD"),
      budget: j.budget ?? null,
      postedAgo: timeAgo(j.createdAt),
      workFromAnywhere: !!j.workFromAnywhere,
      detailUrl: toProJobUrl({ id: j.id, company: j.company, serviceType: j.serviceType }),
    }));
  }, [rawProJobs]);

  // ── Map applications ──────────────────────────────────────────────────────
  const myApplications: DisplayApplication[] = useMemo(() => {
    if (!rawApplications) return [];
    return (rawApplications as any[]).map((a) => ({
      id: a.id,
      title: extractTitle(a.description),
      companyName: a.clientCompanyName ?? null,
      location: a.locationAddress
        ? a.locationAddress.split(",").slice(0, 2).join(",").trim()
        : "Work From Anywhere",
      postedAgo: timeAgo(a.createdAt),
      datetime: formatDatetime(a.startDate, a.dateType),
      rate: formatRate(a.isHourly, a.openRate, a.artistHourlyRate, a.clientHourlyRate),
      status: a.status ?? null,
      jobId: a.jobId ?? null,
      clientProfilePicture: a.clientProfilePicture ?? null,
    }));
  }, [rawApplications]);

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
    { id: "applications", label: "Applications", count: isAuthenticated ? myApplications.length : undefined },
  ];

  // Build an ApplyGateJob from a DisplayJob
  function openGate(job: DisplayJob) {
    const applyUrl = job.detailUrl + "/apply";
    setGateJob({
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      datetime: job.datetime,
      rate: job.rate,
      description: job.description,
      applyUrl,
    });
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden" style={{ fontFamily: "Poppins, sans-serif" }}>
      <SubscriptionPaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      {gateJob && (
        <ApplyGateModal
          job={gateJob}
          onClose={() => setGateJob(null)}
        />
      )}
      <Navbar />

      {/* Page header + tabs — pt accounts for fixed nav (64px) + optional logged-in banner (28px) */}
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
              {/* Subscription banner for non-subscribers */}
              {isAuthenticated && !canApplyToJobs && (
                <button
                  onClick={() => setPaywallOpen(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#FFF3EE] to-[#FFF8F5] border border-[#F25722]/20 hover:border-[#F25722]/40 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F25722] flex items-center justify-center flex-shrink-0">
                    <Zap size={14} className="text-white fill-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#111]">Subscribe to apply to jobs</p>
                    <p className="text-[11px] text-gray-500">Get Basic or PRO to unlock applications</p>
                  </div>
                  <ArrowRight size={14} className="text-[#F25722] flex-shrink-0" />
                </button>
              )}

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
                    canApply={isAuthenticated ? canApplyToJobs : false}
                    onPaywall={() => isAuthenticated ? setPaywallOpen(true) : openGate(job)}
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
                {!isAuthenticated ? (
                  <button
                    onClick={() => openGate(selectedJob)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
                  >
                    Apply Now →
                  </button>
                ) : canApplyToJobs ? (
                  <Link
                    href={selectedJob.detailUrl}
                    className="mt-3 block w-full py-2 rounded-xl text-xs font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors text-center"
                  >
                    Apply →
                  </Link>
                ) : (
                  <button
                    onClick={() => setPaywallOpen(true)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors"
                  >
                    <Lock size={11} /> Subscribe to Apply
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: PRO Jobs ── */}
      {tab === "pro" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6">
            {/* PRO upsell banner — only show if not already PRO */}
            {!canApplyToProJobs && (
              <div className="rounded-2xl bg-[#111] p-5 mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                    <Star size={20} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm">Artswrk PRO</p>
                    <p className="text-white/60 text-xs">
                      Exclusive jobs from top studios and enterprise clients
                    </p>
                  </div>
                </div>
                <Link
                  href={isAuthenticated ? "/subscribe/pro" : "/join?next=/subscribe/pro"}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors px-4 py-2 rounded-full"
                >
                  Upgrade <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {proJobsLoading ? (
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
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-3">
                  <Star size={20} className="text-yellow-400" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No PRO jobs right now</p>
                <p className="text-xs text-gray-300 mt-1">Check back soon — new roles are added regularly</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Applications ── */}
      {tab === "applications" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6">
            {!isAuthenticated ? (
              /* Not logged in */
              <div className="mt-8 p-8 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center mx-auto mb-4">
                  <Lock size={20} className="text-white" />
                </div>
                <p className="text-base font-black text-[#111] mb-1">Track your applications</p>
                <p className="text-sm text-gray-400 mb-5">
                  Log in to see all your job applications and their current status.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors px-5 py-2.5 rounded-full"
                >
                  Login to Artswrk <ArrowRight size={14} />
                </Link>
              </div>
            ) : appsLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading applications...</span>
              </div>
            ) : myApplications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Briefcase size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No applications yet</p>
                <p className="text-xs text-gray-300 mt-1 mb-4">Browse jobs and apply to get started</p>
                <button
                  onClick={() => setTab("near-me")}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F25722] hover:underline"
                >
                  Browse jobs <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-black text-[#111]">
                    Your Applications ({myApplications.length})
                  </h2>
                </div>
                {myApplications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    job={app}
                    status={(app.status ?? "Interested") as AppStatus}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
