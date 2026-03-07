/*
 * ARTSWRK DASHBOARD — MY JOBS
 * Post job, manage active/archived jobs, view applicants per job
 */

import { useState } from "react";
import {
  Plus, Search, Filter, Clock, Users, RefreshCw,
  MoreHorizontal, ChevronDown, MapPin, DollarSign,
  CheckCircle, XCircle, Eye, Trash2, Sparkles
} from "lucide-react";

const JOBS = [
  {
    id: 1, tag: "Recurring Classes", status: "active",
    date: "March 6th, 2025 @ 3:30 pm", location: "Bayside, NY",
    rate: "$45/hr",
    desc: "Thursday versatile instructor needed. Must be committed through May 15th, 2025. Thursdays: 3:30-4pm clean tap solo (Age 12), 4-5:15pm ballet/tap/hip hop (1st-3rd), 5:15-5:45pm Mini Jazz Company, 6-7pm Teen-Adult Tap. Total: 3.25 hrs.",
    applicants: 4, views: 128,
  },
  {
    id: 2, tag: "Recurring Classes", status: "active",
    date: "March 5th, 2025 @ 4:00 pm", location: "Bayside, NY",
    rate: "$50/hr",
    desc: "Wed weekly preballet/hip hop instructor needed. 3K & PreK. MUST have experience & enjoy working with young dancers. Must be committed through May 14th.",
    applicants: 7, views: 203,
  },
  {
    id: 3, tag: "Recurring Classes", status: "active",
    date: "March 5th, 2025 @ 4:00 pm", location: "Bayside, NY",
    rate: "$45/hr",
    desc: "Wednesday versatile instructor needed, to work with a variety of ages, styles and levels. 4-4:55pm hip hop & basic acro (K-2nd), 5-6pm beginner ballet (7-12), 6-7pm Contemporary & jazz (preteens & teens), 7:10-7:50pm adaptive dance (adults).",
    applicants: 3, views: 89,
  },
  {
    id: 4, tag: "Recurring Classes", status: "active",
    date: "March 4th, 2025 @ 4:00 pm", location: "Bayside, NY",
    rate: "Open rate",
    desc: "Tues instructor needed. Must be available and committed through May 13, 2025. 4-5pm Jazz/Tap K-2nd grade, 5-6pm Jazz/Lyrical ages 8 to 12. Must have 3+ years teaching experience.",
    applicants: 2, views: 67,
  },
  {
    id: 5, tag: "Sub", status: "active",
    date: "March 3rd, 2025 @ 10:00 am", location: "Bayside, NY",
    rate: "$40/hr",
    desc: "Saturday sub instructor needed for PreBallet/Hip Hop (ages 3-4) and Mommy & Me (ages 3 & younger). Must be experienced working with ages 4 & younger.",
    applicants: 6, views: 145,
  },
  {
    id: 6, tag: "Recurring Classes", status: "archived",
    date: "January 15th, 2025 @ 4:00 pm", location: "Bayside, NY",
    rate: "$45/hr",
    desc: "Wed weekly preballet/hip hop instructor needed from 4-4:45pm. 3K & PreK. MUST have experience & enjoy working with young dancers.",
    applicants: 11, views: 312,
  },
];

const APPLICANTS_BY_JOB: Record<number, { name: string; initials: string; color: string; status: "pending" | "accepted" | "declined" }[]> = {
  1: [
    { name: "Sasha K.", initials: "SK", color: "bg-purple-500", status: "pending" },
    { name: "Jesse B.", initials: "JB", color: "bg-orange-500", status: "pending" },
    { name: "Amie B.", initials: "AB", color: "bg-pink-500", status: "accepted" },
    { name: "Olivia G.", initials: "OG", color: "bg-rose-500", status: "declined" },
  ],
  2: [
    { name: "Marlon S.", initials: "MS", color: "bg-blue-500", status: "pending" },
    { name: "gracen n.", initials: "GN", color: "bg-green-500", status: "pending" },
    { name: "Alex M.", initials: "AM", color: "bg-teal-500", status: "pending" },
    { name: "Clarissa J.", initials: "CJ", color: "bg-indigo-500", status: "accepted" },
    { name: "Victoria M.", initials: "VM", color: "bg-violet-500", status: "pending" },
    { name: "Kayla S.", initials: "KS", color: "bg-yellow-500", status: "declined" },
    { name: "Jesse B.", initials: "JB", color: "bg-orange-500", status: "pending" },
  ],
};

export default function DashJobs() {
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [jobText, setJobText] = useState("");
  const [search, setSearch] = useState("");

  const filtered = JOBS.filter(
    (j) => j.status === activeTab && (search === "" || j.desc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-[#111]">My Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">{JOBS.filter(j => j.status === "active").length} active · {JOBS.filter(j => j.status === "archived").length} archived</p>
        </div>
        <button
          onClick={() => setShowPostForm(!showPostForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Post a Job
        </button>
      </div>

      {/* Post job form */}
      {showPostForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-[#F25722]" />
            <h2 className="text-sm font-bold text-[#111]">Describe your job naturally</h2>
          </div>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Ex: Looking for a hip hop instructor this Saturday 3/15 from 4-5pm. Ages 8-12. $50/hr. Studio is in Lincoln Park, Chicago. DM me if interested!"
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">We'll parse your description into a clean listing automatically.</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPostForm(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
              <button className="px-5 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
                Preview & Post →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
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
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors bg-white">
          <Filter size={13} /> Filter
        </button>
      </div>

      {/* Job cards */}
      <div className="space-y-3">
        {filtered.map((job) => (
          <div key={job.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                    {job.tag === "Recurring Classes" ? "RC" : "SB"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-semibold text-[#F25722] bg-orange-50 px-2 py-0.5 rounded-full">{job.tag}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={10} /> {job.date}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={10} /> {job.location}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><DollarSign size={10} /> {job.rate}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{job.desc}</p>
                    <div className="flex items-center gap-4 mt-2.5">
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Users size={11} /> {job.applicants} applicants</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Eye size={11} /> {job.views} views</span>
                      <span className="flex items-center gap-1 text-xs text-green-500 font-medium"><RefreshCw size={10} /> Recurring</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${expandedJob === job.id ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            </div>

            {/* Expanded applicants */}
            {expandedJob === job.id && (
              <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Applicants</h3>
                {APPLICANTS_BY_JOB[job.id] ? (
                  <div className="space-y-2">
                    {APPLICANTS_BY_JOB[job.id].map((a) => (
                      <div key={a.name} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-gray-100">
                        <div className={`w-8 h-8 rounded-full ${a.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {a.initials}
                        </div>
                        <p className="text-sm font-semibold text-[#111] flex-1">{a.name}</p>
                        <div className="flex items-center gap-2">
                          {a.status === "accepted" && (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle size={10} /> Accepted
                            </span>
                          )}
                          {a.status === "declined" && (
                            <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <XCircle size={10} /> Declined
                            </span>
                          )}
                          {a.status === "pending" && (
                            <div className="flex items-center gap-1.5">
                              <button className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                                <CheckCircle size={14} />
                              </button>
                              <button className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
                                <XCircle size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">No applicants yet for this job.</p>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-white transition-colors">
                    <Eye size={12} /> View Full Job
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-colors">
                    <Trash2 size={12} /> Archive Job
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Sparkles size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No {activeTab} jobs found</p>
            <button
              onClick={() => setShowPostForm(true)}
              className="mt-4 px-5 py-2.5 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
            >
              Post Your First Job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
