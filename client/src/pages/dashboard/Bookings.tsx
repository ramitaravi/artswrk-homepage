/*
 * ARTSWRK DASHBOARD — BOOKINGS
 * Real data from the bookings table, linked to jobs + interested artists.
 */

import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  Calendar, Clock, MapPin, DollarSign, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, ChevronRight, CreditCard,
  TrendingUp, Loader2, RefreshCw, Send, ArrowRight, Building2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
// Flexible type for both raw Booking schema rows and enriched query results
type AnyBooking = {
  id: number;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  artistUserId?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  locationAddress?: string | null;
  description?: string | null;
  artistRate?: number | null;
  clientRate?: number | null;
  totalClientRate?: number | null;
  totalArtistRate?: number | null;
  grossProfit?: number | null;
  stripeFee?: number | null;
  externalPayment?: boolean | null;
  hours?: number | null;
  bubbleArtistId?: string | null;
  bubbleRequestId?: string | null;
  paymentMethod?: string | null;
  directPayConfirmedAt?: Date | null;
  artswrkInvoiceSubmittedAt?: Date | null;
  // enriched artist fields (from join)
  artistFirstName?: string | null;
  artistLastName?: string | null;
  artistName?: string | null;
  artistProfilePicture?: string | null;
  artistSlug?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${cents.toLocaleString()}`;
}

function getInitials(firstName: string | null | undefined, lastName: string | null | undefined, id: string) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
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

function BookingRow({ booking }: { booking: AnyBooking }) {
  const [, navigate] = useLocation();
  const artistUserId = (booking as any).artistUserId as number | null | undefined;

  const bookingStatus = (booking.bookingStatus ?? "Confirmed") as BookingStatus;
  const paymentStatus = (booking.paymentStatus ?? "Unpaid") as PaymentStatus;
  const statusCfg = BOOKING_STATUS_CONFIG[bookingStatus] ?? BOOKING_STATUS_CONFIG.Confirmed;
  const payCfg = PAYMENT_STATUS_CONFIG[paymentStatus] ?? PAYMENT_STATUS_CONFIG.Unpaid;

  const artistId = booking.bubbleArtistId ?? "";
  const artistFirstName = (booking as any).artistFirstName as string | null | undefined;
  const artistLastName = (booking as any).artistLastName as string | null | undefined;
  const artistName = (booking as any).artistName as string | null | undefined;
  const artistProfilePicture = (booking as any).artistProfilePicture as string | null | undefined;
  const artistSlug = (booking as any).artistSlug as string | null | undefined;
  const initials = getInitials(artistFirstName, artistLastName, artistId);
  const color = avatarColor(artistId);
   const displayName = artistFirstName && artistLastName
    ? `${artistFirstName} ${artistLastName[0]}.`
    : artistName ?? `Artist #${artistId.slice(-6) || "—"}`;

  function handleArtistClick() {
    if (artistUserId) navigate(`/app/artists/${artistUserId}`);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Main row */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Artist avatar */}
            {artistProfilePicture ? (
              <img
                src={artistProfilePicture}
                alt={displayName}
                className="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-gray-100"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
              style={{ display: artistProfilePicture ? "none" : "flex" }}
            >
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

              {/* Artist name */}
              <p
                className={`text-sm font-bold text-[#111] mb-0.5 ${artistUserId ? 'cursor-pointer hover:text-[#F25722] transition-colors' : ''}`}
                onClick={artistUserId ? handleArtistClick : undefined}
              >{displayName}</p>
              {artistSlug && (
                <p className="text-xs text-gray-400 mb-1">@{artistSlug}</p>
              )}

              {/* Job description snippet */}
              {booking.description && (
                <p className="text-sm text-gray-500 mb-2 line-clamp-1">{booking.description}</p>
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
            {/* Artist rate removed: this row renders for CLIENTS too, and the
                artist's rate next to the client's is Artswrk's margin. The
                field is no longer even fetched for clients. */}
            {/* Pay Now removed — see dashboard/Payments.tsx. It linked to a
                Bubble Payment Link that charges for a different booking. */}
            <button
              onClick={() => navigate(`/app/bookings/${booking.id}`)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Details <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Booking Period Submit Form ──────────────────────────────────────────

function PeriodSubmitModal({ period, booking, onClose, onSuccess }: {
  period: any;
  booking: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [hours, setHours] = useState(period.actualHours?.toString() ?? "");
  const [notes, setNotes] = useState(period.artistNotes ?? "");

  const submit = trpc.bookingPeriods.submit.useMutation({
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => alert("Error: " + e.message),
  });

  const periodLabel = new Date(period.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const artistRate = booking.artistRate ?? 0;
  const clientRate = booking.clientRate ?? 0;
  const estimatedArtist = hours ? (Number(hours) * artistRate).toFixed(2) : null;
  const estimatedClient = hours ? (Number(hours) * clientRate).toFixed(2) : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black text-[#111]">Submit Hours</h2>
          <p className="text-sm text-gray-500">{periodLabel} · {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Hours Worked *</label>
          <input
            type="number" min="0" step="0.25"
            value={hours} onChange={e => setHours(e.target.value)}
            placeholder="e.g. 8.5"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722]"
          />
        </div>

        {estimatedArtist && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Your earnings</span><span className="font-semibold text-[#111]">${estimatedArtist}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Client invoice</span><span className="font-semibold text-[#111]">${estimatedClient}</span></div>
            <p className="text-[10px] text-gray-400 pt-1">Based on ${artistRate}/hr artist · ${clientRate}/hr client rate. Reimbursements add to the invoice.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Any notes for the client…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] resize-none"
          />
        </div>

        <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
          Submitting will generate a payment invoice and email the client a payment link.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            onClick={() => submit.mutate({ periodId: period.id, actualHours: Number(hours), artistNotes: notes || undefined, origin: window.location.origin })}
            disabled={!hours || submit.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submit.isPending ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Submit & Invoice Client</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Booking Card ────────────────────────────────────────────────────────

function AdminBookingCard({ booking, isArtist, onPeriodsUpdated }: { booking: any; isArtist: boolean; onPeriodsUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [submitPeriod, setSubmitPeriod] = useState<any>(null);

  const periods: any[] = booking.periods ?? [];
  const openPeriods = periods.filter((p: any) => p.status === "open");
  const submittedPeriods = periods.filter((p: any) => p.status === "artist_submitted");
  const paidPeriods = periods.filter((p: any) => p.status === "client_paid");

  const clientName = booking.clientCompanyName || (booking.clientFirstName ? `${booking.clientFirstName} ${booking.clientLastName ?? ""}`.trim() : null);
  const artistName = booking.artistFirstName
    ? `${booking.artistFirstName}${booking.artistLastName ? " " + booking.artistLastName[0] + "." : ""}`
    : booking.artistName;

  const statusColor = (s: string) => ({
    upcoming: "text-gray-400 bg-gray-50",
    open: "text-amber-600 bg-amber-50",
    artist_submitted: "text-blue-600 bg-blue-50",
    client_paid: "text-green-600 bg-green-50",
  }[s] ?? "text-gray-400 bg-gray-50");

  const statusLabel = (s: string) => ({
    upcoming: "Upcoming",
    open: "Awaiting submission",
    artist_submitted: "Invoice sent",
    client_paid: "Paid",
  }[s] ?? s);

  return (
    <>
      {submitPeriod && (
        <PeriodSubmitModal
          period={submitPeriod}
          booking={booking}
          onClose={() => setSubmitPeriod(null)}
          onSuccess={onPeriodsUpdated}
        />
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white flex-shrink-0">
                <CalendarDays size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 uppercase tracking-wider">Admin Booking</span>
                  {booking.isRecurring && <span className="text-[10px] font-semibold text-gray-500 capitalize">{booking.recurringCadence}</span>}
                </div>
                <p className="text-sm font-bold text-[#111]">
                  {isArtist ? (clientName ?? "Client") : (artistName ?? "Artist")}
                </p>
                {booking.description && <p className="text-xs text-gray-500 line-clamp-1">{booking.description}</p>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar size={11} /> {formatDate(booking.startDate)} – {formatDate(booking.endDate)}</span>
                  {booking.locationAddress && <span className="flex items-center gap-1 text-xs text-gray-500 truncate max-w-[160px]"><MapPin size={11} /> {booking.locationAddress}</span>}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
              {/* AdminBookingCard only — admin/recurring bookings DO store an
                  hourly rate (the period invoice is rate × hours server-side).
                  Bubble-migrated bookings are the opposite: their rate is the
                  booking total, which is why BookingRow above shows no "/hr". */}
              <p className="text-sm font-black text-[#111]">${isArtist ? booking.artistRate : booking.clientRate}/hr</p>
              <p className="text-[10px] text-gray-400">{paidPeriods.length}/{periods.length} paid</p>
              {isArtist && openPeriods.length > 0 && (
                <button
                  onClick={() => setSubmitPeriod(openPeriods[0])}
                  className="flex items-center gap-1 text-xs font-bold text-white hirer-grad-bg px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Send size={11} /> Submit Hours
                </button>
              )}
              {!isArtist && submittedPeriods.length > 0 && submittedPeriods[0].invoiceStripeCheckoutUrl && (
                <a
                  href={submittedPeriods[0].invoiceStripeCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-white hirer-grad-bg px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <CreditCard size={11} /> Pay Invoice
                </a>
              )}
              <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? "Less" : `${periods.length} period${periods.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Billing Periods</p>
            {periods.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-[#111]">Period {i + 1} · {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</p>
                  {p.actualHours != null && <p className="text-[10px] text-gray-500">{p.actualHours}h logged</p>}
                </div>
                <div className="flex items-center gap-2">
                  {p.invoiceTotalCents != null && <span className="text-xs font-semibold text-gray-700">${(p.invoiceTotalCents / 100).toFixed(2)}</span>}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                  {isArtist && p.status === "open" && (
                    <button onClick={() => setSubmitPeriod(p)} className="text-[10px] font-bold text-[#F25722] hover:underline">Submit →</button>
                  )}
                  {!isArtist && p.status === "artist_submitted" && p.invoiceStripeCheckoutUrl && (
                    <a href={p.invoiceStripeCheckoutUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-[#F25722] hover:underline">Pay →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Need CalendarDays icon
function CalendarDays({ size, className }: { size: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/></svg>;
}

// ── Main Component ────────────────────────────────────────────────────────────

type FilterTab = "all" | "Confirmed" | "Completed" | "Cancelled";

export default function Bookings() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const { user } = useAuth();
  const isArtist = ((user as any)?.planTier as string | undefined)?.startsWith("artist_") ?? false;

  const { data: stats, isLoading: statsLoading } = trpc.bookings.myStats.useQuery();
  const { data: bookings, isLoading: bookingsLoading } = trpc.bookings.myBookings.useQuery({
    limit: 200,
  });
  const { data: adminBookings, isLoading: adminLoading, refetch: refetchAdmin } = trpc.bookingPeriods.myAdminBookings.useQuery();

  const isLoading = statsLoading || bookingsLoading;

  // "Pay Now" bookings float to the top regardless of tab — that's the one
  // status that means the client actually owes money right now, so it
  // should be the easiest thing on the page to spot and act on.
  const filtered = (bookings ?? [])
    .filter((b) => {
      if (activeTab === "all") return true;
      return b.bookingStatus === activeTab;
    })
    .sort((a, b) => {
      const aPayNow = a.bookingStatus === "Pay Now" ? 0 : 1;
      const bPayNow = b.bookingStatus === "Pay Now" ? 0 : 1;
      return aPayNow - bPayNow;
    });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats?.total ?? 0 },
    { key: "Confirmed", label: "Confirmed", count: stats?.confirmed ?? 0 },
    { key: "Completed", label: "Completed", count: stats?.completed ?? 0 },
    { key: "Cancelled", label: "Cancelled", count: stats?.cancelled ?? 0 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
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

      {/* Admin Bookings */}
      {!adminLoading && (adminBookings as any[])?.length > 0 && (
        <div className="mb-7">
          <h2 className="text-base font-black text-[#111] mb-3">Admin Bookings</h2>
          <div className="space-y-3">
            {(adminBookings as any[]).map((b: any) => (
              <AdminBookingCard key={b.id} booking={b} isArtist={isArtist} onPeriodsUpdated={() => refetchAdmin()} />
            ))}
          </div>
        </div>
      )}

      {/* Booking list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading bookings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-gray-700 mb-1">No bookings found</p>
          <p className="text-sm mt-1 mb-4">Post a job or browse artists to get your first booking.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/app/artists" className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
              Browse artists →
            </Link>
            <Link href="/app/jobs/new" className="px-4 py-2 rounded-full text-xs font-bold text-[#111] border border-gray-200 hover:bg-gray-50 transition-colors">
              Post a job
            </Link>
          </div>
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
