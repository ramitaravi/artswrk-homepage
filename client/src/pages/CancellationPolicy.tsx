import Navbar from "@/components/Navbar";

const LAST_UPDATED = "April 5, 2023";

export default function CancellationPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 pt-32 pb-24">

        {/* Breadcrumb links */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-10">
          <a href="/terms" className="hover:text-[#F25722] transition-colors">Terms of Service</a>
          <span>·</span>
          <a href="/privacy-policy" className="hover:text-[#F25722] transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="/cancellation-policy" className="font-semibold text-[#111] border-b border-[#111]">Cancellation Policy</a>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-[#111] mb-2">Cancellation Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Updated: {LAST_UPDATED}</p>

        <div className="prose-legal">

          <section>
            <p>This Cancellation Policy sets forth the terms and conditions whereby Artswrk, Inc, a Delaware C-corporation, operates when providing freelancers and related services. The team at Artswrk works to connect professional artists with a variety of clientele, and this Policy is enacted to protect these artists' time, energy, and financial wellbeing, as well as to protect the expected deliverables to and bottom line of our valued clients. This Policy applies to all booking transactions in which the client payment is processed through Artswrk, who then pays the artist; if the client is paying the artist directly, this Policy can only be partially enforced and on a case-by-case basis.</p>
            <p>After a booking is confirmed via email to the client and to the artist, either the client or the artist may cancel that booking at any time for any reason up to 48 hours prior to the expected delivery of services, with no consequence. If canceled within 48 hours of the booking start time, unless due to an Act of God, either party is subject to the following:</p>
            <p>If canceled by the client within the 48-hour window, there is a three-time incident policy in which there is a note made on your Artswrk account for the first two short-notice cancellations; after the third short-notice cancellation, the client's account will be prevented from posting booking inquiries for 90 days. After the 90-day period, the incidents will reset to zero and the client will be able to book through Artswrk once again.</p>
            <p>If canceled by the artist within the 48-hour window, there is a three-time incident policy in which there is a note made on your Artswrk account for the first two short-notice cancellations; after the third short-notice cancellation, the artist's account will be prevented from receiving booking inquiries for 90 days. After the 90-day period, the incidents will reset to zero and the artist will be able to be booked through Artswrk once again.</p>
            <p>If the booking is confirmed within 48 hours, any cancellation is subject to the above cancellation policy. We understand last-minute bookings and cancellations may occur, and we will work with you to ensure as much fairness and equity in this process as possible, and we welcome your feedback as such occasions arise.</p>
            <p>Clients and artists may share any good faith disputes or request changes to the service(s) selected, associated payments, service cancellation, and/or payment refund by emailing <a href="mailto:contact@artswrk.com">contact@artswrk.com</a>. We appreciate your cooperation and the opportunities to connect creative work and consistent income with these incredible artists.</p>
          </section>

        </div>

        <div className="border-t border-gray-100 mt-14 pt-8 flex items-center gap-6 text-xs text-gray-400">
          <a href="/terms" className="hover:text-[#F25722] transition-colors">Terms of Service</a>
          <a href="/privacy-policy" className="hover:text-[#F25722] transition-colors">Privacy Policy</a>
          <a href="/cancellation-policy" className="font-semibold text-[#111]">Cancellation Policy</a>
          <span className="ml-auto">{LAST_UPDATED}</span>
        </div>

      </div>

      <style>{`
        .prose-legal section { margin-bottom: 2.5rem; }
        .prose-legal h2 { font-size: 1rem; font-weight: 700; color: #111; margin-bottom: 0.75rem; margin-top: 0; }
        .prose-legal p { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.875rem; }
        .prose-legal strong { color: #111; font-weight: 600; }
        .prose-legal a { color: #F25722; text-decoration: none; }
        .prose-legal a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
