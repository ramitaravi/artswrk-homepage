/**
 * ARTSWRK ENTERPRISE DASHBOARD
 * Two views:
 *  1. Company Page View — logo, company name, "+ Post Job", Jobs tab, job cards + Interested Artists panel
 *  2. Job Detail View — breadcrumb, logo, job title, company | posted date, Active badge, Archive Job,
 *                       Applicants / Details tabs, applicants table with "View Application →" + "Message" buttons
 *
 * Matches the live Bubble enterprise dashboard at artswrk.com/version-live/enterprise
 */
import { useState, useMemo } from "react";
import {
  Home,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  MapPin,
  ExternalLink,
  User,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function AvatarFallback({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials || <User size={size * 0.5} />}
    </div>
  );
}

function ArtistAvatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) return <AvatarFallback name={name} size={size} />;
  return (
    <img
      src={src}
      alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
    />
  );
}

// ── Avatar Stack (overlapping avatars + count badge) ─────────────────────────

function AvatarStack({
  artists,
}: {
  artists: Array<{ profilePicture?: string | null; name: string }>;
}) {
  const visible = artists.slice(0, 2);
  const extra = artists.length - visible.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((a, i) => (
          <div key={i} className="ring-2 ring-white rounded-full">
            <ArtistAvatar src={a.profilePicture} name={a.name} size={32} />
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
          + {extra}
        </span>
      )}
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  const s = status || "Active";
  const isActive = s.toLowerCase() === "active";
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
        isActive
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-gray-100 text-gray-600 border border-gray-200"
      }`}
    >
      {s}
    </span>
  );
}

// ── Job Card (Company View) ───────────────────────────────────────────────────

function JobCard({
  job,
  applicants,
  isSelected,
  onClick,
  onViewDetail,
}: {
  job: any;
  applicants: any[];
  isSelected: boolean;
  onClick: () => void;
  onViewDetail: () => void;
}) {
  const rawLogo = job.logo;
  const logoUrl = rawLogo?.startsWith("//") ? `https:${rawLogo}` : rawLogo;
  const companyName = job.company || "Company";
  const jobTitle = job.serviceType || "Job";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? "border-gray-900 bg-gray-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Company logo */}
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-gray-400">{companyName[0]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{jobTitle}</h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{companyName}</p>

          {/* Location */}
          {(job.workFromAnywhere || job.location) && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <MapPin size={10} className="flex-shrink-0" />
              {job.workFromAnywhere ? "Work from Anywhere" : job.location}
            </p>
          )}

          {/* Budget badge */}
          {job.budget && (
            <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[#F25722] bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
              <span className="text-[10px]">💳</span> {job.budget}
            </span>
          )}
        </div>

        {/* Right side: avatar stack + status + view detail */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {applicants.length > 0 && <AvatarStack artists={applicants} />}
          <StatusBadge status={job.status} />
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
            className="text-xs font-semibold text-[#F25722] hover:underline flex items-center gap-1 mt-1"
          >
            View Detail →
          </button>
        </div>
      </div>
    </button>
  );
}

// ── Interested Artists Panel (Company View right column) ──────────────────────

function InterestedArtistsPanel({ artists }: { artists: any[] }) {
  if (artists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <User size={20} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No applications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {artists.map((artist) => {
        const name = artist.firstName
          ? `${artist.firstName} ${artist.lastName || ""}`.trim()
          : artist.name || "Artist";
        return (
          <div key={artist.id} className="flex items-center gap-3">
            <ArtistAvatar src={artist.profilePicture} name={name} size={48} />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{name}</p>
              {artist.location && (
                <p className="text-xs text-gray-500 truncate">{artist.location}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Job Applicants Panel (fetches for a specific job) ─────────────────────────

function JobApplicantsPanel({ jobId }: { jobId: number }) {
  const { data, isLoading } = trpc.enterprise.getJobApplicants.useQuery(
    { jobId },
    { enabled: !!jobId }
  );

  const applicants = data?.applicants ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-gray-400" size={20} />
      </div>
    );
  }

  return <InterestedArtistsPanel artists={applicants} />;
}

// ── Company Page View ─────────────────────────────────────────────────────────

function CompanyView({
  enterpriseUser,
  onSelectJob,
}: {
  enterpriseUser: any;
  onSelectJob: (job: any) => void;
}) {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const { data: jobsData, isLoading: jobsLoading } = trpc.enterprise.getJobs.useQuery(
    { clientUserId: enterpriseUser?.id },
    { enabled: !!enterpriseUser?.id }
  );

  const jobs = jobsData?.jobs ?? [];

  // Auto-select first job
  const effectiveJobId = selectedJobId ?? (jobs[0]?.id ?? null);

  const rawLogo = enterpriseUser?.enterpriseLogoUrl;
  const logoUrl = rawLogo?.startsWith("//") ? `https:${rawLogo}` : rawLogo;
  const companyName = enterpriseUser?.clientCompanyName || enterpriseUser?.name || "Company";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back arrow */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Company header card */}
      <div className="max-w-6xl mx-auto px-4 pb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-start justify-between">
          <div className="flex flex-col gap-4">
            {/* Logo */}
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-white">{companyName[0]}</span>
              )}
            </div>
            {/* Company name */}
            <h1 className="text-2xl font-black text-gray-900">{companyName}</h1>
          </div>

          {/* Post Job button */}
          <Button
            variant="outline"
            className="rounded-full border-gray-900 text-gray-900 hover:bg-gray-50 font-semibold"
            onClick={() => toast.info("Premium job posting coming soon!")}
          >
            <Plus size={16} className="mr-1" /> Post Job
          </Button>
        </div>
      </div>

      {/* Jobs tab + content */}
      <div className="max-w-6xl mx-auto px-4 pb-10">
        {/* Tab bar */}
        <div className="border-b border-gray-200 mb-6">
          <button className="pb-3 px-1 text-sm font-bold text-gray-900 border-b-2 border-gray-900">
            Jobs
          </button>
        </div>

        {jobsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#F25722]" size={28} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500 mb-4">No jobs posted yet.</p>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800 rounded-full"
              onClick={() => toast.info("Premium job posting coming soon!")}
            >
              <Plus size={16} className="mr-2" /> Post a Job
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Job cards column */}
            <div className="lg:col-span-3 space-y-3">
              {jobs.map((job: any) => {
                const isSelected = effectiveJobId === job.id;
                return (
                  <JobCard
                    key={job.id}
                    job={job}
                    applicants={[]}
                    isSelected={isSelected}
                    onClick={() => setSelectedJobId(job.id)}
                    onViewDetail={() => onSelectJob(job)}
                  />
                );
              })}
            </div>

            {/* Interested Artists panel */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 sticky top-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Interested Artists</h2>
                {effectiveJobId !== null ? (
                  <JobApplicantsPanel jobId={effectiveJobId} />
                ) : (
                  <InterestedArtistsPanel artists={[]} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Applicants Tab ────────────────────────────────────────────────────────────

function ApplicantsTab({
  applicants,
  isLoading,
}: {
  applicants: any[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-[#F25722]" size={28} />
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <User size={24} className="text-gray-400" />
        </div>
        <p className="text-gray-500 font-medium">No applications yet</p>
        <p className="text-gray-400 text-sm mt-1">Artists who apply will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">Applications</h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[40%]">
                Name
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[30%]">
                Details
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[30%]">
                Get In Touch
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {applicants.map((applicant) => {
              const name = applicant.firstName
                ? `${applicant.firstName} ${applicant.lastName || ""}`.trim()
                : applicant.name || "Artist";

              return (
                <tr key={applicant.id} className="hover:bg-gray-50 transition-colors">
                  {/* Name + location */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <ArtistAvatar src={applicant.profilePicture} name={name} size={40} />
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{name}</p>
                        {applicant.location && (
                          <p className="text-xs text-gray-500 mt-0.5">{applicant.location}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* View Application link */}
                  <td className="px-6 py-4">
                    {applicant.resumeLink ? (
                      <a
                        href={applicant.resumeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#ec008c] hover:text-[#c4006f] font-medium text-sm transition-colors"
                      >
                        View Application →
                      </a>
                    ) : applicant.slug ? (
                      <a
                        href={`/artists/${applicant.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#ec008c] hover:text-[#c4006f] font-medium text-sm transition-colors"
                      >
                        View Application →
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>

                  {/* Message button */}
                  <td className="px-6 py-4">
                    <Button
                      className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-6 text-sm font-semibold"
                      onClick={() => toast.info("Messaging feature coming soon!")}
                    >
                      Message
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Details Tab ───────────────────────────────────────────────────────────────

function DetailsTab({ job }: { job: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      {job.description && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Description
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {job.description}
          </p>
        </div>
      )}

      {job.category && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Category
          </h3>
          <p className="text-gray-700 text-sm">{job.category}</p>
        </div>
      )}

      {job.budget && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Compensation
          </h3>
          <p className="text-gray-700 text-sm">{job.budget}</p>
        </div>
      )}

      {(job.location || job.workFromAnywhere) && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Location
          </h3>
          <p className="text-gray-700 text-sm flex items-center gap-1">
            <MapPin size={14} className="text-gray-400" />
            {job.workFromAnywhere ? "Work from Anywhere" : job.location}
          </p>
        </div>
      )}

      {job.applyEmail && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Apply Email
          </h3>
          <a
            href={`mailto:${job.applyEmail}`}
            className="text-[#ec008c] text-sm hover:underline"
          >
            {job.applyEmail}
          </a>
        </div>
      )}

      {job.applyLink && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Apply Link
          </h3>
          <a
            href={job.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ec008c] text-sm hover:underline flex items-center gap-1"
          >
            <ExternalLink size={12} />
            {job.applyLink}
          </a>
        </div>
      )}

      {job.tag && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Tags
          </h3>
          <p className="text-gray-700 text-sm">{job.tag}</p>
        </div>
      )}
    </div>
  );
}

// ── Job Detail View ───────────────────────────────────────────────────────────

type JobDetailTab = "applicants" | "details";

function JobDetailView({
  jobId,
  companyName,
  enterpriseUser,
  onBack,
}: {
  jobId: number;
  companyName: string;
  enterpriseUser: any;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<JobDetailTab>("applicants");

  const { data: jobData, isLoading: jobLoading } = trpc.enterprise.getJobDetail.useQuery(
    { jobId },
    { enabled: !!jobId }
  );

  const { data: applicantsData, isLoading: applicantsLoading } =
    trpc.enterprise.getJobApplicants.useQuery({ jobId }, { enabled: !!jobId });

  const job = jobData?.job;
  const applicants = applicantsData?.applicants ?? [];

  const rawJobLogo = job?.logo;
  const jobLogoUrl = rawJobLogo?.startsWith("//") ? `https:${rawJobLogo}` : rawJobLogo;
  const rawEnterpriseLogo = enterpriseUser?.enterpriseLogoUrl;
  const enterpriseLogoUrl = rawEnterpriseLogo?.startsWith("//")
    ? `https:${rawEnterpriseLogo}`
    : rawEnterpriseLogo;
  const displayLogo = jobLogoUrl || enterpriseLogoUrl;

  if (jobLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#F25722]" size={32} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Job not found.</p>
      </div>
    );
  }

  const jobTitle = job.serviceType || "Job";
  const postedDate = job.bubbleCreatedAt || job.createdAt;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm mb-6 bg-white rounded-xl border border-gray-200 px-4 py-3 w-fit">
          <button
            onClick={onBack}
            className="text-blue-700 hover:text-blue-900 transition-colors flex items-center"
          >
            <Home size={16} className="text-blue-700" />
          </button>
          <ChevronRight size={14} className="text-gray-400" />
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            {companyName}
          </button>
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-gray-900 font-medium">{jobTitle}</span>
        </nav>

        {/* Job header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-4">
              {/* Logo */}
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                {displayLogo ? (
                  <img
                    src={displayLogo}
                    alt={companyName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-black text-white">{companyName[0]}</span>
                )}
              </div>

              {/* Job title */}
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-1">{jobTitle}</h1>
                <p className="text-gray-500 text-sm">
                  {companyName}
                  {postedDate && <> | Posted {formatDate(postedDate)}</>}
                </p>
                <div className="mt-3">
                  <StatusBadge status={job.status} />
                </div>
              </div>
            </div>

            {/* Archive Job button */}
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
              onClick={() => toast.info("Archive job feature coming soon!")}
            >
              <Trash2 size={15} />
              Archive Job
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-6">
            {(["applicants", "details"] as JobDetailTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "applicants" && (
          <ApplicantsTab applicants={applicants} isLoading={applicantsLoading} />
        )}
        {activeTab === "details" && <DetailsTab job={job} />}
      </div>
    </div>
  );
}

// ── Main Enterprise Page ──────────────────────────────────────────────────────

type PageView = { type: "company" } | { type: "job"; jobId: number };

export default function Enterprise() {
  const { user, loading, isAuthenticated } = useAuth();
  const [view, setView] = useState<PageView>({ type: "company" });

  // Determine which enterprise user to show
  // Admin sees REVEL (id 780544) as demo; enterprise users see their own data
  const enterpriseUserId = useMemo(() => {
    if (!user) return undefined;
    if (user.role === "admin") return 780544; // REVEL Dance Convention demo
    return user.id as number;
  }, [user]);

  // Fetch enterprise user info
  const { data: enterpriseUserData } = trpc.artswrkUsers.getById.useQuery(
    { id: enterpriseUserId! },
    { enabled: !!enterpriseUserId }
  );

  const enterpriseUser = enterpriseUserData?.user;
  const companyName = enterpriseUser?.clientCompanyName || enterpriseUser?.name || "Company";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#F25722]" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600 font-medium">
          Please sign in to access the Enterprise Dashboard.
        </p>
        <Button
          className="bg-gray-900 text-white hover:bg-gray-800 rounded-full"
          onClick={() => (window.location.href = getLoginUrl())}
        >
          Sign In
        </Button>
      </div>
    );
  }

  if (view.type === "company") {
    return (
      <CompanyView
        enterpriseUser={enterpriseUser}
        onSelectJob={(job) => setView({ type: "job", jobId: job.id })}
      />
    );
  }

  return (
    <JobDetailView
      jobId={view.jobId}
      companyName={companyName}
      enterpriseUser={enterpriseUser}
      onBack={() => setView({ type: "company" })}
    />
  );
}
