/**
 * InvoicePayment — public page for studios to review and pay an artist invoice.
 * URL: /invoice/:token
 * No login required. The token in the URL is the only auth mechanism.
 *
 * Two states before payment: the artist's submission only saves an estimate
 * (no payment link yet) — this page shows an editable review first (hours
 * can be adjusted), and approving is what actually creates the Stripe
 * checkout link. Matches how the old Bubble flow worked: artist invoices,
 * studio confirms, THAT confirm is what creates the payment link.
 */
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export default function InvoicePayment() {
  const { token } = useParams<{ token: string }>();
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Detect ?paid=1 in URL (Stripe success redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setAlreadyPaid(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: booking, isLoading, error } = trpc.invoice.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  const isPeriodInvoice = !!(booking as any)?.isPeriodInvoice;
  // Recurring period invoices are always billed hourly. For a regular booking,
  // read the applicant record's real isHourlyRate flag — inferring "hourly"
  // from `hours` being set treats the 365 flat bookings that also record hours
  // as hourly, and this page is where the studio approves the charge.
  const isHourly = isPeriodInvoice
    ? true
    : ((booking as any)?.isHourlyRate === 1 || (booking as any)?.isHourlyRate === true);
  const initialHours = isPeriodInvoice ? (booking as any)?.actualHours : booking?.hours;

  const [hoursInput, setHoursInput] = useState<string>("");
  useEffect(() => {
    if (initialHours != null) setHoursInput(String(initialHours));
  }, [initialHours]);

  const approve = trpc.invoice.approve.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (err) => setApproveError(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#F25722]" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-[#111] mb-2">Invoice Not Found</h2>
          <p className="text-gray-500 text-sm">This payment link may have expired or is invalid. Please contact Artswrk support.</p>
        </div>
      </div>
    );
  }

  const isPaid = alreadyPaid || !!booking.invoicePaidAt;
  const checkoutUrl = booking.invoiceStripeCheckoutUrl;
  const isApproved = !!checkoutUrl;
  const artistName = booking.artistName ?? booking.artistFirstName ?? "Your artist";
  const jobTitle = ((booking as any).jobDescription ?? "").split("\n")[0].slice(0, 80) || "Booking";
  const bookingDate = booking.startDate
    ? new Date(booking.startDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
    : new Date((booking as any).artswrkInvoiceSubmittedAt ?? Date.now()).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });

  const reimbTotal = (booking as any).reimbursementsTotal ?? 0;
  const hoursNum = parseFloat(hoursInput) || 0;
  const artistRate = (booking as any).artistRate ?? 0;
  const clientRate = (booking as any).clientRate ?? 0;

  // Live recompute as the studio edits hours — mirrors the server's math
  // exactly (invoice.approve), so what they see here is what they'll pay.
  let liveTotalDollars: number;
  if (isApproved || isPaid) {
    liveTotalDollars = (booking.invoiceTotalCents ?? 0) / 100;
  } else if (isPeriodInvoice) {
    liveTotalDollars = clientRate * hoursNum + reimbTotal;
  } else {
    const base = isHourly ? artistRate * hoursNum : artistRate;
    const fee = Math.round((base + reimbTotal) * 0.04);
    liveTotalDollars = base + reimbTotal + fee;
  }

  const handleApprove = () => {
    setApproveError(null);
    approve.mutate({ token: token ?? "", hours: isHourly ? hoursNum : undefined });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-serif">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-5 px-6 flex items-center justify-center">
        <a href="/" className="flex items-center select-none">
          <span className="font-black text-2xl tracking-tight" style={{ background: "linear-gradient(90deg,#FFBC5D,#F25722)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ARTS</span>
          <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-2 py-0.5 rounded ml-0.5">WRK</span>
        </a>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {isPaid ? (
          /* ── Paid confirmation ── */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-10 text-center">
              <CheckCircle2 size={56} className="mx-auto text-green-500 mb-5" />
              <h1 className="text-2xl font-bold text-[#111] mb-2">Payment Received!</h1>
              <p className="text-gray-500 text-base mb-1">
                Thank you — your payment for <strong>{artistName}</strong> has been processed.
              </p>
              <p className="text-gray-400 text-sm">You'll receive a receipt from Stripe at your email address.</p>
            </div>
          </div>
        ) : (
          /* ── Invoice details + review/pay ── */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Title */}
            <div className="px-10 pt-10 pb-6 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-[#111]">
                {isApproved ? "Payment Request" : "Review Invoice"} for {artistName} {bookingDate}
              </h1>
            </div>

            {/* Greeting */}
            <div className="px-10 py-6 border-b border-gray-100">
              <p className="text-base text-gray-600 mb-3">Hi there,</p>
              <p className="text-base text-gray-600">
                Your booking has been completed by <strong>{artistName}</strong>{" "}
                {isApproved ? "and requires payment." : "— take a look before approving."}
              </p>
            </div>

            {/* Booking details */}
            <div className="px-10 py-6 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Booking:</p>
              <div className="border-l-4 border-[#ec008c] pl-5 space-y-3">
                <p className="text-sm text-gray-700"><strong>Job:</strong> {jobTitle}</p>
                <p className="text-sm text-gray-700"><strong>Date:</strong> {bookingDate}</p>
                {(booking as any).jobLocation && (
                  <p className="text-sm text-gray-700"><strong>Location:</strong> {(booking as any).jobLocation}</p>
                )}
                {isHourly && (
                  <div className="text-sm text-gray-700 flex items-center gap-2">
                    <strong>Hours:</strong>
                    {isApproved ? (
                      <span>{initialHours}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={hoursInput}
                        onChange={(e) => setHoursInput(e.target.value)}
                        className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#ec008c]"
                      />
                    )}
                    <span className="text-gray-400 text-xs">
                      ({isPeriodInvoice ? `$${clientRate}/hr` : `$${artistRate}/hr`})
                    </span>
                  </div>
                )}
                {reimbTotal > 0 && (
                  <p className="text-sm text-gray-700"><strong>Reimbursements:</strong> ${reimbTotal.toFixed(2)}</p>
                )}
                <p className="text-sm text-gray-700 pt-1">
                  <strong>Total Payment Amount:</strong>{" "}
                  <span className="text-[#F25722] font-bold">${liveTotalDollars.toFixed(2)}</span>
                </p>
                {!isApproved && isHourly && (
                  <p className="text-xs text-gray-400">Adjust hours above if they don't match — the total updates automatically.</p>
                )}
              </div>
            </div>

            {/* Payment details */}
            <div className="px-10 py-6 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Payment Details</p>
              <p className="text-base text-gray-600 leading-relaxed">
                {isApproved
                  ? "You will be able to pay digitally with a card or Apple Pay, and will receive a receipt upon payment."
                  : "Once you approve the invoice above, you'll get a secure payment link to pay by card or Apple Pay, and will receive a receipt upon payment."}
              </p>
            </div>

            {/* CTA */}
            <div className="px-10 py-8 text-center">
              {isApproved ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#111] text-white text-lg font-semibold px-12 py-5 rounded-full hover:bg-gray-800 transition-colors"
                >
                  Continue to Payment <ExternalLink size={18} />
                </a>
              ) : (
                <div>
                  <button
                    onClick={handleApprove}
                    disabled={approve.isPending}
                    className="inline-flex items-center gap-2 bg-[#111] text-white text-lg font-semibold px-12 py-5 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {approve.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
                    Approve & Continue to Payment
                  </button>
                  {approveError && (
                    <p className="text-sm text-red-500 mt-3">{approveError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer note */}
            <div className="px-10 pb-10 pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-3">
                As always, if you have any questions or concerns, don't hesitate to reach out to us.
              </p>
              <p className="text-sm text-gray-500">Best,<br />The Artswrk Team</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
