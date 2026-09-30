/*
 * ARTSWRK DASHBOARD — BOOKINGS
 * Real data from the bookings table, linked to jobs + interested artists.
 */

import { useState, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import {
  Calendar, Clock, MapPin, DollarSign, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, ChevronRight, CreditCard,
  TrendingUp, Loader2, RefreshCw, Send, ArrowRight, Building2, Paperclip, X, Search
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { periodInvoiceTotals, bookingMoney } from "@shared/bookingRates";
import { isArtistAccount } from "@shared/accountRole";
import { groupClientBookings, periodClassDay, toClientDateCards } from "@/lib/weeklyBookings";
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

/** True when both ends of a booking fall on the same calendar day. */
function sameDay(a: Date | string | null | undefined, b: Date | string | null | undefined) {
  if (!a || !b) return true;
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** A class date, written the way a studio says it: "Mon, Sep 14". */
function formatClassDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** "Weekly class · Mondays" — the season a date belongs to, never a status. */
function weeklyClassLabel(booking: { startDate?: Date | string | null; recurringCadence?: string | null }) {
  const cadence = booking.recurringCadence === "biweekly" ? "Every other week"
    : booking.recurringCadence === "monthly" ? "Monthly class"
    : booking.recurringCadence === "quarterly" ? "Quarterly" : "Weekly class";
  if (!booking.startDate) return cadence;
  const day = new Date(booking.startDate).toLocaleDateString("en-US", { weekday: "long" });
  return `${cadence} · ${day}s`;
}

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

type BookingStatus = "Confirmed" | "Completed" | "Cancelled" | "Pay Now" | "Awaiting Invoice";
type PaymentStatus = "Paid" | "Unpaid";

const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: React.ReactNode }> = {
  Confirmed: { label: "Confirmed", icon: <CheckCircle size={12} />, className: "text-green-600 bg-green-50" },
  Completed: { label: "Completed", icon: <CheckCircle size={12} />, className: "text-gray-500 bg-gray-100" },
  Cancelled: { label: "Cancelled", icon: <AlertCircle size={12} />, className: "text-red-500 bg-red-50" },
  "Pay Now": { label: "Pay Now", icon: <CreditCard size={12} />, className: "text-amber-600 bg-amber-50" },
  // The class happened; the teacher hasn't sent their hours yet. Nothing for
  // the studio to do but it is not "Confirmed" either — it is waiting on someone.
  "Awaiting Invoice": { label: "Awaiting artist invoice", icon: <Clock size={12} />, className: "text-blue-600 bg-blue-50" },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  Paid: { label: "Paid", className: "text-green-600 bg-green-50" },
  Unpaid: { label: "Unpaid", className: "text-amber-600 bg-amber-50" },
};

// ── Booking Row ───────────────────────────────────────────────────────────────

/** Every row across the groups — what the All pill counts. */
function filteredTotal(groups: { rows: any[] }[]): number {
  return groups.reduce((n, g) => n + g.rows.length, 0);
}

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

  function handleArtistClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (artistUserId) navigate(`/app/artists/${artistUserId}`);
  }

  const detailHref = (booking as any).isClassDate && (booking as any).periodId
    ? `/app/bookings/${booking.id}?date=${(booking as any).periodId}`
    : `/app/bookings/${booking.id}`;

  return (
    // The whole card is the target — a studio scanning a list clicks the row,
    // not the small link at its edge. Controls inside stop the click so Pay now
    // still goes to checkout and the artist's name still opens their profile.
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(detailHref)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(detailHref); } }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F25722]/40"
    >
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
                  // The date is what a studio scans for, so it leads the meta row
                  // in the page's text colour rather than sitting in grey.
                  <span className="flex items-center gap-1.5 text-sm font-bold text-[#111]">
                    <Calendar size={13} className="text-gray-400" /> {formatClassDate(booking.startDate)}
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
            {bookingStatus === "Pay Now" && ((booking as any).invoiceStripeCheckoutUrl || (booking as any).invoicePaymentToken) ? (
              <a
                href={(booking as any).invoiceStripeCheckoutUrl ?? `/invoice/${(booking as any).invoicePaymentToken}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-bold text-white hirer-grad-bg px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Pay now <ChevronRight size={13} />
              </a>
            ) : null}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              View details <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Booking Period Submit Form ──────────────────────────────────────────

export function PeriodSubmitModal({ period, booking, onClose, onSuccess }: {
  period: any;
  booking: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Pre-fill with the scheduled hours so the artist only changes it when a week ran long or short.
  const [hours, setHours] = useState((period.actualHours ?? period.scheduledHours)?.toString() ?? "");
  const [notes, setNotes] = useState(period.artistNotes ?? "");
  const [expNote, setExpNote] = useState("");
  const [expValue, setExpValue] = useState("");
  const [expFile, setExpFile] = useState<File | null>(null);
  /** Nothing is invoiced until the artist has seen the full breakdown. */
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Expenses belong to the WEEK, not the booking: the weekly invoice reads them
  // by bookingPeriodId, so one saved against the booking is never paid.
  const { data: expenses } = trpc.artistDashboard.getPeriodReimbursements.useQuery({ periodId: period.id });
  const uploadReceipt = trpc.artistDashboard.uploadReimbursementReceipt.useMutation();
  const addExpense = trpc.artistDashboard.addReimbursement.useMutation({
    onSuccess: () => {
      utils.artistDashboard.getPeriodReimbursements.invalidate({ periodId: period.id });
      setExpNote(""); setExpValue(""); setExpFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) => alert("Couldn't add that expense: " + e.message),
  });
  const removeExpense = trpc.artistDashboard.removeReimbursement.useMutation({
    onSuccess: () => utils.artistDashboard.getPeriodReimbursements.invalidate({ periodId: period.id }),
    onError: (e: any) => alert("Couldn't remove that expense: " + e.message),
  });

  const submit = trpc.bookingPeriods.submit.useMutation({
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => alert("Error: " + e.message),
  });

  // The class this is for — the date the artist knows it by, not the billing window.
  const classDayLabel = periodClassDay(period).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const artistRate = booking.hourlyRate ?? booking.artistRate ?? 0;
  const expenseTotal = (expenses ?? []).reduce((s: number, r: any) => s + Number(r.value ?? 0), 0);
  const money = bookingMoney(
    { rateType: "hourly", hourlyRate: Number(artistRate), hours: Number(hours || 0) },
    { reimbursements: expenseTotal },
  );
  const estimatedArtist = hours ? money.artistTotal.toFixed(2) : null;

  async function saveExpense() {
    const value = parseFloat(expValue);
    // A receipt is required for every expense.
    if (!value || isNaN(value) || !expFile) return;
    let fileUrl: string | undefined;
    if (expFile) {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = rej;
        r.readAsDataURL(expFile);
      });
      const up = await uploadReceipt.mutateAsync({ fileName: expFile.name, fileBase64: base64, mimeType: expFile.type });
      fileUrl = up.url;
    }
    if (!fileUrl) return; // a receipt is required — the server rejects expenses without one
    addExpense.mutate({ bookingId: booking.id, bookingPeriodId: period.id, value, note: expNote || undefined, fileUrl });
  }

  function doSubmit() {
    submit.mutate({ periodId: period.id, actualHours: Number(hours), artistNotes: notes || undefined, origin: window.location.origin });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black text-[#111]">Submit Hours</h2>
          <p className="text-sm text-gray-500">{classDayLabel}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Hours Worked *</label>
          <input
            type="number" min="0" step="0.25"
            value={hours} onChange={e => setHours(e.target.value)}
            placeholder="e.g. 8.5"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#ec008c]"
          />
        </div>

        {estimatedArtist && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">${Number(artistRate).toFixed(2)}/hr × {hours} hrs</span><span className="font-semibold text-[#111]">${money.base.toFixed(2)}</span></div>
            {expenseTotal > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Reimbursements</span><span className="font-semibold text-[#111]">${expenseTotal.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="font-bold text-[#111]">You'll receive</span><span className="font-bold text-[#111]">${estimatedArtist}</span></div>
            {/* Only artists use this popup — never show them what the studio is charged. */}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Any notes for the client…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#ec008c] resize-none"
          />
        </div>

        {/* Expenses for THIS week — gas, parking, supplies. */}
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <label className="block text-xs font-semibold text-gray-600">Reimbursements for this week</label>
          {(expenses ?? []).length > 0 ? (
            <div className="space-y-1">
              {(expenses ?? []).map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg pl-3 pr-1.5 py-1.5">
                  <span className="text-gray-600 truncate flex-1 min-w-0">
                    {r.note || "Expense"}
                    {r.fileUrl && <> · <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#ec008c] hover:underline">receipt</a></>}
                  </span>
                  <span className="font-semibold text-[#111]">${Number(r.value).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => removeExpense.mutate({ id: r.id })}
                    disabled={removeExpense.isPending}
                    aria-label={`Remove ${r.note || "expense"}`}
                    title="Remove"
                    className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">None added yet — leave empty if you had no expenses.</p>
          )}
          <div className="flex gap-2">
            <input
              value={expNote} onChange={e => setExpNote(e.target.value)}
              placeholder="Description (e.g. Gas, Parking)"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#ec008c]"
            />
            <input
              type="number" min="0" step="0.01" value={expValue} onChange={e => setExpValue(e.target.value)}
              placeholder="$" className="w-20 px-2 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#ec008c]"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors min-w-0 ${
                  expFile
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-dashed border-gray-300 bg-white text-gray-600 hover:border-[#ec008c] hover:text-[#ec008c]"
                }`}
              >
                <Paperclip size={12} className="flex-shrink-0" />
                <span className="truncate">{expFile ? expFile.name.slice(0, 22) : "Attach receipt *"}</span>
              </button>
              {expFile && (
                <button
                  type="button"
                  onClick={() => { setExpFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  aria-label="Remove attached receipt"
                  className="p-1 rounded-md text-gray-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setExpFile(e.target.files?.[0] ?? null)} />
            <button
              type="button" onClick={saveExpense}
              title={!expFile ? "Attach a receipt first" : undefined}
              disabled={!expValue || !expFile || addExpense.isPending || uploadReceipt.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {addExpense.isPending || uploadReceipt.isPending ? "Adding…" : "+ Add"}
            </button>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
          Submitting will generate a payment invoice and email the studio a payment link.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            onClick={() => setConfirming(true)}
            disabled={!hours || submit.isPending || addExpense.isPending || uploadReceipt.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Send size={14} /> Review &amp; Submit
          </button>
        </div>
      </div>

      {/* Last look before anything is invoiced. An artist who forgot their
          expenses can't get them back on this week once it's submitted. */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setConfirming(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-black text-[#111]">Send this invoice?</h3>
              <p className="text-xs text-gray-500">{classDayLabel}</p>
            </div>

            {expenseTotal === 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800">You haven't added any reimbursements.</p>
                <p className="text-[11px] text-amber-700">If you paid for gas, parking or supplies this week, add it now — it can't be added to this week once the invoice is sent.</p>
                <button onClick={() => setConfirming(false)} className="text-[11px] font-bold text-amber-800 underline">Go back and add expenses</button>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">${Number(artistRate).toFixed(2)}/hr × {hours} hrs</span><span className="font-semibold text-[#111]">${money.base.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Reimbursements</span><span className="font-semibold text-[#111]">${expenseTotal.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5"><span className="font-bold text-[#111]">You'll receive</span><span className="font-black text-[#ec008c]">${money.artistTotal.toFixed(2)}</span></div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
              <button
                onClick={doSubmit} disabled={submit.isPending}
                className="flex-1 px-3 py-2.5 rounded-xl text-xs font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submit.isPending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <>Yes, send it</>}
              </button>
            </div>
          </div>
        </div>
      )}
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
    skipped: "text-gray-400 bg-gray-50 line-through",
  }[s] ?? "text-gray-400 bg-gray-50");

  const statusLabel = (s: string) => ({
    upcoming: "Upcoming",
    open: "Awaiting submission",
    artist_submitted: "Invoice sent",
    client_paid: "Paid",
    skipped: "No class",
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
                  {/* Same status badge as every other booking — never labeled "admin". */}
                  {(() => {
                    const cfg = BOOKING_STATUS_CONFIG[booking.bookingStatus as BookingStatus] ?? BOOKING_STATUS_CONFIG.Confirmed;
                    return (
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    );
                  })()}
                  {(booking.recurringSeriesId || booking.isRecurring) && (
                    <span className="text-[10px] font-semibold text-gray-500">
                      {weeklyClassLabel(booking)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#111]">
                  {isArtist ? (clientName ?? "Client") : (artistName ?? "Artist")}
                </p>
                {booking.description && <p className="text-xs text-gray-500 line-clamp-1">{booking.description}</p>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={11} />
                    {/* A class date is one day. Only a booking that really spans
                        days shows a range — a single date shown as "Sep 14 – Sep 14"
                        reads like something is missing. */}
                    {sameDay(booking.startDate, booking.endDate)
                      ? formatClassDate(booking.startDate)
                      : `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`}
                  </span>
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
              {periods.length > 0 ? (
                <p className="text-[10px] text-gray-400">{paidPeriods.length}/{periods.length} paid</p>
              ) : booking.hours != null ? (
                <p className="text-[10px] text-gray-400">{booking.hours}h scheduled</p>
              ) : null}
              {!isArtist && periods.length === 0 && booking.bookingStatus === "Pay Now" && (
                <a
                  href={booking.invoiceStripeCheckoutUrl ?? (booking.invoicePaymentToken ? `/invoice/${booking.invoicePaymentToken}` : "/app/bookings")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-white hirer-grad-bg px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Pay now →
                </a>
              )}
              {isArtist && openPeriods.length > 0 && (
                <button
                  onClick={() => setSubmitPeriod({ ...openPeriods[0], scheduledHours: booking.hours })}
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
                  <p className="text-xs font-semibold text-[#111]">
                    {booking.isRecurring
                      // A weekly class is one class day, not a date range. periodStart
                      // is that day at UTC midnight, so formatting it directly renders
                      // the day before for anyone west of UTC — the studio reads its
                      // Monday class as Sunday.
                      ? periodClassDay(p).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                      : `Period ${i + 1} · ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`}
                  </p>
                  {p.actualHours != null && <p className="text-[10px] text-gray-500">{p.actualHours}h logged</p>}
                </div>
                <div className="flex items-center gap-2">
                  {p.invoiceTotalCents != null ? (
                    <span className="text-xs font-semibold text-gray-700">${(p.invoiceTotalCents / 100).toFixed(2)}</span>
                  ) : booking.hours != null && p.status !== "skipped" ? (
                    // Placeholder until hours are submitted: the artist sees their pay,
                    // the studio sees what they'll be invoiced (with the processing fee).
                    <span
                      className="text-[10px] text-gray-500"
                      title={isArtist
                        ? `${booking.hours} scheduled hrs × $${booking.artistRate}/hr`
                        : `${booking.hours} scheduled hrs × $${booking.clientRate}/hr + 5% processing fee`}
                    >
                      Est. ${(isArtist
                        ? Number(booking.artistRate ?? 0) * Number(booking.hours)
                        : periodInvoiceTotals(Number(booking.clientRate ?? 0), Number(booking.hours)).total
                      ).toFixed(2)}
                    </span>
                  ) : null}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                  {isArtist && p.status === "open" && (
                    <button onClick={() => setSubmitPeriod({ ...p, scheduledHours: booking.hours })} className="text-[10px] font-bold text-[#F25722] hover:underline">Submit →</button>
                  )}
                  {!isArtist && p.status === "artist_submitted" && (p.invoiceStripeCheckoutUrl || p.invoicePaymentToken) && (
                    // Checkout is created when the studio opens the invoice, so a
                    // submitted week has a token long before it has a Stripe URL.
                    // Without this fallback the studio saw hours submitted and no
                    // way to pay them.
                    <a
                      href={p.invoiceStripeCheckoutUrl ?? `/invoice/${p.invoicePaymentToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-[#F25722] hover:underline"
                    >
                      Review &amp; pay →
                    </a>
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

/** Recurring bookings panel used by the active artist dashboard route. */
export function ArtistRecurringBookings() {
  const { data: adminBookings, isLoading, refetch } = trpc.bookingPeriods.myAdminBookings.useQuery();

  if (isLoading) {
    return <div className="flex justify-center py-5"><Loader2 size={18} className="animate-spin text-gray-300" /></div>;
  }
  if (!(adminBookings as any[])?.length) return null;

  return (
    <div className="space-y-3">
      {(adminBookings as any[]).map((booking: any) => (
        <AdminBookingCard
          key={booking.id}
          booking={booking}
          isArtist
          onPeriodsUpdated={() => refetch()}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type FilterTab = "all" | "pay" | "awaiting" | "upcoming" | "past";

export default function Bookings() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const isArtist = isArtistAccount(user as any);

  const { data: stats, isLoading: statsLoading } = trpc.bookings.myStats.useQuery();
  const { data: bookings, isLoading: bookingsLoading } = trpc.bookings.myBookings.useQuery({
    limit: 200,
  });
  const { data: adminBookings, isLoading: adminLoading, refetch: refetchAdmin } = trpc.bookingPeriods.myAdminBookings.useQuery();

  const isLoading = statsLoading || bookingsLoading;

  // A studio's weekly classes are listed one class date at a time, in the same
  // row as every other booking — a season with dates folded inside it was the
  // thing nobody could read. Artists keep the season card below, where their
  // week-by-week Submit Hours lives.
  const classDates = useMemo(
    () => (isArtist ? [] : toClientDateCards(adminBookings as any[])),
    [isArtist, adminBookings],
  );

  // Search across the things a studio actually remembers a booking by: who
  // taught it, what the class was, where it was, and the date as they would
  // say it ("sep 14", "monday").
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return () => true;
    return (b: any) => {
      const date = b.startDate
        ? new Date(b.startDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : "";
      const name = [b.artistFirstName, b.artistLastName, b.artistName, b.artistSlug].filter(Boolean).join(" ");
      return [name, b.description, b.locationAddress, date, b.bookingStatus]
        .filter(Boolean)
        .some((field: string) => String(field).toLowerCase().includes(q));
    };
  }, [search]);

  const allGroups = useMemo(
    () => groupClientBookings([...(bookings ?? []), ...classDates].filter(matches)),
    [bookings, classDates, matches],
  );
  const groups = activeTab === "all" ? allGroups : allGroups.filter((g) => g.key === activeTab);
  const filtered = groups.flatMap((g) => g.rows);

  // The pills are the sections: a studio filters by what it has to do, not by a
  // status word. A pill with nothing behind it is hidden rather than shown empty.
  const countFor = (key: string) => allGroups.find((g) => g.key === key)?.rows.length ?? 0;
  const tabs: { key: FilterTab; label: string; count: number; urgent?: boolean }[] = ([
    { key: "all", label: "All", count: filteredTotal(allGroups) },
    { key: "pay", label: "Needs payment", count: countFor("pay"), urgent: true },
    { key: "awaiting", label: "Awaiting invoice", count: countFor("awaiting") },
    { key: "upcoming", label: "Upcoming", count: countFor("upcoming") },
    { key: "past", label: "Past", count: countFor("past") },
  ] as { key: FilterTab; label: string; count: number; urgent?: boolean }[])
    .filter((t) => t.key === "all" || t.count > 0);

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

      {/* Filter pills + search */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  active
                    ? "hirer-grad-bg text-white border-transparent shadow-sm"
                    : t.urgent
                      // Money owed stays visible even when the pill is not selected.
                      ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t.label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                  active ? "bg-white/25 text-white" : t.urgent ? "bg-amber-200/60 text-amber-800" : "bg-gray-100 text-gray-500"
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="booking-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search artist, class or date"
            className="w-full pl-9 pr-3 py-2 rounded-full border border-gray-200 text-xs font-medium text-[#111] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722]"
          />
        </div>
      </div>

      {/* Weekly and manually entered bookings. Artists and studios see these as
          ordinary bookings — never labeled "admin". */}
      {isArtist && !adminLoading && (adminBookings as any[])?.length > 0 && (
        <div className="mb-3">
          <div className="space-y-3">
            {/* Studios see each class date as its own booking. Artists keep the
                season card, where their week-by-week Submit Hours lives. */}
            {/* Artists only: the season card with per-week Submit Hours. */}
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
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-sm font-black text-[#111] uppercase tracking-wide">{group.title}</h2>
                <span className="text-xs font-semibold text-gray-400">{group.rows.length}</span>
              </div>
              {group.hint && <p className="text-xs text-gray-500 -mt-2 mb-3">{group.hint}</p>}
              <div className="space-y-3">
                {group.rows.map((booking: any) => (
                  <BookingRow key={booking.key ?? booking.id} booking={booking} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
