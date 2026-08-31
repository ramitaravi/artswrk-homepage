/**
 * Shared job card for client-facing job feeds — used on the client dashboard
 * home (dashboard/Overview.tsx) and the standalone My Jobs page
 * (dashboard/DashJobs.tsx) so both surfaces show the exact same card.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, MapPin, Zap, Clock } from "lucide-react";
import BoostJobModal from "@/components/BoostJobModal";
import { toSimpleJobStatus } from "@shared/jobStatus";

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function getInitials(str: string | null | undefined, fallback = "?"): string {
  if (!str) return fallback;
  return str.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function jobLabel(job: any): string {
  const desc = (job.description ?? "").split(/[\n.!?]/)[0].trim();
  return desc.length > 55 ? desc.slice(0, 52) + "…" : desc || "Untitled Job";
}

// ── Boost Performance Bar ─────────────────────────────────────────────────────

export function BoostPerformanceBar({ applicantCount }: { applicantCount: number }) {
  const tiers = [
    { label: "Starting", min: 0, max: 1, pct: 18, color: "bg-gray-300", text: "text-gray-400" },
    { label: "Good", min: 1, max: 3, pct: 42, color: "bg-yellow-400", text: "text-yellow-600" },
    { label: "Great", min: 3, max: 6, pct: 68, color: "bg-[#F25722]", text: "text-[#F25722]" },
    { label: "Excellent", min: 6, max: Infinity, pct: 92, color: "bg-green-500", text: "text-green-600" },
  ];
  const tier = tiers.find((t) => applicantCount >= t.min && applicantCount < t.max) ?? tiers[0];
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Boost Performance</span>
        <span className={`text-[9px] font-black ${tier.text}`}>{tier.label}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${tier.color}`} style={{ width: `${tier.pct}%` }} />
      </div>
      <div className="flex justify-between mt-0.5">
        {tiers.map((t) => (
          <span key={t.label} className={`text-[8px] font-semibold ${t.label === tier.label ? tier.text : "text-gray-200"}`}>{t.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Avatar Stack ───────────────────────────────────────────────────────────────

export function AvatarStack({ applicants }: { applicants: any[] }) {
  const visible = applicants.slice(0, 3);
  const extra = applicants.length - visible.length;
  if (!visible.length) return null;
  return (
    <div className="flex items-center">
      {visible.map((a, i) => {
        const url = fixUrl(a.artistProfilePicture);
        const name = a.artistFirstName && a.artistLastName
          ? `${a.artistFirstName} ${a.artistLastName[0]}.` : a.artistName ?? "?";
        return (
          <div key={a.id ?? i} className="w-8 h-8 rounded-full border-2 border-white -ml-2 first:ml-0 overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#FFBC5D] to-[#F25722]">
            {url
              ? <img src={url} alt={name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-white text-[9px] font-bold">{getInitials(name)}</div>}
          </div>
        );
      })}
      {extra > 0 && <span className="ml-1.5 text-xs font-semibold text-gray-500">+{extra}</span>}
    </div>
  );
}

// ── Job Logo ───────────────────────────────────────────────────────────────────

export function JobLogo({ profilePicture, companyName }: { profilePicture?: string | null; companyName?: string | null }) {
  const url = fixUrl(profilePicture);
  const label = getInitials(companyName, "JB");
  if (url) {
    return <img src={url} alt="company" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-14 h-14 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-base flex-shrink-0">
      {label}
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  Paused: "text-amber-600 bg-amber-50 border border-amber-200",
  Archived: "text-gray-500 bg-gray-100 border border-gray-200",
};

// ── Job Card ───────────────────────────────────────────────────────────────────

export function JobCard({
  job, applicants, companyName, profilePicture,
}: { job: any; applicants: any[]; companyName?: string | null; profilePicture?: string | null }) {
  const [, navigate] = useLocation();
  const [boostOpen, setBoostOpen] = useState(false);
  const dateStr = fmtDate(job.startDate);
  const descSnippet = (job.description ?? "").slice(0, 120).trim();
  const jobTitle = job.title || jobLabel(job);
  const simpleStatus = toSimpleJobStatus(job.requestStatus);
  // "Waiting" = applied but not yet Confirmed/Declined — the artist is sitting
  // there unactioned. Only worth flagging on a job that's actually still live.
  const waitingCount = simpleStatus === "Active"
    ? applicants.filter((a) => !a.status || a.status === "Interested").length
    : 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => navigate(`/app/jobs/${job.id}`)}
    >
      <JobLogo profilePicture={profilePicture} companyName={companyName} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#111] leading-snug mb-0.5">{jobTitle}</p>
        {dateStr && (
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            📅 {dateStr}
            {job.locationAddress && (
              <span className="flex items-center gap-0.5 ml-2 text-gray-400">
                <MapPin size={10} /> {job.locationAddress.split(",")[0]}
              </span>
            )}
          </p>
        )}
        {descSnippet && (
          <p className="text-xs text-gray-400 italic line-clamp-2 leading-relaxed">{descSnippet}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {simpleStatus === "Paused" && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_PILL.Paused}`}>Submissions Paused</span>
          )}
          {waitingCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              <Clock size={10} /> {waitingCount} waiting on you
            </span>
          )}
          {job.isBoosted ? (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">⚡ Boosted</span>
          ) : simpleStatus === "Active" ? (
            <button
              onClick={(e) => { e.stopPropagation(); setBoostOpen(true); }}
              className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full bg-orange-50 text-[#F25722] hover:bg-orange-100 transition-colors"
            >
              <Zap size={11} className="fill-[#F25722]" /> Boost this job
            </button>
          ) : null}
        </div>
        {job.isBoosted && (
          <BoostPerformanceBar applicantCount={applicants.length} />
        )}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0 pt-0.5">
        <AvatarStack applicants={applicants} />
        <span className="text-[10px] font-semibold text-[#F25722] group-hover:opacity-70 transition-opacity flex items-center gap-0.5">
          View Detail <ChevronRight size={10} />
        </span>
      </div>

      {boostOpen && (
        <BoostJobModal
          jobId={job.id}
          jobTitle={jobTitle}
          open={boostOpen}
          onClose={() => setBoostOpen(false)}
        />
      )}
    </div>
  );
}
