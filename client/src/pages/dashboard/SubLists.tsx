/*
 * ARTSWRK DASHBOARD — SUB LISTS (Premium)
 */

import { useState } from "react";
import { Plus, Search, Phone, Mail, Star, Crown, Trash2, Edit3, ChevronDown } from "lucide-react";

const LISTS = [
  {
    id: 1, name: "Ballet Subs", count: 4,
    artists: [
      { name: "Clarissa J.", initials: "CJ", color: "bg-indigo-500", discipline: "Ballet, Pointe", phone: "(917) 555-0142", rating: 4.9, available: true },
      { name: "Victoria M.", initials: "VM", color: "bg-violet-500", discipline: "Ballet, Contemporary", phone: "(646) 555-0198", rating: 4.7, available: true },
      { name: "Sasha K.", initials: "SK", color: "bg-purple-500", discipline: "Ballet, Tap", phone: "(718) 555-0167", rating: 4.9, available: false },
      { name: "Olivia G.", initials: "OG", color: "bg-rose-500", discipline: "Ballet, Lyrical", phone: "(212) 555-0134", rating: 4.6, available: true },
    ],
  },
  {
    id: 2, name: "Hip Hop Subs", count: 3,
    artists: [
      { name: "Marlon S.", initials: "MS", color: "bg-blue-500", discipline: "Hip Hop, Contemporary", phone: "(917) 555-0201", rating: 4.8, available: true },
      { name: "gracen n.", initials: "GN", color: "bg-green-500", discipline: "Hip Hop, Jazz", phone: "(646) 555-0178", rating: 4.6, available: true },
      { name: "Alex M.", initials: "AM", color: "bg-teal-500", discipline: "Hip Hop, Acro", phone: "(718) 555-0189", rating: 4.5, available: false },
    ],
  },
];

export default function SubLists() {
  const [expandedList, setExpandedList] = useState<number | null>(1);
  const [search, setSearch] = useState("");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-[#111]">Sub Lists</h1>
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
              <Crown size={10} /> Premium
            </span>
          </div>
          <p className="text-gray-500 text-sm">Organize your go-to substitute artists by discipline</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
          <Plus size={15} /> New List
        </button>
      </div>

      <div className="mb-5 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search artists across all lists..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all bg-white"
        />
      </div>

      <div className="space-y-4">
        {LISTS.map((list) => (
          <div key={list.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center text-white text-xs font-black">
                  {list.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#111]">{list.name}</p>
                  <p className="text-xs text-gray-400">{list.count} artists</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                  <Edit3 size={14} />
                </button>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedList === list.id ? "rotate-180" : ""}`} />
              </div>
            </div>

            {expandedList === list.id && (
              <div className="border-t border-gray-100">
                <div className="divide-y divide-gray-100">
                  {list.artists.map((artist) => (
                    <div key={artist.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                      <div className={`w-9 h-9 rounded-full ${artist.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {artist.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#111]">{artist.name}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${artist.available ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                            {artist.available ? "Available" : "Unavailable"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{artist.discipline}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Star size={10} className="fill-amber-400 text-amber-400" /> {artist.rating}
                        </span>
                        <a href={`tel:${artist.phone}`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#F25722] transition-colors">
                          <Phone size={14} />
                        </a>
                        <a href={`mailto:`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#F25722] transition-colors">
                          <Mail size={14} />
                        </a>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-gray-100">
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
                    <Plus size={12} /> Add Artist to List
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
