import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
  { emoji: "🎤", label: "Voice Teachers", desc: "Explore vocal instructors for students of all ages, levels, and styles." },
  { emoji: "🎹", label: "Piano Teachers", desc: "Find experienced piano instructors for all skill levels" },
  { emoji: "🎸", label: "Guitar Teachers", desc: "Connect with guitar teachers for acoustic, electric, and bass" },
  { emoji: "🥁", label: "Percussion Teachers", desc: "Hire drum and percussion instructors" },
  { emoji: "🎷", label: "Saxophone Teachers", desc: "Find woodwind and saxophone specialists" },
  { emoji: "🎻", label: "Strings Teachers", desc: "Connect with violin, viola, cello, and bass teachers" },
];

const FAQS = [
  { q: "Are there fees to hire on Artswrk?", a: "Posting jobs and browsing artists is completely free. We charge a small service fee only when a booking is completed." },
  { q: "How do payments work?", a: "Artswrk handles all payments digitally. Once you book an artist, you pay through our secure platform and the artist receives their payment directly." },
  { q: "Is there a cancellation policy?", a: "Yes. Cancellations made 48+ hours before the booking are fully refunded. Cancellations within 48 hours may incur a fee." },
  { q: "Do I have to provide tax documentation?", a: "No. Artswrk handles all 1099 documentation for the artists you hire." },
  { q: "Does Artswrk work with my existing payroll?", a: "Artswrk is a separate payment platform. Artists are paid as independent contractors through Artswrk." },
  { q: "Who are the Artswrk artists?", a: "Artswrk artists are vetted professional music teachers, vocal coaches, and performers across the country." },
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

export default function MusicSchools() {
  const [activeStaff, setActiveStaff] = useState(0);

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      {/* ── Hero ── */}
      <section className="pt-28 pb-20 px-5 lg:px-10 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-4">For Music Schools</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-5">
            The #1 Platform<br />to Hire Music<br />Teachers
          </h1>
          <p className="text-gray-500 text-lg mb-8">Connect with music teachers near you on Artswrk</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
            <a href="/jobs" className="inline-block bg-[#111] text-white text-sm font-bold px-7 py-3.5 rounded-full hover:bg-gray-800 transition-colors">
              Get Started →
            </a>
          </div>
          <p className="text-xs text-gray-400">Join 70+ Music Schools Hiring on Artswrk</p>
        </div>
      </section>

      {/* ── Ticker ── */}
      <section className="py-8 border-y border-gray-100 overflow-hidden bg-gray-50">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
          Music Schools Nationwide Hiring on Artswrk
        </p>
        <div className="relative overflow-hidden">
          <div className="flex gap-16 items-center" style={{ animation: "ticker 30s linear infinite", width: "max-content" }}>
            {["School of Rock", "Fretboard Academy", "Harmony Music School", "Note-Worthy Academy", "Crescendo Music", "Forte Music School", "Melody Lane", "Rhythm & Keys",
              "School of Rock", "Fretboard Academy", "Harmony Music School", "Note-Worthy Academy", "Crescendo Music", "Forte Music School", "Melody Lane", "Rhythm & Keys"].map((name, i) => (
              <div key={i} className="text-xl font-black text-gray-400 tracking-tight whitespace-nowrap flex-shrink-0">{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hire Music Teachers ── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-8">Hire Music Teachers</h2>
            <div className="space-y-1">
              {STAFF_TYPES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStaff(i)}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all ${activeStaff === i ? "bg-orange-50 border border-orange-100" : "hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.emoji}</span>
                    <div>
                      <p className={`font-bold text-sm ${activeStaff === i ? "text-[#F25722]" : "text-gray-400"}`}>{s.label}</p>
                      {activeStaff === i && <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFBC5D, #F25722)" }}>
              <div className="text-center text-white/80 p-8">
                <div className="text-6xl mb-4">🎹</div>
                <p className="text-sm font-semibold">Professional Music Teachers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 bg-gray-50 px-5 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3 text-center">HOW IT WORKS</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-12">One tool to find, hire, and pay artists</h2>
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
            <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3">FAQs</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-500 text-sm">
              Couldn't find the answer you were looking for?{" "}
              <a href="mailto:contact@artswrk.com" className="text-[#F25722] font-semibold hover:underline">Contact us at contact@artswrk.com</a>
            </p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6">
            {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-5 lg:px-10">
        <div className="max-w-4xl mx-auto hirer-grad-bg rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to hire your next music teacher?</h2>
          <p className="text-white/80 mb-8">Join 70+ music schools already hiring on Artswrk</p>
          <a href="/jobs" className="inline-block bg-white text-[#F25722] text-sm font-bold px-8 py-4 rounded-full hover:bg-gray-50 transition-colors">
            Post a Job — It's Free
          </a>
        </div>
      </section>

      <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
