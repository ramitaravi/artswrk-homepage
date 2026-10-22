/**
 * The admin's controls for fixing a booking.
 *
 * Every one of these replaces a SQL script. In the three weeks before this
 * existed: a rate corrected from $18 to $20, two bookings cancelled, two
 * marked paid outside the platform, a stale invoice withdrawn — all by hand,
 * against the live database, because the product could not do them.
 *
 * The server decides what is allowed (shared/bookingEdits); this asks, shows
 * the answer, and never pretends an action is available when it is not.
 */
import { useState } from "react";
import { AlertTriangle, Ban, Check, Clock, DollarSign, Loader2, Pencil, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isSettled, hasOpenInvoice } from "@shared/bookingEdits";

const input = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-[#111] focus:outline-none focus:border-[#F25722] transition-colors";
const label = "block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1";

export default function AdminBookingControls({ booking, onChanged }: {
  booking: any;
  onChanged?: () => void;
}) {
  const utils = trpc.useUtils();
  const [panel, setPanel] = useState<null | "edit" | "cancel" | "paid">(null);

  const settled = isSettled(booking);
  const invoiceOpen = hasOpenInvoice(booking);

  const refresh = () => {
    utils.admin.getBooking.invalidate({ id: booking.id });
    utils.bookingEdits.history.invalidate({ bookingId: booking.id });
    onChanged?.();
  };
  const fail = (e: any) => toast.error(e?.message || "That didn't work");

  const edit = trpc.bookingEdits.edit.useMutation({
    onSuccess: (r: any) => {
      toast.success(r.invoiceWithdrawn
        ? "Booking updated — the open invoice was withdrawn, so the artist resubmits."
        : "Booking updated.");
      setPanel(null); refresh();
    },
    onError: fail,
  });
  const cancel = trpc.bookingEdits.cancel.useMutation({
    onSuccess: (r: any) => {
      toast.success(r.isLate
        ? `Cancelled — recorded as short notice (${r.noticeHours}h).`
        : "Cancelled, and both sides have been told.");
      setPanel(null); refresh();
    },
    onError: fail,
  });
  const markPaid = trpc.bookingEdits.markPaidManually.useMutation({
    onSuccess: () => { toast.success("Recorded as paid."); setPanel(null); refresh(); },
    onError: fail,
  });

  // ── Edit form ─────────────────────────────────────────────────────────────
  const [hourlyRate, setHourlyRate] = useState(String(booking.hourlyRate ?? ""));
  const [hours, setHours] = useState(String(booking.hours ?? ""));
  const [editReason, setEditReason] = useState("");
  const nextBase = (parseFloat(hourlyRate) || 0) * (parseFloat(hours) || 0);

  // ── Cancel / mark-paid ────────────────────────────────────────────────────
  const [cancelReason, setCancelReason] = useState("");
  const [paidAmount, setPaidAmount] = useState(
    booking.invoiceTotalCents != null ? (booking.invoiceTotalCents / 100).toFixed(2) : "");
  const [paidReason, setPaidReason] = useState("");

  if (settled) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Admin controls</p>
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <Check size={13} className="text-green-600 mt-0.5 flex-shrink-0" />
          <p>
            This booking has been paid, so its details are fixed. Correcting it means
            recording an adjustment, not rewriting what was charged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Admin controls</p>
        {invoiceOpen && (
          <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
            <AlertTriangle size={10} /> invoice out
          </span>
        )}
      </div>

      {panel === null && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPanel("edit")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:border-[#F25722] hover:text-[#F25722] transition-colors">
            <Pencil size={12} /> Edit rate &amp; hours
          </button>
          <button onClick={() => setPanel("paid")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:border-green-500 hover:text-green-600 transition-colors">
            <DollarSign size={12} /> Mark paid manually
          </button>
          <button onClick={() => setPanel("cancel")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:border-red-400 hover:text-red-500 transition-colors">
            <Ban size={12} /> Cancel booking
          </button>
        </div>
      )}

      {/* ── Edit ── */}
      {panel === "edit" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Rate / hr</label>
              <input className={input} type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
            <div>
              <label className={label}>Hours</label>
              <input className={input} type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          {nextBase > 0 && (
            <p className="text-xs text-gray-500">
              The artist is paid <strong className="text-[#111]">${nextBase.toFixed(2)}</strong>,
              the client is billed <strong className="text-[#111]">${(nextBase + Math.round(nextBase * 0.05)).toFixed(2)}</strong>.
            </p>
          )}
          <div>
            <label className={label}>Why (recorded in the history)</label>
            <input className={input} value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. agreed rate was $20/hr, not $18" />
          </div>
          {invoiceOpen && (
            <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              There's an invoice out for this booking. Editing it withdraws that invoice so the
              client can't pay a figure that no longer matches — the artist resubmits.
            </p>
          )}
          <Actions
            busy={edit.isPending}
            onCancel={() => setPanel(null)}
            confirmLabel="Save changes"
            onConfirm={() => edit.mutate({
              bookingId: booking.id,
              hourlyRate: parseFloat(hourlyRate) || undefined,
              hours: parseFloat(hours) || undefined,
              reason: editReason || undefined,
            })}
          />
        </div>
      )}

      {/* ── Mark paid ── */}
      {panel === "paid" && (
        <div className="space-y-3">
          <div>
            <label className={label}>Amount the client paid</label>
            <input className={input} type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" />
            <p className="text-[11px] text-gray-400 mt-1">What was actually collected, not what was quoted.</p>
          </div>
          <div>
            <label className={label}>How it was paid</label>
            <input className={input} value={paidReason} onChange={(e) => setPaidReason(e.target.value)} placeholder="e.g. manual Stripe link sent 10/22" />
          </div>
          <Actions
            busy={markPaid.isPending}
            disabled={!(parseFloat(paidAmount) > 0) || paidReason.trim().length < 3}
            onCancel={() => setPanel(null)}
            confirmLabel="Record as paid"
            onConfirm={() => markPaid.mutate({
              bookingId: booking.id,
              amountCents: Math.round(parseFloat(paidAmount) * 100),
              reason: paidReason.trim(),
            })}
          />
        </div>
      )}

      {/* ── Cancel ── */}
      {panel === "cancel" && (
        <div className="space-y-3">
          <div>
            <label className={label}>Why is it cancelled?</label>
            <input className={input} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. a sub covered the class" />
            <p className="text-[11px] text-gray-400 mt-1">
              Both sides are told, support@ is copied, and the notice period is recorded.
            </p>
          </div>
          <Actions
            busy={cancel.isPending}
            disabled={cancelReason.trim().length < 3}
            onCancel={() => setPanel(null)}
            confirmLabel="Cancel booking"
            danger
            onConfirm={() => cancel.mutate({ bookingId: booking.id, reason: cancelReason.trim() })}
          />
        </div>
      )}
    </div>
  );
}

function Actions({ busy, disabled, onCancel, onConfirm, confirmLabel, danger }: {
  busy?: boolean; disabled?: boolean; onCancel: () => void; onConfirm: () => void;
  confirmLabel: string; danger?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCancel}
        className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
        <X size={12} />
      </button>
      <button type="button" onClick={onConfirm} disabled={busy || disabled}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-[#111] hover:bg-gray-800"}`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        {confirmLabel}
      </button>
    </div>
  );
}

/** The change history for a booking — who did what, when, and why. */
export function AdminBookingHistory({ bookingId }: { bookingId: number }) {
  const { data = [], isLoading } = trpc.bookingEdits.history.useQuery({ bookingId });
  if (isLoading) return null;
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">History</p>
        <p className="text-xs text-gray-400">No changes recorded since this booking was created.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">History</p>
      <div className="space-y-2.5">
        {(data as any[]).map((e) => (
          <div key={e.id} className="flex items-start gap-2.5 text-xs">
            <Clock size={11} className="text-gray-300 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[#111]">
                <span className="font-semibold">{e.actorName ?? e.actorRole}</span>{" "}
                {e.action === "edit" && <>changed <span className="font-mono text-[11px]">{e.field}</span> from <span className="font-semibold">{e.oldValue ?? "—"}</span> to <span className="font-semibold">{e.newValue ?? "—"}</span></>}
                {e.action === "cancel" && <>cancelled this booking{e.newValue ? ` (${e.newValue})` : ""}</>}
                {e.action === "mark_paid" && <>recorded it as paid{e.newValue ? ` — ${e.newValue}` : ""}</>}
                {e.action === "invoice_void" && <>withdrew the invoice</>}
                {e.action === "reimbursement" && <>changed a reimbursement</>}
              </p>
              {e.reason && <p className="text-gray-500 mt-0.5">“{e.reason}”</p>}
              <p className="text-[10px] text-gray-400 mt-0.5">
                {new Date(e.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {" · "}{e.actorRole}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
