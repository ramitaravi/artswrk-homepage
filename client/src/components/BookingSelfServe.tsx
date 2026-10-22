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
import { AlertTriangle, Ban, Check, Clock, Loader2, MapPin, Pencil, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isSettled, hasOpenInvoice } from "@shared/bookingEdits";

const field = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] focus:outline-none focus:border-[#ec008c] transition-colors";
const label = "block text-xs font-semibold text-gray-500 mb-1.5";

export default function BookingSelfServe({ booking, side, onChanged }: {
  booking: any;
  side: "artist" | "client";
  onChanged?: () => void;
}) {
  const utils = trpc.useUtils();
  const [panel, setPanel] = useState<null | "edit" | "cancel">(null);
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

  const [locationAddress, setLocationAddress] = useState(booking.locationAddress ?? "");
  const [description, setDescription] = useState(booking.description ?? "");
  const [cancelReason, setCancelReason] = useState("");

  if (settled) return null;   // Nothing to offer on a settled booking.

  return (
    <div className="border-t border-gray-50 pt-4 space-y-3">
      {panel === null && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPanel("edit")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#ec008c] hover:text-[#ec008c] transition-colors">
            <Pencil size={12} /> Edit details
          </button>
          <button type="button" onClick={() => setPanel("cancel")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-red-400 hover:text-red-500 transition-colors">
            <Ban size={12} /> Cancel booking
          </button>
          <p className="text-[11px] text-gray-400 w-full">
            The rate and hours are what you both agreed — contact support if those need changing.
          </p>
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
