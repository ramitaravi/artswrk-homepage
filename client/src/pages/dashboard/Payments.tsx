/*
 * ARTSWRK DASHBOARD — PAYMENTS & WALLET
 * Layout matches the original Artswrk Bubble app:
 * Left: Wallet card (total spent) + Future Payments + Pending Pay Now
 * Right: Recent Transactions list (artist photo, name, date, amount)
 */

import { trpc } from "@/lib/trpc";
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
  const { data: pending } = trpc.payments.pendingPayments.useQuery();
  const { data: recentPayments, isLoading: paymentsLoading } = trpc.payments.myPayments.useQuery({ limit: 100 });

  const clientName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || "You"
    : "You";

  const totalSpent = wallet?.totalSpent ?? 0;
  const futurePayments = wallet?.futurePayments ?? 0;
  const pendingCount = wallet?.pendingCount ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
            <p className="text-xs text-gray-400 mt-1">{37} confirmed bookings upcoming</p>
          </div>

          {/* Pending Payments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm font-semibold text-gray-700">Pending Payments</p>
              {pendingCount > 0 && (
                <span className="bg-[#F25722] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </div>

            {!pending || pending.length === 0 ? (
              <p className="text-sm text-gray-400">No pending payments</p>
            ) : (
              <div className="space-y-3">
                {pending.map((b) => {
                  const artistName = b.artistFirstName && b.artistLastName
                    ? `${b.artistFirstName} ${b.artistLastName}`
                    : b.artistName ?? "Unknown Artist";
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <ArtistAvatar
                        firstName={b.artistFirstName}
                        lastName={b.artistLastName}
                        name={b.artistName}
                        profilePicture={b.artistProfilePicture}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111] truncate">{artistName}</p>
                        <p className="text-xs text-gray-400">{formatDollars(b.clientRate ?? 0)}</p>
                      </div>
                      {b.stripeCheckoutUrl ? (
                        <a
                          href={b.stripeCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex-shrink-0"
                        >
                          Pay Now
                        </a>
                      ) : (
                        <button className="px-4 py-1.5 rounded-full text-xs font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex-shrink-0">
                          Pay Now
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {recentPayments.map((p) => {
                const artistName = p.artistFirstName && p.artistLastName
                  ? `${p.artistFirstName} ${p.artistLastName}`
                  : p.artistName ?? "Unknown Artist";
                const dateStr = formatDate(p.paymentDate ?? p.bubbleCreatedAt);
                const amountStr = formatCents(p.stripeAmount);

                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <ArtistAvatar
                      firstName={p.artistFirstName}
                      lastName={p.artistLastName}
                      name={p.artistName}
                      profilePicture={p.artistProfilePicture}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111] truncate">{artistName}</p>
                      <p className="text-xs text-gray-400">{dateStr}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#111]">-{amountStr}</p>
                      {p.stripeReceiptUrl && (
                        <a
                          href={p.stripeReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#F25722] hover:underline"
                        >
                          Receipt
                        </a>
                      )}
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
