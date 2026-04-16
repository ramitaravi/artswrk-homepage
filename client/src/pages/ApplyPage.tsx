/**
 * Apply Page — /jobs/:locationSlug/:jobSlug/apply
 *
 * SEO: JobPosting JSON-LD with directApply:true, BreadcrumbList schema,
 *      dynamic <title> + meta description, canonical URL.
 *
 * UX:
 *  - Resume picker (library resumes from DB + upload new)
 *  - Cover message textarea
 *  - Rate pitch (pre-filled, editable if open rate)
 *  - Breadcrumbs: Jobs → City → Job Title → Apply
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Upload,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import {
  slugify,
  extractIdFromSlug,
  toJobUrl,
} from "./JobDetail";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ─── Helpers (shared with JobDetail) ─────────────────────────────────────────

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

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item:
        typeof window !== "undefined"
          ? `${window.location.origin}${item.url}`
          : item.url,
    })),
  };
}

function buildJobPostingSchema(job: any, title: string, rate: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description: job.description ?? title,
    datePosted: job.bubbleCreatedAt
      ? new Date(job.bubbleCreatedAt).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
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
    employmentType: "CONTRACTOR",
    directApply: true,
    url: typeof window !== "undefined" ? window.location.href : "",
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

// ─── Resume picker item ───────────────────────────────────────────────────────

type ResumeItem = { id: string; title: string; fileUrl: string; source: "library" | "profile" };

function ResumeCard({
  resume,
  selected,
  onSelect,
}: {
  resume: ResumeItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const ext = resume.fileUrl.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? "border-[#F25722] bg-orange-50"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          selected ? "bg-[#F25722]" : "bg-gray-100"
        }`}
      >
        <FileText size={16} className={selected ? "text-white" : "text-gray-400"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111] truncate">{resume.title}</p>
        <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">
          {isPdf ? "PDF" : ext.toUpperCase() || "File"} · {resume.source === "library" ? "Library" : "Profile"}
        </p>
      </div>
      {selected && <CheckCircle2 size={18} className="text-[#F25722] flex-shrink-0" />}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const params = useParams<{ locationSlug: string; jobSlug: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const jobId = extractIdFromSlug(params.jobSlug ?? "");

  const { data: job, isLoading: jobLoading } = trpc.jobs.getDetail.useQuery(
    { id: jobId! },
    { enabled: jobId !== null }
  );

  const { data: resumes = [], isLoading: resumesLoading } = trpc.jobs.myResumes.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const applyMutation = trpc.jobs.submitApplication.useMutation();
  const uploadResumeMutation = trpc.artists.uploadResume.useMutation();

  // Form state
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localResumes, setLocalResumes] = useState<ResumeItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge DB resumes + locally uploaded ones
  const allResumes = useMemo(() => {
    const ids = new Set(localResumes.map((r) => r.id));
    return [...localResumes, ...resumes.filter((r) => !ids.has(r.id))];
  }, [resumes, localResumes]);

  const title = useMemo(() => extractTitleFromDescription(job?.description), [job?.description]);
  const rate = useMemo(
    () => (job ? formatRate(job.isHourly, job.openRate, job.artistHourlyRate, job.clientHourlyRate) : ""),
    [job]
  );
  const cityDisplay = useMemo(() => {
    if (!job?.locationAddress) return "Remote";
    return job.locationAddress.split(",").slice(0, 2).join(",").trim();
  }, [job?.locationAddress]);

  const company = job?.clientCompanyName ?? job?.clientName ?? "Artswrk Client";

  // Pre-fill rate from job
  useEffect(() => {
    if (job && !rateInput) {
      const r = job.clientHourlyRate ?? job.artistHourlyRate;
      if (r) setRateInput(String(r));
    }
  }, [job]);

  // SEO: title + meta
  useEffect(() => {
    if (!job || !title) return;
    document.title = `Apply — ${title} at ${company} | Artswrk`;
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      `Apply for the ${title} position in ${cityDisplay} on Artswrk. ${
        rate !== "Rate negotiable" ? `Pay: ${rate}.` : ""
      } Submit your resume and cover message in seconds.`
    );
    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}${window.location.pathname}`);
  }, [job, title, cityDisplay, rate, company]);

  // Handle file upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File too large — max 8 MB per resume.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadResumeMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
        title: file.name.replace(/\.[^/.]+$/, ""),
      });
      setLocalResumes((prev) => [result, ...prev]);
      setSelectedResumeId(result.id);
      toast.success(`Resume uploaded: ${result.title}`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Submit application
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;

    const selectedResume = allResumes.find((r) => r.id === selectedResumeId);
    const rateNum = rateInput ? parseInt(rateInput.replace(/[^0-9]/g, ""), 10) : undefined;
    const isHourly = !!(job?.isHourly ?? true);

    try {
      await applyMutation.mutateAsync({
        jobId,
        message: message.trim() || undefined,
        resumeLink: selectedResume?.fileUrl || undefined,
        artistHourlyRate: isHourly ? rateNum : undefined,
        artistFlatRate: !isHourly ? rateNum : undefined,
        isHourlyRate: isHourly,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong. Please try again.");
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (jobId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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

  if (jobLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    const jobUrl = toJobUrl(job);
    const loginUrl = getLoginUrl();
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{ fontFamily: "Poppins, sans-serif" }}>
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl hirer-grad-bg flex items-center justify-center mx-auto mb-5">
            <FileText size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-[#111] mb-2">Sign in to apply</h1>
          <p className="text-sm text-gray-500 mb-6">
            Create a free account or log in to apply for{" "}
            <span className="font-semibold text-[#111]">{title}</span> at{" "}
            <span className="font-semibold text-[#111]">{company}</span>.
          </p>
          <a
            href={loginUrl}
            className="block w-full py-3 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors mb-3"
          >
            Login to Apply
          </a>
          <Link href={jobUrl} className="block text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to job
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{ fontFamily: "Poppins, sans-serif" }}>
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-5 shadow-lg">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#111] mb-2">Application sent!</h1>
          <p className="text-sm text-gray-500 mb-2">
            Your application for{" "}
            <span className="font-semibold text-[#111]">{title}</span> at{" "}
            <span className="font-semibold text-[#111]">{company}</span> has been submitted.
          </p>
          <p className="text-xs text-gray-400 mb-8">
            The hirer will be in touch if you're a good fit. You can track this in your dashboard.
          </p>
          <div className="space-y-2">
            <Link
              href="/app/jobs"
              className="block w-full py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors"
            >
              View My Applications
            </Link>
            <Link
              href="/jobs"
              className="block w-full py-2.5 rounded-xl text-sm font-semibold text-[#111] border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Browse More Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Breadcrumbs & JSON-LD ─────────────────────────────────────────────────

  const jobUrl = toJobUrl(job);
  const breadcrumbs = [
    { label: "Jobs", href: "/jobs" },
    { label: cityDisplay, href: `/jobs?location=${encodeURIComponent(cityDisplay)}` },
    { label: title, href: jobUrl },
    { label: "Apply" },
  ];

  const jsonLdJob = buildJobPostingSchema(job, title, rate);
  const jsonLdBreadcrumbs = buildBreadcrumbSchema(
    breadcrumbs.map((b) => ({ name: b.label, url: b.href ?? "" }))
  );

  const isOpenRate = job.openRate;

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

      {/* Shared auth-aware Navbar */}
      <Navbar />

      <div className="pt-14">
        <div className="max-w-4xl mx-auto px-5 lg:px-10 py-8">
          {/* Back + Breadcrumbs */}
          <div className="mb-6">
            <Link
              href={jobUrl}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-[#F25722] transition-colors mb-3"
            >
              <ArrowLeft size={14} />
              Back to job
            </Link>
            <Breadcrumbs crumbs={breadcrumbs} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ── Main form column ── */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Page header */}
                <div>
                  <h1 className="text-2xl font-black text-[#111] leading-tight">
                    Apply for {title}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    at <span className="font-semibold text-[#111]">{company}</span> · {cityDisplay}
                  </p>
                </div>

                {/* ── Resume picker ── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-black text-[#111]">Resume</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Select from your library or upload a new file
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#F25722] hover:text-[#d44a1a] transition-colors disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {uploading ? "Uploading…" : "Upload new"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {resumesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-gray-300" />
                    </div>
                  ) : allResumes.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                      <FileText size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 font-medium">No resumes yet</p>
                      <p className="text-xs text-gray-300 mt-1">Upload a PDF, Word doc, or image</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 text-xs font-semibold text-[#F25722] hover:underline"
                      >
                        + Upload resume
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {allResumes.map((r) => (
                        <ResumeCard
                          key={r.id}
                          resume={r}
                          selected={selectedResumeId === r.id}
                          onSelect={() =>
                            setSelectedResumeId((prev) => (prev === r.id ? null : r.id))
                          }
                        />
                      ))}
                    </div>
                  )}

                  {selectedResumeId && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                      <CheckCircle2 size={13} />
                      Resume selected
                    </div>
                  )}
                </div>

                {/* ── Cover message ── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h2 className="text-base font-black text-[#111] mb-1">Cover message</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Optional — tell the hirer why you're a great fit
                  </p>
                  <Textarea
                    placeholder={`Hi! I'm interested in the ${title} role. I have experience in…`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    className="resize-none text-sm border-gray-200 focus:border-[#F25722] focus:ring-[#F25722]/20 rounded-xl"
                  />
                  <p className="text-xs text-gray-300 mt-1.5 text-right">
                    {message.length}/2000
                  </p>
                </div>

                {/* ── Rate ── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h2 className="text-base font-black text-[#111] mb-1">
                    Your rate{" "}
                    {isOpenRate && (
                      <span className="text-xs font-normal text-[#F25722] ml-1">
                        (open — pitch yours)
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400 mb-3">
                    {job.isHourly ? "Hourly rate in USD" : "Flat rate in USD"}
                    {!isOpenRate && rate !== "Rate negotiable" && ` · Listed: ${rate}`}
                  </p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                      $
                    </span>
                    <Input
                      type="number"
                      min={0}
                      placeholder={isOpenRate ? "Enter your rate" : ""}
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      className="pl-7 border-gray-200 focus:border-[#F25722] rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* ── Submit ── */}
                <Button
                  type="submit"
                  disabled={applyMutation.isPending}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity h-auto"
                >
                  {applyMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit Application →"
                  )}
                </Button>
                <p className="text-xs text-gray-400 text-center">
                  Free to apply · No credit card required
                </p>
              </form>
            </div>

            {/* ── Sidebar: Job summary ── */}
            <div className="lg:col-span-2">
              <div className="sticky top-20 space-y-4">
                {/* Job card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                    You're applying to
                  </h2>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
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
                        <div className="w-full h-full flex items-center justify-center text-white text-base font-black hirer-grad-bg">
                          {company[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#111] text-sm leading-tight">{title}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <Building2 size={10} />
                        {company}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-gray-300 flex-shrink-0" />
                      {cityDisplay}
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign size={12} className="text-[#F25722] flex-shrink-0" />
                      <span className="font-semibold text-[#111]">{rate}</span>
                    </div>
                    {job.startDate && (
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-gray-300 flex-shrink-0" />
                        {new Date(job.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-50">
                    <Link
                      href={jobUrl}
                      className="text-xs font-semibold text-[#F25722] hover:underline"
                    >
                      View full job →
                    </Link>
                  </div>
                </div>

                {/* Tips card */}
                <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
                  <p className="text-xs font-bold text-amber-700 mb-2">💡 Application tips</p>
                  <ul className="text-xs text-amber-600 space-y-1.5">
                    <li>• Attach a resume to stand out</li>
                    <li>• Mention relevant experience in your message</li>
                    <li>• Hirers respond fastest within 24 hrs</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
