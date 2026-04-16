/**
 * PRO Job Detail Page — /jobs/pro/:companySlug/:jobSlug
 *
 * SEO-optimised detail page for enterprise / premium jobs.
 * URL pattern: /jobs/pro/elite-dance-academy/competition-choreographer-567
 * The numeric ID is extracted from the end of jobSlug.
 *
 * Includes:
 *   - JSON-LD JobPosting schema for Google Jobs indexing
 *   - Breadcrumb schema
 *   - Visual breadcrumbs
 *   - Full job details: budget, location, tags, description
 *   - Apply CTA — direct apply link or platform application
 */
import { useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  MapPin, Clock, DollarSign, Building2, ArrowLeft,
  ChevronRight, Loader2, AlertCircle, Globe, ExternalLink, Star,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { slugify, extractIdFromSlug } from "./JobDetail";

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

export function toProJobUrl(job: {
  id: number;
  company: string | null;
  serviceType: string | null;
}): string {
  const companySlug = slugify(job.company ?? "company");
  const titleSlug = slugify(job.serviceType ?? "open-position");
  return `/jobs/pro/${companySlug}/${titleSlug}-${job.id}`;
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function buildJobPostingSchema(job: any) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.serviceType ?? "Open Position",
    description: job.description ?? job.serviceType ?? "Open Position at " + job.company,
    datePosted: job.bubbleCreatedAt
      ? new Date(job.bubbleCreatedAt).toISOString().split("T")[0]
      : new Date(job.createdAt).toISOString().split("T")[0],
    hiringOrganization: {
      "@type": "Organization",
      name: job.company ?? "Artswrk Enterprise Client",
      ...(job.logo ? { logo: job.logo } : {}),
    },
    jobLocation: job.workFromAnywhere
      ? { "@type": "Place", name: "Work From Anywhere / Remote" }
      : job.location
      ? { "@type": "Place", address: { "@type": "PostalAddress", name: job.location } }
      : undefined,
    jobBenefits: "Access to performing arts community via Artswrk",
    ...(job.budget ? { baseSalary: { "@type": "MonetaryAmount", description: job.budget } } : {}),
    employmentType: "CONTRACTOR",
    directApply: !job.applyDirect,
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

// ─── Breadcrumb component ─────────────────────────────────────────────────────

function Breadcrumbs({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
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

export default function ProJobDetail() {
  const params = useParams<{ companySlug: string; jobSlug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const jobId = extractIdFromSlug(params.jobSlug ?? "");

  const { data: result, isLoading, error } = trpc.enterprise.getJobDetail.useQuery(
    { jobId: jobId! },
    { enabled: jobId !== null }
  );
  const job = result?.job ?? null;

  // Canonical redirect
  useEffect(() => {
    if (!job) return;
    const canonical = toProJobUrl(job as any);
    if (typeof window !== "undefined" && window.location.pathname !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [job, navigate]);

  const title = job?.serviceType ?? "Open Position";
  const company = job?.company ?? "Artswrk Enterprise";
  const location = job?.workFromAnywhere
    ? "Work From Anywhere"
    : (job as any)?.location ?? "Location not specified";

  // SEO
  useEffect(() => {
    if (!job) return;
    document.title = `${title} at ${company} — ${location} | Artswrk PRO Jobs`;
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      `${title} position at ${company} in ${location}. ${
        (job as any).budget ? `Pay: ${(job as any).budget}.` : ""
      } Apply on Artswrk PRO.`
    );
  }, [job, title, company, location]);

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
          <p className="font-semibold text-gray-500">PRO job not found</p>
          <Link href="/jobs" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  const j = job as any;

  const breadcrumbs = [
    { label: "Jobs", href: "/jobs" },
    { label: "PRO Jobs", href: "/jobs?tab=pro" },
    { label: company, href: `/jobs/pro/${slugify(company)}` },
    { label: title },
  ];

  const jsonLdJob = buildJobPostingSchema(j);
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
              <div className="bg-white rounded-2xl border border-yellow-200 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  {/* Company logo */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden bg-yellow-50 flex items-center justify-center shadow-sm border border-yellow-100">
                    {j.logo ? (
                      <img
                        src={j.logo}
                        alt={company}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xl font-black hirer-grad-bg">
                        {company[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* PRO badge */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <Star size={12} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold text-yellow-600 uppercase tracking-wide">
                        PRO Job
                      </span>
                      {j.featured && (
                        <span className="text-xs font-bold text-white bg-[#F25722] px-2 py-0.5 rounded-full ml-1">
                          Featured
                        </span>
                      )}
                    </div>

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
                        {location}
                      </span>
                      {j.budget && (
                        <span className="flex items-center gap-1.5 text-xs text-[#F25722] font-semibold">
                          <DollarSign size={12} />
                          {j.budget}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12} />
                        Posted {timeAgo(j.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {j.tag && (
                  <div className="mt-4 pt-4 border-t border-yellow-50">
                    <div className="flex flex-wrap gap-2">
                      {j.tag
                        .split(/[\s#,]+/)
                        .filter(Boolean)
                        .map((t: string, i: number) => (
                          <span
                            key={i}
                            className="text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-100 px-3 py-1 rounded-full"
                          >
                            {t}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {j.description && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h2 className="text-base font-black text-[#111] mb-4">About this role</h2>
                  <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {j.description}
                  </div>
                </div>
              )}

              {/* Category */}
              {j.category && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h2 className="text-base font-black text-[#111] mb-3">Category</h2>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-100 px-4 py-2 rounded-full">
                    {j.category}
                  </span>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-4">
              {/* Apply CTA */}
              <div className="bg-white rounded-2xl border border-yellow-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <h2 className="text-base font-black text-[#111]">Apply now</h2>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {j.applyDirect
                    ? "This employer accepts direct applications."
                    : "Apply through Artswrk to stand out."}
                </p>

                {j.applyDirect ? (
                  <>
                    {j.applyLink && (
                      <a
                        href={j.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-sm font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors"
                      >
                        Apply Directly <ExternalLink size={13} />
                      </a>
                    )}
                    {j.applyEmail && (
                      <a
                        href={`mailto:${j.applyEmail}`}
                        className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-[#111] border border-gray-200 hover:bg-gray-50 transition-colors mt-2"
                      >
                        Email Application
                      </a>
                    )}
                  </>
                ) : user ? (
                  <button className="block w-full text-center py-3 rounded-xl text-sm font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors">
                    Apply via Artswrk →
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block w-full text-center py-3 rounded-xl text-sm font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors"
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
                  {j.budget && (
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                        <DollarSign size={13} className="text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Budget</p>
                        <p className="text-sm font-semibold text-[#111]">{j.budget}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <MapPin size={13} className="text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Location</p>
                      <p className="text-sm font-semibold text-[#111]">{location}</p>
                      {j.workFromAnywhere && (
                        <p className="text-xs text-green-500 mt-0.5 font-medium">Remote OK</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={13} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Employment type</p>
                      <p className="text-sm font-semibold text-[#111]">Contract / Project</p>
                    </div>
                  </div>

                  {j.status && (
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Globe size={13} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Status</p>
                        <p className="text-sm font-semibold text-[#111]">{j.status}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* About company */}
              <div className="bg-[#111] rounded-2xl p-5">
                <p className="text-white font-black text-sm mb-1">More PRO jobs</p>
                <p className="text-white/60 text-xs mb-4">
                  Browse exclusive roles from top studios and production companies.
                </p>
                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111] bg-yellow-400 hover:bg-yellow-300 transition-colors px-4 py-2 rounded-full"
                >
                  View all PRO jobs <Star size={11} className="fill-current" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
