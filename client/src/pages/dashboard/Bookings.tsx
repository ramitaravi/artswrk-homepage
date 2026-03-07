/*
 * ARTSWRK DASHBOARD — BOOKINGS
 * Real data from the bookings table, linked to jobs + interested artists.
 */

import { useState } from "react";
import {
  Calendar, Clock, MapPin, DollarSign, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, CreditCard, User, Briefcase, ExternalLink,
  TrendingUp, Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Booking } from "../../../../drizzle/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${cents.toLocaleString()}`;
}

function getInitials(id: string) {
  // Use last 4 chars of Bubble ID as a stable short identifier
  return id?.slice(-4).toUpperCase() ?? "??";
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-blue-500",
  "bg-green-500", "bg-teal-500", "bg-amber-500", "bg-red-500",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type BookingStatus = "Confirmed" | "Completed" | "Cancelled" | "Pay Now";
type PaymentStatus = "Paid" | "Unpaid";

const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: React.ReactNode }> = {
  Confirmed: { label: "Confirmed", icon: <CheckCircle size={12} />, className: "text-green-600 bg-green-50" },
  Completed: { label: "Completed", icon: <CheckCircle size={12} />, className: "text-gray-500 bg-gray-100" },
  Cancelled: { label: "Cancelled", icon: <AlertCircle size={12} />, className: "text-red-500 bg-red-50" },
  "Pay Now": { label: "Pay Now", icon: <CreditCard size={12} />, className: "text-amber-600 bg-amber-50" },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  Paid: { label: "Paid", className: "text-green-600 bg-green-50" },
  Unpaid: { label: "Unpaid", className: "text-amber-600 bg-amber-50" },
};

// ── Booking Row ───────────────────────────────────────────────────────────────

function BookingRow({ booking }: { booking: Booking }) {
  const [expanded, setExpanded] = useState(false);

  const bookingStatus = (booking.bookingStatus ?? "Confirmed") as BookingStatus;
  const paymentStatus = (booking.paymentStatus ?? "Unpaid") as PaymentStatus;
  const statusCfg = BOOKING_STATUS_CONFIG[bookingStatus] ?? BOOKING_STATUS_CONFIG.Confirmed;
  const payCfg = PAYMENT_STATUS_CONFIG[paymentStatus] ?? PAYMENT_STATUS_CONFIG.Unpaid;

  const artistId = booking.bubbleArtistId ?? "";
  const initials = getInitials(artistId);
  const color = avatarColor(artistId);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Main row */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Artist avatar */}
            <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              {/* Status badges */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                  {statusCfg.icon} {statusCfg.label}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${payCfg.className}`}>
                  {payCfg.label}
                </span>
              </div>

              {/* Job description snippet */}
              {booking.description && (
                <p className="text-sm text-gray-700 font-medium mb-2 line-clamp-1">{booking.description}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap">
                {booking.startDate && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={11} /> {formatDate(booking.startDate)}
                  </span>
                )}
                {booking.hours && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={11} /> {booking.hours}h
                  </span>
                )}
                {booking.locationAddress && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 truncate max-w-[200px]">
                    <MapPin size={11} /> {booking.locationAddress}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: financials + expand */}
          <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
            <p className="text-lg font-black text-[#111]">
              {formatCurrency(booking.totalClientRate ?? booking.clientRate)}
            </p>
            {booking.artistRate && (
              <p className="text-xs text-gray-400">Artist: {formatCurrency(booking.artistRate)}</p>
            )}
            {booking.stripeCheckoutUrl && paymentStatus === "Unpaid" && (
              <a
                href={booking.stripeCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-white hirer-grad-bg px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                <CreditCard size={11} /> Pay Now
              </a>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Booking Details</p>
            <div className="flex items-center gap-2 text-gray-600">
              <User size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs">Artist ID: <span className="font-mono text-gray-500">{booking.bubbleArtistId?.slice(-8) ?? "—"}</span></span>
            </div>
            {booking.bubbleRequestId && (
              <div className="flex items-center gap-2 text-gray-600">
                <Briefcase size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs">Job ID: <span className="font-mono text-gray-500">{booking.bubbleRequestId.slice(-8)}</span></span>
              </div>
            )}
            {booking.startDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs">Start: {formatDate(booking.startDate)}</span>
              </div>
            )}
            {booking.endDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs">End: {formatDate(booking.endDate)}</span>
              </div>
            )}
            {booking.locationAddress && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs">{booking.locationAddress}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Financials</p>
            <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Client Rate</span>
                <span className="font-semibold">{formatCurrency(booking.totalClientRate ?? booking.clientRate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Artist Rate</span>
                <span className="font-semibold">{formatCurrency(booking.totalArtistRate ?? booking.artistRate)}</span>
              </div>
              {booking.stripeFee != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Stripe Fee</span>
                  <span className="text-gray-400">{formatCurrency(booking.stripeFee)}</span>
                </div>
              )}
              {booking.grossProfit != null && (
                <div className="flex justify-between text-xs border-t border-gray-100 pt-1.5 mt-1.5">
                  <span className="text-gray-500 font-semibold">Gross Profit</span>
                  <span className="font-bold text-green-600">{formatCurrency(booking.grossProfit)}</span>
                </div>
              )}
            </div>
            {booking.externalPayment && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <ExternalLink size={11} /> Paid externally (outside Stripe)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type FilterTab = "all" | "Confirmed" | "Completed" | "Cancelled";

export default function Bookings() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const { data: stats, isLoading: statsLoading } = trpc.bookings.myStats.useQuery();
  const { data: bookings, isLoading: bookingsLoading } = trpc.bookings.myBookings.useQuery({
    limit: 200,
  });

  const isLoading = statsLoading || bookingsLoading;

  const filtered = (bookings ?? []).filter((b) => {
    if (activeTab === "all") return true;
    return b.bookingStatus === activeTab;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats?.total ?? 0 },
    { key: "Confirmed", label: "Confirmed", count: stats?.confirmed ?? 0 },
    { key: "Completed", label: "Completed", count: stats?.completed ?? 0 },
    { key: "Cancelled", label: "Cancelled", count: stats?.cancelled ?? 0 },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isLoading ? "Loading..." : `${stats?.confirmed ?? 0} confirmed · ${stats?.completed ?? 0} completed · ${stats?.paid ?? 0} paid`}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Total Bookings</p>
          {isLoading ? (
            <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-black text-[#111]">{stats?.total ?? 0}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Confirmed</p>
          {isLoading ? (
            <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-black text-[#111]">{stats?.confirmed ?? 0}</p>
          )}
          <p className="text-xs text-amber-500 font-medium mt-1">{stats?.unpaid ?? 0} unpaid</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Completed</p>
          {isLoading ? (
            <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-black text-[#111]">{stats?.completed ?? 0}</p>
          )}
          <p className="text-xs text-green-500 font-medium mt-1">{stats?.paid ?? 0} paid</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Total Revenue</p>
          {isLoading ? (
            <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-black text-[#111]">{formatCurrency(stats?.totalRevenue)}</p>
          )}
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <TrendingUp size={10} /> Paid bookings
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit mb-5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === t.key ? "hirer-grad-bg text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 ${
              activeTab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Booking list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading bookings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <DollarSign size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No bookings found</p>
          <p className="text-sm mt-1">Try a different filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
