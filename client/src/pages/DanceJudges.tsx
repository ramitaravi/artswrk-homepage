import { useState } from "react";
import { ChevronDown } from "lucide-react";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create your Artist Profile",
    desc: "Share your profile: list services, rates, and availability in one place",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
  },
  {
    step: "02",
    title: "Find & Connect with Competitions & Conventions",
    desc: "Browse open jobs near you - whether for one-time jobs or ongoing work",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-2-Vo37fp95iDpS9ybaZkYWJB.webp",
  },
  {
    step: "03",
    title: "Get Booked & Paid Online",
    desc: "Tax season has never been easier. Get direct deposits for all your work and receive one 1099.",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-3-hjiUkBU9Pft72RAaeq8oxW.webp",
  },
];

const JOB_TYPES = [
  { emoji: "🎤", label: "Dance Judges", desc: "Bring your expertise to the judging panel at events nationwide" },
  { emoji: "🎥", label: "Videographers & Photographers", desc: "Capture the magic of competitions and conventions" },
  { emoji: "🎛️", label: "Tabulators", desc: "Keep scores accurate and events running smoothly" },
  { emoji: "🎭", label: "Backstage Managers", desc: "Keep backstage organized and running on time" },
  { emoji: "👕", label: "Merchandise Sales", desc: "Manage merchandise booths at events" },
  { emoji: "🎤", label: "Emcees", desc: "Host and energize competitions and conventions" },
];

const FAQS = [
  { q: "How do I get booked on Artswrk?", a: "Create your profile, list your services and rates, and apply to open jobs. Competition organizers can also find and book you directly from your profile." },
  { q: "Why do I need to share my rates, location, etc.?", a: "Sharing your rates and location helps competition organizers find the right match quickly. You stay in control of what you share and can update it anytime." },
  { q: "Is there a cancellation policy?", a: "Yes. If you need to cancel, please do so at least 48 hours in advance to avoid any fees." },
  { q: "How do payments work?", a: "All payments are processed securely through Artswrk. You receive direct deposits for completed bookings." },
  { q: "How do taxes work?", a: "Artswrk issues a single 1099 at year end covering all your Artswrk earnings, making tax season simple." },
  { q: "Who are the Artswrk clients?", a: "Artswrk clients include dance competitions, conventions, performing arts centers, and studios across the country." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <h5 className="text-sm font-bold text-[#111] pr-4">{q}</h5>
        <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-gray-500 leading-relaxed pb-5">{a}</p>}
    </div>
  );
}

export default function DanceJudges() {
  const [activeJob, setActiveJob] = useState(0);

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      {/* ── Hero ── */}
      <section className="pt-28 pb-20 px-5 lg:px-10 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold artist-grad-text uppercase tracking-widest mb-4">For Judges &amp; Staff</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-5">
            Jobs for Dance<br />Competition &amp;<br />Convention Staff
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Create your Artswrk profile and connect with conventions &amp; competitions across the country.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href="/login" className="inline-block border border-gray-200 text-gray-700 text-sm font-semibold px-7 py-3.5 rounded-full hover:bg-gray-50 transition-colors">Login</a>
            <a href="/login" className="inline-block artist-grad-bg text-white text-sm font-bold px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity">Join</a>
          </div>
        </div>
      </section>

      {/* ── Job Types ── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-8">Jobs For Dance Competition Staff</h2>
            <div className="space-y-1">
              {JOB_TYPES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveJob(i)}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all ${activeJob === i ? "bg-pink-50 border border-pink-100" : "hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.emoji}</span>
                    <div>
                      <p className={`font-bold text-sm ${activeJob === i ? "text-[#ec008c]" : "text-gray-400"}`}>{s.label}</p>
                      {activeJob === i && <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #ec008c, #ff7171)" }}>
              <div className="text-center text-white/80 p-8">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-sm font-semibold">Dance Competition &amp; Convention Staff</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 bg-gray-50 px-5 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold artist-grad-text uppercase tracking-widest mb-3 text-center">HOW IT WORKS</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-12">Find flexible work doing what you love</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img src={step.img} alt={step.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-6">
                  <h3 className="text-base font-black text-[#111] mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQs ── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-sm font-semibold artist-grad-text uppercase tracking-widest mb-3">FAQs</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-500 text-sm">
              Couldn't find the answer you were looking for?{" "}
              <a href="mailto:contact@artswrk.com" className="text-[#ec008c] font-semibold hover:underline">Contact us at contact@artswrk.com</a>
            </p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6">
            {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-5 lg:px-10">
        <div className="max-w-4xl mx-auto artist-grad-bg rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to find your next competition gig?</h2>
          <p className="text-white/80 mb-8">Join thousands of judges and staff already on Artswrk</p>
          <a href="/login" className="inline-block bg-white text-[#ec008c] text-sm font-bold px-8 py-4 rounded-full hover:bg-gray-50 transition-colors">
            Create Free Profile
          </a>
        </div>
      </section>
    </div>
  );
}
