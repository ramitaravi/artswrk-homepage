/*
 * ARTSWRK DASHBOARD — BOOKINGS
 */

import { useState } from "react";
import { Calendar, Clock, MapPin, DollarSign, CheckCircle, XCircle, AlertCircle, ChevronRight, User } from "lucide-react";

const BOOKINGS = [
  {
    id: 1, artist: "Sasha K.", initials: "SK", color: "bg-purple-500",
    job: "Thursday Versatile Instructor", date: "March 13, 2025", time: "3:30 PM – 7:00 PM",
    location: "FieldCrest Studio, Bayside NY", rate: "$45/hr", hours: 3.5, total: "$157.50",
    status: "confirmed",
  },
  {
    id: 2, artist: "Amie B.", initials: "AB", color: "bg-pink-500",
    job: "Wed PreBallet/Hip Hop", date: "March 12, 2025", time: "4:00 PM – 4:45 PM",
    location: "FieldCrest Studio, Bayside NY", rate: "$50/hr", hours: 0.75, total: "$37.50",
    status: "pending",
  },
  {
    id: 3, artist: "Clarissa J.", initials: "CJ", color: "bg-indigo-500",
    job: "Wednesday Versatile Instructor", date: "March 12, 2025", time: "4:00 PM – 8:00 PM",
    location: "FieldCrest Studio, Bayside NY", rate: "$45/hr", hours: 4, total: "$180.00",
    status: "pending",
  },
  {
    id: 4, artist: "Marlon S.", initials: "MS", color: "bg-blue-500",
    job: "Saturday Sub – PreBallet", date: "March 8, 2025", time: "10:00 AM – 12:00 PM",
    location: "FieldCrest Studio, Bayside NY", rate: "$40/hr", hours: 2, total: "$80.00",
    status: "completed",
  },
  {
    id: 5, artist: "gracen n.", initials: "GN", color: "bg-green-500",
    job: "Tuesday Jazz/Tap Instructor", date: "March 4, 2025", time: "4:00 PM – 6:00 PM",
    location: "FieldCrest Studio, Bayside NY", rate: "$45/hr", hours: 2, total: "$90.00",
    status: "completed",
  },
];

const STATUS_CONFIG = {
  confirmed: { label: "Confirmed", icon: <CheckCircle size={12} />, className: "text-green-600 bg-green-50" },
  pending: { label: "Awaiting Response", icon: <AlertCircle size={12} />, className: "text-amber-600 bg-amber-50" },
  completed: { label: "Completed", icon: <CheckCircle size={12} />, className: "text-gray-500 bg-gray-100" },
};

export default function Bookings() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const upcoming = BOOKINGS.filter(b => b.status === "confirmed" || b.status === "pending");
  const past = BOOKINGS.filter(b => b.status === "completed");
  const shown = activeTab === "upcoming" ? upcoming : past;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">{upcoming.length} upcoming · {past.length} past</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Upcoming</p>
          <p className="text-2xl font-black text-[#111]">{upcoming.length}</p>
          <p className="text-xs text-amber-500 font-medium mt-1">{upcoming.filter(b => b.status === "pending").length} need response</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">This Month</p>
          <p className="text-2xl font-black text-[#111]">$545</p>
          <p className="text-xs text-green-500 font-medium mt-1">Committed spend</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Artists Booked</p>
          <p className="text-2xl font-black text-[#111]">5</p>
          <p className="text-xs text-gray-400 mt-1">This season</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit mb-5">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
              activeTab === t ? "hirer-grad-bg text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t === "upcoming" ? "Upcoming" : "Past Bookings"}
          </button>
        ))}
      </div>

      {/* Booking cards */}
      <div className="space-y-3">
        {shown.map((booking) => {
          const statusCfg = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG];
          return (
            <div key={booking.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-full ${booking.color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {booking.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-[#111]">{booking.artist}</p>
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{booking.job}</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar size={11} /> {booking.date}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Clock size={11} /> {booking.time}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11} /> {booking.location}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black text-[#111]">{booking.total}</p>
                  <p className="text-xs text-gray-400">{booking.rate} · {booking.hours}h</p>
                  {booking.status === "pending" && (
                    <div className="flex items-center gap-1.5 mt-3 justify-end">
                      <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center gap-1">
                        <CheckCircle size={11} /> Confirm
                      </button>
                      <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1">
                        <XCircle size={11} /> Decline
                      </button>
                    </div>
                  )}
                  {booking.status === "confirmed" && (
                    <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity ml-auto">
                      Pay Artist <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
