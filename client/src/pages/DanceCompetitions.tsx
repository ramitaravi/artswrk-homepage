import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";

// Competition logos (using the artist strip images already in the app + Bubble CDN logos)
const COMPETITION_LOGOS = [
  { name: "N70", url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp", isImage: false },
  { name: "Jump", url: "", isImage: false },
  { name: "DreamMaker", url: "", isImage: false },
  { name: "Believe", url: "", isImage: false },
  { name: "Nexstar", url: "", isImage: false },
  { name: "Revel Talent Co", url: "", isImage: false },
  { name: "Starpower", url: "", isImage: false },
  { name: "Hollywood Vibe", url: "", isImage: false },
];

// How it works screenshots (from the existing artist strip CDN images)
const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Post Jobs & Browse Artists",
    desc: "Post a job or browse thousands of vetted professional freelance artists",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
  },
  {
    step: "02",
    title: "Book & Schedule Artists",
    desc: "View and schedule available artists on one simple screen. No more emails or FB groups",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-2-Vo37fp95iDpS9ybaZkYWJB.webp",
  },
  {
    step: "03",
    title: "Pay Artists Online",
    desc: "Pay artists digitally with a simple payment link. We take care of the rest!",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-3-hjiUkBU9Pft72RAaeq8oxW.webp",
  },
];

const STAFF_TYPES = [
  { emoji: "🏆", label: "Dance Judges", desc: "Certified judges with competition experience across all styles." },
  { emoji: "🎤", label: "Announcers", desc: "Keep your event flowing with professional emcees and energetic hosts." },
  { emoji: "🎥", label: "Videographers", desc: "Capture every performance with professional quality footage." },
  { emoji: "🧑‍💻", label: "Tabulators", desc: "Accurate, fast score tabulation to keep your event on schedule." },
  { emoji: "🎬", label: "Backstage Managers", desc: "Keep competitors organized and backstage running smoothly." },
  { emoji: "🛍️", label: "Merchandise Sales", desc: "Experienced sales staff to manage your merch table." },
];

const FAQS = [
  {
    q: "Are there fees to hire on Artswrk?",
    a: "Posting a job is free. We charge a small service fee when you complete a booking through the platform.",
  },
  {
    q: "How do payments work?",
    a: "Payments are processed securely through Artswrk. Once you confirm an artist, you'll receive a simple payment link. We handle all the payment processing.",
  },
  {
    q: "Is there a cancellation policy?",
    a: "Cancellation policies vary by booking. Please review the terms when confirming your artist. Artswrk recommends communicating any changes as early as possible.",
  },
  {
    q: "Do I have to provide tax documentation?",
    a: "Artswrk handles 1099 documentation for artists paid through the platform, making tax season easier for both hirers and artists.",
  },
  {
    q: "Does Artswrk work with my existing payroll?",
    a: "Yes! Artswrk can integrate with your existing payroll workflow or operate as a standalone payment solution.",
  },
  {
    q: "Who are the Artswrk artists?",
    a: "Artswrk artists are vetted performing arts professionals including dancers, instructors, judges, emcees, videographers, and more — all with verified experience.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <h5 className="text-sm font-bold text-[#111] pr-4">{q}</h5>
        <ChevronDown
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="text-sm text-gray-500 leading-relaxed pb-5">{a}</p>
      )}
    </div>
  );
}

export default function DanceCompetitions() {
  const [activeStaff, setActiveStaff] = useState(0);

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />
      {/* ── Hero ─────────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 px-5 lg:px-10 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-4">
            For Dance Competitions
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-5">
            The #1 Platform<br />to Hire Dance<br />Competition Staff
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Find judges, emcees, and event staff on Artswrk
          </p>
          <a
            href="/jobs"
            className="inline-block bg-[#111] text-white text-sm font-bold px-7 py-3.5 rounded-full hover:bg-gray-800 transition-colors"
          >
            Get Started →
          </a>
        </div>
      </section>

      {/* ── Logo Ticker ─────────────────────────────────────────────────── */}
      <section className="py-8 border-y border-gray-100 overflow-hidden bg-gray-50">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
          Join Competitions Nationwide Hiring on Artswrk
        </p>
        <div className="relative overflow-hidden">
          <div
            className="flex gap-16 items-center"
            style={{
              animation: "ticker 30s linear infinite",
              width: "max-content",
            }}
          >
            {[...COMPETITION_LOGOS, ...COMPETITION_LOGOS].map((logo, i) => (
              <div
                key={i}
                className="text-xl font-black text-gray-400 tracking-tight whitespace-nowrap flex-shrink-0"
              >
                {logo.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hire Competition Staff ──────────────────────────────────────── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-8">
              Hire Competition Staff
            </h2>
            <div className="space-y-1">
              {STAFF_TYPES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStaff(i)}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all ${
                    activeStaff === i
                      ? "bg-orange-50 border border-orange-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.emoji}</span>
                    <div>
                      <p
                        className={`font-bold text-sm ${
                          activeStaff === i ? "text-[#F25722]" : "text-gray-400"
                        }`}
                      >
                        {s.label}
                      </p>
                      {activeStaff === i && (
                        <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {/* Right: dancer photo */}
          <div className="relative">
            <div
              className="aspect-[3/4] rounded-3xl overflow-hidden flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #c0392b, #8e1010)" }}
            >
              {/* Placeholder for the red-background dancer photo */}
              <div className="text-center text-white/60 p-8">
                <div className="text-6xl mb-4">💃</div>
                <p className="text-sm font-semibold">Professional Dance Competition Staff</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 px-5 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3 text-center">
            HOW IT WORKS
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-12">
            One tool to find, hire, and pay artists
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src={step.img}
                    alt={step.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-base font-black text-[#111] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQs ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3">
              FAQs
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-sm">
              Couldn't find the answer you were looking for?{" "}
              <a
                href="mailto:contact@artswrk.com"
                className="text-[#F25722] font-semibold hover:underline"
              >
                Contact us at contact@artswrk.com
              </a>
            </p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6">
            {FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5 lg:px-10">
        <div className="max-w-4xl mx-auto hirer-grad-bg rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Ready to staff your next competition?
          </h2>
          <p className="text-white/80 mb-8">
            Join hundreds of competitions already hiring on Artswrk
          </p>
          <a
            href="/jobs"
            className="inline-block bg-white text-[#F25722] text-sm font-bold px-8 py-4 rounded-full hover:bg-gray-50 transition-colors"
          >
            Post a Job — It's Free
          </a>
        </div>
      </section>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
