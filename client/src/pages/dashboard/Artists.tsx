/*
 * ARTSWRK DASHBOARD — ARTISTS
 * Browse and save artists, view applicant history
 */

import { useState } from "react";
import { Search, Heart, Star, MapPin, Filter, MessageSquare, ChevronRight } from "lucide-react";

const ARTISTS = [
  { id: 1, name: "Sasha K.", initials: "SK", color: "bg-purple-500", discipline: "Ballet, Tap, Hip Hop", location: "Brooklyn, NY", rate: "$45/hr", rating: 4.9, jobs: 9, saved: true },
  { id: 2, name: "Marlon S.", initials: "MS", color: "bg-blue-500", discipline: "Hip Hop, Contemporary", location: "Manhattan, NY", rate: "$50/hr", rating: 4.8, jobs: 9, saved: false },
  { id: 3, name: "Amie B.", initials: "AB", color: "bg-pink-500", discipline: "Ballet, Lyrical", location: "Queens, NY", rate: "$45/hr", rating: 4.7, jobs: 6, saved: true },
  { id: 4, name: "gracen n.", initials: "GN", color: "bg-green-500", discipline: "Jazz, Contemporary", location: "Bronx, NY", rate: "$40/hr", rating: 4.6, jobs: 3, saved: false },
  { id: 5, name: "Jesse B.", initials: "JB", color: "bg-orange-500", discipline: "Tap, Jazz", location: "Hoboken, NJ", rate: "$45/hr", rating: 4.8, jobs: 3, saved: false },
  { id: 6, name: "Alex M.", initials: "AM", color: "bg-teal-500", discipline: "Hip Hop, Acro", location: "Jersey City, NJ", rate: "$40/hr", rating: 4.5, jobs: 3, saved: false },
  { id: 7, name: "Clarissa J.", initials: "CJ", color: "bg-indigo-500", discipline: "Ballet, Pointe", location: "Long Island, NY", rate: "$50/hr", rating: 4.9, jobs: 2, saved: true },
  { id: 8, name: "Victoria M.", initials: "VM", color: "bg-violet-500", discipline: "Contemporary, Modern", location: "Brooklyn, NY", rate: "$45/hr", rating: 4.7, jobs: 1, saved: false },
];

export default function Artists() {
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Set<number>>(new Set(ARTISTS.filter(a => a.saved).map(a => a.id)));
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const filtered = ARTISTS.filter(a => {
    const matchSearch = search === "" || a.name.toLowerCase().includes(search.toLowerCase()) || a.discipline.toLowerCase().includes(search.toLowerCase());
    const matchSaved = !showSavedOnly || saved.has(a.id);
    return matchSearch && matchSaved;
  });

  function toggleSave(id: number) {
    setSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">Artists</h1>
        <p className="text-gray-500 text-sm mt-1">Browse artists who have applied to your jobs</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or discipline..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
          />
        </div>
        <button
          onClick={() => setShowSavedOnly(!showSavedOnly)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
            showSavedOnly ? "hirer-grad-bg text-white border-transparent" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
          }`}
        >
          <Heart size={13} className={showSavedOnly ? "fill-white" : ""} /> Saved
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors bg-white">
          <Filter size={13} /> Filter
        </button>
      </div>

      {/* Artist grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((artist) => (
          <div key={artist.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-full ${artist.color} flex items-center justify-center text-white text-sm font-bold`}>
                {artist.initials}
              </div>
              <button
                onClick={() => toggleSave(artist.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Heart
                  size={16}
                  className={saved.has(artist.id) ? "fill-[#F25722] text-[#F25722]" : "text-gray-300"}
                />
              </button>
            </div>
            <h3 className="text-sm font-bold text-[#111] mb-0.5">{artist.name}</h3>
            <p className="text-xs text-gray-500 mb-2">{artist.discipline}</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={10} /> {artist.location}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#F25722]">{artist.rate}</span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Star size={10} className="fill-amber-400 text-amber-400" /> {artist.rating}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Applied to you <span className="font-semibold text-[#111]">{artist.jobs}×</span></p>
            <div className="flex items-center gap-2">
              <button className="flex-1 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
                View Profile
              </button>
              <button className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <MessageSquare size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
