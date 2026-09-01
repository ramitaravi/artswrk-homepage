import { useState } from "react";
import { ChevronDown, ArrowRight, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { COMPETITION_LOGOS, type CompetitionLogo } from "@/data/competitionLogos";
import { trpc } from "@/lib/trpc";
import { saveInquiryDraft } from "@/lib/inquiryDraft";

// The mock board in "How it WRKs" — the design's own sample rows, shown as an
// illustration of the enterprise dashboard rather than live data.
const BOARD_JOBS = [
  { title: "Judges", grad: "linear-gradient(150deg,#4A90E2 0%,#0B3C7A 100%)" },
  { title: "General Staff", grad: "linear-gradient(150deg,#B06CF0 0%,#EF5E95 100%)" },
  { title: "Judge", grad: "linear-gradient(150deg,#7AA7F0 0%,#C77DF5 100%)" },
  { title: "Merchandise Sales", grad: "linear-gradient(150deg,#F278A8 0%,#B06CF0 100%)" },
];

const BOARD_APPLICANTS = [
  { initials: "JF", name: "James Felton", grad: "linear-gradient(150deg,#EF1187 0%,#FF7171 100%)" },
  { initials: "FC", name: "Faith Coleman", grad: "linear-gradient(150deg,#FFBC5D 0%,#F25722 100%)" },
  { initials: "AC", name: "Alexa Cutrone", grad: "linear-gradient(150deg,#6061F6 0%,#EF5E95 100%)" },
  { initials: "AE", name: "Annie Ellertsen", grad: "linear-gradient(150deg,#4A49CE 0%,#6061F6 100%)" },
  { initials: "SA", name: "Sophie Ackerman", grad: "linear-gradient(150deg,#F278A8 0%,#FBAD6D 100%)" },
];

const BOARD_ORG = "Imagine National Dance Challenge";

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

const LABEL = "mb-1.5 block text-xs font-bold uppercase tracking-[0.05em] text-gray-500";
const FIELD =
  "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-[#F25722]";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#0E0E17]/10 pt-2 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-6 py-[18px] text-left"
      >
        <span className="text-base font-bold tracking-[-0.01em] text-[#0E0E17] md:text-[19px]">{q}</span>
        <ChevronDown
          size={22}
          strokeWidth={2}
          className={`flex-none text-[#0E0E17] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-6 text-base leading-relaxed text-[#6E7690]">{a}</p>
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
      {/* ── Hero — pitch + enterprise job form ──────────────────────────── */}
      <section id="top" className="px-5 pt-28 pb-20 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] hirer-grad-text">
              For Dance Competitions
            </p>
            <h1 className="mb-7 text-4xl font-black leading-[1.12] text-[#111] md:text-5xl lg:text-6xl">
              Hire Dance<br />Competition Staff on{" "}
              <span className="hirer-grad-text">Artswrk</span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-gray-500">
              Find judges, emcees, and event staff on Artswrk.
            </p>
          </div>

          {/* Enterprise inquiry form */}
          <div
            id="get-started"
            className="rounded-3xl border border-gray-100 bg-white p-7 md:p-8"
            style={{ boxShadow: "0 20px 45px rgba(15,23,42,0.10)" }}
          >
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
                <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#F25722]">
                  Artswrk Enterprise
                </p>
                <h2 className="mb-6 text-xl font-black text-[#111]">Post Your Competition Job</h2>
                <form onSubmit={handleGetStarted} className="flex flex-col gap-4">
                  <div>
                    <label className={LABEL}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder="you@competition.com"
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Competition Name</label>
                    <input
                      type="text"
                      value={competitionName}
                      onChange={(e) => setCompetitionName(e.target.value)}
                      placeholder="e.g. REVEL Dance Convention"
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Job Description</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                      maxLength={2000}
                      placeholder="e.g. Looking for 3 judges for our Orlando regional, Mar 14–16. Travel and hotel covered — must have national competition experience."
                      className={`${FIELD} min-h-[150px] resize-y leading-relaxed`}
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

      {/* ── Logo Ticker ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden border-y border-gray-100 bg-[#f8fafc] py-8 md:py-10">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:mb-8">
          Join Competitions Nationwide Hiring on Artswrk
        </p>
        <CompetitionLogoMarquee />
      </section>

      {/* ── Hire Competition Staff ──────────────────────────────────────── */}
      <section id="staff" className="mx-auto max-w-[1200px] px-5 pt-20 lg:px-8 lg:pt-28">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#0E0E17] md:text-[38px]">
              Hire Competition Staff
            </h2>
            {/* Reads as a list, not a set of buttons: only the open row carries
                its description, the rest stay quiet until chosen. */}
            <div className="mt-8 border-t border-[#0E0E17]/10">
              {STAFF_TYPES.map((s, i) => {
                const open = activeStaff === i;
                return (
                  <button
                    key={s.label}
                    onClick={() => setActiveStaff(i)}
                    aria-expanded={open}
                    className="w-full cursor-pointer border-b border-[#0E0E17]/10 py-5 text-left"
                  >
                    <div
                      className={`flex items-center gap-2.5 text-lg font-bold tracking-[-0.01em] transition-colors md:text-[22px] ${
                        open ? "text-[#0E0E17]" : "text-[#9AA0AE]"
                      }`}
                    >
                      <span className="flex-none">{s.emoji}</span>
                      <span>{s.label}</span>
                    </div>
                    {open && (
                      <div className="mt-2.5 text-base leading-relaxed text-[#6E7690]">{s.desc}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="relative w-full overflow-hidden rounded-3xl"
            style={{ aspectRatio: "1 / 1", backgroundImage: "linear-gradient(150deg, #E01B1B 0%, #8E0B0B 100%)" }}
          >
            <img
              src="/testimonials/competition-imagine.png"
              alt="A competition hiring judges and staff on Artswrk"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── How it WRKs ─────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-[1200px] px-5 pt-20 lg:px-8 lg:pt-28">
        <div className="grid items-start gap-9 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="text-base font-medium text-gray-500">For Competitions</div>
            <h2 className="mt-3.5 text-[30px] font-extrabold tracking-[-0.02em] text-[#F25722] md:text-[44px]">
              How it WRKs
            </h2>
            <img
              src="/testimonials/competition-imagine.png"
              alt="“I posted a job at 7am and had a judge on a train to us by 10am — and she was absolutely AMAZING! I’m blown away by Artswrk.” — Shaun M., Imagine Dance Challenge, Dance One"
              loading="lazy"
              decoding="async"
              className="mt-9 block w-full rounded-2xl"
              style={{ boxShadow: "0 1px 2px rgba(14,14,23,0.04), 0 18px 44px -20px rgba(14,14,23,0.18)" }}
            />
          </div>

          {/* Illustration of the enterprise dashboard. Deliberately static and
              decorative — the names are the design's sample data, not real
              applicants, so it must never be wired to live records. */}
          <div
            className="overflow-hidden rounded-[20px] bg-white"
            style={{ border: "1px solid rgba(14,14,23,0.10)" }}
            aria-hidden="true"
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <div
                  className="relative h-[88px] w-[88px] overflow-hidden rounded-full"
                  style={{ backgroundImage: "linear-gradient(150deg,#7AA7F0 0%,#C77DF5 100%)" }}
                >
                  <img
                    src="/manus-storage/imagine-national-dance-challenge_dbc06acd.png"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full bg-white object-contain p-2"
                  />
                </div>
                <div className="mt-3.5 text-xl font-bold text-[#0E0E17]">{BOARD_ORG}</div>
              </div>
              <span
                className="whitespace-nowrap rounded-full px-5 py-[11px] text-[13px] font-semibold text-[#0E0E17]"
                style={{ border: "1px solid rgba(14,14,23,0.16)" }}
              >
                + Post Job
              </span>
            </div>

            <div className="flex gap-6 px-6 pt-5" style={{ borderBottom: "1px solid rgba(14,14,23,0.08)" }}>
              <span className="border-b-2 border-[#0E0E17] pb-2.5 text-sm font-bold text-[#0E0E17]">Jobs</span>
              <span className="pb-2.5 text-sm text-[#737373]">Companies</span>
              <span className="pb-2.5 text-sm text-[#737373]">Artists</span>
            </div>

            <div className="grid gap-4 p-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
              <div className="flex flex-col gap-2.5">
                {BOARD_JOBS.map((j, i) => (
                  <div
                    key={`${j.title}-${i}`}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ border: "1px solid rgba(14,14,23,0.10)" }}
                  >
                    <div className="h-[38px] w-[38px] flex-none rounded-full" style={{ backgroundImage: j.grad }} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#0E0E17]">{j.title}</div>
                      <div className="truncate text-xs text-[#737373]">{BOARD_ORG}</div>
                      <div className="mt-0.5 text-[11.5px] text-gray-400">📍 Work from Anywhere</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-4" style={{ border: "1px solid rgba(14,14,23,0.10)" }}>
                <div className="text-sm font-bold text-[#0E0E17]">Applications</div>
                <div className="mt-3.5 flex flex-col gap-3.5">
                  {BOARD_APPLICANTS.map((a) => (
                    <div key={a.initials} className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold tracking-[-0.02em] text-white"
                        style={{ backgroundImage: a.grad }}
                      >
                        {a.initials}
                      </div>
                      <div>
                        <div className="text-[12.5px] font-bold text-[#0E0E17]">{a.name}</div>
                        <div className="text-[11.5px] text-[#737373]">Judge</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs ────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-[1200px] px-5 pt-20 lg:px-8 lg:pt-28">
        <div className="grid items-start gap-9 lg:grid-cols-2 lg:gap-16">
          <div className="flex min-h-full flex-col">
            <p className="text-[15px] font-semibold text-[#F25722]">FAQs</p>
            <h2 className="mt-5 text-[30px] font-bold leading-[1.45] tracking-[-0.02em] text-[#0E0E17] md:text-[44px]">
              Frequently Asked Questions
            </h2>
            {/* mt-auto pins this to the bottom of the column, matching the
                design's balance against the taller FAQ list beside it. */}
            <p className="mb-0 mt-auto pt-12 text-base leading-relaxed text-[#525252]">
              Couldn't find the answer you were looking for? Contact us at{" "}
              <a href="mailto:contact@artswrk.com" className="font-semibold text-[#F25722] hover:underline">
                contact@artswrk.com
              </a>
            </p>
          </div>
          <div>
            {FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl rounded-[28px] px-6 py-11 text-center md:px-12 md:py-16 hirer-grad-bg">
          <h2 className="text-[28px] font-extrabold tracking-[-0.02em] text-white text-balance md:text-[40px]">
            Ready to staff your next competition?
          </h2>
          <p className="mx-auto mt-4 max-w-[30em] text-base leading-relaxed text-white/85">
            Join the industry's best competitions hiring on Artswrk!
          </p>
          <a
            href="#get-started"
            className="mt-7 inline-block rounded-full bg-white px-8 py-4 text-[15px] font-bold text-[#F25722] transition-colors hover:bg-gray-50"
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
