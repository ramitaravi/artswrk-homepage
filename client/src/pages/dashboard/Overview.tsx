/*
 * ARTSWRK DASHBOARD — OVERVIEW
 * Stats, quick post job, my jobs list, my applicants
 */

import { useState } from "react";
import { Link } from "wouter";
import {
  Briefcase, Calendar, DollarSign, Users, TrendingUp,
  Clock, MapPin, ChevronRight, Sparkles, Image, Search, Plus,
  MoreHorizontal, RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STATS = [
  { label: "Active Jobs", value: "7", change: "+2 this week", icon: <Briefcase size={18} />, color: "text-orange-500", bg: "bg-orange-50" },
  { label: "Pending Bookings", value: "3", change: "2 need response", icon: <Calendar size={18} />, color: "text-blue-500", bg: "bg-blue-50" },
  { label: "Total Paid Out", value: "$4,820", change: "This season", icon: <DollarSign size={18} />, color: "text-green-500", bg: "bg-green-50" },
  { label: "Total Applicants", value: "47", change: "+12 this week", icon: <Users size={18} />, color: "text-purple-500", bg: "bg-purple-50" },
];

const JOBS = [
  {
    id: 1, tag: "Recurring Classes", date: "March 6th, 2025 @ 3:30 pm",
    desc: "Thursday versatile instructor needed. Must be committed through May 15th, 2025. If actively/prioritizing auditions, DO NOT APPLY.",
    applicants: 4, status: "active",
  },
  {
    id: 2, tag: "Recurring Classes", date: "March 5th, 2025 @ 4:00 pm",
    desc: "Wed weekly preballet/hip hop instructor needed. 3K & PreK. MUST have experience & enjoy working with young dancers.",
    applicants: 7, status: "active",
  },
  {
    id: 3, tag: "Recurring Classes", date: "March 5th, 2025 @ 4:00 pm",
    desc: "Wednesday versatile instructor needed, to work with a variety of ages, styles and levels. Must be committed through May 14th.",
    applicants: 3, status: "active",
  },
  {
    id: 4, tag: "Recurring Classes", date: "March 4th, 2025 @ 4:00 pm",
    desc: "Tues instructor needed. Must be available and committed through May 13, 2025. Must have 3+ years teaching experience.",
    applicants: 2, status: "active",
  },
];

const APPLICANTS = [
  { name: "Sasha K.", times: 9, initials: "SK", color: "bg-purple-500" },
  { name: "Marlon S.", times: 9, initials: "MS", color: "bg-blue-500" },
  { name: "Amie B.", times: 6, initials: "AB", color: "bg-pink-500" },
  { name: "gracen n.", times: 3, initials: "GN", color: "bg-green-500" },
  { name: "Jesse B.", times: 3, initials: "JB", color: "bg-orange-500" },
  { name: "Alex M.", times: 3, initials: "AM", color: "bg-teal-500" },
  { name: "Clarissa J.", times: 2, initials: "CJ", color: "bg-indigo-500" },
  { name: "Olivia G.", times: 1, initials: "OG", color: "bg-rose-500" },
];

export default function Overview() {
  const { user } = useAuth();
  const [jobText, setJobText] = useState("");
  const [activeTab, setActiveTab] = useState<"jobs" | "artists" | "companies">("jobs");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">
          Welcome back, {user?.name.split(" ")[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here is your hiring dashboard.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {STATS.map((stat) => (
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
                  <button className="px-3 py-1 rounded-full text-xs font-semibold bg-[#111] text-white">Active</button>
                  <button className="px-3 py-1 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">Archived</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {JOBS.map((job) => (
                    <div key={job.id} className="p-4 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5">
                            RC
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-[#F25722] bg-orange-50 px-2 py-0.5 rounded-full">
                                {job.tag}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock size={10} /> {job.date}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{job.desc}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Users size={11} /> {job.applicants} applicants
                              </span>
                              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                                <RefreshCw size={10} /> Recurring
                              </span>
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
              <span className="text-xs text-gray-400">{APPLICANTS.length} artists</span>
            </div>
            <div className="divide-y divide-gray-100">
              {APPLICANTS.map((a) => (
                <div key={a.name} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className={`w-8 h-8 rounded-full ${a.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {a.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111] truncate">{a.name}</p>
                    <p className="text-xs text-gray-400">Applied to you {a.times} {a.times === 1 ? "time" : "times"}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
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
