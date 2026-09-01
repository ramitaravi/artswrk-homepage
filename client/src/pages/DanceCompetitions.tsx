import { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import { COMPETITION_LOGOS, type CompetitionLogo } from "@/data/competitionLogos";
import { trpc } from "@/lib/trpc";
import { saveInquiryDraft } from "@/lib/inquiryDraft";

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

const LABEL = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500";
const FIELD =
  "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-[#F25722]";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <h3 className="pr-4 text-sm font-bold text-[#111]">{q}</h3>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-gray-500">{a}</p>}
    </div>
  );
}

function CompetitionLogoCard({ logo, duplicate = false }: { logo: CompetitionLogo; duplicate?: boolean }) {
  const widthClass =
    logo.sizing === "wide"
      ? "w-[220px] md:w-[268px]"
      : logo.sizing === "compact"
        ? "w-[160px] md:w-[188px]"
        : "w-[190px] md:w-[224px]";

  return (
    <div
      className={`${widthClass} flex h-[92px] shrink-0 items-center justify-center rounded-2xl border px-4 py-3 shadow-[0_10px_35px_rgba(15,23,42,0.06)] md:h-[108px] md:px-5 md:py-4 ${
        logo.surface === "dark" ? "border-white/10 bg-[#08090c]" : "border-gray-200/80 bg-white"
      }`}
      aria-hidden={duplicate || undefined}
    >
      <img
        src={logo.src}
        alt={duplicate ? "" : logo.name}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
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
        {[false, true].map(duplicate => (
          <div
            key={duplicate ? "duplicate" : "primary"}
            className="flex shrink-0 items-center gap-4 pr-4 md:gap-6 md:pr-6"
            aria-hidden={duplicate || undefined}
          >
            {COMPETITION_LOGOS.map(logo => (
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
  const [competitionName, setCompetitionName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitInquiry = trpc.inquiry.submit.useMutation({
    onSuccess: data => {
      if (data.existingAccount) {
        saveInquiryDraft({ company: competitionName.trim(), description: message.trim() });
        const next = data.isEnterprise ? "/enterprise?postJob=1" : "/post-job";
        window.location.href = `/login?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`;
        return;
      }
      setSubmitted(true);
    },
    onError: err => setError(err.message || "Something went wrong — please try again."),
  });

  function handleGetStarted(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="min-h-screen bg-white font-[Poppins,sans-serif]">
      <Navbar />

      <section className="px-5 pb-20 pt-28 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest hirer-grad-text">
              For Dance Competitions
            </p>
            <h1 className="mb-5 text-4xl font-black leading-tight text-[#111] md:text-5xl lg:text-6xl">
              The #1 Platform<br />to Hire Dance<br />Competition Staff
            </h1>
            <p className="mb-2 max-w-md text-lg text-gray-500">
              Find judges, emcees, and event staff on Artswrk.
            </p>
            <p className="max-w-md text-sm text-gray-400">
              Post your first job in under a minute — no account needed to get started.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-xl md:p-8" id="get-started">
            {submitted ? (
              <div className="space-y-3 py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
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
                <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-[#F25722]">Get Started</p>
                <h2 className="mb-6 text-xl font-black text-[#111]">Tell us what you need</h2>
                <form onSubmit={handleGetStarted} className="space-y-4">
                  <div>
                    <label className={LABEL}>Competition Name</label>
                    <input
                      type="text"
                      value={competitionName}
                      onChange={event => setCompetitionName(event.target.value)}
                      placeholder="e.g. Starpower Dance Competition"
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={event => {
                        setEmail(event.target.value);
                        setError("");
                      }}
                      placeholder="you@competition.com"
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>What do you need? (optional)</label>
                    <textarea
                      value={message}
                      onChange={event => setMessage(event.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Roles, dates, cities — whatever you already know."
                      className={`${FIELD} min-h-[96px] resize-y leading-relaxed`}
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitInquiry.isPending}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 hirer-grad-bg"
                  >
                    {submitInquiry.isPending ? "Sending…" : <>Get Started <ArrowRight size={15} /></>}
                  </button>
                  <p className="text-center text-[11px] text-gray-400">
                    Our team will reach out — usually within one business day.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-gray-100 bg-[#f8fafc] py-8 md:py-10">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:mb-8">
          Join Competitions Nationwide Hiring on Artswrk
        </p>
        <CompetitionLogoMarquee />
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          <div>
            <h2 className="mb-8 text-3xl font-black text-[#111] md:text-4xl">Hire Competition Staff</h2>
            <div className="space-y-1">
              {STAFF_TYPES.map((staff, index) => (
                <button
                  key={staff.label}
                  type="button"
                  onClick={() => setActiveStaff(index)}
                  aria-expanded={activeStaff === index}
                  className={`w-full rounded-2xl px-5 py-4 text-left transition-all ${
                    activeStaff === index ? "border border-orange-100 bg-orange-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{staff.emoji}</span>
                    <div>
                      <p className={`text-sm font-bold ${activeStaff === index ? "text-[#F25722]" : "text-gray-400"}`}>
                        {staff.label}
                      </p>
                      {activeStaff === index && <p className="mt-0.5 text-xs text-gray-500">{staff.desc}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex flex-col gap-4">
            <div className="rounded-3xl border border-orange-100 bg-orange-50 p-8">
              <p className="mb-1 text-4xl font-black text-[#F25722]">6,000+</p>
              <p className="text-sm font-semibold text-gray-600">Vetted performing arts professionals ready to work</p>
            </div>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-8">
              <p className="mb-1 text-4xl font-black text-[#111]">3</p>
              <p className="text-sm font-semibold text-gray-600">Average applicants within 24 hours of posting</p>
            </div>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-8">
              <p className="mb-1 text-4xl font-black text-[#111]">Free</p>
              <p className="text-sm font-semibold text-gray-600">To post unlimited jobs — only pay to unlock applicants</p>
            </div>
            <div className="rounded-3xl p-8 hirer-grad-bg">
              <p className="mb-1 text-4xl font-black text-white">50+</p>
              <p className="text-sm font-semibold text-white/80">Cities with active artists on the platform</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-5 py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-widest hirer-grad-text">How It Works</p>
          <h2 className="mb-12 text-center text-3xl font-black text-[#111] md:text-4xl">
            One tool to find, hire, and pay artists
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map(step => (
              <div key={step.step} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img src={step.img} alt={step.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
                <div className="p-6">
                  <h3 className="mb-2 text-base font-black text-[#111]">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest hirer-grad-text">FAQs</p>
            <h2 className="mb-4 text-3xl font-black text-[#111] md:text-4xl">Frequently Asked Questions</h2>
            <p className="text-sm text-gray-500">
              Couldn't find the answer you were looking for?{" "}
              <a href="mailto:contact@artswrk.com" className="font-semibold text-[#F25722] hover:underline">
                Contact us at contact@artswrk.com
              </a>
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white px-6 shadow-sm">
            {FAQS.map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-3xl p-12 text-center hirer-grad-bg">
          <h2 className="mb-4 text-3xl font-black text-white md:text-4xl">Ready to staff your next competition?</h2>
          <p className="mb-8 text-white/80">Join hundreds of competitions already hiring on Artswrk</p>
          <a
            href="/post-job"
            className="inline-block rounded-full bg-white px-8 py-4 text-sm font-bold text-[#F25722] transition-colors hover:bg-gray-50"
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
