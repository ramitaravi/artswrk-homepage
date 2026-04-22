/*
 * SIMPLE DASHBOARD — enterprise-style layout for regular clients.
 * Header with logo/name, Jobs/Companies/Artists tabs,
 * job cards with avatar stacks + Applications sidebar.
 */

import { useState } from "react";
import { Link } from "wouter";
import { MapPin, Plus, ChevronRight, Loader2, Briefcase } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function getInitials(str: string | null | undefined, fallback = "?") {
  if (!str) return fallback;
  return str
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function statusStyle(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "active": return "bg-green-100 text-green-700";
    case "confirmed": return "bg-blue-100 text-blue-700";
    case "completed": return "bg-gray-200 text-gray-700";
    case "submissions paused": return "bg-yellow-100 text-yellow-700";
    default: return "bg-orange-50 text-[#F25722]";
  }
}

function getJobLabel(job: any): string {
  const title = job.description
    ? job.description.split(/[\n.!?]/)[0].trim().slice(0, 60)
    : "Untitled Job";
  if (job.startDate) {
    const d = new Date(job.startDate);
    if (!isNaN(d.getTime())) {
      return `${title} | ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
  }
  return title;
}

// ── Avatar stack ──────────────────────────────────────────────────────────────

function AvatarStack({ applicants }: { applicants: any[] }) {
  const visible = applicants.slice(0, 3);
  const extra = applicants.length - visible.length;

  if (!visible.length) return null;

  return (
    <div className="flex items-center">
      {visible.map((a, i) => {
        const url = fixUrl(a.artistProfilePicture);
        const name = a.artistFirstName && a.artistLastName
          ? `${a.artistFirstName} ${a.artistLastName}`
          : a.artistName ?? "?";
        return (
          <div
            key={a.id ?? i}
            className="w-8 h-8 rounded-full border-2 border-white -ml-2 first:ml-0 overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#FFBC5D] to-[#F25722]"
          >
            {url ? (
              <img src={url} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-[9px] font-bold">
                {getInitials(name)}
              </div>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-gray-500">+{extra}</span>
      )}
    </div>
  );
}

// ── Job Logo ──────────────────────────────────────────────────────────────────

function JobLogo({ job, size = "md" }: { job: any; size?: "sm" | "md" | "lg" }) {
  const sizeClass = { sm: "w-12 h-12 text-sm", md: "w-16 h-16 text-base", lg: "w-20 h-20 text-xl" }[size];
  const url = fixUrl(job.logo);
  const label = getInitials(job.clientCompanyName ?? job.description, "JB");

  if (url) {
    return (
      <img src={url} alt="company" className={`${sizeClass} rounded-xl object-cover flex-shrink-0`} />
    );
  }
  return (
    <div className={`${sizeClass} rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black flex-shrink-0`}>
      {label}
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({ job, applicants }: { job: any; applicants: any[] }) {
  const location = job.location && !job.location.includes("[object")
    ? job.location
    : job.workFromAnywhere ? "Work from Anywhere" : null;
  const company = job.clientCompanyName ?? job.creatorName ?? "Your Company";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <JobLogo job={job} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#111] leading-snug mb-0.5 truncate">
          {getJobLabel(job)}
        </p>
        <p className="text-xs text-gray-500 mb-1">{company}</p>
        {location && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={11} className="flex-shrink-0" /> {location}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <AvatarStack applicants={applicants} />
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyle(job.status)}`}>
          {job.status ?? "Active"}
        </span>
        <Link
          href={`/app/jobs/${job.id}`}
          className="text-xs font-semibold text-[#F25722] flex items-center gap-0.5 hover:opacity-70 transition-opacity"
        >
          View Detail <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

// ── Applications Sidebar ──────────────────────────────────────────────────────

function ApplicationsSidebar({ applicants, loading }: { applicants: any[]; loading: boolean }) {
  return (
    <div className="w-64 flex-shrink-0">
      <h2 className="text-base font-bold text-[#111] mb-4">Applications</h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : applicants.length === 0 ? (
        <p className="text-xs text-gray-400">No applications yet.</p>
      ) : (
        <div className="space-y-3">
          {applicants.slice(0, 20).map((a) => {
            const url = fixUrl(a.artistProfilePicture);
            const name = a.artistFirstName && a.artistLastName
              ? `${a.artistFirstName} ${a.artistLastName}`
              : a.artistName ?? "Artist";
            const jobTitle = a.jobDescription
              ? a.jobDescription.split(/[\n.!?]/)[0].trim().slice(0, 20)
              : "Job";
            return (
              <div key={a.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#FFBC5D] to-[#F25722]">
                  {url ? (
                    <img src={url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                      {getInitials(name)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#111] truncate">{name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{jobTitle}…</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Companies Tab ─────────────────────────────────────────────────────────────

function CompaniesTab({ jobs }: { jobs: any[] }) {
  const companies = Array.from(
    new Map(
      jobs
        .filter((j) => j.clientCompanyName)
        .map((j) => [j.clientCompanyName, j])
    ).values()
  );

  if (!companies.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Briefcase size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-semibold text-gray-600 mb-1">No companies yet</p>
        <p className="text-xs mb-4">Post a job to associate it with your company.</p>
        <Link href="/post-job" className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
          Post a Job →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {companies.map((j) => (
        <div key={j.clientCompanyName} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
          <JobLogo job={j} size="sm" />
          <div>
            <p className="text-sm font-bold text-[#111]">{j.clientCompanyName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {jobs.filter((jj) => jj.clientCompanyName === j.clientCompanyName).length} job(s)
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Artists Tab ───────────────────────────────────────────────────────────────

function ArtistsTab({ applicants, loading }: { applicants: any[]; loading: boolean }) {
  const unique = Array.from(new Map(applicants.map((a) => [a.artistUserId ?? a.id, a])).values());

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!unique.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-sm font-semibold text-gray-600 mb-1">No artists yet</p>
        <p className="text-xs mb-4">Artists who apply to your jobs will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {unique.map((a) => {
        const url = fixUrl(a.artistProfilePicture);
        const name = a.artistFirstName && a.artistLastName
          ? `${a.artistFirstName} ${a.artistLastName}`
          : a.artistName ?? "Artist";
        return (
          <div key={a.artistUserId ?? a.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#FFBC5D] to-[#F25722]">
              {url ? (
                <img src={url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                  {getInitials(name)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111] truncate">{name}</p>
              {a.artistSlug && (
                <Link href={`/app/artists/${a.artistUserId}`} className="text-[11px] text-[#F25722] hover:opacity-70">
                  View profile →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "jobs" | "companies" | "artists";

export default function SimpleDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("jobs");

  const { data: jobs, isLoading: jobsLoading } = trpc.jobs.myJobs.useQuery({ limit: 100 });
  const { data: allApplicants, isLoading: appsLoading } = trpc.applicants.myApplicants.useQuery({ limit: 500 });

  const applicantsByJob = (allApplicants ?? []).reduce<Record<number, any[]>>((acc, a) => {
    if (a.jobId != null) {
      acc[a.jobId] = acc[a.jobId] ?? [];
      acc[a.jobId].push(a);
    }
    return acc;
  }, {});

  // User display info
  const displayName = (user as any)?.name || (user as any)?.firstName || "You";
  const companyName = (user as any)?.clientCompanyName;
  const logoUrl = fixUrl((user as any)?.profilePicture);

  const tabs: { id: Tab; label: string }[] = [
    { id: "jobs", label: "Jobs" },
    { id: "companies", label: "Companies" },
    { id: "artists", label: "Artists" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex items-end justify-between">
        <div className="flex items-end gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl hirer-grad-bg flex items-center justify-center text-white text-2xl font-black">
              {getInitials(companyName ?? displayName)}
            </div>
          )}
          <div>
            <p className="text-2xl font-black text-[#111]">{companyName ?? displayName}</p>
            {companyName && <p className="text-sm text-gray-400">{displayName}</p>}
          </div>
        </div>
        <Link
          href="/post-job"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-[#111] border-2 border-[#111] hover:bg-gray-50 transition-colors"
        >
          <Plus size={16} /> Post Job
        </Link>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {tab === "jobs" && (
        <div className="flex gap-8">
          {/* Job list */}
          <div className="flex-1 min-w-0">
            {jobsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={24} className="animate-spin text-gray-300" />
              </div>
            ) : !jobs?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Briefcase size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-semibold text-gray-600 mb-1">No jobs yet</p>
                <p className="text-xs mb-4">Post your first job to start receiving applications.</p>
                <Link href="/post-job" className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                  Post a Job →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    applicants={applicantsByJob[job.id] ?? []}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Applications sidebar */}
          <ApplicationsSidebar applicants={allApplicants ?? []} loading={appsLoading} />
        </div>
      )}

      {tab === "companies" && <CompaniesTab jobs={jobs ?? []} />}

      {tab === "artists" && (
        <ArtistsTab applicants={allApplicants ?? []} loading={appsLoading} />
      )}
    </div>
  );
}
