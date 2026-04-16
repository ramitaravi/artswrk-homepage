/**
 * Job Detail Page — /jobs/:locationSlug/:jobSlug
 *
 * SEO-optimised detail page for regular (marketplace) jobs.
 * URL pattern: /jobs/new-york-ny/dance-teacher-1234
 * The numeric ID is extracted from the end of jobSlug.
 * If the canonical slug doesn't match, the page redirects to the correct URL.
 *
 * Includes:
 *   - JSON-LD JobPosting schema for Google Jobs indexing
 *   - Breadcrumb schema
 *   - Visual breadcrumbs (shadcn/ui)
 *   - Full job details: rate, dates, location, description
 *   - Apply CTA (opens login if not authenticated)
 */
import { useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  MapPin, Clock, Calendar, DollarSign, Building2, ArrowLeft,
  ChevronRight, Loader2, AlertCircle, ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Slug helpers ─────────────────────────────────────────────────────────────

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
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  locationAddress: string | null;
  description: string | null;
}): string {
  const city = job.locationAddress
    ? job.locationAddress.split(",")[0].trim()
    : "remote";
  const title = extractTitleFromDescription(job.description);
  return `/jobs/${slugify(city)}/${slugify(title)}-${job.id}`;
}

// ─── JSON-LD helpers ──────────────────────────────────────────────────────────

function buildJobPostingSchema(job: any, title: string, rate: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description: job.description ?? title,
    datePosted: job.bubbleCreatedAt
      ? new Date(job.bubbleCreatedAt).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    ...(job.startDate ? { validThrough: new Date(job.startDate).toISOString().split("T")[0] } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: job.clientCompanyName ?? job.clientName ?? "Artswrk Client",
      ...(job.clientProfilePicture ? { logo: job.clientProfilePicture } : {}),
    },
    jobLocation: job.locationAddress
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            streetAddress: job.locationAddress,
          },
        }
      : { "@type": "Place", name: "Remote / Work From Anywhere" },
    ...(rate !== "Rate negotiable" && rate !== "Open rate — pitch yours"
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "USD",
            value: {
              "@type": "QuantitativeValue",
              value: (job.clientHourlyRate ?? job.artistHourlyRate) ?? 0,
              unitText: job.isHourly ? "HOUR" : "FIXED",
            },
          },
        }
      : {}),
    employmentType: job.dateType === "Ongoing"
      ? "PART_TIME"
      : job.dateType === "Recurring"
      ? "CONTRACTOR"
      : "CONTRACTOR",
    directApply: true,
    url: typeof window !== "undefined" ? window.location.href : "",
  };
}

function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: typeof window !== "undefined" ? `${window.location.origin}${item.url}` : item.url,
    })),
  };
}

// ─── Breadcrumb component ──────────────────────────────────────────────────────

function Breadcrumbs({
  crumbs,
}: {
  crumbs: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-400 flex-wrap">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-[#F25722] transition-colors font-medium">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-[#111] font-semibold">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobDetail() {
  const params = useParams<{ locationSlug: string; jobSlug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const jobId = extractIdFromSlug(params.jobSlug ?? "");

  const { data: job, isLoading, error } = trpc.jobs.getDetail.useQuery(
    { id: jobId! },
    { enabled: jobId !== null }
  );

  const title = useMemo(
    () => extractTitleFromDescription(job?.description),
    [job?.description]
  );
  const rate = useMemo(
    () =>
      job
        ? formatRate(job.isHourly, job.openRate, job.artistHourlyRate, job.clientHourlyRate)
        : "",
    [job]
  );
  const cityDisplay = useMemo(() => {
    if (!job?.locationAddress) return "Remote";
    return job.locationAddress.split(",").slice(0, 2).join(",").trim();
  }, [job?.locationAddress]);

  // Canonical redirect — if slug doesn't match, fix the URL
  useEffect(() => {
    if (!job) return;
    const canonical = toJobUrl(job);
    if (typeof window !== "undefined" && window.location.pathname !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [job, navigate]);

  // SEO: update document title + meta description
  useEffect(() => {
    if (!job || !title) return;
    const company = job.clientCompanyName ?? job.clientName ?? "Artswrk";
    document.title = `${title} at ${company} — ${cityDisplay} | Artswrk Jobs`;
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      `${title} position in ${cityDisplay}. ${
        rate !== "Rate negotiable" ? `Pay: ${rate}.` : ""
      } Apply now on Artswrk.`
    );
  }, [job, title, cityDisplay, rate]);

  if (jobId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Invalid job URL</p>
          <Link href="/jobs" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">
            ← Back to Jobs
          </Link>
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
          <Link href="/jobs" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  const company = job.clientCompanyName ?? job.clientName ?? "Artswrk Client";

  const breadcrumbs = [
    { label: "Jobs", href: "/jobs" },
    { label: cityDisplay, href: `/jobs?location=${encodeURIComponent(cityDisplay)}` },
    { label: title },
  ];

  const jsonLdJob = buildJobPostingSchema(job, title, rate);
  const jsonLdBreadcrumbs = buildBreadcrumbSchema(
    breadcrumbs.map((b) => ({ name: b.label, url: b.href ?? "" }))
  );

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdJob) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumbs) }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14">
        <div className="mx-auto px-5 lg:px-10 max-w-5xl h-full flex items-center justify-between">
          <Link href="/" className="flex items-center select-none">
            <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">
              WRK
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/artist-dashboard"
                className="text-sm font-semibold text-white bg-[#111] px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-black">
                  Login
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-white bg-[#111] px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors"
                >
                  Join
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-14">
        <div className="max-w-5xl mx-auto px-5 lg:px-10 py-8">
          {/* Back + Breadcrumbs */}
          <div className="mb-6">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-[#F25722] transition-colors mb-3"
            >
              <ArrowLeft size={14} />
              Back to Jobs
            </Link>
            <Breadcrumbs crumbs={breadcrumbs} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Main column ── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Hero card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  {/* Company avatar */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm">
                    {job.clientProfilePicture ? (
                      <img
                        src={job.clientProfilePicture}
                        alt={company}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xl font-black artist-grad-bg">
                        {company[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-black text-[#111] leading-tight mb-1">
                      {title}
                    </h1>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                      <Building2 size={13} className="flex-shrink-0" />
                      <span>{company}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={12} />
                        {cityDisplay}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[#F25722] font-semibold">
                        <DollarSign size={12} />
                        {rate}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12} />
                        Posted {timeAgo(job.bubbleCreatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                {job.requestStatus && (
                  <div className="mt-4 pt-4 border-t border-gray-50">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                        job.requestStatus === "Active"
                          ? "bg-green-50 text-green-600"
                          : job.requestStatus === "Confirmed"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          job.requestStatus === "Active"
                            ? "bg-green-500"
                            : job.requestStatus === "Confirmed"
                            ? "bg-blue-500"
                            : "bg-gray-400"
                        }`}
                      />
                      {job.requestStatus === "Active"
                        ? "Actively hiring"
                        : job.requestStatus}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {job.description && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h2 className="text-base font-black text-[#111] mb-4">About this role</h2>
                  <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-4">
              {/* Apply CTA */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-base font-black text-[#111] mb-1">Ready to apply?</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Sign up or log in to send your application in seconds.
                </p>
                {user ? (
                  <Link
                    href={`${toJobUrl(job)}/apply`}
                    className="block w-full text-center py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors"
                  >
                    Apply Now →
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`${toJobUrl(job)}/apply`}
                      className="block w-full text-center py-3 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors"
                    >
                      Login to Apply
                    </Link>
                    <Link
                      href="/signup"
                      className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-[#111] border border-gray-200 hover:bg-gray-50 transition-colors mt-2"
                    >
                      Create Free Account
                    </Link>
                  </>
                )}
              </div>

              {/* Job Details */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-sm font-black text-[#111] mb-4">Job details</h2>
                <div className="space-y-3">
                  {/* Rate */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <DollarSign size={13} className="text-[#F25722]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pay</p>
                      <p className="text-sm font-semibold text-[#111]">{rate}</p>
                    </div>
                  </div>

                  {/* Date */}
                  {(job.startDate || job.dateType) && (
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Calendar size={13} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Date</p>
                        <p className="text-sm font-semibold text-[#111]">
                          {job.dateType === "Ongoing"
                            ? "Ongoing"
                            : job.dateType === "Recurring"
                            ? "Recurring"
                            : formatDate(job.startDate)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <MapPin size={13} className="text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Location</p>
                      <p className="text-sm font-semibold text-[#111]">{cityDisplay}</p>
                      {job.locationAddress && job.locationAddress !== cityDisplay && (
                        <p className="text-xs text-gray-400 mt-0.5">{job.locationAddress}</p>
                      )}
                    </div>
                  </div>

                  {/* Job type */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={13} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Type</p>
                      <p className="text-sm font-semibold text-[#111]">
                        {job.dateType === "Ongoing"
                          ? "Ongoing / Part-time"
                          : job.dateType === "Recurring"
                          ? "Recurring"
                          : "Single date"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* About Artswrk */}
              <div className="bg-[#111] rounded-2xl p-5">
                <p className="text-white font-black text-sm mb-1">Find more jobs like this</p>
                <p className="text-white/60 text-xs mb-4">
                  Artswrk connects performing arts professionals with top studios and companies.
                </p>
                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111] bg-white hover:bg-gray-100 transition-colors px-4 py-2 rounded-full"
                >
                  Browse all jobs <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
