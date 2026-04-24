/**
 * InvoicePayment — public page for studios to review and pay an artist invoice.
 * URL: /invoice/:token
 * No login required. The token in the URL is the only auth mechanism.
 */
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export default function InvoicePayment() {
  const { token } = useParams<{ token: string }>();
  const [alreadyPaid, setAlreadyPaid] = useState(false);

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
  const totalCents = booking.invoiceTotalCents ?? 0;
  const totalDollars = totalCents / 100;
  const artistName = booking.artistName ?? booking.artistFirstName ?? "Your artist";
  const jobTitle = (booking.jobDescription ?? "").split("\n")[0].slice(0, 80) || "Booking";
  const bookingDate = booking.startDate
    ? new Date(booking.startDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
    : new Date(booking.artswrkInvoiceSubmittedAt ?? Date.now()).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });

  // Rough breakdown (we don't store individual line items on the booking, so we reverse-engineer)
  // processingFee = round((base + reimb) * 0.04), total = base + reimb + fee
  // We display total only since we don't have the split stored separately here
  const checkoutUrl = booking.invoiceStripeCheckoutUrl;

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
          /* ── Invoice details + pay button ── */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Title */}
            <div className="px-10 pt-10 pb-6 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-[#111]">
                Payment Request for {artistName} {bookingDate}
              </h1>
            </div>

            {/* Greeting */}
            <div className="px-10 py-6 border-b border-gray-100">
              <p className="text-base text-gray-600 mb-3">Hi there,</p>
              <p className="text-base text-gray-600">
                Your booking has been completed by <strong>{artistName}</strong> and requires payment.
              </p>
            </div>

            {/* Booking details */}
            <div className="px-10 py-6 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Booking:</p>
              <div className="border-l-4 border-[#ec008c] pl-5 space-y-2">
                <p className="text-sm text-gray-700"><strong>Job:</strong> {jobTitle}</p>
                <p className="text-sm text-gray-700"><strong>Date:</strong> {bookingDate}</p>
                {booking.jobLocation && (
                  <p className="text-sm text-gray-700"><strong>Location:</strong> {booking.jobLocation}</p>
                )}
                <p className="text-sm text-gray-700">
                  <strong>Total Payment Amount:</strong>{" "}
                  <span className="text-[#F25722] font-bold">${totalDollars.toFixed(2)}</span>
                </p>
              </div>
            </div>

            {/* Payment details */}
            <div className="px-10 py-6 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Payment Details</p>
              <p className="text-base text-gray-600 leading-relaxed">
                If you need to edit your payment details, you can do so on Artswrk by following the link below.
                You will be able to pay digitally with a card or Apple Pay, and will receive a receipt upon payment.
              </p>
            </div>

            {/* CTA */}
            <div className="px-10 py-8 text-center">
              {checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#111] text-white text-lg font-semibold px-12 py-5 rounded-full hover:bg-gray-800 transition-colors"
                >
                  Continue to Payment <ExternalLink size={18} />
                </a>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Payment link is being generated.</p>
                  <p className="text-sm text-gray-400">Please contact <a href="mailto:contact@artswrk.com" className="text-[#F25722] underline">contact@artswrk.com</a> if this persists.</p>
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
