/**
 * Job Detail Page — /jobs/:jobSlug
 *
 * Three auth states:
 *   logged out        → job content shown (company identity hidden), inline auth form
 *   logged in, free   → job shown fully, upgrade to basic CTA
 *   logged in, basic+ → full access, apply button
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  MapPin, Clock, Calendar, DollarSign, ArrowLeft,
  Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import InlineAuth from "@/components/InlineAuth";

// ─── Slug helpers (exported — used by other pages) ────────────────────────────

export function slugify(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function extractIdFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function extractTitleFromDescription(description: string | null | undefined): string {
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
  isHourly: boolean | null,
  openRate: boolean | null,
  artistRate: number | null,
  clientRate: number | null
): string {
  if (openRate) return "Open rate — pitch yours";
  const rate = clientRate ?? artistRate;
  if (!rate) return "Rate negotiable";
  return isHourly ? `$${rate}/hr` : `$${rate} flat`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Flexible";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Flexible";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

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

export function toJobUrl(job: {
  id: number;
  slug?: string | null;
  locationAddress?: string | null;
  description?: string | null;
}): string {
  if (job.slug) return `/jobs/${job.slug}`;
  const title = extractTitleFromDescription(job.description ?? null);
  return `/jobs/${slugify(title)}-${job.id}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobDetail() {
  const params = useParams<{ locationSlug?: string; jobSlug?: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const isBasic = !!(user as any)?.artswrkBasic;
  const isPro = !!(user as any)?.artswrkPro;
  const canApply = isBasic || isPro;

  const rawSlug = params.jobSlug ?? params.locationSlug ?? "";
  const jobId = extractIdFromSlug(rawSlug);

  const { data: job, isLoading, error } = trpc.jobs.getDetail.useQuery(
    { id: jobId! },
    { enabled: jobId !== null }
  );

  const applyMutation = trpc.jobs.submitApplication.useMutation();
  const [applied, setApplied] = useState(false);

  const title = useMemo(() => extractTitleFromDescription(job?.description), [job?.description]);
  const rate = useMemo(
    () => job ? formatRate(job.isHourly, job.openRate, job.artistHourlyRate, job.clientHourlyRate) : "",
    [job]
  );
  const cityDisplay = useMemo(() => {
    if (!job?.locationAddress) return "Remote";
    return job.locationAddress.split(",").slice(0, 2).join(",").trim();
  }, [job?.locationAddress]);

  // Canonical redirect (legacy two-segment URLs)
  useEffect(() => {
    if (!job) return;
    const canonical = toJobUrl(job);
    const current = typeof window !== "undefined" ? window.location.pathname : "";
    if (current.match(/^\/jobs\/[^/]+\/[^/]+$/) && current !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [job, navigate]);

  // SEO
  useEffect(() => {
    if (!job || !title) return;
    const company = job.clientCompanyName ?? job.clientName ?? "Artswrk";
    document.title = `${title} · ${cityDisplay} | Artswrk Jobs`;
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", `${title} in ${cityDisplay}. ${rate !== "Rate negotiable" ? `Pay: ${rate}.` : ""} Apply on Artswrk.`);
  }, [job, title, cityDisplay, rate]);

  // ── Loading / error states ────────────────────────────────────────────────

  if (jobId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Invalid job URL</p>
          <Link href="/jobs" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">← Back to Jobs</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Job not found</p>
          <Link href="/jobs" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">← Back to Jobs</Link>
        </div>
      </div>
    );
  }

  const jobUrl = toJobUrl(job);
  const applyUrl = `${jobUrl}/apply`;
  const company = job.clientCompanyName ?? job.clientName ?? "Artswrk Client";
  const dateLabel = job.dateType === "Ongoing" ? "Ongoing"
    : job.dateType === "Recurring" ? "Recurring"
    : formatDate(job.startDate);

  // ── Sidebar / bottom CTA ─────────────────────────────────────────────────

  const ctaSection = !isAuthenticated ? (
    <InlineAuth nextUrl={jobUrl} heading="Join Artswrk to apply" />
  ) : !canApply ? (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <p className="text-base font-black text-[#111] mb-1">Artswrk Basic</p>
      <p className="text-xs text-gray-400 mb-4">Subscribe to apply to jobs on Artswrk.</p>
      <a
        href="/app/settings"
        className="block w-full text-center py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity"
      >
        Subscribe to apply →
      </a>
    </div>
  ) : applied ? (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-50 border border-green-100 text-green-700 font-semibold text-sm justify-center">
        <CheckCircle2 size={16} /> Applied!
      </div>
    </div>
  ) : (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <p className="text-base font-black text-[#111] mb-1">Ready to apply?</p>
      <p className="text-xs text-gray-400 mb-4">Send your application in seconds.</p>
      <Link
        href={applyUrl}
        className="block w-full text-center py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity"
      >
        Apply Now →
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Navbar />

      <div className="pt-14 pb-28 lg:pb-10">
        <div className="max-w-4xl mx-auto px-5 py-8">
          {/* Back link */}
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-[#111] transition-colors mb-6"
          >
            <ArrowLeft size={14} /> Back to Jobs
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Main column ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Job header */}
              <div>
                <h1 className="text-3xl font-black text-[#111] leading-tight mb-3">{title}</h1>

                {/* Company row — hidden for logged-out */}
                <div className="flex items-center gap-3 mb-4">
                  {isAuthenticated ? (
                    <>
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {job.clientProfilePicture ? (
                          <img src={job.clientProfilePicture} alt={company} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-black text-gray-500">{company[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-600">{company}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-full bg-gray-200 blur-sm flex-shrink-0" />
                      <span className="text-sm text-gray-400 select-none">
                        Company hidden · <a href="/join" className="text-[#F25722] font-semibold hover:underline">Join to see</a>
                      </span>
                    </>
                  )}
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                    <MapPin size={11} /> {cityDisplay}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F25722] bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full">
                    <DollarSign size={11} /> {rate}
                  </span>
                  {(job.startDate || job.dateType) && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                      <Calendar size={11} /> {dateLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                    <Clock size={11} /> Posted {timeAgo(job.bubbleCreatedAt)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {job.description && (
                <div className="border-t border-gray-100 pt-5">
                  <h2 className="text-sm font-black text-[#111] mb-3">About this role</h2>
                  <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </div>
                </div>
              )}

              {/* Mobile CTA */}
              <div className="lg:hidden pt-2">{ctaSection}</div>
            </div>

            {/* ── Sidebar (desktop) ── */}
            <div className="hidden lg:block space-y-4">
              {ctaSection}

              {/* More jobs */}
              <div className="bg-[#111] rounded-2xl p-5">
                <p className="text-white font-black text-sm mb-1">More jobs like this</p>
                <p className="text-white/60 text-xs mb-4">Browse hundreds of open roles for performing artists.</p>
                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white border border-white/30 hover:bg-white/10 transition-colors px-4 py-2 rounded-full"
                >
                  Browse all jobs →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky bottom bar (mobile) ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div>
          <p className="text-base font-black text-[#111]">{rate}</p>
          <p className="text-xs text-gray-400">{cityDisplay}</p>
        </div>
        {!isAuthenticated ? (
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); document.querySelector<HTMLInputElement>("input[type=email]")?.focus(); }}
            className="flex-shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity"
          >
            Sign up to apply
          </a>
        ) : !canApply ? (
          <a
            href="/app/settings"
            className="flex-shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity"
          >
            Subscribe →
          </a>
        ) : applied ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <CheckCircle2 size={16} /> Applied!
          </span>
        ) : (
          <Link
            href={applyUrl}
            className="flex-shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity"
          >
            Apply Now →
          </Link>
        )}
      </div>
    </div>
  );
}
