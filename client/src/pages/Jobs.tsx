/*
 * ARTSWRK JOBS PAGE
 * Layout: Full-screen split — left sidebar (filters + job list) | right map panel
 * Font: Poppins
 * Artist gradient: #ec008c → #ff7171
 * Hirer gradient: #FFBC5D → #F25722
 */

import { useState, useMemo } from "react";
import { Search, MapPin, Clock, ChevronDown, X, Star, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: number;
  title: string;
  location: string;
  postedAgo: string;
  datetime: string;
  rate: string | null;
  type: string;
  serviceType: string;
  isPro?: boolean;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
const ALL_JOBS: Job[] = [
  { id: 1, title: "Master Classes", location: "Deer Park, NY", postedAgo: "4 days ago", datetime: "Wed, 8/05/26, 1:00 pm – 3:00 pm", rate: null, type: "Dance Educator", serviceType: "Master Classes" },
  { id: 2, title: "Recurring Classes", location: "Florham Park, NJ", postedAgo: "2 days ago", datetime: "Mon, 9/07/26, 5:00 pm – 8:00 pm", rate: "$65.00/hr", type: "Dance Educator", serviceType: "Recurring Classes" },
  { id: 3, title: "Master Classes", location: "Sea Girt, NJ", postedAgo: "5 days ago", datetime: "Sun, 3/15/26, 10:00 am – 1:30 pm", rate: null, type: "Dance Educator", serviceType: "Master Classes" },
  { id: 4, title: "Substitute Teacher", location: "Union City, NJ", postedAgo: "1 day ago", datetime: "Wed, 2/25/26, 6:30 pm – 7:30 pm", rate: null, type: "Dance Educator", serviceType: "Substitute Teacher" },
  { id: 5, title: "Recurring Classes", location: "Bethel, CT", postedAgo: "3 days ago", datetime: "Mon, 7/06/26, 2:00 pm – Ongoing", rate: null, type: "Dance Educator", serviceType: "Recurring Classes" },
  { id: 6, title: "Substitute Teacher", location: "Mount Vernon, NY", postedAgo: "21 hours ago", datetime: "Sat, 3/28/26, 2:30 pm – 3/28", rate: "$45.00/hr", type: "Dance Educator", serviceType: "Substitute Teacher" },
  { id: 7, title: "Master Classes", location: "Deer Park, NY", postedAgo: "4 days ago", datetime: "Mon, 8/03/26, 10:00 am – 11:00 am", rate: null, type: "Dance Educator", serviceType: "Master Classes" },
  { id: 8, title: "Substitute Teacher", location: "New York, NY", postedAgo: "6 days ago", datetime: "Sat, 2/07/26, 2:00 pm", rate: "$40.00/hr", type: "Dance Educator", serviceType: "Substitute Teacher" },
  { id: 9, title: "Substitute Teacher", location: "Queens, NY", postedAgo: "5 days ago", datetime: "Fri, 2/13/26, 4:00 pm – 8:00 pm", rate: "$60.00/hr", type: "Dance Educator", serviceType: "Substitute Teacher" },
  { id: 10, title: "Master Classes", location: "Sea Girt, NJ", postedAgo: "5 days ago", datetime: "Sat, 3/14/26, 9:00 am – 12:45 pm", rate: null, type: "Dance Educator", serviceType: "Master Classes" },
  { id: 11, title: "Voice Teacher", location: "Milford, MI", postedAgo: "a day ago", datetime: "Mon, May 4, 2026", rate: "$22.00/hr", type: "Vocal Coach", serviceType: "Private Voice Lessons" },
  { id: 12, title: "Piano Teacher", location: "Orland Park, IL", postedAgo: "3 days ago", datetime: "Mon, Apr 6, 2026", rate: "$28.00/hr", type: "Music Teacher", serviceType: "Piano Teacher" },
  { id: 13, title: "Violin Teacher", location: "Naperville, IL", postedAgo: "3 days ago", datetime: "Mon, Apr 6, 2026", rate: "$32.00/hr", type: "Music Teacher", serviceType: "Violin Teacher" },
  { id: 14, title: "Competition Choreography", location: "Stamford, CT", postedAgo: "2 days ago", datetime: "Sat, 4/12/26, 9:00 am – 5:00 pm", rate: null, type: "Dance Educator", serviceType: "Competition Choreography" },
  { id: 15, title: "Private Lessons", location: "Hoboken, NJ", postedAgo: "1 day ago", datetime: "Ongoing", rate: "$55.00/hr", type: "Dance Educator", serviceType: "Private Lessons" },
  { id: 16, title: "Event Photography", location: "Brooklyn, NY", postedAgo: "3 days ago", datetime: "Sat, 3/21/26, 6:00 pm – 10:00 pm", rate: null, type: "Photographer", serviceType: "Event Photography" },
  { id: 17, title: "Dance Competition Judge", location: "Newark, NJ", postedAgo: "2 days ago", datetime: "Sun, 4/05/26, 8:00 am – 6:00 pm", rate: null, type: "Dance Adjudicator", serviceType: "Dance Competition Judge" },
  { id: 18, title: "Headshots", location: "Manhattan, NY", postedAgo: "4 days ago", datetime: "Flexible scheduling", rate: null, type: "Photographer", serviceType: "Headshots" },
  { id: 19, title: "Event Videography", location: "White Plains, NY", postedAgo: "1 day ago", datetime: "Sat, 3/28/26, 2:00 pm – 8:00 pm", rate: null, type: "Videographer", serviceType: "Event Videography" },
  { id: 20, title: "Recurring Classes", location: "Bethel, CT", postedAgo: "3 days ago", datetime: "Ongoing", rate: null, type: "Dance Educator", serviceType: "Recurring Classes" },
  { id: 21, title: "Acting Coach", location: "New York, NY", postedAgo: "2 days ago", datetime: "Ongoing", rate: "$75.00/hr", type: "Acting Coach", serviceType: "Acting Coach" },
  { id: 22, title: "Substitute Teacher", location: "Yonkers, NY", postedAgo: "5 hours ago", datetime: "Fri, 3/13/26, 4:00 pm – 7:00 pm", rate: "$50.00/hr", type: "Dance Educator", serviceType: "Substitute Teacher" },
  { id: 23, title: "Master Classes", location: "Parsippany, NJ", postedAgo: "6 days ago", datetime: "Sat, 4/18/26, 10:00 am – 1:00 pm", rate: null, type: "Dance Educator", serviceType: "Master Classes" },
  { id: 24, title: "Guitar Teacher", location: "Chicago, IL", postedAgo: "2 days ago", datetime: "Ongoing", rate: "$35.00/hr", type: "Music Teacher", serviceType: "Guitar" },
  { id: 25, title: "Yoga Instructor", location: "Hoboken, NJ", postedAgo: "1 day ago", datetime: "Mon/Wed/Fri mornings", rate: "$40.00/hr", type: "Side Jobs", serviceType: "Yoga Instructor" },
  { id: 26, title: "Social Media Manager", location: "Remote", postedAgo: "3 days ago", datetime: "Ongoing", rate: null, type: "Side Jobs", serviceType: "Social Media Manager" },
  { id: 27, title: "Event Performers", location: "New York, NY", postedAgo: "1 day ago", datetime: "Sat, 4/25/26, 7:00 pm – 11:00 pm", rate: null, type: "Dance Educator", serviceType: "Event Performers" },
  { id: 28, title: "Vocal Audition Prep", location: "Brooklyn, NY", postedAgo: "4 days ago", datetime: "Ongoing", rate: "$65.00/hr", type: "Vocal Coach", serviceType: "Vocal Audition Prep" },
  { id: 29, title: "Percussion Teacher", location: "Montclair, NJ", postedAgo: "2 days ago", datetime: "Ongoing", rate: "$30.00/hr", type: "Music Teacher", serviceType: "Percussion Teacher" },
  { id: 30, title: "Substitute Teacher", location: "Norwalk, CT", postedAgo: "8 hours ago", datetime: "Thu, 3/12/26, 5:00 pm – 7:00 pm", rate: "$45.00/hr", type: "Dance Educator", serviceType: "Substitute Teacher" },
  { id: 31, title: "Dance Competition Judge", location: "Trenton, NJ", postedAgo: "5 days ago", datetime: "Sat, 5/02/26, 9:00 am – 5:00 pm", rate: null, type: "Dance Adjudicator", serviceType: "Dance Competition Judge" },
  { id: 32, title: "Private Lessons", location: "Westchester, NY", postedAgo: "2 days ago", datetime: "Ongoing", rate: "$60.00/hr", type: "Dance Educator", serviceType: "Private Lessons" },
];

const ARTIST_TYPES = ["Dance Educator", "Photographer", "Dance Adjudicator", "Videographer", "Acting Coach", "Vocal Coach", "Side Jobs", "Music Teacher"];
const SERVICE_TYPES = [
  "Competition Choreography", "Substitute Teacher", "Recurring Classes", "Private Lessons",
  "Master Classes", "Photoshoot", "Videoshoot", "Event Photography", "Headshots",
  "Event Videography", "Dance Competition Judge", "Video Editing", "Acting Coach",
  "Private Voice Lessons", "Vocal Audition Prep", "Event Choreography", "Event Performers",
  "Yoga Instructor", "Social Media Manager", "Guitar", "Percussion Teacher", "Piano Teacher",
  "Violin Teacher", "Voice Teacher",
];

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14">
      <div className="mx-auto px-5 lg:px-8 max-w-full h-full">
        <div className="flex items-center justify-between h-full">
          <Link href="/" className="flex items-center select-none">
            <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <Link href="/jobs" className="text-sm font-semibold text-[#111] border-b-2 border-[#F25722]">Jobs</Link>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">About</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">For Hirers</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">For Artists</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Login</a>
            <a href="#" className="text-sm font-semibold text-white bg-[#111] px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors">Join</a>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, isSelected, onClick }: { job: Job; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#F25722] bg-orange-50 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold artist-grad-bg">
            {job.title[0]}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[#111] text-sm truncate">{job.title}</h3>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="flex-shrink-0" />
              <span className="truncate">{job.location}</span>
              <span className="text-gray-300">·</span>
              <span className="flex-shrink-0">Posted {job.postedAgo}</span>
            </p>
          </div>
        </div>
        <button
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold text-white artist-grad-bg hover:opacity-90 transition-opacity"
          onClick={(e) => { e.stopPropagation(); }}
        >
          Apply
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
        <span className="flex items-center gap-1">
          <Clock size={10} className="flex-shrink-0" />
          <span className="truncate max-w-[160px]">{job.datetime}</span>
        </span>
        <span className="ml-auto font-semibold text-[#111] flex-shrink-0">
          {job.rate ?? <span className="text-gray-400 font-normal">Open rate</span>}
        </span>
      </div>
    </div>
  );
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────
function MapPanel({ selectedJob }: { selectedJob: Job | null }) {
  return (
    <div className="relative w-full h-full bg-gray-100 overflow-hidden">
      {/* Stylized map background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(200,210,220,0.4) 1px, transparent 1px),
          linear-gradient(90deg, rgba(200,210,220,0.4) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        backgroundColor: "#e8edf2"
      }} />

      {/* Road-like lines */}
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="35%" x2="100%" y2="30%" stroke="#b0bec5" strokeWidth="8" />
        <line x1="0" y1="60%" x2="100%" y2="65%" stroke="#b0bec5" strokeWidth="5" />
        <line x1="25%" y1="0" x2="30%" y2="100%" stroke="#b0bec5" strokeWidth="6" />
        <line x1="65%" y1="0" x2="60%" y2="100%" stroke="#b0bec5" strokeWidth="4" />
        <line x1="0" y1="15%" x2="100%" y2="20%" stroke="#b0bec5" strokeWidth="3" />
        <line x1="45%" y1="0" x2="50%" y2="100%" stroke="#b0bec5" strokeWidth="3" />
        <rect x="20%" y="25%" width="15%" height="20%" fill="#d0d8e0" rx="4" />
        <rect x="55%" y="40%" width="12%" height="15%" fill="#d0d8e0" rx="4" />
        <rect x="35%" y="55%" width="18%" height="12%" fill="#d0d8e0" rx="4" />
      </svg>

      {/* Map pins */}
      <div className="absolute inset-0">
        {[
          { top: "30%", left: "28%", label: "NY" },
          { top: "45%", left: "52%", label: "NJ" },
          { top: "25%", left: "65%", label: "CT" },
          { top: "60%", left: "38%", label: "NY" },
          { top: "38%", left: "72%", label: "NJ" },
          { top: "55%", left: "20%", label: "NY" },
          { top: "20%", left: "45%", label: "NY" },
          { top: "70%", left: "60%", label: "NJ" },
        ].map((pin, i) => (
          <div
            key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{ top: pin.top, left: pin.left }}
          >
            <div className="w-8 h-8 rounded-full artist-grad-bg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <MapPin size={14} className="text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Selected job tooltip */}
      {selectedJob && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-xl p-4 w-72 border border-gray-100 z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg artist-grad-bg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {selectedJob.title[0]}
            </div>
            <div>
              <p className="font-bold text-sm text-[#111]">{selectedJob.title}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin size={10} />{selectedJob.location}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{selectedJob.datetime}</span>
            <span className="font-bold text-[#111]">{selectedJob.rate ?? "Open rate"}</span>
          </div>
          <button className="w-full mt-3 py-2 rounded-lg text-xs font-semibold text-white artist-grad-bg hover:opacity-90 transition-opacity">
            Apply Now →
          </button>
        </div>
      )}

      {/* Map attribution */}
      <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded">
        Map data preview
      </div>
    </div>
  );
}

// ─── Main Jobs Page ───────────────────────────────────────────────────────────
export default function Jobs() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [artistType, setArtistType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return ALL_JOBS.filter((job) => {
      const matchSearch = !search || job.title.toLowerCase().includes(search.toLowerCase()) || job.location.toLowerCase().includes(search.toLowerCase());
      const matchLocation = !location || job.location.toLowerCase().includes(location.toLowerCase());
      const matchType = !artistType || job.type === artistType;
      const matchService = !serviceType || job.serviceType === serviceType;
      return matchSearch && matchLocation && matchType && matchService;
    });
  }, [search, location, artistType, serviceType]);

  const hasFilters = search || location || artistType || serviceType;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Navbar />

      {/* Main content below navbar */}
      <div className="flex flex-1 overflow-hidden pt-14">

        {/* ── Left Panel ── */}
        <div className="w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col border-r border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-black text-[#111]">
                Jobs For You{" "}
                <span className="text-base font-semibold text-gray-400">({filtered.length})</span>
              </h1>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors md:hidden ${
                  hasFilters ? "border-[#F25722] text-[#F25722] bg-orange-50" : "border-gray-200 text-gray-500"
                }`}
              >
                <SlidersHorizontal size={12} />
                Filters {hasFilters ? `(${[search, location, artistType, serviceType].filter(Boolean).length})` : ""}
              </button>
            </div>

            {/* Search row */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Jobs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
              <div className="relative flex-1">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Filter row */}
            <div className={`flex gap-2 items-center flex-wrap ${filtersOpen || "hidden md:flex"}`}>
              <div className="relative flex-1 min-w-[120px]">
                <select
                  value={artistType}
                  onChange={(e) => setArtistType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                >
                  <option value="">Artist Type</option>
                  {ARTIST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative flex-1 min-w-[120px]">
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F25722] text-gray-600 cursor-pointer"
                >
                  <option value="">Service Type</option>
                  {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setLocation(""); setArtistType(""); setServiceType(""); }}
                  className="flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:text-[#d44a1a] transition-colors whitespace-nowrap"
                >
                  <X size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* PRO Banner */}
          <div className="mx-4 mt-3 mb-1 px-4 py-3 rounded-xl bg-[#111] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-bold">Jobs PRO</span>
              <span className="text-yellow-400 text-xs">⭐️</span>
            </div>
            <button className="text-xs font-semibold text-white border border-white/30 px-3 py-1 rounded-full hover:bg-white/10 transition-colors">
              View PRO Jobs →
            </button>
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Search size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No jobs found</p>
                <p className="text-xs text-gray-300 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right Map Panel ── */}
        <div className="hidden md:flex flex-1 relative">
          <MapPanel selectedJob={selectedJob} />
        </div>
      </div>
    </div>
  );
}
