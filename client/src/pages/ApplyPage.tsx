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
 *  - Breadcrumbs: Jobs → Company → Job Title → Apply (Company crumb links
 *    to /studio/:clientUserId when available)
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
  Check,
  Trash2,
  Eye,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatLocation } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import DashboardLayout from "@/components/DashboardLayout";
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

function extractTitleFromDescription(description: string | null | undefined, clientName?: string | null): string {
  if (!description) return "Open Position";
  const first = description.split("\n")[0].trim();
  // Skip a first line that is just the poster's own name (legacy Bubble imports).
  const isPosterName = !!clientName && first.toLowerCase() === clientName.toLowerCase();
  if (first.length > 0 && first.length <= 80 && !isPosterName) return first;
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
  onDelete,
}: {
  resume: ResumeItem;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const ext = resume.fileUrl.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  return (
    // Root is a <div role="button"> rather than a native <button> because the
    // delete icon-button below needs to live inside this clickable card, and
    // HTML doesn't allow a <button> nested inside another <button>.
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
        selected
          ? "border-[#F25722] bg-orange-50"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      {/* Persistent checkbox-style indicator — always visible so it's obvious these cards are selectable */}
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          selected ? "bg-[#F25722] border-[#F25722]" : "bg-white border-gray-300"
        }`}
        aria-hidden="true"
      >
        {selected && <Check size={12} className="text-white" strokeWidth={3} />}
      </div>

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
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Preview — works for every resume regardless of source (library or profile) */}
        <a
          href={resume.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-gray-300 hover:text-[#F25722] hover:bg-orange-50 transition-colors"
          aria-label={`Preview ${resume.title}`}
        >
          <Eye size={15} />
        </a>
        {resume.source === "library" && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label={`Delete ${resume.title}`}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Confirm-delete-resume modal ─────────────────────────────────────────────
// Hand-rolled modal (backdrop + centered card), matching the pattern used by
// DeleteAccountModal in client/src/pages/artist/ArtistSettings.tsx — scoped
// here to just this one confirmation use case.

function ConfirmDeleteResumeModal({
  resume,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  resume: ResumeItem;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h2 className="text-lg font-black text-[#111] mb-1.5">Delete this resume?</h2>
        <p className="text-sm text-gray-500 mb-6">
          This will permanently remove &ldquo;{resume.title}&rdquo; from your resume library. This can&apos;t be
          undone.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-[#111] border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isDeleting && <Loader2 size={15} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  // Supports both /jobs/:jobSlug/apply (new) and /jobs/:locationSlug/:jobSlug/apply (legacy)
  const params = useParams<{ locationSlug?: string; jobSlug?: string; legacyJobSlug?: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // In the new pattern, jobSlug is the full slug. In legacy, it's the second segment.
  const rawSlug = params.jobSlug ?? params.legacyJobSlug ?? params.locationSlug ?? "";
  const jobId = extractIdFromSlug(rawSlug);

  const { data: job, isLoading: jobLoading } = trpc.jobs.getDetail.useQuery(
    { id: jobId! },
    { enabled: jobId !== null }
  );

  const { data: resumes = [], isLoading: resumesLoading } = trpc.jobs.myResumes.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Used to detect whether the artist has already applied to this job, so we
  // never show the (blank) apply form again on a repeat visit — see Fix 3.
  const { data: myApplications, isLoading: myApplicationsLoading } = trpc.jobs.myApplications.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

  const applyMutation = trpc.jobs.submitApplication.useMutation();
  const uploadResumeMutation = trpc.artists.uploadResume.useMutation();
  const deleteResumeMutation = trpc.artists.deleteResume.useMutation();

  // Form state
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [isHourlyPitch, setIsHourlyPitch] = useState<boolean>(true); // default set below once job loads
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localResumes, setLocalResumes] = useState<ResumeItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ resume?: string; message?: string }>({});
  // Resume pending delete confirmation — set on delete-button click, cleared
  // on cancel or after the confirmed delete completes. See Fix 2.
  const [resumeToDelete, setResumeToDelete] = useState<ResumeItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Merge DB resumes + locally uploaded ones
  const allResumes = useMemo(() => {
    const ids = new Set(localResumes.map((r) => r.id));
    return [...localResumes, ...resumes.filter((r) => !ids.has(r.id))];
  }, [resumes, localResumes]);

  const title = useMemo(() => (job as any)?.title || extractTitleFromDescription(job?.description, (job as any)?.clientCompanyName ?? (job as any)?.clientName), [job]);
  const rate = useMemo(
    () => (job ? formatRate(job.isHourly, job.openRate, job.artistHourlyRate, job.clientHourlyRate) : ""),
    [job]
  );
  const cityDisplay = useMemo(() => {
    return formatLocation(job?.locationAddress) ?? "Remote";
  }, [job?.locationAddress]);

  const company = job?.clientCompanyName ?? job?.clientName ?? "Artswrk Client";

  // Has the artist already applied to this exact job? Drives Fix 3 below —
  // once true, we always show the confirmation state instead of the form.
  const alreadyApplied = useMemo(() => {
    if (jobId === null || !myApplications) return false;
    return (myApplications as { jobId: number | null }[]).some((a) => a.jobId === jobId);
  }, [myApplications, jobId]);

  // Pre-fill rate from job
  useEffect(() => {
    if (job && !rateInput) {
      const r = job.clientHourlyRate ?? job.artistHourlyRate;
      if (r) setRateInput(String(r));
    }
  }, [job]);

  // Default the rate-type toggle to match the job's listed type; stays user-changeable after.
  useEffect(() => {
    if (job) setIsHourlyPitch(!!job.isHourly);
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

  // Delete a library resume
  async function handleDeleteResume(resume: ResumeItem) {
    if (resume.source !== "library") return;
    const numericId = parseInt(resume.id.replace(/^lib-/, ""), 10);
    if (Number.isNaN(numericId)) return;
    try {
      await deleteResumeMutation.mutateAsync({ id: numericId });
      setLocalResumes((prev) => prev.filter((r) => r.id !== resume.id));
      if (selectedResumeId === resume.id) setSelectedResumeId(null);
      await utils.jobs.myResumes.invalidate();
      toast.success("Resume deleted");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete resume");
    }
  }

  // Confirm-then-delete: called after the user confirms in ConfirmDeleteResumeModal.
  async function confirmDeleteResume() {
    if (!resumeToDelete) return;
    await handleDeleteResume(resumeToDelete);
    setResumeToDelete(null);
  }

  // Submit application
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;

    // Fix 1: resume + cover message are both required — validate before submitting.
    const nextErrors: { resume?: string; message?: string } = {};
    if (!selectedResumeId) nextErrors.resume = "Please select a resume.";
    if (!message.trim()) nextErrors.message = "Please add a cover message.";
    setFieldErrors(nextErrors);
    if (nextErrors.resume || nextErrors.message) return;

    const selectedResume = allResumes.find((r) => r.id === selectedResumeId);
    const rateNum = rateInput ? parseInt(rateInput.replace(/[^0-9]/g, ""), 10) : undefined;

    try {
      await applyMutation.mutateAsync({
        jobId,
        message: message.trim() || undefined,
        resumeLink: selectedResume?.fileUrl || undefined,
        artistHourlyRate: isHourlyPitch ? rateNum : undefined,
        artistFlatRate: !isHourlyPitch ? rateNum : undefined,
        isHourlyRate: isHourlyPitch,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong. Please try again.");
    }
  }

  // ── Page shell ─────────────────────────────────────────────────────────────
  // Logged-in users get the same dashboard chrome (sidebar, gray canvas,
  // centered width) as every other page; logged-out visitors get the
  // standalone public page with its own Navbar.
  const jobsBackHref = isAuthenticated ? "/app/jobs" : "/jobs";
  const shell = (content: React.ReactNode) =>
    isAuthenticated ? <DashboardLayout>{content}</DashboardLayout> : content;

  // ── Loading / error states ────────────────────────────────────────────────

  if (jobId === null) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Invalid job URL</p>
          <Link href={jobsBackHref} className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  if (jobLoading || authLoading) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!job) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Job not found</p>
          <Link href={jobsBackHref} className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">
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

  // ── Already-applied check (Fix 3) ─────────────────────────────────────────
  // Wait for the applications list before deciding whether to show the form,
  // so we never flash the blank form then swap to the confirmation state.

  if (myApplicationsLoading) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  // Shown both right after a fresh submit (`submitted`) and on any later
  // visit to this URL once we know the artist already applied
  // (`alreadyApplied`) — the artist should never see the blank form again.

  if (submitted || alreadyApplied) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mx-auto mb-5 shadow-lg">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#111] mb-2">
            {submitted ? "Application sent!" : "You've already applied"}
          </h1>
          <p className="text-sm text-gray-500 mb-2">
            Your application for{" "}
            <span className="font-semibold text-[#111]">{title}</span> at{" "}
            <span className="font-semibold text-[#111]">{company}</span>{" "}
            {submitted ? "has been submitted." : "was already submitted."}
          </p>
          <p className="text-xs text-gray-400 mb-8">
            The hirer will be in touch if you're a good fit. You can track this in your dashboard.
          </p>
          <div className="space-y-2">
            <Link
              href="/app/jobs?tab=applications"
              className="block w-full py-3 rounded-xl text-sm font-bold text-white bg-[#F25722] hover:bg-[#d44a1a] transition-colors"
            >
              View My Applications
            </Link>
            <Link
              href={jobsBackHref}
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
  const companyUrl = job.clientUserId ? `/studio/${job.clientUserId}` : undefined;
  const breadcrumbs = companyUrl
    ? [
        { label: "Jobs", href: jobsBackHref },
        { label: company, href: companyUrl },
        { label: title, href: jobUrl },
        { label: "Apply" },
      ]
    : [
        { label: "Jobs", href: jobsBackHref },
        { label: title, href: jobUrl },
        { label: "Apply" },
      ];

  const jsonLdJob = buildJobPostingSchema(job, title, rate);
  const jsonLdBreadcrumbs = buildBreadcrumbSchema(
    breadcrumbs.map((b) => ({ name: b.label, url: b.href ?? "" }))
  );

  const isOpenRate = !!job.openRate;

  return shell(
    <>
    <div className={isAuthenticated ? "" : "min-h-screen bg-gray-50"} style={{ fontFamily: "Poppins, sans-serif" }}>
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
      {!isAuthenticated && <Navbar />}

      <div className={isAuthenticated ? "" : "pt-14"}>
        <div className={isAuthenticated ? "max-w-5xl mx-auto px-4 md:px-6 py-6" : "max-w-4xl mx-auto px-5 lg:px-10 py-8"}>
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
                    at{" "}
                    {companyUrl ? (
                      <Link
                        href={companyUrl}
                        className="font-semibold text-[#111] hover:text-[#F25722] hover:underline transition-colors"
                      >
                        {company}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[#111]">{company}</span>
                    )}{" "}
                    · {cityDisplay}
                  </p>
                </div>

                {/* ── Resume picker ── */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-sm ${
                    fieldErrors.resume ? "border-red-300" : "border-gray-100"
                  }`}
                >
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
                          onSelect={() => {
                            setSelectedResumeId((prev) => (prev === r.id ? null : r.id));
                            setFieldErrors((prev) => ({ ...prev, resume: undefined }));
                          }}
                          onDelete={
                            r.source === "library" ? () => setResumeToDelete(r) : undefined
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
                  {fieldErrors.resume && (
                    <p className="mt-3 text-xs text-red-500 font-medium">{fieldErrors.resume}</p>
                  )}
                </div>

                {/* ── Cover message ── */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-sm ${
                    fieldErrors.message ? "border-red-300" : "border-gray-100"
                  }`}
                >
                  <h2 className="text-base font-black text-[#111] mb-1">Cover message</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Tell the hirer why you're a great fit
                  </p>
                  <Textarea
                    placeholder={`Hi! I'm interested in the ${title} role. I have experience in…`}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, message: undefined }));
                    }}
                    rows={5}
                    maxLength={2000}
                    className={`resize-none text-sm focus:ring-[#F25722]/20 rounded-xl ${
                      fieldErrors.message
                        ? "border-red-300 focus:border-red-400"
                        : "border-gray-200 focus:border-[#F25722]"
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    {fieldErrors.message ? (
                      <p className="text-xs text-red-500 font-medium">{fieldErrors.message}</p>
                    ) : (
                      <span />
                    )}
                    <p className="text-xs text-gray-300 text-right">
                      {message.length}/2000
                    </p>
                  </div>
                </div>

                {/* ── Rate — only shown when the job is open-rate; a fixed-rate job
                     has nothing for the artist to pitch, so we skip asking. ── */}
                {isOpenRate && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h2 className="text-base font-black text-[#111] mb-1">
                      Your rate{" "}
                      <span className="text-xs font-normal text-[#F25722] ml-1">
                        (open — pitch yours)
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400 mb-3">
                      {isHourlyPitch ? "Hourly rate in USD" : "Flat rate in USD"}
                    </p>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setIsHourlyPitch(false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          !isHourlyPitch
                            ? "bg-[#F25722] text-white border-[#F25722]"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        Flat Rate
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsHourlyPitch(true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          isHourlyPitch
                            ? "bg-[#F25722] text-white border-[#F25722]"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        Hourly Rate
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Enter your rate"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        className="pl-7 pr-12 border-gray-200 focus:border-[#F25722] rounded-xl text-sm"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold pointer-events-none">
                        {isHourlyPitch ? "/hr" : "flat"}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Submit ── */}
                <Button
                  type="submit"
                  disabled={
                    applyMutation.isPending ||
                    !selectedResumeId ||
                    !message.trim() ||
                    (isOpenRate && !rateInput.trim())
                  }
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity h-auto disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {companyUrl ? (
                          <Link href={companyUrl} className="hover:text-[#F25722] hover:underline transition-colors">
                            {company}
                          </Link>
                        ) : (
                          company
                        )}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {resumeToDelete && (
      <ConfirmDeleteResumeModal
        resume={resumeToDelete}
        onCancel={() => setResumeToDelete(null)}
        onConfirm={confirmDeleteResume}
        isDeleting={deleteResumeMutation.isPending}
      />
    )}
    </>
  );
}
