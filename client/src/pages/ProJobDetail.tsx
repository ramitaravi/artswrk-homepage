/**
 * PRO Job Detail Page — /pro/:jobSlug
 *
 * Layout: single-column, Nova-style.
 * - "Apply Now" + "Share" buttons above description
 * - Apply form inline at bottom of content (scrolled to on click)
 * - Sticky bottom bar always visible
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  MapPin, Clock, ArrowLeft, Star, Loader2, AlertCircle, CheckCircle2,
  FileText, Upload, DollarSign, Share2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { slugify, extractIdFromSlug } from "./JobDetail";
import Navbar from "@/components/Navbar";
import InlineAuth from "@/components/InlineAuth";
import { toast } from "sonner";

// ─── URL helper ───────────────────────────────────────────────────────────────

export function toProJobUrl(job: {
  id: number;
  company: string | null;
  serviceType: string | null;
}): string {
  const titleSlug = slugify(job.serviceType ?? "open-position");
  return `/pro/${titleSlug}-${job.id}`;
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

// ─── Resume card ──────────────────────────────────────────────────────────────

type ResumeItem = { id: string; title: string; fileUrl: string; source: "library" | "profile" };

function ResumeCard({ resume, selected, onSelect }: { resume: ResumeItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
        selected ? "border-[#111] bg-gray-50" : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? "bg-[#111]" : "bg-gray-100"}`}>
        <FileText size={14} className={selected ? "text-white" : "text-gray-400"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111] truncate">{resume.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {resume.fileUrl.split(".").pop()?.toUpperCase() || "File"} · {resume.source === "library" ? "Library" : "Profile"}
        </p>
      </div>
      {selected && <CheckCircle2 size={16} className="text-[#111] flex-shrink-0" />}
    </button>
  );
}

// ─── Inline apply form ────────────────────────────────────────────────────────

type ApplicationSummary = { resumeTitle?: string; resumeLink?: string; message?: string; rate?: string };

function ProApplyForm({
  jobId,
  jobTitle,
  company,
  hasOpenBudget,
  onApplied,
}: {
  jobId: number;
  jobTitle: string;
  company: string;
  hasOpenBudget: boolean;
  onApplied: (summary: ApplicationSummary) => void;
}) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: resumes = [], isLoading: resumesLoading } = trpc.jobs.myResumes.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const uploadResumeMutation = trpc.artists.uploadResume.useMutation();
  const applyMutation = trpc.artistDashboard.applyToProJob.useMutation({
    onSuccess: (_data, variables) => {
      // Invalidate so Applications tab + dashboard both reflect the new record
      utils.artistDashboard.getProApplications.invalidate();
      utils.artistDashboard.checkProJobApplication.invalidate({ premiumJobId: jobId });
      const selectedResume = allResumesRef.current.find((r) => r.id === selectedResumeIdRef.current);
      onApplied({
        resumeTitle: selectedResume?.title,
        resumeLink: selectedResume?.fileUrl,
        message: variables.message,
        rate: variables.rate,
      });
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [rateType, setRateType] = useState<"flat" | "hourly">("flat");
  const [uploading, setUploading] = useState(false);
  const [localResumes, setLocalResumes] = useState<ResumeItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs so onSuccess closure can read latest values without stale captures
  const selectedResumeIdRef = useRef<string | null>(null);
  const allResumesRef = useRef<ResumeItem[]>([]);

  const allResumes = useMemo(() => {
    const ids = new Set(localResumes.map((r) => r.id));
    const merged = [...localResumes, ...(resumes as ResumeItem[]).filter((r) => !ids.has(r.id))];
    allResumesRef.current = merged;
    return merged;
  }, [resumes, localResumes]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Max 8 MB per resume."); return; }
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
      setLocalResumes((prev) => [result as ResumeItem, ...prev]);
      setSelectedResumeId(result.id);
      toast.success(`Uploaded: ${result.title}`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const canSubmit =
    message.trim().length > 0 &&
    (!hasOpenBudget || rateInput.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    selectedResumeIdRef.current = selectedResumeId;
    const selectedResume = allResumes.find((r) => r.id === selectedResumeId);
    const formattedRate = rateInput.trim()
      ? `$${rateInput.trim()}${rateType === "hourly" ? "/hr" : " flat"}`
      : undefined;
    applyMutation.mutate({
      premiumJobId: jobId,
      message: message.trim() || undefined,
      resumeLink: selectedResume?.fileUrl || undefined,
      rate: formattedRate,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Resume picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-[#111]">Resume</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#111] transition-colors disabled:opacity-40"
          >
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {uploading ? "Uploading…" : "Upload new"}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={handleFileUpload} />
        </div>

        {resumesLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-gray-300" />
          </div>
        ) : allResumes.length === 0 ? (
          <div className="border-2 border-dashed border-gray-100 rounded-xl p-5 text-center">
            <FileText size={22} className="text-gray-200 mx-auto mb-1.5" />
            <p className="text-sm text-gray-400 font-medium">No resumes yet</p>
            <p className="text-xs text-gray-300 mt-0.5 mb-2">Upload a PDF, Word doc, or image</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-[#111] hover:underline">
              + Upload resume
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {allResumes.map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                selected={selectedResumeId === r.id}
                onSelect={() => setSelectedResumeId((prev) => (prev === r.id ? null : r.id))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Message */}
      <div>
        <p className="text-sm font-bold text-[#111] mb-2">Cover message</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={`Hi! I'm interested in the ${jobTitle} role…`}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-[#111] transition-colors"
        />
        <p className="text-xs text-gray-300 text-right mt-1">{message.length}/2000</p>
      </div>

      {/* Rate pitch */}
      {hasOpenBudget && (
        <div>
          <p className="text-sm font-bold text-[#111] mb-2">Your rate</p>
          {/* Flat / Hourly toggle */}
          <div className="flex gap-2 mb-2">
            {(["flat", "hourly"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRateType(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  rateType === t
                    ? "bg-[#111] text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {t === "flat" ? "Flat rate" : "Hourly rate"}
              </button>
            ))}
          </div>
          <div className="relative">
            <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="number"
              min={0}
              placeholder={rateType === "hourly" ? "e.g. 50 /hr" : "e.g. 500 flat"}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#111] transition-colors"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={applyMutation.isPending || !canSubmit}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {applyMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Submitting…
          </span>
        ) : (
          "Submit Application →"
        )}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProJobDetail() {
  const params = useParams<{ jobSlug: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const isPro = !!(user as any)?.artswrkPro;
  const jobId = extractIdFromSlug(params.jobSlug ?? "");

  const { data: result, isLoading, error } = trpc.enterprise.getJobDetail.useQuery(
    { jobId: jobId! },
    { enabled: jobId !== null }
  );
  const job = result?.job ?? null;

  const utils = trpc.useUtils();

  // Check DB on load so applied state survives page refresh
  const { data: applicationCheck } = trpc.artistDashboard.checkProJobApplication.useQuery(
    { premiumJobId: jobId! },
    { enabled: jobId !== null && isAuthenticated && isPro }
  );

  const [applied, setApplied] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState<ApplicationSummary | null>(null);
  const applyRef = useRef<HTMLDivElement>(null);

  const proCheckoutMutation = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: (data: { url: string }) => { window.location.href = data.url; },
    onError: (err) => { console.error("[PRO checkout]", err); toast.error("Checkout failed: " + err.message); },
  });

  // Sync applied state + summary from server once loaded.
  // Use functional update so an already-set in-session summary is never overwritten.
  useEffect(() => {
    if (!applicationCheck?.applied) return;
    setApplied(true);
    setAppliedSummary((prev) => {
      if (prev) return prev; // don't overwrite in-session summary
      const rl = (applicationCheck as any).resumeLink as string | null;
      return {
        resumeLink: rl ?? undefined,
        resumeTitle: rl
          ? decodeURIComponent(rl.split("/").pop()?.split("?")[0] ?? "Resume") || "Resume"
          : undefined,
        message: (applicationCheck as any).message as string ?? undefined,
        rate: (applicationCheck as any).rate as string ?? undefined,
      };
    });
  }, [applicationCheck]);

  function scrollToApply() {
    applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Canonical redirect
  useEffect(() => {
    if (!job) return;
    const canonical = toProJobUrl(job as any);
    if (typeof window !== "undefined" && window.location.pathname !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [job, navigate]);

  // SEO
  useEffect(() => {
    if (!job) return;
    const t = (job as any).serviceType ?? "Open Position";
    const loc = (job as any).workFromAnywhere ? "Remote" : ((job as any).location ?? "");
    document.title = `${t}${loc ? " · " + loc : ""} | Artswrk PRO`;
  }, [job]);

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy link.");
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (jobId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Invalid job URL</p>
          <Link href="/pro" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">← PRO Jobs</Link>
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
          <Link href="/pro" className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">← PRO Jobs</Link>
        </div>
      </div>
    );
  }

  const j = job as any;
  const title = j.serviceType ?? "Open Position";
  const location = j.workFromAnywhere ? "Work From Anywhere" : (j.location ?? "Location TBD");
  const company = j.company ?? "Artswrk Client";
  const jobUrl = toProJobUrl(j);
  const hasOpenBudget = !j.budget;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Navbar />

      {/* Page content — single column, pb-28 for sticky bar */}
      <div className="pt-14 pb-28">
        <div className="max-w-2xl mx-auto px-5 py-8">

          {/* Back link */}
          <Link
            href="/pro"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-[#111] transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Back to PRO Jobs
          </Link>

          {/* PRO badge */}
          <div className="flex items-center gap-1.5 mb-3">
            <Star size={12} className="text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-yellow-600 uppercase tracking-wide">PRO Job</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-black text-[#111] leading-tight mb-4">{title}</h1>

          {/* Company row */}
          <div className="flex items-center gap-3 mb-5">
            {isAuthenticated && isPro ? (
              <>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {j.logo ? (
                    <img src={j.logo} alt={company} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-gray-500">{company[0]?.toUpperCase()}</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-600">{company}</span>
              </>
            ) : isAuthenticated ? (
              <>
                <div className="w-9 h-9 rounded-full bg-gray-200 blur-sm flex-shrink-0" />
                <span className="text-sm text-gray-400 select-none">
                  Company hidden · <button onClick={scrollToApply} className="text-[#F25722] font-semibold hover:underline">Unlock PRO to see</button>
                </span>
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
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
              <MapPin size={11} /> {location}
            </span>
            {j.budget ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F25722] bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full">
                💳 {j.budget}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                <DollarSign size={11} /> Open rate
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
              <Clock size={11} /> Posted {timeAgo(j.createdAt)}
            </span>
          </div>

          {/* ── Action buttons / Applied summary chip ── */}
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            {applied && appliedSummary ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-100">
                <CheckCircle2 size={15} className="text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-bold text-green-700">Applied</span>
                  {appliedSummary.resumeTitle && (
                    <span className="text-xs text-green-600 ml-2">· {appliedSummary.resumeTitle}</span>
                  )}
                  {appliedSummary.rate && (
                    <span className="text-xs text-green-600 ml-2">· {appliedSummary.rate}</span>
                  )}
                </div>
              </div>
            ) : applied ? (
              <span className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-green-700 bg-green-50 border border-green-100">
                <CheckCircle2 size={15} /> Applied!
              </span>
            ) : (
              <button
                onClick={scrollToApply}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:opacity-80 transition-opacity"
              >
                Apply Now
              </button>
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-[#111] transition-colors"
            >
              <Share2 size={14} /> Share job
            </button>
          </div>

          {/* Description */}
          {j.description && (
            <div className="border-t border-gray-100 pt-6">
              <h2 className="text-sm font-black text-[#111] mb-3">About this role</h2>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {j.description}
              </div>
            </div>
          )}

          {/* ── Inline apply section ── */}
          <div ref={applyRef} className="mt-10 pt-8 border-t border-gray-100 scroll-mt-20">
            <h2 className="text-xl font-black text-[#111] mb-1">
              {applied ? "Application submitted" : "Apply for this role"}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {applied
                ? "The team will be in touch if you're a great fit."
                : `Send your application to ${company} directly through Artswrk.`}
            </p>

            {applied ? (
              <div className="rounded-2xl border border-green-100 bg-green-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-green-700">Application submitted!</p>
                </div>
                {(appliedSummary?.resumeLink || appliedSummary?.resumeTitle || appliedSummary?.message || appliedSummary?.rate) && (
                  <div className="border-t border-green-100 pt-3 space-y-2.5">
                    {/* Resume */}
                    {(appliedSummary?.resumeLink || appliedSummary?.resumeTitle) && (
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <FileText size={12} className="flex-shrink-0 text-green-500" />
                        <span className="font-semibold">Resume:</span>
                        {appliedSummary?.resumeLink ? (
                          <a
                            href={appliedSummary.resumeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate underline underline-offset-2 hover:text-green-900 transition-colors"
                          >
                            {appliedSummary.resumeTitle ?? "View resume →"}
                          </a>
                        ) : (
                          <span className="truncate">{appliedSummary.resumeTitle}</span>
                        )}
                      </div>
                    )}
                    {/* Rate */}
                    {appliedSummary?.rate && (
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <DollarSign size={12} className="flex-shrink-0 text-green-500" />
                        <span className="font-semibold">Rate pitched:</span>
                        <span>{appliedSummary.rate}</span>
                      </div>
                    )}
                    {/* Message */}
                    {appliedSummary?.message && (
                      <div className="flex items-start gap-2 text-xs text-green-700">
                        <span className="font-semibold flex-shrink-0 mt-0.5">Message:</span>
                        <span className="line-clamp-3 text-green-700 leading-relaxed">{appliedSummary.message}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-green-600">The team will be in touch if you're a great fit. Track your application in your dashboard.</p>
              </div>
            ) : !isAuthenticated ? (
              <InlineAuth
                heading="Join Artswrk to apply"
                onSuccess={() => window.location.reload()}
                onNotFound={(email) => { window.location.href = `/join?next=${encodeURIComponent(jobUrl)}&email=${encodeURIComponent(email)}`; }}
              />
            ) : !isPro ? (
              <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {/* Blurred preview of apply form */}
                <div className="relative p-6 select-none pointer-events-none">
                  <div className="blur-sm opacity-40 space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-24 bg-gray-100 rounded-xl" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-10 bg-gray-100 rounded-xl" />
                  </div>
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]" />
                </div>
                <div className="bg-[#111] p-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-black text-sm">ArtswrkPRO</span>
                  </div>
                  <p className="text-white/70 text-xs mb-4">Subscribe to apply to exclusive high-paying PRO jobs</p>
                  <button
                    onClick={() => proCheckoutMutation.mutate({
                      interval: "month",
                      origin: window.location.origin,
                      returnPath: jobUrl,
                    })}
                    disabled={proCheckoutMutation.isPending}
                    className="w-full py-3 rounded-xl text-sm font-bold text-[#111] bg-white hover:bg-gray-100 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {proCheckoutMutation.isPending ? (
                      <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                    ) : (
                      <>🔒 Unlock Artswrk PRO</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <ProApplyForm
                jobId={j.id}
                jobTitle={title}
                company={company}
                hasOpenBudget={hasOpenBudget}
                onApplied={(summary) => { setApplied(true); setAppliedSummary(summary); }}
              />
            )}
          </div>

        </div>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center justify-between gap-4 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]">
        <div className="min-w-0">
          <p className="text-base font-black text-[#111] truncate">{j.budget ?? "Open rate"}</p>
          <p className="text-xs text-gray-400 truncate">{location}</p>
        </div>

        {applied ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600 flex-shrink-0">
            <CheckCircle2 size={16} /> Applied!
          </span>
        ) : !isAuthenticated ? (
          <a
            href={`/join?next=${encodeURIComponent(jobUrl)}`}
            className="flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-[#111] hover:opacity-80 transition-opacity"
          >
            Apply
          </a>
        ) : !isPro ? (
          <button
            onClick={() => proCheckoutMutation.mutate({
              interval: "month",
              origin: window.location.origin,
              returnPath: jobUrl,
            })}
            disabled={proCheckoutMutation.isPending}
            className="flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-[#111] hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {proCheckoutMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "🔒"}
            Unlock PRO
          </button>
        ) : (
          <button
            onClick={scrollToApply}
            className="flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-[#111] hover:opacity-80 transition-opacity"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}
