/**
 * ARTSWRK ENTERPRISE DASHBOARD
 * For users with enterprise = true
 * Mirrors the Bubble enterprise page structure with the current design language
 * Tabs: Jobs | Companies | Artists
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Briefcase,
  Building2,
  Users,
  Plus,
  MapPin,
  Clock,
  ChevronRight,
  Menu,
  LogOut,
  Crown,
  Loader2,
  Star,
  CheckCircle2,
  Search,
  Filter,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Tab = "jobs" | "companies" | "artists";
type ArtistsSubTab = "browse" | "interested";

// ── Sidebar nav items ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Jobs", icon: <Briefcase size={18} />, tab: "jobs" as Tab },
  { label: "Companies", icon: <Building2 size={18} />, tab: "companies" as Tab },
  { label: "Artists", icon: <Users size={18} />, tab: "artists" as Tab },
];

// ── Jobs Tab ─────────────────────────────────────────────────────────────────
function JobsTab({ enterpriseUser }: { enterpriseUser: any }) {
  const { data: jobsData, isLoading } = trpc.enterprise.getJobs.useQuery(
    { clientUserId: enterpriseUser?.id },
    { enabled: !!enterpriseUser?.id }
  );

  const jobs = jobsData?.jobs ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#F25722]" size={28} />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
          <Briefcase size={28} className="text-[#F25722]" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">No jobs posted yet</h3>
        <p className="text-gray-500 text-sm mb-5">Post your first premium job to start receiving applications.</p>
        <Button
          className="hirer-grad-bg text-white border-0 hover:opacity-90"
          onClick={() => toast.info("Premium job posting coming soon!")}
        >
          <Plus size={16} className="mr-2" /> Post a Job
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Jobs list */}
      <div className="xl:col-span-3 space-y-4">
        {jobs.map((job: any) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {/* Applications panel */}
      <div className="xl:col-span-2">
        <ApplicationsPanel jobs={jobs} clientUserId={enterpriseUser?.id} />
      </div>
    </div>
  );
}

function JobCard({ job }: { job: any }) {
  const applicantCount = job.interestedArtistCount ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header bar */}
      <div className="h-1 hirer-grad-bg" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              <Star size={16} />
            </div>
            <div>
              <h3 className="font-black text-[#111] text-base leading-tight">
                {job.serviceType || job.description?.slice(0, 60) || "Untitled Job"}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{job.clientCompanyName || "REVEL Dance Convention"}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`flex-shrink-0 text-xs font-semibold ${
              job.requestStatus === "Active"
                ? "border-green-200 text-green-700 bg-green-50"
                : "border-gray-200 text-gray-500"
            }`}
          >
            {job.requestStatus || "Active"}
          </Badge>
        </div>

        <div className="space-y-1.5 text-sm text-gray-600 mb-4">
          {job.location && (
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-gray-400 flex-shrink-0" />
              <span>{job.location}</span>
            </div>
          )}
          {(job.startDate || job.dateType) && (
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-gray-400 flex-shrink-0" />
              <span>{job.dateType === "Ongoing" ? "Ongoing / Recurring" : job.startDate ? new Date(job.startDate).toLocaleDateString() : job.dateType}</span>
            </div>
          )}
          {job.compensation && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs font-bold">$</span>
              <span className="font-semibold text-[#111]">{job.compensation}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full hirer-grad-bg text-white">
              <Users size={11} /> +{applicantCount}
            </span>
            <span className="text-xs text-gray-500">applicants</span>
          </div>
          <button
            className="text-xs font-semibold text-[#F25722] hover:underline flex items-center gap-1"
            onClick={() => toast.info("Job detail view coming soon!")}
          >
            View Details <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicationsPanel({ jobs, clientUserId }: { jobs: any[]; clientUserId?: number }) {
  const { data } = trpc.enterprise.getApplications.useQuery(
    { clientUserId: clientUserId! },
    { enabled: !!clientUserId }
  );

  const applications = data?.applications ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="font-black text-[#111] text-base">Applications</h3>
        <span className="text-xs font-bold text-gray-400">{applications.length} total</span>
      </div>
      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
        {applications.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No applications yet
          </div>
        ) : (
          applications.map((app: any) => (
            <div key={app.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              {app.profilePicture ? (
                <img
                  src={app.profilePicture}
                  alt={app.artistName}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                  {(app.artistName || "?")[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111] truncate">{app.artistName}</p>
                <p className="text-xs text-gray-400 truncate">{app.jobTitle}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Companies Tab ─────────────────────────────────────────────────────────────
function CompaniesTab({ enterpriseUser }: { enterpriseUser: any }) {
  const { data } = trpc.enterprise.getCompanies.useQuery(
    { clientUserId: enterpriseUser?.id },
    { enabled: !!enterpriseUser?.id }
  );

  const companies = data?.companies ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-black text-[#111]">Companies</h2>
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-semibold"
          onClick={() => toast.info("Add company coming soon!")}
        >
          <Plus size={14} className="mr-1" /> Add Company
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mb-4">
            <Building2 size={24} className="text-[#F25722]" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">No companies yet</h3>
          <p className="text-sm text-gray-500">Add your first company to manage jobs by location or brand.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company: any) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company }: { company: any }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => toast.info("Company detail coming soon!")}
    >
      <div className="flex items-center gap-4 mb-3">
        {company.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={company.name}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-xl flex-shrink-0">
            {(company.name || "C")[0]}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-black text-[#111] text-sm leading-tight truncate">{company.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {company.openRoles ?? 0} open role{company.openRoles !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {company.location && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin size={11} />
          <span>{company.location}</span>
        </div>
      )}
    </div>
  );
}

// ── Artists Tab ───────────────────────────────────────────────────────────────
function ArtistsTab({ enterpriseUser }: { enterpriseUser: any }) {
  const [subTab, setSubTab] = useState<ArtistsSubTab>("browse");
  const [search, setSearch] = useState("");

  const { data: browseData, isLoading: browseLoading } = trpc.artists.browse.useQuery(
    { search, offset: 0, limit: 24 },
    { enabled: subTab === "browse" }
  );

  const { data: interestedData, isLoading: interestedLoading } = trpc.enterprise.getInterestedArtists.useQuery(
    { clientUserId: enterpriseUser?.id },
    { enabled: subTab === "interested" && !!enterpriseUser?.id }
  );

  const artists = subTab === "browse" ? (browseData?.artists ?? []) : (interestedData?.artists ?? []);
  const isLoading = subTab === "browse" ? browseLoading : interestedLoading;

  return (
    <div>
      {/* Sub-tab toggle */}
      <div className="flex items-center gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {(["browse", "interested"] as ArtistsSubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              subTab === t ? "bg-white text-[#111] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "browse" ? "Browse All" : "Interested"}
          </button>
        ))}
      </div>

      {/* Search */}
      {subTab === "browse" && (
        <div className="relative mb-5 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[#F25722]" size={28} />
        </div>
      ) : artists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-pink-50 flex items-center justify-center mb-4">
            <Users size={24} className="text-pink-500" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">
            {subTab === "interested" ? "No interested artists yet" : "No artists found"}
          </h3>
          <p className="text-sm text-gray-500">
            {subTab === "interested"
              ? "Artists who apply to your jobs will appear here."
              : "Try adjusting your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {artists.map((artist: any) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArtistCard({ artist }: { artist: any }) {
  const [, navigate] = useLocation();
  const types = (() => {
    try { return JSON.parse(artist.masterArtistTypes || "[]"); } catch { return []; }
  })();

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/dashboard/artists/${artist.id}`)}
    >
      <div className="relative aspect-square bg-gradient-to-br from-orange-100 to-pink-100">
        {artist.profilePicture ? (
          <img
            src={artist.profilePicture}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-black text-white/80">
              {(artist.firstName || artist.name || "?")[0]}
            </span>
          </div>
        )}
        {artist.artswrkPro && (
          <div className="absolute top-2 right-2 bg-amber-400 rounded-full p-1">
            <Crown size={10} className="text-white" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-bold text-[#111] text-xs truncate">
          {artist.firstName && artist.lastName
            ? `${artist.firstName} ${artist.lastName}`
            : artist.name || "Artist"}
        </p>
        {types[0] && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{types[0]}</p>
        )}
        {artist.location && (
          <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-1 truncate">
            <MapPin size={9} /> {artist.location}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Enterprise Dashboard ─────────────────────────────────────────────────
export default function Enterprise() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("jobs");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch enterprise user record from DB
  const { data: enterpriseUser, isLoading: userLoading } = trpc.artswrkUsers.getByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  // Redirect non-enterprise users to regular dashboard
  useEffect(() => {
    if (!userLoading && enterpriseUser && !(enterpriseUser as any).enterprise) {
      navigate("/dashboard");
    }
  }, [userLoading, enterpriseUser, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (loading || userLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="animate-spin text-[#F25722]" size={32} />
      </div>
    );
  }

  if (!user || !enterpriseUser) return null;

  const companyName = enterpriseUser.clientCompanyName || enterpriseUser.name || "Enterprise";
  const logoUrl = enterpriseUser.enterpriseLogoUrl || enterpriseUser.profilePicture;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <a href="/" className="flex items-center select-none">
          <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
          <span className="font-black text-xl tracking-tight bg-white text-[#111] px-1.5 py-0.5 rounded ml-0.5 text-sm">WRK</span>
        </a>
        <button
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
        >
          ✕
        </button>
      </div>

      {/* Company info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-white/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              {companyName[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{companyName}</p>
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 mt-0.5">
              <Crown size={8} /> ENTERPRISE
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            onClick={() => { setActiveTab(item.tab); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
              activeTab === item.tab
                ? "hirer-grad-bg text-white shadow-sm"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom: logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f5f5f5] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col bg-[#111] flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#111] flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>

            {/* Company header */}
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="w-9 h-9 rounded-xl object-cover border border-gray-100"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm">
                  {companyName[0]}
                </div>
              )}
              <div>
                <h1 className="font-black text-[#111] text-base leading-tight">{companyName}</h1>
                <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                  <Crown size={9} /> Enterprise
                </span>
              </div>
            </div>
          </div>

          {/* Tab pills (desktop) + Post Job */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === item.tab
                      ? "bg-white text-[#111] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <Button
              className="hirer-grad-bg text-white border-0 hover:opacity-90 text-sm font-bold"
              onClick={() => toast.info("Premium job posting coming soon!")}
            >
              <Plus size={15} className="mr-1.5" /> Post Job
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          {activeTab === "jobs" && <JobsTab enterpriseUser={enterpriseUser} />}
          {activeTab === "companies" && <CompaniesTab enterpriseUser={enterpriseUser} />}
          {activeTab === "artists" && <ArtistsTab enterpriseUser={enterpriseUser} />}
        </main>
      </div>
    </div>
  );
}
