/**
 * Job Detail Page — /jobs/:jobSlug
 *
 * Three auth states:
 *   logged out        → job content shown (company identity hidden), inline auth form
 *   logged in, free   → job shown fully, upgrade to basic CTA
 *   logged in, basic+ → full access, apply button
 */
import { useEffect, useMemo, useRef } from "react";
import { openPendingTab, type PendingTab } from "@/lib/openCheckoutTab";
import { Link, useParams, useLocation } from "wouter";
import {
  MapPin, Calendar, DollarSign, ArrowLeft,
  Loader2, AlertCircle, CheckCircle2, FileText, ExternalLink, Lock, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatLocation, getJobTitle } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import InlineAuth from "@/components/InlineAuth";
import RichText from "@/components/RichText";
import DashboardLayout from "@/components/DashboardLayout";

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
  const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  // A midnight timestamp usually means only a date was picked, not a real
  // time — showing "12:00 AM" there would read as wrong, not helpful.
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return dateStr;
  return `${dateStr} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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
  const title = getJobTitle(null, job.description);
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

  const { data: pricingData } = trpc.artistSubscription.getPricing.useQuery(undefined, { enabled: !canApply });
  const basicPrice = pricingData?.basic?.annual?.dollars ?? "$30";
  const proPrice = pricingData?.pro?.annual?.dollars ?? "$110";
  const trialDays = pricingData?.pro?.trialDays ?? 0;

  // New tab, opened during the click — see lib/openCheckoutTab.ts for why it
  // can't wait for the mutation to resolve.
  const checkoutTab = useRef<PendingTab | null>(null);
  const openUnlock = (run: () => void) => { checkoutTab.current = openPendingTab(); run(); };
  const onCheckoutUrl = ({ url }: { url: string }) => {
    const tab = checkoutTab.current; checkoutTab.current = null;
    tab ? tab.go(url) : (window.location.href = url);
  };
  const onCheckoutError = (err: { message: string }) => {
    checkoutTab.current?.cancel(); checkoutTab.current = null;
    toast.error("Checkout failed", { description: err.message });
  };
  const createBasicCheckout = trpc.artistSubscription.createBasicCheckout.useMutation({
    onSuccess: onCheckoutUrl, onError: onCheckoutError,
  });
  const createProCheckout = trpc.artistSubscription.createProCheckout.useMutation({
    onSuccess: onCheckoutUrl, onError: onCheckoutError,
  });
  const unlockBusy = createBasicCheckout.isPending || createProCheckout.isPending;

  const rawSlug = params.jobSlug ?? params.locationSlug ?? "";
  const jobId = extractIdFromSlug(rawSlug);

  const { data: job, isLoading, error } = trpc.jobs.getDetail.useQuery(
    { id: jobId! },
    { enabled: jobId !== null }
  );

  const { data: myApplications } = trpc.jobs.myApplications.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );
  const applied = !!(jobId !== null && (myApplications as any[] ?? []).some((a: any) => a.jobId === jobId));

  const { data: applicationCheck } = trpc.jobs.checkApplication.useQuery(
    { jobId: jobId! },
    { enabled: jobId !== null && isAuthenticated && applied }
  );
  const appliedSummary = applicationCheck?.applied ? {
    message: applicationCheck.message ?? undefined,
    resumeLink: applicationCheck.resumeLink ?? undefined,
    rate: applicationCheck.rate ?? undefined,
  } : null;

  const title = useMemo(() => getJobTitle((job as any)?.title, job?.description, (job as any)?.clientCompanyName ?? (job as any)?.clientName), [job]);
  const rate = useMemo(
    () => job ? formatRate(job.isHourly, job.openRate, job.artistHourlyRate, job.clientHourlyRate) : "",
    [job]
  );
  const cityDisplay = useMemo(() => formatLocation(job?.locationAddress) ?? "Remote", [job?.locationAddress]);
  const mapsUrl = useMemo(() => (
    job?.locationAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.locationAddress)}`
      : null
  ), [job?.locationAddress]);

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

  // ── Page shell ─────────────────────────────────────────────────────────────
  // Logged-in users get the same dashboard chrome (sidebar, gray canvas,
  // centered width) as every other page; logged-out visitors get the
  // standalone public page with its own Navbar.
  const jobsBackHref = isAuthenticated
    ? (applied ? "/app/jobs?tab=applications" : "/app/jobs")
    : (applied ? "/jobs?tab=applications" : "/jobs");
  const shell = (content: React.ReactNode) =>
    isAuthenticated ? <DashboardLayout>{content}</DashboardLayout> : content;

  // ── Loading / error states ────────────────────────────────────────────────

  if (jobId === null) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Invalid job URL</p>
          <Link href={jobsBackHref} className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">← Back to Jobs</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !job) {
    return shell(
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Job not found</p>
          <Link href={jobsBackHref} className="mt-4 inline-block text-sm text-[#F25722] font-semibold hover:underline">← Back to Jobs</Link>
        </div>
      </div>
    );
  }

  const jobUrl = toJobUrl(job);
  const applyUrl = `${jobUrl}/apply`;
  const company = job.clientCompanyName ?? job.clientName ?? "Artswrk Client";
  const dateLabel = job.dateType === "Ongoing" ? "Ongoing"
    : job.dateType === "Recurring" ? "Recurring"
    : job.dateType === "Dates Flexible" ? "Flexible — dates TBD"
    : job.dateType === "Weekly" ? `Weekly${job.startDate ? " — starting " + formatDate(job.startDate) : ""}`
    : job.dateType === "Multiple Dates" ? "Multiple Dates"
    : formatDate(job.startDate); // Single Date (default) — full date, and time when one was set

  // ── Sidebar / bottom CTA ─────────────────────────────────────────────────

  const ctaSection = !isAuthenticated ? (
    <InlineAuth
      heading="Join Artswrk to apply"
      variant="artist"
      onSuccess={() => window.location.reload()}
      onNotFound={(email) => { window.location.href = `/join?next=${encodeURIComponent(jobUrl)}&email=${encodeURIComponent(email)}`; }}
    />
  ) : !canApply ? (
    <div className="rounded-2xl overflow-hidden border border-pink-100 shadow-sm">
      <div className="artist-grad-bg px-5 py-4">
        <p className="text-white font-black text-sm flex items-center gap-1.5"><Lock size={13} /> Unlock to apply</p>
        <p className="text-white/80 text-xs mt-0.5">Choose a plan to send your application.</p>
      </div>
      <div className="bg-white p-3.5 space-y-2.5">
        <button
          onClick={() => openUnlock(() => createBasicCheckout.mutate({ origin: window.location.origin, returnPath: jobUrl }))}
          disabled={unlockBusy}
          className="w-full text-left rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50/30 transition-colors p-3.5 disabled:opacity-60"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#111]">Artswrk Basic</span>
            <span className="text-sm font-black text-[#ec008c] flex-shrink-0">{basicPrice}/yr</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Apply to unlimited Artswrk jobs</p>
        </button>
        <button
          onClick={() => openUnlock(() => createProCheckout.mutate({ origin: window.location.origin, returnPath: jobUrl }))}
          disabled={unlockBusy}
          className="relative w-full text-left rounded-xl border-2 border-[#ec008c] bg-pink-50/50 p-3.5 disabled:opacity-60"
        >
          {trialDays > 0 && (
            <span className="absolute -top-2.5 right-3 text-[9px] font-bold uppercase tracking-wide text-white artist-grad-bg px-2 py-0.5 rounded-full">
              {trialDays}-Day Free Trial
            </span>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#111] flex items-center gap-1"><Sparkles size={12} className="text-[#ec008c]" /> Artswrk PRO</span>
            <span className="text-sm font-black text-[#ec008c] flex-shrink-0">{proPrice}/yr</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">PRO jobs, partner discounts &amp; more</p>
        </button>
        {(createBasicCheckout.isPending || createProCheckout.isPending) && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
            <Loader2 size={12} className="animate-spin" /> Opening checkout…
          </p>
        )}
      </div>
    </div>
  ) : applied ? (
    // The full application summary further down the page is the single
    // source of truth once applied — no separate indicator needed up here.
    null
  ) : (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <p className="text-base font-black text-[#111] mb-1">Ready to apply?</p>
      <p className="text-xs text-gray-400 mb-4">Send your application in seconds.</p>
      <Link
        href={applyUrl}
        className="artist-grad-bg block w-full text-center py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
      >
        Apply Now →
      </Link>
      {rate && rate !== "Rate negotiable" && (
        <p className="text-xs text-gray-400 mt-3 text-center">You keep 100% of this rate - Artswrk takes no commission.</p>
      )}
    </div>
  );

  return shell(
    <div className={isAuthenticated ? "" : "min-h-screen bg-white"} style={{ fontFamily: "Poppins, sans-serif" }}>
      {!isAuthenticated && <Navbar />}

      <div className={isAuthenticated ? "pb-10" : "pt-14 pb-28 lg:pb-10"}>
        <div className={isAuthenticated ? "max-w-5xl mx-auto px-4 md:px-6 py-6" : "max-w-4xl mx-auto px-5 py-8"}>
          {/* Back link */}
          <Link
            href={jobsBackHref}
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

                <p className="text-xs text-gray-400">Posted {timeAgo(job.bubbleCreatedAt)}</p>
              </div>

              {/* Details */}
              <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 bg-white">
                <div className="px-5 py-3.5">
                  <p className="text-xs font-semibold text-gray-400 mb-0.5">Date</p>
                  <p className="text-sm font-medium text-[#111]">
                    {dateLabel}
                    {job.dateType !== "Single Date" && job.dateDetails
                      ? ` · ${job.dateDetails}` : ""}
                  </p>
                </div>
                <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 mb-0.5">Location</p>
                    <p className="text-sm font-medium text-[#111] truncate">{cityDisplay}</p>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:underline"
                    >
                      <MapPin size={12} /> View map <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="px-5 py-3.5">
                  <p className="text-xs font-semibold text-gray-400 mb-0.5">Rate</p>
                  <p className="text-sm font-semibold text-[#F25722]">{rate}</p>
                </div>
              </div>

              {/* Description */}
              {job.description && (
                <div className="border-t border-gray-100 pt-5">
                  <h2 className="text-sm font-black text-[#111] mb-3">About this role</h2>
                  <RichText html={job.description} className="text-gray-600" />
                </div>
              )}

              {/* Full application summary — replaces the mobile CTA once applied */}
              {applied && appliedSummary && (
                <div className="rounded-2xl border border-green-100 bg-green-50 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-green-700">Application submitted</p>
                  </div>
                  {(appliedSummary.message || appliedSummary.resumeLink || appliedSummary.rate) && (
                    <div className="border-t border-green-100 pt-3 space-y-2.5">
                      {appliedSummary.rate && (
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <DollarSign size={12} className="flex-shrink-0 text-green-500" />
                          <span className="font-semibold">Your rate:</span>
                          <span>{appliedSummary.rate}</span>
                        </div>
                      )}
                      {appliedSummary.resumeLink && (
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <FileText size={12} className="flex-shrink-0 text-green-500" />
                          <span className="font-semibold">Resume:</span>
                          <a
                            href={appliedSummary.resumeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate underline underline-offset-2 hover:text-green-900 transition-colors"
                          >
                            View resume →
                          </a>
                        </div>
                      )}
                      {appliedSummary.message && (
                        <div className="flex items-start gap-2 text-xs text-green-700">
                          <span className="font-semibold flex-shrink-0 mt-0.5">Your message:</span>
                          <span className="leading-relaxed">{appliedSummary.message}</span>
                        </div>
                      )}
                    </div>
                  )}
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
                  href={jobsBackHref}
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
            className="artist-grad-bg flex-shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            Sign up to apply
          </a>
        ) : !canApply ? (
          <button
            onClick={() => openUnlock(() => createBasicCheckout.mutate({ origin: window.location.origin, returnPath: jobUrl }))}
            disabled={unlockBusy}
            className="artist-grad-bg flex-shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {unlockBusy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={13} />}
            Unlock {basicPrice}/yr
          </button>
        ) : applied ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <CheckCircle2 size={16} /> Applied!
          </span>
        ) : (
          <Link
            href={applyUrl}
            className="artist-grad-bg flex-shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            Apply Now →
          </Link>
        )}
      </div>
    </div>
  );
}

