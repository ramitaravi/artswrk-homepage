import { useState } from "react";
import { ChevronDown, ArrowRight, Check } from "lucide-react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { COMPETITION_LOGOS, type CompetitionLogo } from "@/data/competitionLogos";
import { trpc } from "@/lib/trpc";
import { saveInquiryDraft } from "@/lib/inquiryDraft";

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
    a: "It is free to post unlimited jobs on Artswrk. We want you to receive as many candidates as possible! To unlock their applications, you can either do a one-time job unlock or subscribe for unlimited access.",
  },
  {
    q: "How do payments work?",
    a: "Artswrk works with your business. You can pay artists directly through Artswrk with seamless digital payment links, or you can process payment through your regular payroll.",
  },
  {
    q: "Do I have to provide tax documentation?",
    a: "If payment is processed through Artswrk, our partner Stripe Connect handles 1099-NEC tax documentation for eligible artists according to latest IRS guidelines. If payment is processed through your regular payroll, eligible tax documentation will come from your business.",
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

function CompetitionLogoCard({ logo, duplicate = false }: { logo: CompetitionLogo; duplicate?: boolean }) {
  const widthClass = logo.sizing === "wide"
    ? "w-[220px] md:w-[268px]"
    : logo.sizing === "compact"
      ? "w-[160px] md:w-[188px]"
      : "w-[190px] md:w-[224px]";

  return (
    <div
      className={`${widthClass} flex h-[92px] shrink-0 items-center justify-center rounded-2xl border px-4 py-3 shadow-[0_10px_35px_rgba(15,23,42,0.06)] md:h-[108px] md:px-5 md:py-4 ${
        logo.surface === "dark"
          ? "border-white/10 bg-[#08090c]"
          : "border-gray-200/80 bg-white"
      }`}
      aria-hidden={duplicate || undefined}
    >
      {/* rounded-xl on the image itself, not just the card: several of these
          logos are full-bleed exports with their own baked-in background, so
          without it they render as a hard-edged rectangle inside a rounded
          card. object-contain means it's a no-op for transparent marks. */}
      <img
        src={logo.src}
        alt={duplicate ? "" : logo.name}
        loading="lazy"
        decoding="async"
        className="h-full w-full rounded-xl object-contain"
      />
    </div>
  );
}

function CompetitionLogoMarquee() {
  return (
    <div className="relative overflow-hidden" aria-label="Dance competitions hiring on Artswrk">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#f8fafc] to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#f8fafc] to-transparent sm:w-24" />
      <div className="competition-logo-marquee flex w-max">
        {[false, true].map((duplicate) => (
          <div
            key={duplicate ? "duplicate" : "primary"}
            className="flex shrink-0 items-center gap-4 pr-4 md:gap-6 md:pr-6"
            aria-hidden={duplicate || undefined}
          >
            {COMPETITION_LOGOS.map((logo) => (
              <CompetitionLogoCard
                key={`${duplicate ? "duplicate" : "primary"}-${logo.name}`}
                logo={logo}
                duplicate={duplicate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DanceCompetitions() {
  const [activeStaff, setActiveStaff] = useState(0);
  const [, navigate] = useLocation();
  const [competitionName, setCompetitionName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitInquiry = trpc.inquiry.submit.useMutation({
    onSuccess: (data) => {
      // Existing customers can post the job themselves right now — telling them
      // "we'll be in touch" would stall a booking they're ready to make. Their
      // draft rides along so the login round-trip doesn't lose it.
      if (data.existingAccount) {
        saveInquiryDraft({ company: competitionName.trim(), description: message.trim() });
        const next = data.isEnterprise ? "/enterprise?postJob=1" : "/post-job";
        window.location.href = `/login?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`;
        return;
      }
      setSubmitted(true);
    },
    onError: (err) => setError(err.message || "Something went wrong — please try again."),
  });

  function handleGetStarted(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    submitInquiry.mutate({
      email: email.trim(),
      company: competitionName.trim() || undefined,
      message: message.trim() || undefined,
      source: "dance-competitions",
    });
  }

  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />
      {/* ── Hero — split screen: pitch + quick-start job post ──────────────────── */}
      <section className="pt-28 pb-20 px-5 lg:px-10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          {/* Left: pitch */}
          <div>
            <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-4">
              For Dance Competitions
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-5">
              The #1 Platform<br />to Hire Dance<br />Competition Staff
            </h1>
            <p className="text-gray-500 text-lg mb-2 max-w-md">
              Find judges, emcees, and event staff on Artswrk.
            </p>
            <p className="text-gray-400 text-sm max-w-md">
              Post your first job in under a minute — no account needed to get started.
            </p>
          </div>

          {/* Right: quick-start job post */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-7 md:p-8">
            {submitted ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                  <Check size={24} className="text-green-500" />
                </div>
                <h2 className="text-xl font-black text-[#111]">Our team has received your inquiry</h2>
                <p className="text-sm text-gray-500">
                  We'll be in touch shortly{competitionName.trim() ? ` about ${competitionName.trim()}` : ""}. We've sent a
                  confirmation to <span className="font-semibold text-[#111]">{email.trim()}</span>.
                </p>
                <a href="/browse" className="inline-block pt-1 text-sm font-bold text-[#F25722] hover:underline">
                  Browse artists in the meantime →
                </a>
              </div>
            ) : (
            <>
            <p className="text-xs font-bold uppercase tracking-widest text-[#F25722] mb-1.5">Get Started</p>
            <h2 className="text-xl font-black text-[#111] mb-6">Tell us what you need</h2>
            <form onSubmit={handleGetStarted} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Competition Name
                </label>
                <input
                  type="text"
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  placeholder="e.g. Starpower Dance Competition"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@competition.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  What do you need? <span className="font-medium normal-case tracking-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Roles, dates, cities — whatever you already know."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-[#F25722] transition-colors"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={submitInquiry.isPending}
                className="w-full hirer-grad-bg text-white text-sm font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {submitInquiry.isPending ? "Sending…" : <>Get Started <ArrowRight size={15} /></>}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Our team will reach out — usually within one business day.
              </p>
            </form>
            </>
            )}
          </div>
        </div>
      </section>

      {/* ── Logo Ticker ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden border-y border-gray-100 bg-[#f8fafc] py-8 md:py-10">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:mb-8">
          Join Competitions Nationwide Hiring on Artswrk
        </p>
        <CompetitionLogoMarquee />
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
          <div className="relative flex flex-col gap-4">
            <div className="rounded-3xl bg-orange-50 border border-orange-100 p-8">
              <p className="text-4xl font-black text-[#F25722] mb-1">6,000+</p>
              <p className="text-sm font-semibold text-gray-600">Vetted performing arts professionals ready to work</p>
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
        @keyframes competition-logo-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .competition-logo-marquee {
          animation: competition-logo-marquee 42s linear infinite;
          will-change: transform;
        }

        .competition-logo-marquee:hover {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .competition-logo-marquee {
            animation: none;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
