/*
 * ARTSWRK DASHBOARD — MY JOBS
 * Post job, manage active/archived jobs — real data from DB
 */

import { useState } from "react";
import {
  Plus, Search, Filter, Clock, Users, RefreshCw,
  MoreHorizontal, ChevronDown, MapPin, DollarSign,
  Eye, Sparkles, Loader2, Briefcase, CreditCard
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

function formatJobDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getJobInitials(desc: string | null | undefined) {
  if (!desc) return "JB";
  const words = desc.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "JB";
}

function getStatusColor(status: string | null | undefined) {
  switch (status) {
    case "Active": return "text-green-600 bg-green-50";
    case "Confirmed": return "text-blue-600 bg-blue-50";
    case "Completed": return "text-gray-600 bg-gray-100";
    case "Submissions Paused": return "text-yellow-700 bg-yellow-50";
    case "Deleted by Client": return "text-red-500 bg-red-50";
    default: return "text-[#F25722] bg-orange-50";
  }
}

export default function DashJobs() {
  const [activeTab, setActiveTab] = useState<"active" | "all" | "archived">("active");
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [jobText, setJobText] = useState("");
  const [search, setSearch] = useState("");

  // Status filters per tab
  const statusFilters: Record<string, string[] | undefined> = {
    active: ["Active", "Confirmed"],
    archived: ["Completed", "Deleted by Client", "Lost - No Revenue", "Submissions Paused"],
    all: undefined,
  };

  const { data: jobs, isLoading } = trpc.jobs.myJobs.useQuery({
    limit: 100,
    status: statusFilters[activeTab],
  });

  const { data: stats } = trpc.jobs.myStats.useQuery();

  const filtered = (jobs ?? []).filter(
    (j) => search === "" || (j.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-[#111]">My Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">
            {stats ? `${stats.active} active · ${stats.completed} completed · ${stats.total} total` : "Loading..."}
          </p>
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
          {(["active", "all", "archived"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                activeTab === t ? "hirer-grad-bg text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t === "all" ? "All Jobs" : t.charAt(0).toUpperCase() + t.slice(1)}
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
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          <span className="text-sm">Loading jobs...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Briefcase size={40} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">No {activeTab === "active" ? "active " : ""}jobs found</p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-2 text-xs text-[#F25722] hover:opacity-70">
              Clear search
            </button>
          )}
        </div>
      ) : (
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
                      {getJobInitials(job.description)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {job.requestStatus && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusColor(job.requestStatus)}`}>
                            {job.requestStatus}
                          </span>
                        )}
                        {job.dateType && (
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {job.dateType}
                          </span>
                        )}
                        {job.bubbleCreatedAt && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={10} /> {formatJobDate(job.bubbleCreatedAt)}
                          </span>
                        )}
                        {job.locationAddress && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin size={10} /> {job.locationAddress.split(",").slice(0, 2).join(",")}
                          </span>
                        )}
                        {job.artistHourlyRate ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                            <DollarSign size={10} /> ${job.artistHourlyRate}/hr
                          </span>
                        ) : job.openRate ? (
                          <span className="text-xs font-semibold text-gray-500">Open rate</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                        {job.description ?? "No description"}
                      </p>
                      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                        {(job.dateType === "Recurring" || job.dateType === "Ongoing") && (
                          <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                            <RefreshCw size={10} /> {job.dateType}
                          </span>
                        )}
                        {job.ages && (() => {
                          try {
                            const ages = JSON.parse(job.ages);
                            if (Array.isArray(ages) && ages.length > 0) {
                              return (
                                <span className="text-xs text-gray-400">
                                  Ages: {ages.join(", ")}
                                </span>
                              );
                            }
                          } catch { /* ignore */ }
                          return null;
                        })()}
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

              {/* Expanded details */}
              {expandedJob === job.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Description</h3>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {job.description ?? "No description"}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Details</h3>
                        <div className="space-y-1.5 text-sm text-gray-600">
                          {job.locationAddress && (
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                              <span>{job.locationAddress}</span>
                            </div>
                          )}
                          {job.startDate && (
                            <div className="flex items-center gap-2">
                              <Clock size={13} className="text-gray-400 flex-shrink-0" />
                              <span>Start: {formatJobDate(job.startDate)}</span>
                            </div>
                          )}
                          {job.endDate && (
                            <div className="flex items-center gap-2">
                              <Clock size={13} className="text-gray-400 flex-shrink-0" />
                              <span>End: {formatJobDate(job.endDate)}</span>
                            </div>
                          )}
                          {job.artistHourlyRate && (
                            <div className="flex items-center gap-2">
                              <DollarSign size={13} className="text-gray-400 flex-shrink-0" />
                              <span>Artist rate: ${job.artistHourlyRate}/hr</span>
                            </div>
                          )}
                          {job.clientHourlyRate && (
                            <div className="flex items-center gap-2">
                              <DollarSign size={13} className="text-gray-400 flex-shrink-0" />
                              <span>Client rate: ${job.clientHourlyRate}/hr</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 flex-wrap">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
                          <Eye size={12} /> View on site
                        </button>
                        <Link href="/dashboard/artists">
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
                            <Users size={12} /> View applicants
                          </button>
                        </Link>
                        <Link href="/dashboard/bookings">
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
                            <CreditCard size={12} /> View bookings
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Count footer */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-6">
          Showing {filtered.length} job{filtered.length !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
        </p>
      )}
    </div>
  );
}
