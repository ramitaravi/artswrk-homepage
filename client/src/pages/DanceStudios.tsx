import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import { StudioJobWizard } from "@/components/StudioJobWizard";

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
  { emoji: "📆", label: "Weekly Classes", desc: "Hire for part-time or full-time roles at your studio" },
  { emoji: "💬", label: "Substitute Teaching", desc: "Find reliable subs on short notice" },
  { emoji: "⭐️", label: "Guest Classes", desc: "Bring in guest instructors for special workshops" },
  { emoji: "🩰", label: "Private Lessons", desc: "Connect students with private instructors" },
  { emoji: "🏆", label: "Competition Choreography", desc: "Hire choreographers for your competition teams" },
  { emoji: "🎤", label: "Dance Judges", desc: "Find qualified judges for your studio showcases" },
];

const FAQS = [
  { q: "Are there fees to hire on Artswrk?", a: "It is free to post unlimited jobs on Artswrk. We want you to receive as many candidates as possible! To unlock their applications, you can either do a one-time job unlock or subscribe for unlimited access." },
  { q: "How do payments work?", a: "Artswrk works with your business. You can pay artists directly through Artswrk with seamless digital payment links, or you can process payment through your regular payroll." },
  { q: "Do I have to provide tax documentation?", a: "If payment is processed through Artswrk, our partner Stripe Connect handles 1099-NEC tax documentation for eligible artists according to latest IRS guidelines. If payment is processed through your regular payroll, eligible tax documentation will come from your business." },
  { q: "Who are the Artswrk artists?", a: "Artswrk artists are vetted professional dance teachers, choreographers, judges, and performers across the country." },
];

function StudioLeadForm() {
  return (
    <section className="py-16 px-5 lg:px-10 bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3">Get Started Free</p>
        </div>
        <StudioJobWizard
          heading="Post a Job in Minutes"
          subheading="Describe what you need — our AI will build your listing and send it to 6,000+ artists."
          businessType="Dance Studio"
        />
      </div>
    </section>
  );
}

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

export default function DanceStudios() {
  const [activeStaff, setActiveStaff] = useState(0);

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />
      {/* ── Hero ── */}
      <section className="pt-28 pb-20 px-5 lg:px-10 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-4">For Dance Studios</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-5">
            The #1 Platform<br />to Hire Dance<br />Teachers
          </h1>
          <p className="text-gray-500 text-lg mb-8">Connect with dance teachers near you on Artswrk</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
            <a href="#get-started" className="inline-block bg-[#111] text-white text-sm font-bold px-7 py-3.5 rounded-full hover:bg-gray-800 transition-colors">
              Get Started →
            </a>
          </div>
          <p className="text-xs text-gray-400">Join 500+ Studios Hiring on Artswrk</p>
        </div>
      </section>

      {/* ── Ticker ── */}
      <section className="py-8 border-y border-gray-100 overflow-hidden bg-gray-50">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
          Studios Nationwide Hiring on Artswrk
        </p>
        <div className="relative overflow-hidden">
          <div className="flex gap-16 items-center" style={{ animation: "ticker 30s linear infinite", width: "max-content" }}>
            {["Broadway Dance Center", "Steps on Broadway", "Peridance", "Alvin Ailey", "The Ailey School", "Dance New Amsterdam", "Gibney Dance", "Mark Morris Dance Group",
              "Broadway Dance Center", "Steps on Broadway", "Peridance", "Alvin Ailey", "The Ailey School", "Dance New Amsterdam", "Gibney Dance", "Mark Morris Dance Group"].map((name, i) => (
              <div key={i} className="text-xl font-black text-gray-400 tracking-tight whitespace-nowrap flex-shrink-0">{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead Capture Wizard ── */}
      <div id="get-started">
        <StudioLeadForm />
      </div>

      {/* ── Hire Dance Teachers ── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-8">Hire Dance Teachers for...</h2>
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
          <div className="relative flex flex-col gap-4">
            <div className="rounded-3xl bg-orange-50 border border-orange-100 p-8">
              <p className="text-4xl font-black text-[#F25722] mb-1">6,000+</p>
              <p className="text-sm font-semibold text-gray-600">Vetted dance teachers & artists ready to work</p>
            </div>
            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-8">
              <p className="text-4xl font-black text-[#111] mb-1">3</p>
              <p className="text-sm font-semibold text-gray-600">Average applicants within 24 hours of posting</p>
            </div>
            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-8">
              <p className="text-4xl font-black text-[#111] mb-1">Free</p>
              <p className="text-sm font-semibold text-gray-600">To post unlimited jobs — only pay to unlock applicants</p>
            </div>
            <div className="rounded-3xl hirer-grad-bg p-8">
              <p className="text-4xl font-black text-white mb-1">50+</p>
              <p className="text-sm font-semibold text-white/80">Cities with active artists on the platform</p>
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
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to hire your next dance teacher?</h2>
          <p className="text-white/80 mb-8">Join 500+ studios already hiring on Artswrk</p>
          <a href="#get-started" className="inline-block bg-white text-[#F25722] text-sm font-bold px-8 py-4 rounded-full hover:bg-gray-50 transition-colors">
            Post a Job — It's Free
          </a>
        </div>
      </section>

      <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
