/*
 * ARTSWRK DASHBOARD — BENEFITS (Premium)
 */

import { Crown, Zap, Shield, Percent, Headphones, Star, ChevronRight, CheckCircle } from "lucide-react";

const BENEFITS = [
  {
    icon: <Zap size={20} />, color: "bg-amber-50 text-amber-500",
    title: "Priority Job Placement",
    desc: "Your job postings are shown first to artists in your area, getting you 3x more qualified applicants.",
    active: true,
  },
  {
    icon: <Shield size={20} />, color: "bg-blue-50 text-blue-500",
    title: "Verified Studio Badge",
    desc: "Display a verified badge on your company page and job listings to build trust with artists.",
    active: true,
  },
  {
    icon: <Percent size={20} />, color: "bg-green-50 text-green-500",
    title: "0% Platform Fee",
    desc: "Premium members pay zero platform fees on all payments made through Artswrk.",
    active: true,
  },
  {
    icon: <Headphones size={20} />, color: "bg-purple-50 text-purple-500",
    title: "Dedicated Support",
    desc: "Access to a dedicated account manager and priority support response within 2 hours.",
    active: true,
  },
  {
    icon: <Star size={20} />, color: "bg-rose-50 text-rose-500",
    title: "Featured Studio Listing",
    desc: "Get featured on the Artswrk homepage and in our weekly newsletter sent to 5,000+ artists.",
    active: false,
  },
];

const PARTNER_PERKS = [
  { name: "Staples Business", desc: "20% off all office & studio supplies", code: "ARTSWRK20" },
  { name: "Zoom", desc: "3 months free Zoom Pro for virtual auditions", code: "ARTSWRK-ZOOM" },
  { name: "Canva Pro", desc: "Free Canva Pro for studio marketing materials", code: "ARTSWRK-CANVA" },
  { name: "QuickBooks", desc: "50% off QuickBooks for 6 months", code: "ARTSWRK-QB" },
];

export default function Benefits() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-black text-[#111]">Benefits</h1>
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
            <Crown size={10} /> Premium
          </span>
        </div>
        <p className="text-gray-500 text-sm">Your premium perks and partner discounts</p>
      </div>

      {/* Premium status card */}
      <div className="hirer-grad-bg rounded-2xl p-6 mb-7 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/4 translate-x-1/4" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={18} className="text-amber-300" />
              <p className="text-sm font-bold text-white/80">Premium Member</p>
            </div>
            <p className="text-2xl font-black mb-1">FieldCrest Studio</p>
            <p className="text-sm text-white/60">Member since January 2025 · Renews April 2025</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">$49</p>
            <p className="text-sm text-white/60">/month</p>
          </div>
        </div>
      </div>

      {/* Active benefits */}
      <h2 className="text-sm font-bold text-[#111] mb-4">Your Benefits</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className={`bg-white rounded-2xl border p-5 shadow-sm ${benefit.active ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${benefit.color} flex items-center justify-center flex-shrink-0`}>
                {benefit.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-[#111]">{benefit.title}</p>
                  {benefit.active && <CheckCircle size={13} className="text-green-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{benefit.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Partner perks */}
      <h2 className="text-sm font-bold text-[#111] mb-4">Partner Perks</h2>
      <div className="space-y-3">
        {PARTNER_PERKS.map((perk) => (
          <div key={perk.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-600 flex-shrink-0">
              {perk.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#111]">{perk.name}</p>
              <p className="text-xs text-gray-500">{perk.desc}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-mono font-bold text-[#F25722] bg-orange-50 px-2 py-1 rounded-lg mb-1">{perk.code}</p>
              <button className="text-xs font-semibold text-gray-500 hover:text-[#F25722] transition-colors flex items-center gap-0.5 ml-auto">
                Redeem <ChevronRight size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
