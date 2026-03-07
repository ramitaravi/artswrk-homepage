/*
 * ARTSWRK DASHBOARD — COMPANY PAGE (Premium)
 */

import { useState } from "react";
import { Building2, MapPin, Globe, Instagram, Upload, Plus, Edit3, Eye, Crown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function CompanyPage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("FieldCrest School of Performing Arts is a premier dance studio in Bayside, NY offering classes in ballet, tap, hip hop, jazz, lyrical, and contemporary for ages 2 and up. We are dedicated to nurturing talent in a supportive, professional environment.");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-[#111]">Company Page</h1>
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
              <Crown size={10} /> Premium
            </span>
          </div>
          <p className="text-gray-500 text-sm">Your public studio profile that artists see when they apply</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <Eye size={13} /> Preview
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
          >
            <Edit3 size={13} /> {editing ? "Save Changes" : "Edit Page"}
          </button>
        </div>
      </div>

      {/* Cover photo */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="h-40 hirer-grad-bg relative flex items-center justify-center">
          {editing && (
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors">
              <Upload size={13} /> Upload Cover Photo
            </button>
          )}
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <div className="w-16 h-16 rounded-2xl hirer-grad-bg flex items-center justify-center text-white text-xl font-black border-4 border-white shadow-sm flex-shrink-0">
              FC
            </div>
            {editing && (
              <button className="mb-1 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity">
                Change Logo
              </button>
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              {editing ? (
                <input
                  defaultValue={user?.clientCompanyName ?? ""}
                  className="text-xl font-black text-[#111] border-b border-[#FFBC5D] focus:outline-none bg-transparent w-full mb-1"
                />
              ) : (
                <h2 className="text-xl font-black text-[#111] mb-1">{user?.clientCompanyName}</h2>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11} /> Location TBD</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><Globe size={11} /> fieldcrestdance.com</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><Instagram size={11} /> @fieldcrestdance</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-center flex-shrink-0">
              <div>
                <p className="text-lg font-black text-[#111]">47</p>
                <p className="text-xs text-gray-400">Artists hired</p>
              </div>
              <div>
                <p className="text-lg font-black text-[#111]">4.9</p>
                <p className="text-xs text-gray-400">Avg rating</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-bold text-[#111] mb-3">About</h3>
        {editing ? (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none leading-relaxed"
          />
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed">{bio}</p>
        )}
      </div>

      {/* Disciplines */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#111]">Disciplines We Hire For</h3>
          {editing && <button className="text-xs font-semibold text-[#F25722]"><Plus size={12} className="inline" /> Add</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Ballet", "Tap", "Hip Hop", "Jazz", "Lyrical", "Contemporary", "Acro", "Mommy & Me", "PreBallet"].map((d) => (
            <span key={d} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-[#F25722] border border-orange-100">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Active jobs preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#111] mb-3">Active Job Postings</h3>
        <p className="text-xs text-gray-500 mb-3">These are visible to artists browsing your company page.</p>
        <div className="space-y-2">
          {["Thursday Versatile Instructor", "Wed PreBallet/Hip Hop", "Wednesday Versatile Instructor"].map((job) => (
            <div key={job} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-sm font-medium text-[#111]">{job}</p>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
