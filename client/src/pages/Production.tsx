import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create your Artist Profile",
    desc: "Share your profile: list services, rates, and availability in one place",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
  },
  {
    step: "02",
    title: "Find & Connect with Clients",
    desc: "Browse open jobs near you - whether for one-time gigs or ongoing work",
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
  { emoji: "🎥", label: "Videographers", desc: "Film events, performances, and productions" },
  { emoji: "📸", label: "Photographers", desc: "Capture events, headshots, and performances" },
  { emoji: "🎛️", label: "Audio Engineers", desc: "Mix and master audio for events and recordings" },
  { emoji: "💡", label: "Lighting Designers", desc: "Design and operate lighting for productions" },
  { emoji: "🎬", label: "Stage Managers", desc: "Manage productions from pre-show to curtain call" },
  { emoji: "🎭", label: "Set Designers", desc: "Design and build sets for productions" },
];

const FAQS = [
  { q: "How do I get booked on Artswrk?", a: "Create your profile, list your services and rates, and apply to open jobs. Clients can also find and book you directly from your profile." },
  { q: "Why do I need to share my rates, location, etc.?", a: "Sharing your rates and location helps clients find the right match quickly. You stay in control of what you share and can update it anytime." },
  { q: "Is there a cancellation policy?", a: "Yes. If you need to cancel, please do so at least 48 hours in advance to avoid any fees." },
  { q: "How do payments work?", a: "All payments are processed securely through Artswrk. You receive direct deposits for completed bookings." },
  { q: "How do taxes work?", a: "Artswrk issues a single 1099 at year end covering all your Artswrk earnings, making tax season simple." },
  { q: "Who are the Artswrk clients?", a: "Artswrk clients include performing arts organizations, dance studios, competitions, conventions, and private clients across the country." },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    features: ["Job Notifications", "Free Profile"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Basic",
    price: "$1.99",
    period: "/month",
    features: ["Apply to unlimited jobs", "Connect with clients", "Get booked & earn digitally"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "PRO",
    price: "$10.99",
    period: "/month",
    features: ["All Basic Features", "Access to PRO Jobs", "Access to Benefits Suite", "1:1 Support from Artswrk Team"],
    cta: "Get Started",
    highlight: true,
  },
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

export default function Production() {
  const [activeJob, setActiveJob] = useState(0);

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />
      {/* ── Hero ── */}
      <section className="pt-28 pb-20 px-5 lg:px-10 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold artist-grad-text uppercase tracking-widest mb-4">For Production Artists</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-5">
            Jobs for<br />Production &amp;<br />Media Artists
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Create your Artswrk profile and connect with clients across the country.
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
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-8">Jobs for Production Artists</h2>
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
                <div className="text-6xl mb-4">🎬</div>
                <p className="text-sm font-semibold">Professional Production Artists</p>
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

      {/* ── Pricing ── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <p className="text-sm font-semibold artist-grad-text uppercase tracking-widest mb-3 text-center">PRICING</p>
        <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-10">Affordable pricing for production artists</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PRICING.map((plan) => (
            <div key={plan.name} className={`rounded-3xl p-8 border ${plan.highlight ? "artist-grad-bg border-transparent" : "border-gray-100 bg-white shadow-sm"}`}>
              <h3 className={`text-lg font-black mb-1 ${plan.highlight ? "text-white" : "text-[#111]"}`}>{plan.name}</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className={`text-4xl font-black ${plan.highlight ? "text-white" : "text-[#111]"}`}>{plan.price}</span>
                <span className={`text-sm mb-1 ${plan.highlight ? "text-white/70" : "text-gray-400"}`}>{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className={`text-sm flex items-center gap-2 ${plan.highlight ? "text-white/90" : "text-gray-600"}`}>
                    <span className="text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/login" className={`block text-center text-sm font-bold py-3 rounded-full transition-all ${plan.highlight ? "bg-white text-[#ec008c] hover:bg-gray-50" : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                {plan.cta}
              </a>
            </div>
          ))}
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
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to find your next production gig?</h2>
          <p className="text-white/80 mb-8">Join thousands of production artists already on Artswrk</p>
          <a href="/login" className="inline-block bg-white text-[#ec008c] text-sm font-bold px-8 py-4 rounded-full hover:bg-gray-50 transition-colors">
            Create Free Profile
          </a>
        </div>
      </section>
    </div>
  );
}
