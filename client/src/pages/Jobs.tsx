/*
 * ARTSWRK JOBS PAGE — ARTIST VIEW
 * Three tabs: Jobs Near Me (map + list) | PRO Jobs | Applications
 * Map: real Google Maps with job pin markers
 * Data: real DB via tRPC (enriched jobs + PRO jobs + artist applications)
 */
import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, MapPin, Clock, ChevronDown, X, Star, Loader2,
  Briefcase, CheckCircle, AlertCircle, Lock, ArrowRight, Zap,
} from "lucide-react";
import { Link, useSearch, useLocation as useWouterLocation, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatLocation, getJobTitle } from "@/lib/utils";
import JobListCard, { ApplyCta } from "@/components/JobListCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { toJobUrl } from "./JobDetail";
import { toProJobUrl } from "./ProJobDetail";
import SharedNavbar from "@/components/Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationFilter {
  query: string;
  lat?: number;
  lng?: number;
}

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
  isBoosted: boolean;
}

interface DisplayProJob {
  id: number;
  title: string;
  company: string | null;
  logo: string | null;
  location: string;
  budget: string | null;
  description: string | null;
  postedAgo: string;
  workFromAnywhere: boolean;
  detailUrl: string;
  category: string | null;
}

interface DisplayApplication {
  id: number;
  title: string;
  companyName: string | null;
  location: string;
  postedAgo: string;
  datetime: string;    // formatted date/time of the job
  rate: string | null;
  detailUrl: string | null;
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
  if (dateType === "Dates Flexible") return "Flexible";
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

// Extract a city/state from job description text when locationAddress is not available
function extractLocationFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const patterns = [
    /\bin\s+([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})\b/,
    /\bat\s+([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})\b/,
    /\bnear\s+([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})\b/,
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*,\s*[A-Z]{2})\b/,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const loc = (match[1] ?? match[0]).trim();
      if (loc.length > 4 && loc.length < 50) return loc;
    }
  }
  return null;
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

// Artist types are now loaded from the server via trpc.jobs.getFilterOptions

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
  isAuthenticated = false,
  applied = false,
}: {
  job: DisplayJob;
  isAuthenticated?: boolean;
  applied?: boolean;
}) {
  return (
    <JobListCard
      href={job.detailUrl}
      avatarUrl={job.clientProfilePicture}
      avatarFallbackText={job.companyName ?? job.title}
      title={job.title}
      subtitle={isAuthenticated ? job.companyName : null}
      location={job.location}
      postedAgo={job.postedAgo}
      dateLabel={job.datetime}
      rate={job.rate ?? "Open rate"}
      cta={<ApplyCta applied={applied} />}
      topBadge={
        job.isBoosted ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722]">
            <Zap size={9} className="fill-[#F25722]" /> Priority Listing
          </span>
        ) : undefined
      }
    />
  );
}

// ─── PRO Job Card ─────────────────────────────────────────────────────────────

function ProJobCard({
  job,
  isAuthenticated,
  isPro,
  applied = false,
}: {
  job: DisplayProJob;
  isAuthenticated: boolean;
  isPro: boolean;
  applied?: boolean;
}) {
  // Every state is a single clickable card → the job detail page. The unlock/
  // apply CTA is a visual pill only — actually unlocking PRO always happens
  // on the detail page, never straight from the list.
  const showCompany = isAuthenticated && isPro;

  return (
    <JobListCard
      href={job.detailUrl}
      borderVariant="pro"
      avatarUrl={job.logo}
      avatarFallbackText={showCompany ? (job.company ?? job.title) : "?"}
      avatarBlurred={!showCompany}
      title={job.title}
      subtitle={showCompany ? job.company : null}
      location={job.location}
      dateLabel={job.budget ? `💳 ${job.budget}` : undefined}
      cta={
        !isAuthenticated ? (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#111]">Apply →</span>
        ) : !isPro ? (
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#111]">
            <Lock size={11} /> Unlock PRO
          </span>
        ) : (
          <ApplyCta applied={applied} />
        )
      }
      topBadge={
        <span className="flex items-center gap-1.5">
          <Star size={10} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
          <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">PRO Job</span>
        </span>
      }
    />
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
    <JobListCard
      href={job.detailUrl ?? "#"}
      avatarUrl={job.clientProfilePicture}
      avatarFallbackText={job.companyName ?? job.title}
      title={job.title}
      subtitle={job.companyName}
      location={job.location}
      postedAgo={job.postedAgo}
      dateLabel={job.datetime}
      rate={job.rate}
      cta={
        <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.className}`}>
          {cfg.icon} {cfg.label}
        </span>
      }
    />
  );
}

// ─── Main Jobs Page ───────────────────────────────────────────────────────────

type Tab = "near-me" | "pro" | "applications";

export default function Jobs({ inDashboard = false }: { inDashboard?: boolean }) {
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const [path] = useLocation();
  const initialTab: Tab =
    path === "/pro" || path === "/app/pro-jobs" ? "pro"
    : (searchParams.get("tab") as Tab) ?? "near-me";

  const [tab, setTab] = useState<Tab>(initialTab);

  // Keep the active tab in sync with the URL. This component doesn't remount
  // when the sidebar nav switches between /app/jobs, /app/pro-jobs, etc. (same
  // route tree, just a different matched Route), so without this the tab
  // would stay stuck on whatever it was last set to.
  useEffect(() => {
    const nextTab: Tab =
      path === "/pro" || path === "/app/pro-jobs" ? "pro"
      : (searchParams.get("tab") as Tab) ?? "near-me";
    setTab(nextTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, searchStr]);

  const [search, setSearch] = useState("");
  const [proSearch, setProSearch] = useState("");
  const [proCategory, setProCategory] = useState("");
  const [proRemoteOnly, setProRemoteOnly] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({ query: searchParams.get("location") ?? "" });
  const [artistType, setArtistType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const locationInputRef = useRef<HTMLInputElement>(null);
  const placesAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useWouterLocation();

  // Redirect clients away from the artist jobs page — they have their own dashboard
  useEffect(() => {
    if (user && (user as any).role === "client") {
      navigate("/app");
    }
  }, [user, navigate]);

  // Google Places Autocomplete for the location input
  useEffect(() => {
    if (!locationInputRef.current || typeof google === "undefined") return;
    if (placesAutocompleteRef.current) return; // already initialised
    try {
      const autocomplete = new google.maps.places.Autocomplete(locationInputRef.current, {
        types: ["(cities)"],
        fields: ["geometry", "formatted_address"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const query = place.formatted_address ?? locationInputRef.current?.value ?? "";
          setLocationFilter({ query, lat, lng });
        }
      });
      placesAutocompleteRef.current = autocomplete;
    } catch {
      // Google Maps not yet loaded — will retry on next render
    }
  });

  const [paywallOpen, setPaywallOpen] = useState(false);

  // Subscription access checks
  const isBasic = !!(user as any)?.artswrkBasic;
  const isPro = !!(user as any)?.artswrkPro;
  const canApplyToJobs = isBasic || isPro;   // Basic OR PRO can apply to regular jobs
  const canApplyToProJobs = isPro;            // Only PRO can apply to PRO jobs

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: filterOptions } = trpc.jobs.getFilterOptions.useQuery();

  // Stable filter input to avoid infinite re-fetch
  const filterInput = useMemo(() => ({
    limit: 600,
    artistType: artistType || undefined,
    serviceType: serviceType || undefined,
    locationLat: locationFilter.lat,
    locationLng: locationFilter.lng,
    locationQuery: !locationFilter.lat && locationFilter.query ? locationFilter.query : undefined,
  }), [artistType, serviceType, locationFilter.lat, locationFilter.lng, locationFilter.query]);

  const { data: rawJobs, isLoading: jobsLoading } = trpc.jobs.publicListEnriched.useQuery(filterInput);
  const { data: rawProJobs, isLoading: proJobsLoading } = trpc.artistDashboard.getProJobsFeed.useQuery({ limit: 50 });
  const { data: rawApplications, isLoading: appsLoading } = trpc.jobs.myApplications.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );
  const { data: rawProApplications, isLoading: proAppsLoading } = trpc.artistDashboard.getProApplications.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const isLoading = jobsLoading;

  // ── Map regular jobs ──────────────────────────────────────────────────────
  const allJobs: DisplayJob[] = useMemo(() => {
    if (!rawJobs) return [];
    return rawJobs.map((j: any) => ({
      id: j.id,
      title: getJobTitle(j.title, j.description, j.clientCompanyName ?? j.clientName),
      companyName: j.clientCompanyName ?? j.clientName ?? null,
      location: j.locationAddress
        ? (formatLocation(j.locationAddress) ?? "Remote / Flexible")
        : (extractLocationFromDescription(j.description) ?? (j.locationLat && j.locationLng ? "See map" : "Remote / Flexible")),
      postedAgo: timeAgo(j.bubbleCreatedAt),
      datetime: formatDatetime(j.startDate, j.dateType),
      rate: formatRate(j.isHourly, j.openRate, j.artistHourlyRate, j.clientHourlyRate),
      dateType: j.dateType ?? null,
      description: j.description ?? null,
      lat: j.locationLat ? parseFloat(j.locationLat) : null,
      lng: j.locationLng ? parseFloat(j.locationLng) : null,
      isDirect: j.direct ?? false,
      clientProfilePicture: j.clientProfilePicture ?? null,
      detailUrl: toJobUrl({ id: j.id, slug: j.slug, locationAddress: j.locationAddress, description: j.description }),
      isBoosted: !!(j.isBoosted) && (!j.boostEndDate || new Date(j.boostEndDate) > new Date()),
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
      description: j.description ?? null,
      postedAgo: timeAgo(j.createdAt),
      workFromAnywhere: !!j.workFromAnywhere,
      detailUrl: toProJobUrl({ id: j.id, company: j.company, serviceType: j.serviceType }),
      category: j.category ?? null,
    }));
  }, [rawProJobs]);

  // ── Map applications ──────────────────────────────────────────────────────
  const myApplications: DisplayApplication[] = useMemo(() => {
    if (!rawApplications) return [];
    return (rawApplications as any[]).map((a) => ({
      id: a.id,
      title: getJobTitle(a.title, a.description, a.clientCompanyName),
      companyName: a.clientCompanyName ?? null,
      location: formatLocation(a.locationAddress) ?? "Location TBD",
      detailUrl: a.jobId
        ? toJobUrl({ id: a.jobId, locationAddress: a.locationAddress, description: a.description })
        : null,
      postedAgo: timeAgo(a.createdAt),
      datetime: formatDatetime(a.startDate, a.dateType),
      rate: formatRate(a.isHourly, a.openRate, a.artistHourlyRate, a.clientHourlyRate),
      status: a.status ?? null,
      jobId: a.jobId ?? null,
      clientProfilePicture: a.clientProfilePicture ?? null,
    }));
  }, [rawApplications]);

  // Sets for O(1) applied-state lookup in card renders
  const appliedJobIds = useMemo<Set<number>>(() => {
    if (!rawApplications) return new Set();
    return new Set((rawApplications as any[]).map((a) => a.jobId).filter(Boolean));
  }, [rawApplications]);

  const appliedProJobIds = useMemo<Set<number>>(() => {
    if (!rawProApplications) return new Set();
    return new Set((rawProApplications as any[]).map((a) => a.premiumJobId).filter(Boolean));
  }, [rawProApplications]);

  // Client-side text search only; location/artistType/serviceType are server-side
  const filtered = useMemo(() => {
    const base = !search ? allJobs : (() => {
      const q = search.toLowerCase();
      return allJobs.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().includes(q)
      );
    })();
    return [...base].sort((a, b) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0));
  }, [allJobs, search]);

  const hasFilters = !!(search || locationFilter.query || artistType || serviceType);

  // Category options derived from the loaded PRO jobs feed
  const proCategories = useMemo(() => {
    const set = new Set<string>();
    proJobs.forEach((j) => { if (j.category) set.add(j.category); });
    return Array.from(set).sort();
  }, [proJobs]);

  // Fuzzy (substring) search + category/remote filters for PRO jobs
  const filteredProJobs = useMemo(() => {
    let base = proJobs;
    if (proSearch) {
      const q = proSearch.toLowerCase();
      base = base.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        (j.company ?? "").toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().includes(q)
      );
    }
    if (proCategory) base = base.filter((j) => j.category === proCategory);
    if (proRemoteOnly) base = base.filter((j) => j.workFromAnywhere);
    return base;
  }, [proJobs, proSearch, proCategory, proRemoteOnly]);

  const hasProFilters = !!(proSearch || proCategory || proRemoteOnly);

  // Fuzzy (substring) client-side search across both regular + PRO applications
  const filteredApplications = useMemo(() => {
    if (!appSearch) return myApplications;
    const q = appSearch.toLowerCase();
    return myApplications.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.companyName ?? "").toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q)
    );
  }, [myApplications, appSearch]);

  const filteredProApplications = useMemo(() => {
    if (!rawProApplications) return [];
    if (!appSearch) return rawProApplications as any[];
    const q = appSearch.toLowerCase();
    return (rawProApplications as any[]).filter((app) =>
      (app.serviceType ?? "").toLowerCase().includes(q) ||
      (app.company ?? "").toLowerCase().includes(q) ||
      (app.location ?? "").toLowerCase().includes(q)
    );
  }, [rawProApplications, appSearch]);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "near-me", label: "Jobs Near Me", count: allJobs.length },
    { id: "pro", label: "PRO Jobs", count: proJobs.length },
    { id: "applications", label: "Applications", count: isAuthenticated ? myApplications.length : undefined },
  ];

  return (
    <div className={`${inDashboard ? "h-full bg-gray-50" : "h-screen bg-white"} flex flex-col overflow-hidden`} style={{ fontFamily: "Poppins, sans-serif" }}>
      <SubscriptionPaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      {!inDashboard && <Navbar />}

      {/* Page header + tabs */}
      <div className={`${inDashboard ? "" : "pt-14 bg-white border-b border-gray-100"} flex-shrink-0`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
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
                Browse open jobs for artists on Artswrk
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); navigate(inDashboard ? (t.id === "pro" ? "/app/pro-jobs" : t.id === "near-me" ? "/app/jobs" : "/app/jobs?tab=" + t.id) : (t.id === "pro" ? "/pro" : t.id === "near-me" ? "/jobs" : "/jobs?tab=" + t.id)); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all flex-shrink-0 ${
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
                    className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
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
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Jobs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
              <div className="relative flex-1">
                <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={locationInputRef}
                  type="text"
                  placeholder="City, State..."
                  value={locationFilter.query}
                  onChange={(e) => setLocationFilter({ query: e.target.value })}
                  className="w-full pl-8 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
              <div className="relative sm:w-44 flex-shrink-0">
                <select
                  value={artistType}
                  onChange={(e) => { setArtistType(e.target.value); setServiceType(""); }}
                  className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                >
                  <option value="">Artist Type</option>
                  {(filterOptions?.artistTypes ?? []).map((t) => (
                    <option key={t.bubbleId} value={t.bubbleId}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative sm:w-44 flex-shrink-0">
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                >
                  <option value="">Service Type</option>
                  {(filterOptions?.serviceTypes ?? [])
                    .filter((s) => !artistType || s.artistTypeBubbleId === artistType || !s.artistTypeBubbleId)
                    .map((s) => (
                      <option key={s.bubbleId} value={s.bubbleId}>{s.name}</option>
                    ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSearch("");
                    setLocationFilter({ query: "" });
                    setArtistType("");
                    setServiceType("");
                  }}
                  className="flex items-center justify-center gap-1 text-xs font-semibold text-[#F25722] hover:text-[#d44a1a] transition-colors whitespace-nowrap px-2"
                >
                  <X size={12} /> Reset
                </button>
              )}
            </div>

            {/* Subscription banner for non-subscribers */}
            {isAuthenticated && !canApplyToJobs && (
              <button
                onClick={() => setPaywallOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#FFF3EE] to-[#FFF8F5] border border-[#F25722]/20 hover:border-[#F25722]/40 transition-all text-left mb-4"
              >
                <div className="w-8 h-8 rounded-lg bg-[#F25722] flex items-center justify-center flex-shrink-0">
                  <Zap size={14} className="text-white fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#111]">Subscribe to apply to jobs</p>
                  <p className="text-[11px] text-gray-500">Get Basic or PRO to unlock applications</p>
                </div>
                <ArrowRight size={14} className="text-[#F25722] flex-shrink-0" />
              </button>
            )}

            {/* Job list */}
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
              <div className="space-y-4">
                {filtered.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isAuthenticated={isAuthenticated}
                    applied={appliedJobIds.has(job.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: PRO Jobs ── */}
      {tab === "pro" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
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

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search PRO jobs..."
                  value={proSearch}
                  onChange={(e) => setProSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
              {proCategories.length > 0 && (
                <div className="relative sm:w-48 flex-shrink-0">
                  <select
                    value={proCategory}
                    onChange={(e) => setProCategory(e.target.value)}
                    className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {proCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}
              <button
                onClick={() => setProRemoteOnly((v) => !v)}
                className={`flex-shrink-0 flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg border transition-colors whitespace-nowrap ${
                  proRemoteOnly
                    ? "bg-[#111] border-[#111] text-white"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                Remote Only
              </button>
              {hasProFilters && (
                <button
                  onClick={() => { setProSearch(""); setProCategory(""); setProRemoteOnly(false); }}
                  className="flex items-center justify-center gap-1 text-xs font-semibold text-[#F25722] hover:text-[#d44a1a] transition-colors whitespace-nowrap px-2"
                >
                  <X size={12} /> Reset
                </button>
              )}
            </div>

            {proJobsLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading PRO jobs...</span>
              </div>
            ) : filteredProJobs.length > 0 ? (
              <div className="space-y-4">
                {filteredProJobs.map((job) => (
                  <ProJobCard
                    key={job.id}
                    job={job}
                    isAuthenticated={isAuthenticated}
                    isPro={canApplyToProJobs}
                    applied={appliedProJobIds.has(job.id)}
                  />
                ))}
              </div>
            ) : hasProFilters ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Search size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No PRO jobs match your filters</p>
                <p className="text-xs text-gray-300 mt-1">Try adjusting your search or filters</p>
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
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
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
            ) : appsLoading || proAppsLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading applications...</span>
              </div>
            ) : myApplications.length === 0 && (!rawProApplications || rawProApplications.length === 0) ? (
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
              <div className="space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search your applications..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                  />
                </div>

                {appSearch && filteredApplications.length === 0 && filteredProApplications.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <Search size={20} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-400">No applications match "{appSearch}"</p>
                    <p className="text-xs text-gray-300 mt-1">Try a different search term</p>
                  </div>
                )}

                {/* Regular job applications */}
                {filteredApplications.length > 0 && (
                  <div className="space-y-4">
                    {filteredApplications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        job={app}
                        status={(app.status ?? "Interested") as AppStatus}
                      />
                    ))}
                  </div>
                )}

                {/* PRO job applications */}
                {filteredProApplications.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-black text-[#111] flex items-center gap-1.5">
                      <Star size={13} className="text-yellow-500 fill-yellow-500" />
                      PRO Jobs ({filteredProApplications.length})
                    </h2>
                    {filteredProApplications.map((app) => (
                      <JobListCard
                        key={app.id}
                        borderVariant="pro"
                        href={`/pro/${(app.serviceType ?? "open-position").toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")}-${app.premiumJobId}`}
                        avatarUrl={app.logo}
                        avatarFallbackText={app.company ?? "?"}
                        title={app.serviceType ?? "Open Position"}
                        subtitle={app.company}
                        location={app.workFromAnywhere ? "Work From Anywhere" : (formatLocation(app.location) ?? "Location TBD")}
                        cta={
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            app.status === "Confirmed" ? "bg-green-50 text-green-600"
                            : app.status === "Declined" ? "bg-red-50 text-red-500"
                            : "bg-blue-50 text-blue-600"
                          }`}>
                            {app.status === "Confirmed" ? "Confirmed" : app.status === "Declined" ? "Declined" : "Applied"}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
