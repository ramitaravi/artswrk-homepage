/**
 * ClientBookingDetail — /app/bookings/:bookingId
 * Real detail page for a confirmed booking, replacing the old inline
 * expand-in-place row on the Bookings list.
 */
import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  ArrowLeft, Calendar, MapPin, Clock, CheckCircle, AlertCircle, CreditCard,
  Loader2, MessageCircle, Send, ExternalLink, Star, Briefcase,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Booking times are stored as the wall-clock everyone agreed on, held in UTC —
// they are not instants to re-localize, so read and format them in UTC. Same
// convention as the jobs board; formatting in the viewer's zone shifted every
// booking and pushed midnight (date-only) ones onto the previous day.
function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Time of day, or null when the value is midnight (i.e. only a date was set). */
function formatTime(d: string | Date | null | undefined) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) return null;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

/** "September 4, 2026 · 4:30 PM – 7:30 PM", collapsing whatever isn't set. */
function formatDateTimeRange(start: string | Date | null | undefined, end: string | Date | null | undefined) {
  if (!start) return "—";
  const startDay = formatDate(start);
  const endDay = end ? formatDate(end) : null;
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  const sameDay = !endDay || endDay === startDay;

  if (sameDay) {
    const times = [startTime, endTime].filter(Boolean).join(" – ");
    return times ? `${startDay} · ${times}` : startDay;
  }
  return [
    startTime ? `${startDay} · ${startTime}` : startDay,
    endTime ? `${endDay} · ${endTime}` : endDay,
  ].join(" – ");
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type BookingStatus = "Confirmed" | "Completed" | "Cancelled" | "Pay Now";
type PaymentStatus = "Paid" | "Unpaid";

const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: React.ReactNode }> = {
  Confirmed: { label: "Confirmed", icon: <CheckCircle size={13} />, className: "text-green-600 bg-green-50" },
  Completed: { label: "Completed", icon: <CheckCircle size={13} />, className: "text-gray-500 bg-gray-100" },
  Cancelled: { label: "Cancelled", icon: <AlertCircle size={13} />, className: "text-red-500 bg-red-50" },
  "Pay Now": { label: "Pay Now", icon: <CreditCard size={13} />, className: "text-amber-600 bg-amber-50" },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  Paid: { label: "Paid", className: "text-green-600 bg-green-50" },
  Unpaid: { label: "Unpaid", className: "text-amber-600 bg-amber-50" },
};

// ─── Message Artist Modal ───────────────────────────────────────────────────

function MessageArtistModal({ artistUserId, artistName, onClose }: { artistUserId: number; artistName: string; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const startConversation = trpc.messages.startConversation.useMutation({
    onSuccess: ({ conversationId }) => {
      setSent(true);
      setTimeout(() => {
        onClose();
        navigate(`/app/messages?conversationId=${conversationId}`);
      }, 1400);
    },
    onError: (e) => toast.error(e.message || "Failed to send message"),
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 gap-4">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-500" />
        </div>
        <p className="font-bold text-[#111] text-lg">Message sent!</p>
        <p className="text-sm text-gray-500 text-center">Opening your thread with {artistName}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Textarea
        placeholder={`Hi ${artistName}, quick question about this booking…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[120px] resize-none text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
        <Button
          onClick={() => startConversation.mutate({ artistUserId, initialMessage: text })}
          disabled={!text.trim() || startConversation.isPending}
          className="bg-[#111] hover:bg-gray-800 text-white gap-2"
          size="sm"
        >
          {startConversation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send Message
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientBookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, navigate] = useLocation();
  const [msgOpen, setMsgOpen] = useState(false);
  const id = Number(bookingId);

  const { data: booking, isLoading, error } = trpc.bookings.clientDetail.useQuery({ id }, { enabled: !!id });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading booking…
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto text-center py-24">
        <AlertCircle size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-700 mb-1">Booking not found</p>
        <button onClick={() => navigate("/app/bookings")} className="text-sm text-[#F25722] font-semibold hover:underline mt-2">
          ← Back to Bookings
        </button>
      </div>
    );
  }

  const b = booking as any;
  const bookingStatus = (b.bookingStatus ?? "Confirmed") as BookingStatus;
  const paymentStatus = (b.paymentStatus ?? "Unpaid") as PaymentStatus;
  const statusCfg = BOOKING_STATUS_CONFIG[bookingStatus] ?? BOOKING_STATUS_CONFIG.Confirmed;
  const payCfg = PAYMENT_STATUS_CONFIG[paymentStatus] ?? PAYMENT_STATUS_CONFIG.Unpaid;

  const artistName = b.artistFirstName && b.artistLastName
    ? `${b.artistFirstName} ${b.artistLastName}`
    : b.artistName ?? "Artist";
  // Only ever gates the "N hours" line. The real hourly/flat flag lives on
  // the applicant record and is read server-side in buildClientPricing.
  const hasHours = b.hours != null && b.hours > 0;

  // The whole money breakdown is computed server-side (see buildClientPricing)
  // so no artist-side figure is ever sent to the browser. Labels stay neutral —
  // never "artist rate" / "client rate", which reads like we mark work up.
  const pricing = (b.pricing ?? {
    isHourly: false, unitRate: null, hours: null,
    subtotal: 0, processingFee: 0, reimbursements: 0, total: 0, hasProcessingFee: false,
  }) as {
    isHourly: boolean; unitRate: number | null; hours: number | null;
    subtotal: number; processingFee: number; reimbursements: number;
    total: number; hasProcessingFee: boolean;
  };
  const total = pricing.total;

  // Legacy Bubble bookings have no paymentMethod at all (5,185 of them) — in
  // Bubble everything ran through Artswrk unless it was flagged as an external
  // payment, so derive it rather than showing "Payment method not set".
  const paidDirectly = b.paymentMethod === "direct" || (!b.paymentMethod && !!b.externalPayment);

  // "Pay Now" is the status that means the client owes money right now.
  const needsPayment = bookingStatus === "Pay Now" && paymentStatus !== "Paid" && !b.invoicePaidAt;
  // ONLY invoiceStripeCheckoutUrl — the link this app generates for THIS
  // booking. Never fall back to bookings.stripeCheckoutUrl: 2,622 rows carry a
  // legacy Bubble Payment Link that charges for a different artist's booking
  // entirely (a client clicking it is shown someone else's name and amount).
  const payUrl: string | null = b.invoiceStripeCheckoutUrl || null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {msgOpen && (
        <Dialog open onOpenChange={(o) => !o && setMsgOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Message {artistName}</DialogTitle></DialogHeader>
            <MessageArtistModal artistUserId={b.artistUserId} artistName={artistName} onClose={() => setMsgOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      <button onClick={() => navigate("/app/bookings")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#111] transition-colors mb-4">
        <ArrowLeft size={15} /> Back to Bookings
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {b.artistProfilePicture ? (
              <img src={b.artistProfilePicture} alt={artistName} className="w-16 h-16 rounded-full object-cover border border-gray-100" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xl font-black">
                {artistName[0]?.toUpperCase() ?? "A"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {/* "Pay Now" implies the client can act, but until the artist
                    submits an invoice there is nothing to pay — say what's
                    actually true instead. */}
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                  {statusCfg.icon} {needsPayment && !payUrl ? "Awaiting Payment" : statusCfg.label}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${payCfg.className}`}>
                  {payCfg.label}
                </span>
              </div>
              {b.artistSlug ? (
                <Link href={`/book/${b.artistSlug}`} className="text-lg font-black text-[#111] hover:text-[#F25722] transition-colors">
                  {artistName}
                </Link>
              ) : (
                <p className="text-lg font-black text-[#111]">{artistName}</p>
              )}
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {b.artistLocation && (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={11} /> {b.artistLocation}</span>
                )}
                {b.artistRatingScore != null && (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Star size={11} className="fill-amber-400 text-amber-400" /> {Number(b.artistRatingScore).toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Pay Now removed — see dashboard/Payments.tsx. It linked to a
                Bubble Payment Link that charges for a different booking. */}
            <button
              onClick={() => setMsgOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#111] border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <MessageCircle size={14} /> Message
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Booking details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Booking Details</p>
          <div className="space-y-2.5 text-sm">
            {b.jobTitle && (
              <div className="flex items-start gap-2 text-gray-600">
                <Briefcase size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                {b.jobSlug ? (
                  <Link href={`/jobs/${b.jobSlug}`} className="hover:text-[#F25722] transition-colors">{b.jobTitle}</Link>
                ) : <span>{b.jobTitle}</span>}
              </div>
            )}
            {b.startDate && (
              <div className="flex items-start gap-2 text-gray-600">
                <Calendar size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{formatDateTimeRange(b.startDate, b.endDate)}</span>
              </div>
            )}
            {hasHours && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={14} className="text-gray-400 flex-shrink-0" />
                <span>{b.hours} hours{b.isRecurring && b.recurringCadence ? ` · ${b.recurringCadence}` : ""}</span>
              </div>
            )}
            {!hasHours && !!b.isRecurring && b.recurringCadence && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={14} className="text-gray-400 flex-shrink-0" />
                <span>Recurring · {b.recurringCadence}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <CreditCard size={14} className="text-gray-400 flex-shrink-0" />
              <span>
                {paidDirectly ? "Paid directly to the artist" : "Paid through Artswrk"}
                {b.directPayConfirmedAt ? ` · confirmed ${formatDate(b.directPayConfirmedAt)}` : ""}
              </span>
            </div>
            {b.locationAddress && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(b.locationAddress)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="hover:text-[#F25722] transition-colors flex items-center gap-1"
                >
                  {b.locationAddress} <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
          {b.description && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{b.description}</p>
            </div>
          )}
        </div>

        {/* Financials */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Financials</p>
          {/* Client-facing figures ONLY. Artist rate, Stripe fee and gross
              profit are Artswrk's margin — they are not fetched for this page
              (see getClientBookingDetail), so there is nothing to leak here. */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            {/* The rate × hours line is context for the subtotal, not a
                calculation done here — bookings store totals, and the per-unit
                figure comes from the applicant record. */}
            {pricing.unitRate != null && pricing.isHourly && pricing.hours ? (
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatCurrency(pricing.unitRate)}/hr × {pricing.hours} hrs</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-gray-500">{pricing.hasProcessingFee ? "Rate subtotal" : "Booking rate"}</span>
              <span className="font-semibold text-[#111]">{formatCurrency(pricing.subtotal)}</span>
            </div>
            {/* Legacy bookings never had a fee — the old margin sat inside the
                rate — so this line only appears on new, commission-free ones. */}
            {pricing.hasProcessingFee && pricing.processingFee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Processing fee (5%)</span>
                <span className="font-semibold text-[#111]">{formatCurrency(pricing.processingFee)}</span>
              </div>
            )}
            {pricing.hasProcessingFee && pricing.processingFee > 0 && (
              // Says plainly that Artswrk takes no cut — without this the fee
              // reads like commission, which is the opposite of the model.
              <p className="text-[11px] text-gray-400 leading-relaxed pt-0.5">
                Your artist receives 100% of the {formatCurrency(pricing.subtotal)} rate. The processing fee
                covers payment processing and credit card costs — Artswrk takes no commission.
              </p>
            )}
            {pricing.reimbursements > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Reimbursements</span>
                <span className="font-semibold text-[#111]">{formatCurrency(pricing.reimbursements)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-900 font-semibold">Total</span>
              <span className="font-bold text-[#111]">{formatCurrency(pricing.total)}</span>
            </div>
          </div>

          {/* Pay Now bookings previously showed the amount owed with no way to
              pay it — the invoice link exists on the booking but was never
              surfaced here, so the client was stuck. */}
          {needsPayment && (
            payUrl ? (
              <a href={payUrl} target="_blank" rel="noopener noreferrer" className="block mt-3">
                <button className="w-full py-3 rounded-xl bg-[#F25722] text-white text-sm font-bold hover:bg-[#d94a1a] transition-colors flex items-center justify-center gap-2">
                  Pay {formatCurrency(total)} now
                </button>
              </a>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  {artistName} will upload any reimbursements and invoice you — you'll be able to
                  pay right here once they do.
                </p>
              </div>
            )
          )}
          {/* Coerced: externalPayment is a tinyint, so `{0 && …}` rendered a
              bare "0" under the financials box. */}
          {!!b.externalPayment && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-3">
              <ExternalLink size={11} /> Paid externally (outside Stripe)
            </p>
          )}
          {b.artswrkInvoiceSubmittedAt && (
            <p className="text-xs text-gray-400 mt-3">
              Invoice submitted {formatDate(b.artswrkInvoiceSubmittedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
