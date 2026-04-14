/*
 * ARTSWRK ENTERPRISE DASHBOARD
 * Layout: Left sidebar (Dashboard, Browse Artists) + main content area
 * Master view: Jobs / Companies / Artists tabs
 * Job detail view: breadcrumb → Applicants + Details tabs
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  MapPin,
  CreditCard,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Star,
  X,
  Plus,
  CheckCircle2,
  Home,
  Archive,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
  }[size];

  const url = fixUrl(src);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {initials(name)}
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "open") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        Active
      </span>
    );
  }
  if (s === "completed" || s === "closed") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
        Completed
      </span>
    );
  }
  if (s === "archived") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400 border border-gray-200">
        Archived
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
      {status || "Active"}
    </span>
  );
}

// ── Applicant Avatar Stack ────────────────────────────────────────────────────

function AvatarStack({ artists }: { artists: any[] }) {
  const visible = artists.slice(0, 3);
  const extra = artists.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((a, i) => (
        <div
          key={a.id || i}
          className="w-8 h-8 rounded-full border-2 border-white -ml-2 first:ml-0 overflow-hidden flex-shrink-0"
        >
          {fixUrl(a.profilePicture) ? (
            <img
              src={fixUrl(a.profilePicture)!}
              alt={a.name || "Artist"}
              className="w-full h-full object-cover"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                el.parentElement!.style.background =
                  "linear-gradient(135deg, #FFBC5D, #F25722)";
                el.parentElement!.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:white;font-size:10px;font-weight:700">${initials(a.name || "A")}</span>`;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xs font-bold">
              {initials(a.name || a.firstName || "A")}
            </div>
          )}
        </div>
      ))}
      {extra > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-gray-500">
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

type SidebarItem = {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
};

function Sidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate: (section: string) => void;
}) {
  const [, navigate] = useLocation();

  const items: SidebarItem[] = [
    {
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
      onClick: () => onNavigate("dashboard"),
      active: activeSection === "dashboard",
    },
    {
      icon: <Users size={18} />,
      label: "Browse Artists",
      onClick: () => navigate("/dashboard/artists"),
      active: false,
    },
  ];

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-100 bg-white min-h-screen pt-6 px-3">
      <div className="mb-6 px-3">
        <Link href="/">
          <span className="font-black text-xl tracking-tight">
            <span className="hirer-grad-text">ARTS</span>
            <span className="bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">
              WRK
            </span>
          </span>
        </Link>
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              item.active
                ? "bg-orange-50 text-[#F25722]"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

// ── Job Card (Jobs Tab) ───────────────────────────────────────────────────────

function JobCard({
  job,
  applicants,
  onViewDetail,
}: {
  job: any;
  applicants: any[];
  onViewDetail: () => void;
}) {
  const rawLogo = job.logo || job.enterpriseLogoUrl;
  const logoUrl = fixUrl(rawLogo);
  const companyName = job.company || job.clientCompanyName || "Company";
  const jobTitle = job.serviceType || job.title || "Job";
  // Guard against stringified [object Object] from Bubble import
  const rawLocation = job.location || job.clientLocation;
  const location =
    rawLocation && !rawLocation.includes("[object") && rawLocation !== "[object Object]"
      ? rawLocation
      : job.workFromAnywhere
        ? "Work from Anywhere"
        : null;
  const rate = job.rate || job.clientRate;
  const status = job.status || job.requestStatus;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start gap-4">
        {/* Company logo */}
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
              {initials(companyName)}
            </div>
          )}
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#111] text-sm leading-snug mb-0.5 truncate">
            {jobTitle}
          </h3>
          <p className="text-xs text-gray-500 mb-1">{companyName}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={10} />
            {location}
          </p>
          {rate && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] text-xs font-semibold">
              <CreditCard size={10} />
              {rate}
            </span>
          )}
        </div>

        {/* Right: avatar stack + status + view detail */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {applicants.length > 0 && <AvatarStack artists={applicants} />}
          <StatusBadge status={status} />
          <button
            onClick={onViewDetail}
            className="text-xs font-semibold text-[#F25722] hover:underline flex items-center gap-1"
          >
            View Detail <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Company Card (Companies Tab) ──────────────────────────────────────────────

function CompanyCard({ company }: { company: any }) {
  const logoUrl = fixUrl(company.logoUrl);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Logo area */}
      <div className="h-40 bg-gray-50 flex items-center justify-center p-6">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={company.name}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-2xl">
            {initials(company.name)}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-4 border-t border-gray-100">
        <h3 className="font-bold text-[#111] text-sm mb-1">{company.name}</h3>
        {company.location && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
            <MapPin size={10} />
            {company.location}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#F25722]">
            {company.openRoles} open role{company.openRoles !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-gray-400">View →</span>
        </div>
      </div>
    </div>
  );
}

// ── Artist Row (Artists Tab) ──────────────────────────────────────────────────

function ArtistRow({ artist }: { artist: any }) {
  const name =
    artist.firstName
      ? `${artist.firstName} ${artist.lastName || ""}`.trim()
      : artist.name || "Artist";
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
      <Avatar src={artist.profilePicture} name={name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[#111] truncate">{name}</p>
        {artist.location && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={10} />
            {artist.location}
          </p>
        )}
      </div>
      {artist.artswrkPro && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 text-xs font-semibold border border-yellow-200">
          <Star size={10} fill="currentColor" />
          PRO
        </span>
      )}
    </div>
  );
}

// ── Applications Panel ────────────────────────────────────────────────────────

function ApplicationsPanel({ applications }: { applications: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-6">
      <h3 className="font-bold text-[#111] text-base mb-4">Applications</h3>
      {applications.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No applications yet
        </p>
      ) : (
        <div className="space-y-3">
          {applications.slice(0, 10).map((app) => {
            const name = app.artistName || "Artist";
            return (
              <div key={app.id} className="flex items-center gap-3">
                <Avatar src={app.profilePicture} name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#111] truncate">
                    {name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {app.jobTitle}
                  </p>
                </div>
              </div>
            );
          })}
          {applications.length > 10 && (
            <p className="text-xs text-gray-400 text-center pt-1">
              +{applications.length - 10} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Post Job Modal ───────────────────────────────────────────────────────────────────────────────────

const JOB_CATEGORIES = [
  "Dance Teacher",
  "Choreographer",
  "Competition Judge",
  "Performer",
  "Yoga / Pilates Instructor",
  "Fitness Instructor",
  "Photographer",
  "Videographer",
  "Music Teacher",
  "Acting Coach",
  "Other",
];

function PostJobModal({
  user,
  companies,
  onClose,
  onSuccess,
}: {
  user: any;
  companies: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [form, setForm] = useState({
    serviceType: "",
    company: companies.length > 0 ? companies[0].name : "",
    logo: companies.length > 0 ? (companies[0].logoUrl || "") : "",
    bubbleClientCompanyId: companies.length > 0 ? (companies[0].bubbleId || "") : "",
    category: "",
    location: "",
    budget: "",
    workFromAnywhere: false,
    description: "",
    applyEmail: user?.email || "",
  });

  const postJob = trpc.enterprise.postJob.useMutation({
    onSuccess: () => {
      setStep("success");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to post job. Please try again.");
    },
  });

  function handleCompanyChange(companyName: string) {
    const found = companies.find((c) => c.name === companyName);
    setForm((f) => ({
      ...f,
      company: companyName,
      logo: found?.logoUrl || "",
      bubbleClientCompanyId: found?.bubbleId || "",
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.serviceType.trim()) {
      toast.error("Job title is required");
      return;
    }
    if (!form.company.trim()) {
      toast.error("Company is required");
      return;
    }
    postJob.mutate({
      serviceType: form.serviceType,
      company: form.company,
      logo: form.logo || undefined,
      category: form.category || undefined,
      location: form.location || undefined,
      budget: form.budget || undefined,
      workFromAnywhere: form.workFromAnywhere,
      description: form.description || undefined,
      applyEmail: form.applyEmail || undefined,
      bubbleClientCompanyId: form.bubbleClientCompanyId || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="bg-[#111] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            {form.logo ? (
              <img
                src={fixUrl(form.logo) || ""}
                alt={form.company}
                className="w-12 h-12 rounded-full object-contain bg-white p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
                {initials(form.company || "C")}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {step === "success" ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-[#111] mb-2">Job Posted!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Your job has been posted successfully and is now visible to artists.
            </p>
            <button
              onClick={onSuccess}
              className="px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-0">
            {/* Job Title */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Job Title
              </label>
              <input
                type="text"
                placeholder="Job Title"
                value={form.serviceType}
                onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                required
              />
            </div>

            {/* Company */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Company
              </label>
              {companies.length > 0 ? (
                <select
                  value={form.company}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-[#ec008c] text-sm focus:outline-none focus:border-[#F25722] transition-all"
                  required
                >
                  <option value="">Choose an option...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Company name"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                  required
                />
              )}
            </div>

            {/* Category */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
              >
                <option value="">Choose an option...</option>
                {JOB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Location
              </label>
              <input
                type="text"
                placeholder="Start typing..."
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                disabled={form.workFromAnywhere}
              />
            </div>

            {/* Rate */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Rate
              </label>
              <input
                type="text"
                placeholder="e.g. $50/hr or $500 flat"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
              />
            </div>

            {/* Work from anywhere */}
            <div className="flex items-center gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] flex-shrink-0">
                Work from anywhere?
              </label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, workFromAnywhere: !f.workFromAnywhere }))}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  form.workFromAnywhere ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    form.workFromAnywhere ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Apply Email */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Apply Email
              </label>
              <input
                type="email"
                placeholder="email@company.com"
                value={form.applyEmail}
                onChange={(e) => setForm((f) => ({ ...f, applyEmail: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
              />
            </div>

            {/* Description */}
            <div className="flex items-start gap-4 py-4">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Description
              </label>
              <textarea
                placeholder="Describe the role, requirements, and any other details..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={5}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2 pb-2">
              <button
                type="submit"
                disabled={postJob.isPending}
                className="px-8 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {postJob.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Post Job"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Master View (Jobs / Companies / Artists tabs) ─────────────────────────────

type MasterTab = "jobs" | "companies" | "artists";

function MasterView({
  user,
  onSelectJob,
}: {
  user: any;
  onSelectJob: (job: any) => void;
}) {
  const [tab, setTab] = useState<MasterTab>("jobs");
  const [showPostJob, setShowPostJob] = useState(false);
  const userId = user?.id;

  const utils = trpc.useUtils();

  const { data: jobsData, isLoading: jobsLoading } =
    trpc.enterprise.getJobs.useQuery(
      { clientUserId: userId },
      { enabled: !!userId }
    );

  const { data: appsData } = trpc.enterprise.getApplications.useQuery(
    { clientUserId: userId },
    { enabled: !!userId }
  );

  // Use real client companies from DB (seeded from premium_jobs)
  const { data: clientCompaniesData, isLoading: companiesLoading } =
    trpc.enterprise.getClientCompanies.useQuery();

  const { data: artistsData, isLoading: artistsLoading } =
    trpc.enterprise.getInterestedArtists.useQuery(
      { clientUserId: userId },
      { enabled: !!userId }
    );

  const jobs = jobsData?.jobs || [];
  const applications = appsData?.applications || [];
  const companies = clientCompaniesData?.companies || [];
  const artists = artistsData?.artists || [];

  // Use job logo as fallback since the logged-in user may be a different account
  const firstJobLogo = jobs.length > 0 ? fixUrl(jobs[0].logo) : null;
  const rawLogo = user?.enterpriseLogoUrl || user?.profilePicture;
  const logoUrl = fixUrl(rawLogo) || firstJobLogo;
  const displayName = user?.name || user?.firstName || "Enterprise";

  const tabs: { id: MasterTab; label: string }[] = [
    { id: "jobs", label: "Jobs" },
    { id: "companies", label: "Companies" },
    { id: "artists", label: "Artists" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Post Job Modal */}
      {showPostJob && (
        <PostJobModal
          user={user}
          companies={companies}
          onClose={() => setShowPostJob(false)}
          onSuccess={() => {
            setShowPostJob(false);
            utils.enterprise.getJobs.invalidate();
            utils.enterprise.getClientCompanies.invalidate();
          }}
        />
      )}

      {/* Company header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex items-start justify-between">
        <div>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={displayName}
              className="w-24 h-24 object-contain mb-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-3xl mb-4">
              {initials(displayName)}
            </div>
          )}
          <h1 className="text-2xl font-black text-[#111]">{displayName}</h1>
        </div>
        <button
          onClick={() => setShowPostJob(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-[#111] text-sm font-bold text-[#111] hover:bg-[#111] hover:text-white transition-colors"
        >
          <Plus size={15} /> Post Job
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3">
          {/* Jobs Tab */}
          {tab === "jobs" && (
            <div className="space-y-3">
              {jobsLoading ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Loading jobs…
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No jobs found. Post your first job!
                </div>
              ) : (
                jobs.map((job: any) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    applicants={applications.filter(
                      (a: any) => a.jobTitle === (job.serviceType || job.title)
                    )}
                    onViewDetail={() => onSelectJob(job)}
                  />
                ))
              )}
            </div>
          )}

          {/* Companies Tab */}
          {tab === "companies" && (
            <div>
              {companiesLoading ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Loading companies…
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No companies found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companies.map((company: any) => (
                    <CompanyCard key={company.id} company={company} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Artists Tab */}
          {tab === "artists" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-[#111] text-base mb-4">
                Interested Artists ({artists.length})
              </h3>
              {artistsLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Loading artists…
                </div>
              ) : artists.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No interested artists yet.
                </div>
              ) : (
                <div>
                  {artists.map((artist: any) => (
                    <ArtistRow key={artist.id} artist={artist} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Applications panel (right column) */}
        <div className="lg:col-span-1">
          <ApplicationsPanel applications={applications} />
        </div>
      </div>
    </div>
  );
}

// ── Job Detail View ───────────────────────────────────────────────────────────

type DetailTab = "applicants" | "details";

function JobDetailView({
  job,
  user,
  onBack,
}: {
  job: any;
  user: any;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("applicants");

  const { data: applicantsData, isLoading } =
    trpc.enterprise.getJobApplicants.useQuery(
      { jobId: job.id },
      { enabled: !!job.id }
    );

  const applicants = applicantsData?.applicants || [];

  const rawLogo = job.logo || job.enterpriseLogoUrl || user?.enterpriseLogoUrl;
  const logoUrl = fixUrl(rawLogo);
  const jobTitle = job.serviceType || job.title || "Job";
  const postedBy = user?.name || "Enterprise";
  const postedDate = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const status = job.status || job.requestStatus;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button
          onClick={() => {}}
          className="hover:text-gray-600 transition-colors"
        >
          <Home size={14} />
        </button>
        <ChevronRight size={14} />
        <button
          onClick={onBack}
          className="hover:text-[#F25722] transition-colors font-medium"
        >
          {postedBy}
        </button>
        <ChevronRight size={14} />
        <span className="text-[#111] font-semibold truncate max-w-xs">
          {jobTitle}
        </span>
      </nav>

      {/* Job header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={postedBy}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-lg">
                  {initials(postedBy)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-[#111] mb-1">
                {jobTitle}
              </h2>
              <p className="text-sm text-gray-500">
                {postedBy}
                {postedDate ? ` | Posted ${postedDate}` : ""}
              </p>
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors">
            <Archive size={14} />
            Archive Job
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
        {(["applicants", "details"] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {t === "applicants" ? "Applicants" : "Details"}
          </button>
        ))}
      </div>

      {/* Applicants Tab */}
      {tab === "applicants" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Loading applicants…
            </div>
          ) : applicants.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No applicants yet.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">
                    Details
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                    Get In Touch
                  </th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a: any) => {
                  const name = a.firstName
                    ? `${a.firstName} ${a.lastName || ""}`.trim()
                    : a.name || "Artist";
                  const profileUrl = a.slug
                    ? `https://artswrk.com/version-live/artist-profile?slug=${a.slug}`
                    : null;
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={a.profilePicture}
                            name={name}
                            size="md"
                          />
                          <div>
                            <p className="font-semibold text-sm text-[#111]">
                              {name}
                            </p>
                            {a.location && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <MapPin size={10} />
                                {a.location}
                              </p>
                            )}
                            {a.artswrkPro && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600 text-xs font-semibold">
                                <Star size={9} fill="currentColor" />
                                PRO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {profileUrl ? (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-[#F25722] hover:underline"
                          >
                            View Application <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111] text-white text-xs font-semibold hover:bg-gray-800 transition-colors">
                          <MessageCircle size={12} />
                          Message
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Details Tab */}
      {tab === "details" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          {job.description && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Description
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}
          {job.category && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Category
              </h4>
              <p className="text-sm text-gray-700">{job.category}</p>
            </div>
          )}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Location
            </h4>
            <p className="text-sm text-gray-700 flex items-center gap-1">
              <MapPin size={13} className="text-gray-400" />
              {job.location && !job.location.includes("[object") ? job.location : job.workFromAnywhere ? "Work from Anywhere" : "TBD"}
            </p>
          </div>
          {job.applyEmail && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Apply Email
              </h4>
              <a
                href={`mailto:${job.applyEmail}`}
                className="text-sm text-[#F25722] hover:underline"
              >
                {job.applyEmail}
              </a>
            </div>
          )}
          {job.rate && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Rate
              </h4>
              <p className="text-sm text-gray-700">{job.rate}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Enterprise Page ──────────────────────────────────────────────────────

export default function Enterprise() {
  const { user, loading } = useAuth();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [activeSection] = useState("dashboard");

  // Fetch the enterprise user data from DB (by ID to get full profile)
  const { data: userById } = trpc.artswrkUsers.getById.useQuery(
    { id: (user as any)?.id || 0 },
    { enabled: !!(user as any)?.id }
  );

  // userById returns { user: {...} }, auth user already has full fields
  const enterpriseUser = (userById as any)?.user || user;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={() => setSelectedJob(null)}
      />

      {/* Main content */}
      <main className="flex-1 p-6 overflow-hidden">
        {selectedJob ? (
          <JobDetailView
            job={selectedJob}
            user={enterpriseUser}
            onBack={() => setSelectedJob(null)}
          />
        ) : (
          <MasterView
            user={enterpriseUser}
            onSelectJob={(job) => setSelectedJob(job)}
          />
        )}
      </main>
    </div>
  );
}
