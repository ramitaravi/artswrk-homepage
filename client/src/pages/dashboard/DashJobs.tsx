/*
 * ARTSWRK DASHBOARD — MY JOBS
 * Left: job listings (Active / Archived). Right: your account + your companies,
 * managed inline — the exact same company editor used on /app/settings.
 */

import { useMemo, useState } from "react";
import { Briefcase, Copy, Check, Loader2, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CompanyManager from "@/components/CompanyManager";
import { JobCard } from "@/components/ClientJobCard";
import { toSimpleJobStatus } from "@shared/jobStatus";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashJobs() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: jobs, isLoading: jobsLoading } = trpc.jobs.myJobs.useQuery({ limit: 100 });
  // Same feed as the dashboard home tab, so cards match 1:1 — see ClientJobCard.
  const { data: applicants } = trpc.applicants.myApplicants.useQuery({ limit: 500 });
  const applicantsByJob = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const a of (applicants as any[] ?? [])) {
      if (a.jobId != null) { map[a.jobId] = map[a.jobId] ?? []; map[a.jobId].push(a); }
    }
    return map;
  }, [applicants]);

  // Active tab includes Paused too — a paused job is still yours to manage,
  // just flagged on its own card; Archived is its own bucket. Same rule as
  // the dashboard home tab.
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let list = jobs.filter((j: any) => {
      const simple = toSimpleJobStatus(j.requestStatus);
      return activeTab === "active" ? simple !== "Archived" : simple === "Archived";
    });
    if (selectedCompanyId !== null) list = list.filter((j: any) => j.clientCompanyId === selectedCompanyId);
    return list;
  }, [jobs, activeTab, selectedCompanyId]);

  const navigateToPostJob = () => {
    const blank = {
      title: null, description: "", locationAddress: null, dateType: "Single Date",
      startDate: null, endDate: null, isHourly: false, openRate: true,
      clientHourlyRate: null, clientFlatRate: null, transportation: false, serviceType: null,
    };
    sessionStorage.setItem("postJobParsed", JSON.stringify({ rawText: "", parsed: blank }));
    navigate("/post-job");
  };

  const artswrkUser = user as any;
  const accountName = [artswrkUser?.firstName, artswrkUser?.lastName].filter(Boolean).join(" ") || artswrkUser?.name || "My Account";
  const accountAvatar = fixUrl(artswrkUser?.profilePicture);
  const publicUrl = artswrkUser?.id ? `${window.location.origin}/studio/${artswrkUser.id}` : null;

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#111]">My Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your job listings and companies</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {publicUrl && (
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? <><Check size={12} className="text-green-500" /> Copied!</> : <><Copy size={12} /> Copy Link</>}
            </button>
          )}
          <button
            onClick={navigateToPostJob}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Post a Job
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Job listings ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit mb-4">
            {(["active", "archived"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  activeTab === t ? "hirer-grad-bg text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {jobsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={22} className="animate-spin mr-3" />
              <span className="text-sm">Loading jobs…</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <Briefcase size={32} className="mb-2 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No {activeTab} jobs</p>
              {activeTab === "active" && (
                <>
                  <p className="text-xs mt-1 text-gray-400">Post a job to start receiving applications.</p>
                  <button
                    onClick={navigateToPostJob}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
                  >
                    Post a Job
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job: any) => (
                <JobCard
                  key={job.id}
                  job={job}
                  applicants={applicantsByJob[job.id] ?? []}
                  companyName={job.companyName || "My Studio"}
                  profilePicture={fixUrl(job.companyLogo)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Account + Companies ─────────────────────────────────── */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          {/* Account */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
              {accountAvatar ? <img src={accountAvatar} alt={accountName} className="w-full h-full object-cover" /> : getInitials(accountName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-[#111] truncate">{accountName}</p>
              <p className="text-xs text-gray-400 truncate">{artswrkUser?.email}</p>
            </div>
          </div>

          {/* My Companies */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-black text-[#111] mb-3">My Companies</h3>
            <CompanyManager selectedCompanyId={selectedCompanyId} onSelectCompany={(id) => setSelectedCompanyId(id === selectedCompanyId ? null : id)} />
          </div>
        </div>
      </div>
    </div>
  );
}
