/*
 * ARTSWRK DASHBOARD — OVERVIEW
 * Stats, quick post job, my jobs list (real data from DB)
 */

import { useState } from "react";
import { Link } from "wouter";
import {
  Briefcase, Calendar, DollarSign, Users, TrendingUp,
  Clock, ChevronRight, Sparkles, Image, Search, Plus,
  MoreHorizontal, RefreshCw, MapPin, Loader2, AlertCircle
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
];

function getArtistInitials(bubbleId: string | null | undefined) {
  if (!bubbleId) return "?";
  // Use the last 2 chars of the Bubble ID as a deterministic placeholder
  return bubbleId.slice(-2).toUpperCase();
}

function getArtistColor(bubbleId: string | null | undefined) {
  if (!bubbleId) return AVATAR_COLORS[0];
  const idx = bubbleId.charCodeAt(bubbleId.length - 1) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function formatJobDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "Flexible";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Flexible";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getJobInitials(desc: string | null | undefined) {
  if (!desc) return "JB";
  const words = desc.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "JB";
}

function getStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "Active": return "bg-green-100 text-green-700";
    case "Confirmed": return "bg-blue-100 text-blue-700";
    case "Completed": return "bg-gray-100 text-gray-600";
    case "Submissions Paused": return "bg-yellow-100 text-yellow-700";
    default: return "bg-orange-50 text-[#F25722]";
  }
}

export default function Overview() {
  const { user } = useAuth();
  const [jobText, setJobText] = useState("");
  const [activeTab, setActiveTab] = useState<"jobs" | "artists" | "companies">("jobs");
  const [jobFilter, setJobFilter] = useState<"active" | "all">("active");

  // Real job data
  const { data: jobStats, isLoading: statsLoading } = trpc.jobs.myStats.useQuery();
  const { data: activeJobs, isLoading: jobsLoading } = trpc.jobs.myJobs.useQuery({
    limit: 10,
    status: jobFilter === "active" ? ["Active", "Confirmed"] : undefined,
  });

  // Real applicant data
  const { data: applicantStats } = trpc.applicants.myStats.useQuery();
  const { data: recentApplicants, isLoading: applicantsLoading } = trpc.applicants.myApplicants.useQuery({ limit: 6 });

  // Real booking data
  const { data: bookingStats } = trpc.bookings.myStats.useQuery();

  const stats = [
    {
      label: "Active Jobs",
      value: statsLoading ? "—" : String(jobStats?.active ?? 0),
      change: statsLoading ? "" : `${jobStats?.confirmed ?? 0} confirmed`,
      icon: <Briefcase size={18} />,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      label: "Total Jobs",
      value: statsLoading ? "—" : String(jobStats?.total ?? 0),
      change: "All time",
      icon: <TrendingUp size={18} />,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Completed",
      value: statsLoading ? "—" : String(jobStats?.completed ?? 0),
      change: "Successfully filled",
      icon: <Calendar size={18} />,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      label: "Applicants",
      value: statsLoading ? "—" : String(applicantStats?.total ?? 0),
      change: statsLoading ? "" : `${applicantStats?.confirmed ?? 0} confirmed`,
      icon: <Users size={18} />,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      label: "Bookings",
      value: bookingStats == null ? "—" : String(bookingStats.total),
      change: bookingStats == null ? "" : `${bookingStats.paid} paid · $${(bookingStats.totalRevenue ?? 0).toLocaleString()}`,
      icon: <DollarSign size={18} />,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">
          Welcome back, {(user?.name ?? user?.firstName ?? "there").split(" ")[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here is your hiring dashboard.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                {stat.icon}
              </div>
              <TrendingUp size={14} className="text-gray-300" />
            </div>
            <p className="text-2xl font-black text-[#111]">{stat.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick post + jobs */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick post job */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#111] mb-3">Post a New Job</h2>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Ex: I'm hiring a ballet teacher for weekly classes starting April..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <Image size={13} /> Add Image
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <Search size={13} /> Browse Artists
                </button>
                <Link href="/dashboard/jobs">
                  <button className="flex items-center gap-1.5 text-xs font-bold text-white px-4 py-1.5 rounded-lg hirer-grad-bg hover:opacity-90 transition-opacity">
                    <Plus size={13} /> Post Job
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* My Jobs / Artists / Companies tabs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1 p-4 border-b border-gray-100">
              {(["jobs", "artists", "companies"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
                    activeTab === t ? "hirer-grad-bg text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  My {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "jobs" && (
              <div>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <button
                    onClick={() => setJobFilter("active")}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      jobFilter === "active" ? "bg-[#111] text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setJobFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      jobFilter === "all" ? "bg-[#111] text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    All Jobs
                  </button>
                </div>

                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    <span className="text-sm">Loading jobs...</span>
                  </div>
                ) : !activeJobs || activeJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Briefcase size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">No {jobFilter === "active" ? "active " : ""}jobs found</p>
                    <Link href="/dashboard/jobs">
                      <button className="mt-3 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
                        Post your first job →
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {activeJobs.map((job) => (
                      <div key={job.id} className="p-4 hover:bg-gray-50 transition-colors group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5">
                              {getJobInitials(job.description)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusBadge(job.requestStatus)}`}>
                                  {job.dateType ?? job.requestStatus ?? "Job"}
                                </span>
                                {job.bubbleCreatedAt && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Clock size={10} /> {formatJobDate(job.bubbleCreatedAt)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                                {job.description ?? "No description"}
                              </p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {job.locationAddress && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <MapPin size={10} /> {job.locationAddress.split(",").slice(0, 2).join(",")}
                                  </span>
                                )}
                                {job.artistHourlyRate && (
                                  <span className="text-xs font-semibold text-green-600">
                                    ${job.artistHourlyRate}/hr
                                  </span>
                                )}
                                {job.dateType === "Recurring" || job.dateType === "Ongoing" ? (
                                  <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                                    <RefreshCw size={10} /> {job.dateType}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-4 border-t border-gray-100">
                  <Link href="/dashboard/jobs">
                    <button className="w-full text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity flex items-center justify-center gap-1">
                      View all jobs <ChevronRight size={14} />
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "artists" && (
              <div className="p-6 text-center text-gray-400 text-sm">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Your saved artists will appear here</p>
                <Link href="/dashboard/artists">
                  <button className="mt-3 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
                    Browse Artists →
                  </button>
                </Link>
              </div>
            )}

            {activeTab === "companies" && (
              <div className="p-6 text-center text-gray-400 text-sm">
                <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Manage your company profiles</p>
                <Link href="/dashboard/company">
                  <button className="mt-3 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
                    Set Up Company Page →
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: Applicants */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#111]">My Applicants</h2>
              <span className="text-xs text-gray-400">{applicantStats?.total ?? "—"} total</span>
            </div>
            <div className="divide-y divide-gray-100">
              {applicantsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : !recentApplicants || recentApplicants.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs">
                  <Users size={24} className="mx-auto mb-2 opacity-30" />
                  <p>No applicants yet</p>
                </div>
              ) : (
                recentApplicants.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group">
                    <div className={`w-8 h-8 rounded-full ${getArtistColor(a.bubbleArtistId)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {getArtistInitials(a.bubbleArtistId)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111] truncate">Artist #{a.bubbleArtistId?.slice(-6)}</p>
                      <p className="text-xs text-gray-400">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium mr-1 ${
                          a.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'Declined' ? 'bg-red-100 text-red-600' :
                          'bg-orange-50 text-[#F25722]'
                        }`}>{a.status}</span>
                        {a.artistHourlyRate ? `$${a.artistHourlyRate}/hr` : a.artistFlatRate ? `$${a.artistFlatRate} flat` : "Open rate"}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <Link href="/dashboard/artists">
                <button className="w-full text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity flex items-center justify-center gap-1">
                  View all artists <ChevronRight size={14} />
                </button>
              </Link>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="bg-[#111] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-amber-400" />
              <p className="text-sm font-bold text-white">Upgrade to Premium</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Unlock Company Pages, Sub Lists, Community access, and exclusive Benefits for your studio.
            </p>
            <button className="w-full py-2.5 rounded-xl text-xs font-bold text-[#111] bg-amber-400 hover:bg-amber-300 transition-colors">
              View Premium Plans →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
