/*
 * ARTSWRK DASHBOARD — PAYMENTS & WALLET
 * Real data from Bubble via tRPC
 */

import { useState } from "react";
import { DollarSign, Download, ArrowUpRight, CheckCircle, CreditCard, ExternalLink, ChevronDown, ChevronRight, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

function getArtistInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function getArtistColor(id?: string | null) {
  const colors = ["bg-purple-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-red-500"];
  if (!id) return colors[0];
  const idx = id.charCodeAt(id.length - 1) % colors.length;
  return colors[idx];
}

function formatDate(val?: string | Date | null) {
  if (!val) return "—";
  const d = new Date(val);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(cents?: number | null) {
  if (!cents && cents !== 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

type Payment = {
  id: number;
  bubbleId: string | null;
  bookingId: number | null;
  bubbleBookingId: string | null;
  clientUserId: number | null;
  stripeId: string | null;
  stripeStatus: string | null;
  status: string | null;
  stripeAmount: number | null;
  stripeApplicationFee: string | null;
  stripeApplicationFeeAmount: number | null;
  stripeCardBrand: string | null;
  stripeCardLast4: string | null;
  stripeCardName: string | null;
  stripeDescription: string | null;
  stripeReceiptUrl: string | null;
  stripeRefundUrl: string | null;
  paymentDate: Date | null;
  createdAt: Date | null;
  bubbleCreatedAt: Date | null;
  bookingStartDate: Date | null;
  bookingStatus: string | null;
  bookingDescription: string | null;
  artistFirstName: string | null;
  artistLastName: string | null;
  artistName: string | null;
  artistProfilePicture: string | null;
};

function PaymentRow({ p }: { p: Payment }) {
  const [expanded, setExpanded] = useState(false);
  const artistDisplayName =
    p.artistFirstName && p.artistLastName
      ? `${p.artistFirstName} ${p.artistLastName}`
      : p.artistName ?? "Unknown Artist";

  const amount = formatAmount(p.stripeAmount);
  const fee = formatAmount(p.stripeApplicationFeeAmount);
  const net = p.stripeAmount && p.stripeApplicationFeeAmount
    ? formatAmount(p.stripeAmount - p.stripeApplicationFeeAmount)
    : "—";

  return (
    <>
      <div
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Artist avatar */}
        <div className="flex-shrink-0">
          {p.artistProfilePicture ? (
            <img
              src={p.artistProfilePicture}
              alt={artistDisplayName}
              className="w-9 h-9 rounded-full object-cover border border-gray-100"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const fb = el.nextElementSibling as HTMLElement;
                if (fb) fb.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`w-9 h-9 rounded-full ${getArtistColor(p.bubbleId)} flex items-center justify-center text-white text-xs font-bold`}
            style={{ display: p.artistProfilePicture ? "none" : "flex" }}
          >
            {getArtistInitials(p.artistFirstName, p.artistLastName, p.artistName)}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#111] truncate">{artistDisplayName}</p>
          <p className="text-xs text-gray-400 truncate">{p.stripeDescription ?? p.bookingDescription ?? "—"}</p>
        </div>

        {/* Card info */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <CreditCard size={12} className="text-gray-400" />
          <span className="text-xs text-gray-500">{p.stripeCardBrand ?? "—"} ···{p.stripeCardLast4 ?? "—"}</span>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-[#111]">{amount}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <CheckCircle size={10} className="text-green-400" />
            <p className="text-xs text-gray-400">{formatDate(p.paymentDate ?? p.bubbleCreatedAt)}</p>
          </div>
        </div>

        <ChevronDown
          size={14}
          className={`text-gray-300 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-3">
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Gross Amount</p>
              <p className="font-bold text-[#111]">{amount}</p>
            </div>
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Platform Fee</p>
              <p className="font-bold text-[#F25722]">{fee}</p>
            </div>
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Net to Artist</p>
              <p className="font-bold text-green-600">{net}</p>
            </div>
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Stripe Status</p>
              <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                p.stripeStatus === "succeeded" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>{p.stripeStatus ?? "—"}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs mb-3">
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Booking Date</p>
              <p className="font-semibold text-[#111]">{formatDate(p.bookingStartDate)}</p>
            </div>
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Booking Status</p>
              <p className="font-semibold text-[#111]">{p.bookingStatus ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-400 font-medium mb-0.5">Stripe ID</p>
              <p className="font-mono text-gray-500 truncate">{p.stripeId ?? "—"}</p>
            </div>
          </div>
          {p.stripeReceiptUrl && (
            <a
              href={p.stripeReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity"
            >
              <ExternalLink size={12} /> View Stripe Receipt
            </a>
          )}
        </div>
      )}
    </>
  );
}

export default function Payments() {
  const [search, setSearch] = useState("");

  const { data: payments, isLoading } = trpc.payments.myPayments.useQuery({ limit: 200 });
  const { data: stats } = trpc.payments.myStats.useQuery();

  const filtered = (payments ?? []).filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = [p.artistFirstName, p.artistLastName, p.artistName].filter(Boolean).join(" ").toLowerCase();
    const desc = (p.stripeDescription ?? p.bookingDescription ?? "").toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  const totalAmount = stats?.totalAmount ?? 0;
  const totalFees = stats?.totalFees ?? 0;
  const netRevenue = totalAmount - totalFees;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">Payments</h1>
        <p className="text-gray-500 text-sm mt-1">Stripe payment history for all artist bookings</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Total Payments</p>
          <p className="text-2xl font-black text-[#111]">{stats?.total ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">{stats?.succeeded ?? 0} succeeded</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Gross Charged</p>
          <p className="text-2xl font-black text-[#111]">${(totalAmount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">to artists via Stripe</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Platform Fees</p>
          <p className="text-2xl font-black text-[#F25722]">${(totalFees / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">Artswrk application fee</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Net to Artists</p>
          <p className="text-2xl font-black text-green-600">${(netRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">after fees</p>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <h2 className="text-sm font-bold text-[#111] flex-1">
            Transaction History
            {!isLoading && <span className="ml-2 text-gray-400 font-normal">({filtered.length})</span>}
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search artist or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#FFBC5D] transition-all w-64"
            />
          </div>
          <button className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity flex items-center gap-1">
            <Download size={12} /> Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="h-2.5 bg-gray-100 rounded w-48" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <DollarSign size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No payments found</p>
            {search && <p className="text-xs mt-1">Try a different search term</p>}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(p => (
              <PaymentRow key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* Card info summary */}
      {!isLoading && payments && payments.length > 0 && (() => {
        const cardMap = new Map<string, { brand: string; last4: string; name: string; count: number }>();
        for (const p of payments) {
          if (p.stripeCardLast4) {
            const key = `${p.stripeCardBrand}-${p.stripeCardLast4}`;
            const existing = cardMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              cardMap.set(key, {
                brand: p.stripeCardBrand ?? "Card",
                last4: p.stripeCardLast4,
                name: p.stripeCardName ?? "",
                count: 1,
              });
            }
          }
        }
        const cards = Array.from(cardMap.values()).sort((a, b) => b.count - a.count);
        return (
          <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#111] mb-4">Cards Used</h2>
            <div className="space-y-3">
              {cards.map(card => (
                <div key={`${card.brand}-${card.last4}`} className="flex items-center gap-3">
                  <div className="w-10 h-7 rounded-md bg-[#111] flex items-center justify-center flex-shrink-0">
                    <CreditCard size={14} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#111]">{card.brand} ending in {card.last4}</p>
                    {card.name && <p className="text-xs text-gray-400">{card.name}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{card.count} payment{card.count !== 1 ? "s" : ""}</span>
                  {card === cards[0] && (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Most used</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
