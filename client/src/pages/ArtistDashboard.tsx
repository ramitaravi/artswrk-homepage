/**
 * ARTIST DASHBOARD
 * Matches the live Artswrk Bubble dashboard design at /version-830zu/dashboard-2
 * Sidebar: Dashboard, Jobs, Bookings, Payments, Messages, Profile, PRO Features
 * Main: Greeting, Affiliations, Tasks, Profile Boost, PRO Jobs, Jobs for You
 */

import { useState } from "react";
import { useLocation } from "wouter";
import ArtistProfilePage from "./artist/ArtistProfilePage";
import ArtistSettingsPlan from "./artist/ArtistSettingsPlan";
import {
  Briefcase,
  Calendar,
  CreditCard,
  MessageSquare,
  Star,
  Building2,
  Gift,
  Users,
  Settings,
  MapPin,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

// ─── Placeholder data (to be replaced with real API data) ─────────────────────

const AFFILIATIONS = [
  "CLI Conservatory",
  "University of Arizona",
  "Rutgers Mason Gross",
  "Drexel University",
  "We Are Queens",
  "Clemson University",
  "So You Think You Can Dance",
  "Acrobatic Arts",
  "Hubbard Street",
  "Rider University",
  "University of Wisconsin Madison",
];

const PRO_JOBS = [
  { id: 1, title: "Judge | March 15, 2026", company: "DreamMaker", location: "Work From Anywhere", applied: true },
  { id: 2, title: "Judges", company: "DreamMaker", location: "Work From Anywhere", applied: false },
  { id: 3, title: "General Staff", company: "Imagine", location: "Work From Anywhere", applied: false },
  { id: 4, title: "Tabulator", company: "Destiny Talent Competition", location: "Work From Anywhere", applied: true },
  { id: 5, title: "Judge", company: "Destiny Talent Competition", location: "Work From Anywhere", applied: false },
  { id: 6, title: "Emcee", company: "Destiny Talent Competition", location: "Work From Anywhere", applied: false },
  { id: 7, title: "Social Media / Content Creator", company: "Ailey Extension", location: "Work From Anywhere", applied: false },
  { id: 8, title: "Core Crew", company: "[solidcore]", location: "New York, NY, USA", applied: false },
  { id: 9, title: "Intern", company: "Artistic Dance Exchange", location: "Work From Anywhere", applied: true },
  { id: 10, title: "Event Staff", company: "AmeriDance", location: "Work From Anywhere", applied: false },
  { id: 11, title: "Summer Staff", company: "AmeriDance", location: "Work From Anywhere", applied: false },
  { id: 12, title: "Judge", company: "AmeriDance", location: "Work From Anywhere", applied: false },
];

const JOBS_FOR_YOU = [
  { id: 1, studio: "Dance Studio", serviceType: "Competition Choreography", location: "New York, NY", postedAgo: "2 months ago", date: "Mon, 2/16/26, 8:56 pm", rate: "Open rate", applied: false, logo: null },
  { id: 2, studio: "For Dancers Only", serviceType: "Substitute Teacher", location: "Totowa, NJ", postedAgo: "5 months ago", date: "Sat, 11/22/25, 12:00 am", rate: "$50.00/hr", applied: false, logo: null },
  { id: 3, studio: "Fancy Feet Dance Studio", serviceType: "Competition Choreography", location: "Mount Vernon, NY", postedAgo: "9 months ago", date: "Sat, 7/26/25, 3:50 pm", rate: "Open rate", applied: false, logo: null },
  { id: 4, studio: "DWDP", serviceType: "Master Classes", location: "Deer Park, NY", postedAgo: "a year ago", date: "Thu, 8/07/25, 1:00 pm – 8/07/25, 3:00 pm", rate: "Open rate", applied: true, logo: null },
  { id: 5, studio: "The Edge of Dance", serviceType: "Master Classes", location: "Armonk, NY", postedAgo: "a year ago", date: "Thu, 2/27/25, 6:00 pm – 2/27/25, 8:00 pm", rate: "$65.00/hr", applied: true, logo: null },
  { id: 6, studio: "Norwalk Academy of Dance", serviceType: "Substitute Teacher", location: "Norwalk, CT", postedAgo: "a year ago", date: "Fri, 2/28/25, 4:15 pm – 2/28/25, 7:15 pm", rate: "$50.00/hr", applied: false, logo: null },
  { id: 7, studio: "Isabels School of Dance", serviceType: "Substitute Teacher", location: "Bogota, NJ", postedAgo: "a year ago", date: "Tue, 2/25/25, 5:00 pm", rate: "$30.00/hr", applied: false, logo: null },
  { id: 8, studio: "Create Dance Center", serviceType: "Substitute Teacher", location: "Massapequa, NY", postedAgo: "a year ago", date: "Thu, 3/06/25, 4:45 pm – 3/06/25, 7:30 pm", rate: "$50.00/hr", applied: false, logo: null },
  { id: 9, studio: "Miss Colleens Elite Dancentre", serviceType: "Recurring Classes", location: "Rockville Centre, NY", postedAgo: "a year ago", date: "Dates Flexible", rate: "$40.00/hr", applied: false, logo: null },
  { id: 10, studio: "Artistry Dance Complex", serviceType: "Recurring Classes", location: "Massapequa, NY", postedAgo: "a year ago", date: "Thu, 8/07/25, 7:30 pm", rate: "Open rate", applied: false, logo: null },
];

// (Sidebar removed — DashboardLayout now handles navigation)

// ─── Studio Logo Avatar ───────────────────────────────────────────────────────

function StudioAvatar({ name, logo, size = "md" }: { name: string; logo?: string | null; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  if (logo && !imgError) {
    return (
      <img
        src={logo.startsWith("//") ? `https:${logo}` : logo}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-gray-100`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white hirer-grad-bg`}>
      {initials}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ user }: { user: any }) {
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      {/* Greeting + Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <StudioAvatar name={user?.name || "Artist"} logo={user?.profilePicture} size="lg" />
            <div>
              <h1 className="text-2xl font-black text-[#111]">Hey, {firstName} 🎉</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Star size={11} className="fill-amber-500 text-amber-500" /> Artswrk PRO Member
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">My Affiliations</p>
                <div className="flex flex-wrap gap-1.5">
                  {AFFILIATIONS.map(aff => (
                    <span key={aff} className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{aff}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <a
            href={`https://artswrk.com/artist/${user?.slug || "ramita-ravi"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors"
          >
            View Profile <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Your Tasks */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-[#111]">Your Tasks</h2>
          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">1</span>
        </div>
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#111]">Mark as complete (1)</p>
            <p className="text-xs text-gray-500 mt-0.5">1 booking must be marked as complete</p>
          </div>
          <button className="ml-auto text-xs font-semibold text-amber-700 hover:underline flex-shrink-0">View →</button>
        </div>
      </div>

      {/* Profile Boost */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111] flex items-center gap-2">
              Profile Boost <span className="text-amber-500">⭐️</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Want to get in front of studios like you do on Facebook? Create a boosted post to directly reach hundreds of studios near you.
            </p>
          </div>
          <button className="flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-full transition-opacity hover:opacity-90 hirer-grad-bg">
            Get started <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* PRO Jobs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#111] flex items-center gap-2">
            Jobs <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">PRO ⭐️</span>
          </h2>
          <button className="text-sm font-semibold text-gray-600 hover:text-[#111] flex items-center gap-1">
            View PRO Jobs <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {PRO_JOBS.map(job => (
            <div key={job.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111] truncate">{job.title}</p>
                <p className="text-xs text-gray-500">{job.company}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={10} /> {job.location}
                </p>
              </div>
              {job.applied ? (
                <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={11} /> Applied!
                </span>
              ) : (
                <button className="flex-shrink-0 text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors flex items-center gap-1">
                  Apply <ArrowRight size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Jobs for You */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#111]">Jobs for You</h2>
          <button className="text-sm font-semibold text-gray-600 hover:text-[#111] flex items-center gap-1">
            View All <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-3">
          {JOBS_FOR_YOU.map(job => (
            <div key={job.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
              <StudioAvatar name={job.studio} logo={job.logo} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#111]">{job.studio}</p>
                <p className="text-sm text-gray-700">{job.serviceType}</p>
                <p className="text-xs text-gray-500 mt-0.5">{job.location} · Posted {job.postedAgo}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={10} /> {job.date}</span>
                  <span className="flex items-center gap-1">
                    <CreditCard size={10} /> {job.rate}
                  </span>
                </div>
              </div>
              {job.applied ? (
                <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={11} /> Applied!
                </span>
              ) : (
                <button className="flex-shrink-0 text-xs font-semibold text-white bg-[#111] px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity">
                  Apply
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

type JobsSubTab = "jobs-for-you" | "pro-jobs" | "applications";

function JobsTab({ user }: { user: any }) {
  const [subTab, setSubTab] = useState<JobsSubTab>("jobs-for-you");
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const { data: jobsFeed, isLoading: feedLoading } = trpc.artistDashboard.getJobsFeed.useQuery({ limit: 30, offset: 0 });
  const { data: proJobs, isLoading: proLoading } = trpc.artistDashboard.getProJobsFeed.useQuery({ limit: 30, offset: 0 });
  const { data: applications, isLoading: appsLoading } = trpc.artistDashboard.getProApplications.useQuery();

  const applyMutation = trpc.artistDashboard.applyToProJob.useMutation({
    onSuccess: (data, variables) => {
      setAppliedIds(prev => { const next = new Set(prev); next.add(variables.premiumJobId); return next; });
    },
  });

  const subTabBtn = (tab: JobsSubTab, label: string) => (
    <button
      onClick={() => setSubTab(tab)}
      className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
        subTab === tab ? "bg-[#111] text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#111]">Jobs</h2>
      </div>

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full w-fit">
        {subTabBtn("jobs-for-you", "Jobs For You")}
        {subTabBtn("pro-jobs", "PRO Jobs ⭐️")}
        {subTabBtn("applications", "Applications")}
      </div>

      {/* Jobs For You */}
      {subTab === "jobs-for-you" && (
        <div className="bg-white rounded-2xl border border-gray-100">
          {feedLoading ? (
            <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin mx-auto" /></div>
          ) : !jobsFeed?.length ? (
            <div className="p-8 text-center">
              <Briefcase size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-1">No jobs right now</p>
              <p className="text-sm text-gray-500 mb-4">Make sure your profile is complete so hirers can find you.</p>
              <a href="/app/artists" className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                Browse artist profiles →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobsFeed.map((job: any) => (
                <div key={job.id} className="flex items-start gap-3 p-4">
                  <StudioAvatar name={job.studioName || job.creatorName || "Studio"} logo={job.logo} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#111]">{job.studioName || job.creatorName}</p>
                    <p className="text-sm text-gray-700">{job.serviceType}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.location && !job.location.includes("[object") ? job.location : (job.workFromAnywhere ? "Work From Anywhere" : "Location TBD")}
                      {job.postedAgo ? ` · Posted ${job.postedAgo}` : ""}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {job.rate && <span className="flex items-center gap-1"><CreditCard size={10} /> {job.rate}</span>}
                    </div>
                  </div>
                  <button className="flex-shrink-0 text-xs font-semibold text-white bg-[#111] px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity">
                    Apply
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRO Jobs */}
      {subTab === "pro-jobs" && (
        <div className="bg-white rounded-2xl border border-gray-100">
          {proLoading ? (
            <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin mx-auto" /></div>
          ) : !proJobs?.length ? (
            <div className="p-8 text-center">
              <Star size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-1">No PRO jobs right now</p>
              <p className="text-sm text-gray-500 mb-4">New PRO jobs are posted regularly. Check back soon!</p>
              <a
                href="/app/settings"
                className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold text-white hirer-grad-bg hover:opacity-80 transition-opacity"
              >
                Upgrade to PRO →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {proJobs.map((job: any) => {
                const isApplied = appliedIds.has(job.id) || job.hasApplied;
                return (
                  <div key={job.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <StudioAvatar name={job.companyName || "Company"} logo={job.logo} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#111] truncate">{job.serviceType}</p>
                        <p className="text-xs text-gray-500">{job.companyName}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {job.workFromAnywhere ? "Work From Anywhere" : (job.location && !job.location.includes("[object") ? job.location : "Location TBD")}
                        </p>
                      </div>
                    </div>
                    {isApplied ? (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 size={11} /> Applied!
                      </span>
                    ) : (
                      <button
                        onClick={() => applyMutation.mutate({ premiumJobId: job.id })}
                        disabled={applyMutation.isPending}
                        className="flex-shrink-0 text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        Apply <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Applications */}
      {subTab === "applications" && (
        <div className="bg-white rounded-2xl border border-gray-100">
          {appsLoading ? (
            <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin mx-auto" /></div>
          ) : !applications?.length ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-1">No applications yet</p>
              <p className="text-sm text-gray-500 mb-4">Browse PRO jobs and apply to start tracking here.</p>
              <button
                onClick={() => setSubTab("pro-jobs")}
                className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity"
              >
                Browse PRO jobs →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {applications.map((app: any) => (
                <div key={app.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StudioAvatar name={app.companyName || "Company"} logo={app.logo} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#111] truncate">{app.jobTitle}</p>
                      <p className="text-xs text-gray-500">{app.companyName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ""}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    app.status === "Accepted" ? "bg-green-50 text-green-700" :
                    app.status === "Rejected" ? "bg-red-50 text-red-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {app.status || "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────────

type BookingsSubTab = "mark-complete" | "payment-pending" | "upcoming" | "completed";

const SAMPLE_BOOKINGS = [
  { id: 1, jobTitle: "Hip Hop Instructor", company: "Elevation on Tour", logo: "", date: "May 1–3, 2025", rate: "$20/hr", location: "Sicklerville, NJ", status: "upcoming" as const },
  { id: 2, jobTitle: "Event Assistant", company: "Journey Dance Competition", logo: "", date: "Apr 20, 2025", rate: "$20/hr", location: "Chicago, IL", status: "payment-pending" as const },
  { id: 3, jobTitle: "Dance Judge", company: "REVEL Dance", logo: "", date: "Mar 15, 2025", rate: "$150 flat", location: "Los Angeles, CA", status: "mark-complete" as const },
  { id: 4, jobTitle: "Ballet Teacher", company: "Artswrk Studio", logo: "", date: "Feb 10, 2025", rate: "$40/hr", location: "New York, NY", status: "completed" as const },
];

function BookingsTab() {
  const [subTab, setSubTab] = useState<BookingsSubTab>("upcoming");

  const subTabBtn = (tab: BookingsSubTab, label: string) => (
    <button
      onClick={() => setSubTab(tab)}
      className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
        subTab === tab ? "bg-[#111] text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  const filtered = SAMPLE_BOOKINGS.filter(b => b.status === subTab);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      upcoming: "bg-blue-50 text-blue-700",
      "payment-pending": "bg-amber-50 text-amber-700",
      "mark-complete": "bg-orange-50 text-orange-700",
      completed: "bg-green-50 text-green-700",
    };
    const labels: Record<string, string> = {
      upcoming: "Upcoming",
      "payment-pending": "Payment Pending",
      "mark-complete": "Mark Complete",
      completed: "Completed",
    };
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] || "bg-gray-50 text-gray-600"}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-[#111]">Bookings</h2>

      <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
        {subTabBtn("mark-complete", "Mark as Complete")}
        {subTabBtn("payment-pending", "Payment Pending")}
        {subTabBtn("upcoming", "Upcoming")}
        {subTabBtn("completed", "Completed")}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-gray-700 mb-1">No bookings here</p>
            <p className="text-sm text-gray-500 mb-4">Apply to jobs to start getting booked by hirers.</p>
            <a href="/app/jobs" className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
              Browse jobs →
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(booking => (
              <div key={booking.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StudioAvatar name={booking.company} logo={booking.logo} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111] truncate">{booking.jobTitle}</p>
                    <p className="text-xs text-gray-500">{booking.company}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {booking.date}</span>
                      <span className="flex items-center gap-1"><CreditCard size={10} /> {booking.rate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {statusBadge(booking.status)}
                  {booking.status === "mark-complete" && (
                    <button className="text-xs font-semibold text-white bg-[#111] px-3 py-1.5 rounded-full hover:bg-gray-700 transition-colors">
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────────

const SAMPLE_PAYMENTS = [
  { id: 1, jobTitle: "Hip Hop Instructor", company: "Elevation on Tour", amount: "$160.00", date: "May 5, 2025", status: "paid" as const, method: "Direct Deposit" },
  { id: 2, jobTitle: "Event Assistant", company: "Journey Dance Competition", amount: "$80.00", date: "Apr 22, 2025", status: "pending" as const, method: "Direct Deposit" },
  { id: 3, jobTitle: "Dance Judge", company: "REVEL Dance", amount: "$150.00", date: "Mar 17, 2025", status: "paid" as const, method: "Direct Deposit" },
];

function PaymentsTab() {
  const totalEarned = SAMPLE_PAYMENTS.filter(p => p.status === "paid").reduce((sum, p) => sum + parseFloat(p.amount.replace("$", "").replace(",", "")), 0);
  const totalPending = SAMPLE_PAYMENTS.filter(p => p.status === "pending").reduce((sum, p) => sum + parseFloat(p.amount.replace("$", "").replace(",", "")), 0);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-[#111]">Payments</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Earned</p>
          <p className="text-2xl font-black text-[#111]">${totalEarned.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-1 font-semibold">↑ All time</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-black text-[#111]">${totalPending.toFixed(2)}</p>
          <p className="text-xs text-amber-600 mt-1 font-semibold">Awaiting payment</p>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-bold text-[#111]">Payment History</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {SAMPLE_PAYMENTS.map(payment => (
            <div key={payment.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111] truncate">{payment.jobTitle}</p>
                <p className="text-xs text-gray-500">{payment.company}</p>
                <p className="text-xs text-gray-400 mt-0.5">{payment.date} · {payment.method}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="text-sm font-bold text-[#111]">{payment.amount}</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  payment.status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {payment.status === "paid" ? "Paid" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Stripe CTA */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
        <h3 className="text-sm font-bold mb-1">Set Up Direct Deposit</h3>
        <p className="text-xs text-gray-400 mb-3">Connect your bank account to receive payments directly from hirers.</p>
        <button className="text-xs font-semibold text-[#111] bg-white px-4 py-2 rounded-full hover:bg-gray-100 transition-colors">
          Connect Bank Account
        </button>
      </div>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────────

const SAMPLE_MESSAGES = [
  { id: 1, from: "Elevation on Tour", avatar: "", preview: "Hi! We'd love to have you for our May event. Are you available?", time: "2h ago", unread: true },
  { id: 2, from: "Journey Dance Competition", avatar: "", preview: "Thanks for applying! We'll be in touch soon.", time: "1d ago", unread: false },
  { id: 3, from: "REVEL Dance", avatar: "", preview: "Your booking has been confirmed for March 15th.", time: "3d ago", unread: false },
];

function MessagesTab() {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedMsg = SAMPLE_MESSAGES.find(m => m.id === selected);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-[#111]">Messages</h2>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {!selected ? (
          // Inbox list
          <div className="divide-y divide-gray-50">
            {SAMPLE_MESSAGES.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">No messages yet</p>
                <p className="text-sm text-gray-500 mb-4">Apply to jobs to start conversations with hirers.</p>
                <a href="/app/jobs" className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                  Browse jobs →
                </a>
              </div>
            ) : (
              SAMPLE_MESSAGES.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => setSelected(msg.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <StudioAvatar name={msg.from} logo={msg.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${msg.unread ? "font-bold text-[#111]" : "font-semibold text-gray-700"}`}>{msg.from}</p>
                      <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{msg.time}</p>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${msg.unread ? "text-gray-700" : "text-gray-500"}`}>{msg.preview}</p>
                  </div>
                  {msg.unread && <div className="w-2 h-2 rounded-full bg-pink-500 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        ) : (
          // Conversation view
          <div className="flex flex-col h-[480px]">
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-[#111] transition-colors">
                <ChevronRight size={18} className="rotate-180" />
              </button>
              <StudioAvatar name={selectedMsg?.from || ""} logo={selectedMsg?.avatar} size="sm" />
              <p className="text-sm font-bold text-[#111]">{selectedMsg?.from}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex justify-start">
                <div className="max-w-xs bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <p className="text-sm text-gray-800">{selectedMsg?.preview}</p>
                  <p className="text-xs text-gray-400 mt-1">{selectedMsg?.time}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 text-sm px-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-[#F25722] transition-colors"
                />
                <button className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center hover:bg-gray-700 transition-colors flex-shrink-0">
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────────

function ProfileTab({ user }: { user: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start gap-5 mb-6">
        <StudioAvatar name={user?.name || "Artist"} logo={user?.profilePicture} size="lg" />
        <div className="flex-1">
          <h2 className="text-xl font-black text-[#111]">{user?.name || "Your Name"}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
          {user?.bio && (
            <p className="text-sm text-gray-600 mt-3 leading-relaxed line-clamp-4">{user.bio}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Location</p>
          <p className="text-sm font-semibold text-[#111]">{user?.location || "Not set"}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Artist Type</p>
          <p className="text-sm font-semibold text-[#111]">{user?.masterArtistTypes || "Not set"}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Instagram</p>
          <p className="text-sm font-semibold text-[#111]">{user?.instagram || "Not set"}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Website</p>
          <p className="text-sm font-semibold text-[#111]">{user?.website || "Not set"}</p>
        </div>
      </div>
      <button className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
        Edit Profile
      </button>
    </div>
  );
}

// ─── PRO Jobs Tab ─────────────────────────────────────────────────────────────

function ProJobsTab({ onGoToSettings }: { onGoToSettings: () => void }) {
  const { data: planData, isLoading: planLoading } = trpc.artistSubscription.getCurrentPlan.useQuery();
  const { data: pricingData } = trpc.artistSubscription.getPricing.useQuery();
  const isPro = planData?.plan === "pro";

  // PRO upsell card for free and basic users
  if (!planLoading && !isPro) {
    const proMonthlyPrice = pricingData?.pro?.monthly?.dollars ?? null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#111] flex items-center gap-2">
            PRO Jobs <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⭐️</span>
          </h2>
        </div>

        {/* Upsell card */}
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Star size={22} className="text-amber-600 fill-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-[#111]">Unlock PRO Jobs</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                PRO jobs are exclusive listings from top companies — competitions, touring productions, and enterprise studios. Upgrade to PRO to apply to all of them.
              </p>
              <ul className="mt-3 space-y-1.5">
                {["Access enterprise & competition jobs", "Priority placement in search results", "Profile boost & featured badge", "Advanced application analytics"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={13} className="text-amber-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={onGoToSettings}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 hirer-grad-bg"
                >
                  <Sparkles size={15} />
                  {proMonthlyPrice ? `Upgrade to PRO — from ${proMonthlyPrice}/mo` : "Upgrade to PRO"}
                  <ArrowRight size={14} />
                </button>
              </div>
              {proMonthlyPrice && (
                <p className="text-xs text-gray-400 mt-2">Annual billing available — save ~20%</p>
              )}
            </div>
          </div>
        </div>

        {/* Blurred teaser of PRO jobs */}
        <div className="relative">
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
            {PRO_JOBS.slice(0, 5).map(job => (
              <div key={job.id} className="flex items-center justify-between p-4 select-none">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#111] blur-sm">{job.title}</p>
                  <p className="text-xs text-gray-500 blur-sm">{job.company}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 blur-sm">
                    <MapPin size={10} /> {job.location}
                  </p>
                </div>
                <button
                  onClick={onGoToSettings}
                  className="flex-shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  <Star size={11} className="fill-amber-400" /> PRO Only
                </button>
              </div>
            ))}
          </div>
          {/* Gradient fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-50 to-transparent rounded-b-2xl pointer-events-none" />
          <p className="text-center text-xs text-gray-400 mt-2">{PRO_JOBS.length} PRO jobs available — upgrade to see all</p>
        </div>
      </div>
    );
  }

  // PRO user view — full access
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-[#111] flex items-center gap-2">
          PRO Jobs <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⭐️</span>
        </h2>
        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Star size={11} className="fill-amber-400" /> PRO Access
        </span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {PRO_JOBS.map(job => (
          <div key={job.id} className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111]">{job.title}</p>
              <p className="text-xs text-gray-500">{job.company}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> {job.location}
              </p>
            </div>
            {job.applied ? (
              <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={11} /> Applied!
              </span>
            ) : (
              <button className="flex-shrink-0 text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors flex items-center gap-1">
                Apply <ArrowRight size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Coming Soon Tab ──────────────────────────────────────────────────────────

function ComingSoonTab({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="w-12 h-12 mx-auto text-gray-300 mb-3">{icon}</div>
      <h2 className="text-lg font-bold text-[#111] mb-1">{title}</h2>
      <p className="text-sm text-gray-500">Coming soon. Data integration in progress.</p>
    </div>
  );
}

// ─── Main Artist Dashboard ────────────────────────────────────────────────────
// Renders inside DashboardLayout — no sidebar of its own.
// Content is driven by the current URL path (/app, /app/jobs, etc.)

export default function ArtistDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();

  function renderContent() {
    if (location.startsWith("/app/jobs")) return <JobsTab user={user} />;
    if (location.startsWith("/app/bookings")) return <BookingsTab />;
    if (location.startsWith("/app/payments")) return <PaymentsTab />;
    if (location.startsWith("/app/messages")) return <MessagesTab />;
    if (location.startsWith("/app/profile")) return <ArtistProfilePage />;
    if (location.startsWith("/app/pro-jobs")) return <ProJobsTab onGoToSettings={() => { window.location.href = "/app/settings"; }} />;
    if (location.startsWith("/app/benefits")) return <ComingSoonTab icon={<Gift size={40} />} title="Benefits" />;
    if (location.startsWith("/app/community")) return <ComingSoonTab icon={<Users size={40} />} title="Community" />;
    if (location.startsWith("/app/settings")) return <ArtistSettingsPlan />;
    // Default: /app overview
    return <DashboardTab user={user} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {renderContent()}
    </div>
  );
}
