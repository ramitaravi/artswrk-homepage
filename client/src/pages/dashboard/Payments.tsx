/*
 * ARTSWRK DASHBOARD — PAYMENTS & WALLET
 * Layout matches the original Artswrk Bubble app:
 * Left: Wallet card (total spent) + Future Payments + Needs payment
 * Right: Recent Transactions list (artist photo, name, date, amount)
 */

import { Link } from "wouter";
import { Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { groupClientBookings, toClientDateCards } from "@/lib/weeklyBookings";
import { useAuth } from "@/_core/hooks/useAuth";

function getArtistInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function getArtistColor(seed?: string | null) {
  const colors = ["bg-purple-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-red-500"];
  if (!seed) return colors[0];
  const idx = seed.charCodeAt(seed.length - 1) % colors.length;
  return colors[idx];
}

function formatDate(val?: string | Date | null) {
  if (!val) return "—";
  const d = new Date(val);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDollars(val?: number | null) {
  if (val == null) return "—";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// stripeAmount is stored in cents — divide by 100
function formatCents(cents?: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ArtistAvatar({ firstName, lastName, name, profilePicture, size = "md" }: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  profilePicture?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  const initials = getArtistInitials(firstName, lastName, name);
  const colorClass = getArtistColor(firstName ?? name);

  if (profilePicture) {
    return (
      <img
        src={profilePicture}
        alt={`${firstName ?? name}`}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fb = el.nextElementSibling as HTMLElement;
          if (fb) fb.style.display = "flex";
        }}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full ${colorClass} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function Payments() {
  const { user } = useAuth();

  const { data: wallet, isLoading: walletLoading } = trpc.payments.walletStats.useQuery();
  // Class dates whose hours are in and whose invoice is waiting. These are the
  // only bookings on this page a studio can actually settle right now.
  const { data: adminBookings } = trpc.bookingPeriods.myAdminBookings.useQuery();
  const { data: bookings } = trpc.bookings.myBookings.useQuery({ limit: 200 });
  const needsPayment = (groupClientBookings([
    ...(bookings ?? []), ...toClientDateCards(adminBookings as any[]),
  ]).find((g) => g.key === "pay")?.rows ?? [])
    .filter((b: any) => !!b.invoicePaymentToken);
  const needsPaymentTotal = needsPayment.reduce((sum: number, b: any) => sum + Number(b.totalClientRate ?? 0), 0);
  const { data: recentPayments, isLoading: paymentsLoading } = trpc.payments.myPayments.useQuery({ limit: 100 });

  const clientName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || "You"
    : "You";

  const totalSpent = wallet?.totalSpent ?? 0;
  const futurePayments = wallet?.futurePayments ?? 0;
  const futureCount = wallet?.futureCount ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-black text-[#111] mb-6">Wallet</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Column ── */}
        <div className="space-y-4">

          {/* Wallet Card */}
          <div className="hirer-grad-bg rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
            {/* USD label */}
            <div className="flex items-center gap-1.5 text-white/70 text-xs font-semibold uppercase tracking-widest mb-4">
              <span className="text-lg font-black text-white/80">$</span>
              <span>USD</span>
            </div>

            {walletLoading ? (
              <div className="h-10 w-48 bg-white/20 rounded-lg animate-pulse mb-2" />
            ) : (
              <p className="text-4xl font-black tracking-tight mb-1">
                {formatDollars(totalSpent)}
              </p>
            )}
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-6">
              SPENT ON ARTSWRK
            </p>

            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider text-right">
              SPENT BY {clientName.toUpperCase()}
            </p>

            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-6 -right-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
          </div>

          {/* Future Payments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-500 mb-2">Future Payments</p>
            {walletLoading ? (
              <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-black text-[#111]">{formatDollars(futurePayments)}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {futureCount} confirmed booking{futureCount === 1 ? "" : "s"} upcoming
            </p>
          </div>

          {/* Needs payment — current class dates with a real invoice behind them. */}
          {needsPayment.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-700">Needs payment</p>
                <span className="bg-[#F25722] text-white text-xs font-bold px-2 py-0.5 rounded-full">{needsPayment.length}</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">{formatDollars(needsPaymentTotal)} owed across {needsPayment.length} class date{needsPayment.length !== 1 ? "s" : ""}</p>
              <div className="space-y-3">
                {needsPayment.map((b: any) => {
                  const artistName = b.artistFirstName && b.artistLastName
                    ? `${b.artistFirstName} ${b.artistLastName[0]}.`
                    : b.artistName ?? "Artist";
                  return (
                    <div key={b.key ?? b.id} className="flex items-center gap-3">
                      <ArtistAvatar firstName={b.artistFirstName} lastName={b.artistLastName} name={b.artistName} profilePicture={b.artistProfilePicture} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111] truncate">{artistName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(b.startDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {b.hours ? ` · ${b.hours}h` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-black text-[#111]">{formatDollars(b.totalClientRate)}</p>
                      <a
                        href={`/invoice/${b.invoicePaymentToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-1.5 rounded-full text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex-shrink-0"
                      >
                        Pay now
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Right Column: Recent Transactions ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-[#111]">Recent Transactions</h2>
          </div>

          {paymentsLoading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-32" />
                    <div className="h-2.5 bg-gray-100 rounded w-24" />
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-16" />
                </div>
              ))}
            </div>
          ) : !recentPayments || recentPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-400">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <span className="text-2xl">💳</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No transactions yet</p>
              <p className="text-xs text-gray-400 mb-4">Hire an artist to get started.</p>
              <Link href="/app/artists" className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                Browse artists →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {recentPayments.map((p) => {
                // A payment with no booking behind it was not a payment to a
                // person — it's a subscription or a job unlock. Calling those
                // "Unknown Artist" made every one look like a broken record of
                // paying someone.
                const paidAnArtist = !!(p.artistFirstName || p.artistName);
                const artistName = p.artistFirstName && p.artistLastName
                  ? `${p.artistFirstName} ${p.artistLastName[0]}.`
                  : p.artistName ?? "Artswrk";
                const dateStr = formatDate(p.paymentDate ?? p.bubbleCreatedAt);
                const amountStr = formatCents(p.stripeAmount);
                const card = p.stripeCardLast4 ? `•••• ${p.stripeCardLast4}` : null;

                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    {paidAnArtist ? (
                      <ArtistAvatar
                        firstName={p.artistFirstName}
                        lastName={p.artistLastName}
                        name={p.artistName}
                        profilePicture={p.artistProfilePicture}
                        size="md"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Receipt size={16} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111] truncate">{artistName}</p>
                      <p className="text-xs text-gray-400">
                        {dateStr}{card ? ` · ${card}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#111]">-{amountStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
