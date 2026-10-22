/**
 * What an artist or a studio can change on their own booking.
 *
 * Both sides get the same thing, because the rules are the same for both and
 * the server decides anyway (shared/bookingEdits): logistics and expenses
 * yes, rate and hours no, marking paid no.
 *
 * The gap this closes, in Marlon's words: "I got a little mixed up putting in
 * my travel receipts and accidentally attached the wrong one... I tried to
 * remedy the situation by putting in the right one, but wasn't able to remove
 * the wrong one." It took a SQL DELETE. Now it takes a button.
 */
import { useState } from "react";
import { AlertTriangle, Ban, Check, Clock, Handshake, Loader2, MapPin, Pencil, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isSettled, hasOpenInvoice, hasOpenProposal, proposedBy, proposalSummary } from "@shared/bookingEdits";
import { processingFeeFor } from "@shared/bookingRates";

const field = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] focus:outline-none focus:border-[#ec008c] transition-colors";
const label = "block text-xs font-semibold text-gray-500 mb-1.5";

export default function BookingSelfServe({ booking, side, onChanged }: {
  booking: any;
  side: "artist" | "client";
  onChanged?: () => void;
}) {
  const utils = trpc.useUtils();
  const [panel, setPanel] = useState<null | "edit" | "cancel" | "rate">(null);
  const other = side === "artist" ? "the studio" : "the artist";

  const settled = isSettled(booking);
  const invoiceOpen = hasOpenInvoice(booking);

  const refresh = () => {
    utils.artistDashboard.myConfirmations.invalidate();
    utils.bookingPeriods.myAdminBookings.invalidate();
    utils.bookingEdits.history.invalidate({ bookingId: booking.id });
    onChanged?.();
  };
  const fail = (e: any) => toast.error(e?.message || "That didn't work");

  const edit = trpc.bookingEdits.edit.useMutation({
    onSuccess: (r: any) => {
      toast.success(r.invoiceWithdrawn
        ? `Updated — the invoice was withdrawn, so submit it again when you're ready.`
        : `Updated, and ${other} has been told.`);
      setPanel(null); refresh();
    },
    onError: fail,
  });
  const cancel = trpc.bookingEdits.cancel.useMutation({
    onSuccess: () => { toast.success(`Cancelled, and ${other} has been told.`); setPanel(null); refresh(); },
    onError: fail,
  });

  const proposeRate = trpc.bookingEdits.proposeRate.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Proposed ${r.amountLabel}. Nothing changes until ${other} accepts.`);
      setPanel(null); refresh();
    },
    onError: fail,
  });
  const respond = trpc.bookingEdits.respondToProposal.useMutation({
    onSuccess: (r: any) => {
      toast.success(r.accepted
        ? `Accepted ${r.amountLabel}. The booking has been updated.`
        : `Declined. The booking is unchanged.`);
      refresh();
    },
    onError: fail,
  });
  const withdraw = trpc.bookingEdits.withdrawProposal.useMutation({
    onSuccess: () => { toast.success("Withdrawn."); refresh(); },
    onError: fail,
  });

  // A rate is what both sides agreed, so neither can change it alone. One
  // proposes, the other accepts, and only the acceptance moves any money.
  const openProposal = hasOpenProposal(booking);
  const mineToAnswer = openProposal && proposedBy(booking) !== side;
  const [proposedRate, setProposedRate] = useState("");
  const [rateReason, setRateReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const isHourly = booking.rateType === "hourly" || booking.hourlyRate != null;
  const proposedNum = parseFloat(proposedRate);
  const proposedOk = Number.isFinite(proposedNum) && proposedNum > 0;
  const bookingHours = Number(booking.hours ?? 0);
  const proposedArtistTotal = proposedOk
    ? (isHourly && bookingHours > 0 ? proposedNum * bookingHours : proposedNum)
    : null;

  const [locationAddress, setLocationAddress] = useState(booking.locationAddress ?? "");
  const [description, setDescription] = useState(booking.description ?? "");
  const [cancelReason, setCancelReason] = useState("");

  if (settled) return null;   // Nothing to offer on a settled booking.

  return (
    <div className="border-t border-gray-50 pt-4 space-y-3">
      {openProposal && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <Handshake size={13} /> {proposalSummary(booking)}
          </p>
          {booking.proposedRateReason && (
            <p className="text-[11px] text-amber-700 italic">"{booking.proposedRateReason}"</p>
          )}
          {mineToAnswer ? (
            <>
              <p className="text-[11px] text-amber-700">
                Nothing has changed yet. Accepting updates the booking; declining leaves it as it is.
              </p>
              <input
                className={field}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Optional note for them"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ bookingId: booking.id, accept: true, reason: declineReason || undefined })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#111] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {respond.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Accept
                </button>
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ bookingId: booking.id, accept: false, reason: declineReason || undefined })}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-red-400 hover:text-red-500 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-amber-700">Waiting on {other}.</p>
              <button
                type="button"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate({ bookingId: booking.id })}
                className="px-3 py-1.5 rounded-lg border border-amber-300 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          )}
        </div>
      )}

      {panel === null && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPanel("edit")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#ec008c] hover:text-[#ec008c] transition-colors">
            <Pencil size={12} /> Edit details
          </button>
          {!openProposal && (
            <button type="button" onClick={() => setPanel("rate")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#ec008c] hover:text-[#ec008c] transition-colors">
              <Handshake size={12} /> Propose a rate change
            </button>
          )}
          <button type="button" onClick={() => setPanel("cancel")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-red-400 hover:text-red-500 transition-colors">
            <Ban size={12} /> Cancel booking
          </button>
          <p className="text-[11px] text-gray-400 w-full">
            Neither of you can change the rate alone — propose one and {other} accepts it.
          </p>
        </div>
      )}

      {panel === "rate" && (
        <div className="space-y-3">
          <div>
            <label className={label}>
              {isHourly ? "New rate per hour" : "New rate for the booking"}
            </label>
            <input
              className={field}
              type="number"
              min="0"
              step="0.01"
              value={proposedRate}
              onChange={(e) => setProposedRate(e.target.value)}
              placeholder={isHourly
                ? String(booking.hourlyRate ?? "0.00")
                : String(booking.flatRate ?? booking.artistRate ?? "0.00")}
            />
          </div>
          {proposedArtistTotal != null && (
            <p className="text-xs text-gray-500">
              {side === "artist" ? "You'd receive" : "The artist would receive"}{" "}
              <strong className="text-[#111]">${proposedArtistTotal.toFixed(2)}</strong>
              {isHourly && bookingHours > 0 && <> over {bookingHours} hrs</>}
              {booking.paymentMethod === "artswrk" && (
                <> · {side === "client" ? "you'd pay" : "the studio pays"}{" "}
                  <strong className="text-[#111]">
                    ${(proposedArtistTotal + processingFeeFor(proposedArtistTotal)).toFixed(2)}
                  </strong></>
              )}
            </p>
          )}
          <div>
            <label className={label}>Why? ({other} will see this)</label>
            <input className={field} value={rateReason} onChange={(e) => setRateReason(e.target.value)}
              placeholder="e.g. the class ran long and we agreed a higher rate" />
          </div>
          <p className="text-[11px] text-gray-400">
            Nothing changes until {other} accepts. You can withdraw it before they do.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500">
              <X size={12} />
            </button>
            <button
              type="button"
              disabled={!proposedOk || proposeRate.isPending}
              onClick={() => proposeRate.mutate({
                bookingId: booking.id,
                ...(isHourly ? { hourlyRate: proposedNum } : { flatRate: proposedNum }),
                reason: rateReason || undefined,
              })}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#111] text-white text-xs font-semibold disabled:opacity-50"
            >
              {proposeRate.isPending ? <Loader2 size={12} className="animate-spin" /> : <Handshake size={12} />}
              Propose {proposedOk ? `$${proposedNum.toFixed(2)}${isHourly ? "/hr" : ""}` : "rate"}
            </button>
          </div>
        </div>
      )}

      {panel === "edit" && (
        <div className="space-y-3">
          <div>
            <label className={label}><MapPin size={11} className="inline mr-1" />Location</label>
            <input className={field} value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="Studio address or city" />
          </div>
          <div>
            <label className={label}>Details</label>
            <textarea className={`${field} resize-none`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the booking is for…" />
          </div>
          {invoiceOpen && (
            <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              There's an invoice out for this booking. Changing it withdraws that invoice so nobody
              pays against the old details — you'll submit again.
            </p>
          )}
          <Row busy={edit.isPending} onCancel={() => setPanel(null)} confirmLabel="Save changes"
            onConfirm={() => edit.mutate({ bookingId: booking.id, locationAddress, description })} />
        </div>
      )}

      {panel === "cancel" && (
        <div className="space-y-3">
          <div>
            <label className={label}>Why are you cancelling?</label>
            <input className={field} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              placeholder={side === "artist" ? "e.g. I've arranged a sub" : "e.g. the class was called off"} />
            <p className="text-[11px] text-gray-400 mt-1.5">
              {other.charAt(0).toUpperCase() + other.slice(1)} and the Artswrk team are told straight away.
            </p>
          </div>
          <Row busy={cancel.isPending} danger disabled={cancelReason.trim().length < 3}
            onCancel={() => setPanel(null)} confirmLabel="Cancel this booking"
            onConfirm={() => cancel.mutate({ bookingId: booking.id, reason: cancelReason.trim() })} />
        </div>
      )}
    </div>
  );
}

function Row({ busy, disabled, onCancel, onConfirm, confirmLabel, danger }: {
  busy?: boolean; disabled?: boolean; onCancel: () => void; onConfirm: () => void;
  confirmLabel: string; danger?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCancel}
        className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
        <X size={12} />
      </button>
      <button type="button" onClick={onConfirm} disabled={busy || disabled}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-r from-[#ff7171] to-[#ec008c] hover:opacity-90"}`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        {confirmLabel}
      </button>
    </div>
  );
}

/** A plain-language change history, for the people on the booking. */
export function BookingHistory({ bookingId }: { bookingId: number }) {
  const { data = [] } = trpc.bookingEdits.history.useQuery({ bookingId });
  if (!data.length) return null;
  return (
    <div className="border-t border-gray-50 pt-4">
      <p className="text-xs font-bold text-gray-500 mb-2">Changes</p>
      <div className="space-y-2">
        {(data as any[]).slice(0, 6).map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs text-gray-600">
            <Clock size={11} className="text-gray-300 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p>
                <span className="font-semibold text-[#111]">{e.actorRole === "admin" ? "Artswrk" : e.actorName ?? e.actorRole}</span>{" "}
                {e.action === "edit" && <>changed the {humanField(e.field)}</>}
                {e.action === "cancel" && <>cancelled this booking</>}
                {e.action === "mark_paid" && <>marked it paid{e.newValue ? ` (${e.newValue})` : ""}</>}
                {e.action === "invoice_void" && <>withdrew the invoice</>}
                {e.action === "reimbursement" && <>removed an expense{e.oldValue ? ` (${e.oldValue})` : ""}</>}
              </p>
              {e.reason && <p className="text-gray-400">“{e.reason}”</p>}
              <p className="text-[10px] text-gray-400">
                {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Column names are not words people use. */
function humanField(f?: string | null): string {
  switch (f) {
    case "locationAddress": return "location";
    case "startDate": return "date";
    case "endDate": return "end time";
    case "hourlyRate": return "rate";
    case "hours": return "hours";
    case "description": return "details";
    case "artistRate": case "clientRate": return "total";
    default: return f ?? "booking";
  }
}
