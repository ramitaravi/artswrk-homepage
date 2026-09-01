/*
 * ARTSWRK HOMEPAGE — v4.0
 * Ported from the "MAIN v2" landing-page artboard.
 *
 * Section order matches the design: hero + audience-toggle signup card,
 * trusted-by row, For Hirers business cards, Browse Artists marquee,
 * For Artists jobs list, dual-column How it works, FAQs, gradient CTA, footer.
 *
 * Live data: the jobs list and the artist marquee read the same public tRPC
 * queries the /jobs and /browse pages use. Studio logos and testimonial
 * portraits are still the design's placeholders — no assets supplied yet.
 */

import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Building2, Trophy, Music4 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { buildHomepageAuthDestination, HOMEPAGE_JOB_DRAFT_KEY } from "@/lib/homepageSignup";
import { HOME_FAQS } from "@/data/homepageFaqs";
import Navbar from "@/components/Navbar";

// ─── Design tokens (from the artboard) ────────────────────────────────────────
const INK = "#0E0E17";
const BODY = "#525252";
const MUTED = "#737373";
const FAINT = "#9E9E9E";
const HAIRLINE = "rgba(14,14,23,0.12)";
const ARTIST_GRAD = "linear-gradient(135deg,#EF1187 0%,#FF7171 100%)";
const HIRER_GRAD = "linear-gradient(135deg,#FFBC5D 0%,#F25722 100%)";

const AVATAR_GRADS = [
  "linear-gradient(135deg,#EF1187 0%,#FF7171 100%)",
  "linear-gradient(135deg,#FFBC5D 0%,#F25722 100%)",
  "linear-gradient(135deg,#6061F6 0%,#EF5E95 100%)",
  "linear-gradient(135deg,#F278A8 0%,#FBAD6D 100%)",
  "linear-gradient(135deg,#4A49CE 0%,#6061F6 100%)",
  "linear-gradient(135deg,#FE6B72 0%,#FFBC5D 100%)",
];

// ─── Fallback content ─────────────────────────────────────────────────────────

/** Shown in the artist marquee before the browse query resolves (or if it's empty). */
/**
 * Hand-picked artists for the Browse Artists strip, with the credit Ramita
 * supplied for each. Curated rather than pulled from the live browse query:
 * the point of this row is a specific, recognisable line-up, and a query
 * returns whoever happens to sort first.
 *
 * Photos are the artists' own profile pictures, each verified loading.
 */
const FEATURED_ARTISTS = [
  { id: 27270615, name: "Ryan Hayes", credit: "Pilobolus Dance Theater", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1785158745561x708935897910109700/Headshot.Ryan%20Hayes.jpg" },
  { id: 27270422, name: "Bella Calafiura", credit: "Radio City Christmas Spectacular", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1781532473309x714541467775933400/BellaCalafiura_084%20%281%29.jpg" },
  { id: 27270705, name: "Benjamin Wheelwright", credit: "Harry Potter and the Cursed Child, Broadway", role: "Acting Coach", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1787174479725x359173062518103100/ben6.jpeg" },
  { id: 781199, name: "Michael Everett", credit: "Aladdin on Broadway", role: "Photographer / Videographer", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1765220068031x495383130039776830/22_01681.jpeg" },
  { id: 1020911, name: "Allison Canales", credit: "Videographer for DanceOne", role: "Videographer", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1782431046010x622558634502267100/IMG_4086.jpeg" },
  { id: 780203, name: "Justina Aveyard", credit: "Moulin Rouge! on Broadway", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1780683669580x143550847949425630/Screenshot%202026-06-05%20at%202.21.04%E2%80%AFPM.png" },
  { id: 1021939, name: "Christine Sienicki", credit: "Radio City Rockette", role: "Dance Educator", photo: "https://s3.amazonaws.com/appforest_uf/f1677184223939x811454115724473500/1677183880952x214559943653407800.jpeg" },
  { id: 1020350, name: "Michael Pesko", credit: "Dancer for Lady Gaga", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1768507043717x114736538098918030/Screenshot%202026-01-15%20at%2012.30.35%E2%80%AFPM.png" },
  { id: 1020686, name: "Jaryd Farcon", credit: "Alvin Ailey · Dancing with the Stars", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1723610048628x189869565834476670/Ailey%20II%27s%20Jaryd%20Farcon.%20Photo%20by%20Nir%20Arieli_527.JPG" },
  { id: 1110666, name: "Caro Mojena", credit: "University of Miami Dance Team", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1776343005695x648752884804522500/Facetune_08-01-2026-16-51-58_VSCO.jpeg" },
  { id: 780275, name: "Parth Sethi", credit: "Broadway Dance Center Faculty", role: "Dance Educator", photo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1780507266006x551508103255449660/IMG_0063.JPG" },
];


function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "AW").toUpperCase();
}


// ─── Shared bits ──────────────────────────────────────────────────────────────

const SECTION = "mx-auto w-full max-w-[1200px]";
const SECTION_PAD = { padding: "clamp(72px,9vw,112px) clamp(20px,4vw,32px) 0" };

function Eyebrow({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      className="text-xs font-bold uppercase"
      style={{ letterSpacing: "0.14em", color }}
    >
      {children}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function SignupCard() {
  const [mode, setMode] = useState<"client" | "artist">("client");
  const [email, setEmail] = useState("");
  const [hiringFor, setHiringFor] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [, navigate] = useLocation();
  const isArtist = mode === "artist";
  const checkEmail = trpc.auth.checkEmailExists.useMutation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      if (!isArtist && hiringFor.trim()) {
        sessionStorage.setItem(HOMEPAGE_JOB_DRAFT_KEY, hiringFor.trim());
      }

      const { exists } = await checkEmail.mutateAsync({ email: normalizedEmail });
      navigate(buildHomepageAuthDestination({ email: normalizedEmail, role: mode, exists }));
    } catch (error) {
      console.error("Unable to continue from the homepage signup card", error);
      setSubmitError("We couldn't check your account. Please try again.");
    }
  }

  const pill = (active: boolean) => ({
    background: active ? "#fff" : "transparent",
    color: active ? INK : MUTED,
  });

  return (
    <div
      className="rounded-3xl bg-white"
      style={{
        border: `1px solid ${HAIRLINE}`,
        padding: "clamp(22px,2.5vw,28px)",
        boxShadow: "0 12px 32px rgba(14,14,23,0.08)",
      }}
    >
      <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "#F3F3FC" }}>
        <button
          type="button"
          onClick={() => setMode("client")}
          className="rounded-full py-[11px] text-[13px] font-bold transition-all duration-150"
          style={pill(!isArtist)}
        >
          For Hirers
        </button>
        <button
          type="button"
          onClick={() => setMode("artist")}
          className="rounded-full py-[11px] text-[13px] font-bold transition-all duration-150"
          style={pill(isArtist)}
        >
          For Artists
        </button>
      </div>

      <div
        className="mt-6 font-bold"
        style={{ fontSize: "clamp(19px,2vw,22px)", letterSpacing: "-0.015em" }}
      >
        {isArtist ? "Get Hired on Artswrk!" : "Post Your First Job - It's Free!"}
      </div>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY }}>
        {isArtist
          ? "One profile. Paid work near you, on the days you choose."
          : "Whether a last minute job or long term hire, share your role and dates — we'll share it with our artist network."}
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="h-[52px] w-full rounded-xl px-[18px] text-[15px] outline-none focus:border-[#0E0E17]"
          style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
        />
        {!isArtist && (
          <textarea
            value={hiringFor}
            onChange={(e) => setHiringFor(e.target.value)}
            placeholder="Describe the role, dates, location, and rate..."
            rows={4}
            className="min-h-[112px] w-full resize-y rounded-xl px-[18px] py-4 text-[15px] leading-relaxed outline-none focus:border-[#0E0E17]"
            style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
          />
        )}
        <button
          type="submit"
          disabled={checkEmail.isPending}
          className="h-[52px] rounded-xl text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:cursor-wait disabled:opacity-65 hover:bg-[#3D3D4A]"
          style={{ background: INK }}
        >
          {checkEmail.isPending ? "Checking your account..." : isArtist ? "Join Now →" : "Post a Job →"}
        </button>
        {submitError ? <p className="m-0 text-xs font-medium text-red-600" role="alert">{submitError}</p> : null}
      </form>

      <div className="mt-3 text-xs" style={{ color: MUTED }}>
        {isArtist ? "Free to join. You keep your rate." : "Takes about 60 seconds."}
      </div>
    </div>
  );
}

/**
 * Real customer testimonials, one per business type. Each `card` is the
 * finished design export in client/public/testimonials; the quote/tag/who
 * fields remain as the image's alt text and as a text fallback if an asset
 * ever goes missing.
 */
const BIZ_TYPES = [
  {
    title: "Dance Studios",
    card: "/testimonials/studio-lambarri.png",
    blurb: "Weekly classes, last-minute subs, guest artists and choreo",
    icon: Building2,
    cta: "Post a Studio Job",
    href: "/dance-studios",
    tag: "RELIABLE TEACHERS",
    quote: "“We just wanted to follow up to tell you that we LOVE working with your teachers — they’re always reliable and committed.”",
    who: "Alexa S., Owner, Lambarri Dance Arts",
  },
  {
    title: "Dance Competitions",
    card: "/testimonials/competition-imagine.png",
    blurb: "Judges, emcees, tabulators, crew and photo/video",
    icon: Trophy,
    cta: "Post a Competition Job",
    href: "/dance-competitions",
    tag: "SAME-DAY JUDGE",
    quote: "“I posted a job at 7am and had a judge on a train to us by 10am — and she was absolutely AMAZING! I’m blown away by Artswrk.”",
    who: "Shaun M., Imagine Dance Challenge, Dance One",
  },
  {
    title: "Music Schools",
    card: "/testimonials/musicschool-ensemble.png",
    blurb: "Voice, piano, acting, and instrument teachers",
    icon: Music4,
    cta: "Post a School Job",
    href: "/music-schools",
    tag: "FILLED A 4-MONTH SEARCH",
    quote: "“After a difficult 4ish month search, we are sending an offer letter for our teaching position! We couldn’t have found this candidate without Artswrk.”",
    who: "Allison L., Recruiting @ Ensemble Performing Arts",
  },
];

/**
 * The four example jobs in the For Artists list. Static and curated: they
 * exist to show the KIND of work on Artswrk, so they stay stable rather than
 * reflecting whatever happens to have been posted most recently. This row used
 * to render the live jobs query, which meant a test post could become the
 * site's shop window.
 */
const FALLBACK_JOBS = [
  { title: "Emcee (Touring)", org: "REVEL Dance Convention", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1773623236874x382468136169884900/REVEL%20Dance%20Convention.jpeg", city: "Remote", pay: "Remote", posted: "PRO job" },
  { title: "Judge", org: "Journey Dance Competition", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1770425320895x475037908411778600/download.jpeg", city: "Work from anywhere", pay: "Per event", posted: "PRO job" },
  { title: "Executive Assistant", org: "Ensemble Performing Arts", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1787025383139x307662120689587800/EMS-square-logo%20%281%29.webp", city: "Remote", pay: "Competitive salary", posted: "PRO job" },
  { title: "Competition Photographers", org: "Thunderstruck Dance Competition", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1769117147013x594580362321450200/image_processing20220906-9-1hh0ccy%20%281%29.png", city: "Multiple dates", pay: "Per event", posted: "PRO job" },
];

const CLIENT_STEPS = [
  { n: "01", title: "Post a Job", body: "The role, the dates, the rate. Live in about a minute." },
  { n: "02", title: "View Submissions", body: "Receive emails with applicants resumes & profiles" },
  { n: "03", title: "Hire and pay in one place", body: "Keep tabs on your hires in one seamless dashboard" },
];

const ARTIST_STEPS = [
  { n: "01", title: "Create your Artist Profile", body: "Your disciplines, your rates, your media" },
  { n: "02", title: "Browse Jobs", body: "Matching jobs land in your feed. No proposals to write." },
  { n: "03", title: "Get booked and paid", body: "Bookings are confirmed in-app and paid out after the session." },
];

function Hero() {
  return (
    <section
      id="top"
      className={`${SECTION} grid items-center gap-5 px-5 pt-32 sm:gap-9 sm:px-8 sm:pt-[104px] lg:gap-[72px]`}
      style={{
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))",
      }}
    >
      <div>
        <h1
          className="m-0 text-[clamp(46px,13vw,56px)] font-extrabold sm:text-[clamp(48px,8vw,76px)]"
          style={{ lineHeight: 1.02, letterSpacing: "-0.035em" }}
        >
          Hire{" "}
          <span style={{ backgroundImage: ARTIST_GRAD, backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
            Artists
          </span>
          ,
          <br />
          Find&nbsp;
          <span style={{ backgroundImage: HIRER_GRAD, backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
            WRK
          </span>{" "}
          on Artswrk
        </h1>
        <h2
          className="mt-6 max-w-[34em] font-medium leading-relaxed"
          style={{ fontSize: "clamp(17px,1.6vw,20px)", color: BODY, textWrap: "pretty" as any }}
        >
          Hire Dance Teachers, Dance Competition Staff, Photographers, Videographers and more on Artswrk.
        </h2>
        <p className="mt-3 max-w-[40em] text-sm leading-relaxed sm:text-[15px]" style={{ color: MUTED }}>
          From ballet teachers and choreographers to judges and music instructors, Artswrk helps hirers find local talent and artists discover dance teacher jobs, competition jobs, judging jobs, and other performing arts work.
        </p>
      </div>

      <SignupCard />
    </section>
  );
}

// ─── For hirers ───────────────────────────────────────────────────────────────

function ForHirers() {
  // Which business type is showing. The three rows on the left are the tabs;
  // the testimonial on the right follows. Mirrors the For Artists section
  // below, which is heading-and-CTA on the left, list on the right.
  const [active, setActive] = useState(0);
  // Auto-advance, until someone takes over. Once a person picks a type we stop
  // rotating — moving the thing they just chose out from under them is worse
  // than a static panel.
  const [userPicked, setUserPicked] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (userPicked || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % BIZ_TYPES.length), 5200);
    return () => clearInterval(t);
  }, [userPicked, paused]);

  const shown = BIZ_TYPES[active];

  const choose = (i: number) => { setActive(i); setUserPicked(true); };

  return (
    <section id="hirers" className={SECTION} style={SECTION_PAD}>
      <div
        className="grid items-start"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: "clamp(36px,5vw,64px)",
        }}
      >
        <div>
          <Eyebrow color="#F25722">For hirers</Eyebrow>
          <h2
            className="mt-4 font-bold"
            style={{ fontSize: "clamp(30px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-0.03em", textWrap: "balance" as any }}
          >
            Post a Job Today
          </h2>

          <div className="mt-7 flex flex-col gap-2.5">
            {BIZ_TYPES.map((b, i) => {
              const Icon = b.icon;
              const on = active === i;
              return (
                <button
                  key={b.title}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(i)}
                  className="flex w-full items-start gap-3.5 rounded-2xl bg-white px-4 py-3.5 text-left transition-all duration-150"
                  style={{
                    border: on ? "1px solid #F25722" : `1px solid ${HAIRLINE}`,
                    boxShadow: on ? "0 0 0 1px #F25722, 0 8px 24px rgba(242,87,34,0.08)" : undefined,
                  }}
                >
                  <Icon size={22} strokeWidth={1.7} color={on ? "#F25722" : INK} className="mt-0.5 flex-none" />
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold" style={{ letterSpacing: "-0.01em" }}>
                      {b.title}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug" style={{ color: BODY }}>
                      {b.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/join?role=client"
              className="rounded-xl px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#3D3D4A]"
              style={{ background: INK }}
            >
              {shown.cta} &rarr;
            </Link>
          </div>
        </div>

        {/* The testimonial for whichever type is selected. Exports are cropped
            tight to the card with transparent corners, so the radius and shadow
            here are the page's own and identical across all three. */}
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <img
            key={shown.card}
            src={shown.card}
            alt={`${shown.quote} — ${shown.who}`}
            className="block w-full"
            style={{
              borderRadius: "clamp(14px,1.4vw,20px)",
              boxShadow: "0 1px 2px rgba(14,14,23,0.04), 0 18px 44px -20px rgba(14,14,23,0.18)",
              animation: "hirerFade 260ms ease-out",
            }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />

          {/* Progress dots — also a control, so the rotation is never the only
              way to reach a testimonial. */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {BIZ_TYPES.map((b, i) => (
              <button
                key={`dot-${b.title}`}
                type="button"
                aria-label={`Show ${b.title} testimonial`}
                aria-pressed={active === i}
                onClick={() => choose(i)}
                className="h-2 rounded-full transition-all duration-200"
                style={{
                  width: active === i ? 22 : 8,
                  background: active === i ? "#F25722" : "rgba(14,14,23,0.15)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hirerFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { @keyframes hirerFade { from { opacity: 1 } to { opacity: 1 } } }
      `}</style>
    </section>
  );
}

// ─── Browse artists marquee ───────────────────────────────────────────────────

function BrowseArtistsMarquee() {

  // The curated line-up, always. This used to render whatever
  // trpc.artists.browse returned first; that query is gone rather than left
  // running unused, since nothing reads it now.
  const cards = useMemo(
    () =>
      FEATURED_ARTISTS.map((a, i) => ({
        key: `f-${a.id}`,
        name: a.name,
        role: a.credit,
        sub: a.role,
        photo: a.photo as string | null,
        grad: AVATAR_GRADS[i % AVATAR_GRADS.length],
      })),
    []
  );

  const doubled = [...cards, ...cards];

  return (
    <section style={{ padding: "clamp(44px,6vw,72px) 0 0" }}>
      <div
        className={`${SECTION} flex flex-wrap items-baseline justify-between gap-6`}
        style={{ padding: "0 clamp(20px,4vw,32px)" }}
      >
        <h2 className="m-0 font-bold" style={{ fontSize: "clamp(24px,2.6vw,30px)", letterSpacing: "-0.02em" }}>
          Join or hire 6,000+ of the industry&rsquo;s best artists today
        </h2>
      </div>

      <div
        className="mt-7 overflow-hidden"
        style={{
          WebkitMaskImage: "linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)",
          maskImage: "linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)",
        }}
      >
        <div className="ticker-track gap-[18px] px-5" style={{ animationDuration: "74s" }}>
          {doubled.map((a, i) => (
            <div key={`${a.key}-${i}`} className="flex-none" style={{ width: "clamp(180px,20vw,230px)" }}>
              <div
                className="relative overflow-hidden rounded-[14px]"
                style={{ aspectRatio: "4 / 5", backgroundImage: a.grad }}
              >
                {a.photo && (
                  <img
                    src={a.photo}
                    alt={a.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </div>
              <div className="mt-3.5 text-[15px] font-bold">{a.name}</div>
              {/* Credit first — it's the reason the name is worth reading —
                  then the discipline underneath in lighter type. */}
              <div className="mt-1 text-[12.5px] font-semibold leading-snug" style={{ color: "#B30E4E" }}>
                {a.role}
              </div>
              {a.sub ? (
                <div className="mt-px text-[12.5px]" style={{ color: MUTED }}>
                  {a.sub}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For artists ──────────────────────────────────────────────────────────────

function ForArtists() {
  // The curated four. This previously rendered whatever the public jobs query
  // returned first, which meant a test post or an expired listing could end up
  // as the site's shop window.
  const jobs = useMemo(() => FALLBACK_JOBS.map((j) => ({ ...j, href: "/jobs" })), []);

  return (
    <section id="artists" className={SECTION} style={SECTION_PAD}>
      <div
        className="grid items-start"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: "clamp(36px,5vw,64px)",
        }}
      >
        <div>
          <Eyebrow color="#EF1187">For artists</Eyebrow>
          <h2
            className="mt-4 font-bold"
            style={{ fontSize: "clamp(30px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-0.03em", textWrap: "balance" as any }}
          >
            Find work you love.
          </h2>
          <p className="mt-4 max-w-[30em] text-[17px] leading-relaxed" style={{ color: BODY }}>
            Create your profile. Browse job notifications. Get paid to do the work you love to do.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/join?role=artist"
              className="rounded-xl px-7 py-4 text-[15px] font-bold text-white"
              style={{ backgroundImage: ARTIST_GRAD }}
            >
              Join Artswrk →
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center rounded-xl px-6 py-4 text-[15px] font-bold"
              style={{ border: "1px solid rgba(14,14,23,0.14)" }}
            >
              Browse Jobs
            </Link>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-3">
            {jobs.map((j, i) => (
              <Link
                key={`${j.title}-${i}`}
                href={j.href}
                className="flex items-center gap-4 rounded-2xl bg-white px-[18px] py-4 transition-all duration-150 hover:shadow-[0_8px_24px_rgba(14,14,23,0.06)]"
                style={{ border: `1px solid ${HAIRLINE}` }}
              >
                {j.logo ? (
                  /* The company's real logo. White plate behind it because
                     several of these are dark marks on transparent. */
                  <div
                    className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-white"
                    style={{ border: `1px solid ${HAIRLINE}` }}
                  >
                    <img
                      src={j.logo}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain p-1"
                      onError={(e) => {
                        e.currentTarget.parentElement?.classList.add("hidden");
                        e.currentTarget.parentElement?.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  </div>
                ) : null}
                <div
                  className={`${j.logo ? "hidden " : ""}flex h-11 w-11 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white`}
                  style={{ backgroundImage: AVATAR_GRADS[i % AVATAR_GRADS.length], letterSpacing: "-0.02em" }}
                >
                  {initials(j.org)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{j.title}</div>
                  <div className="mt-0.5 truncate text-[13px]" style={{ color: MUTED }}>
                    {j.org} · {j.city}
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-sm font-bold">{j.pay}</div>
                  <div className="mt-0.5 text-xs" style={{ color: FAINT }}>
                    {j.posted}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/jobs" className="text-sm font-bold" style={{ color: "#ec008c" }}>
              View all jobs →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function StepList({
  label,
  color,
  steps,
}: {
  label: string;
  color: string;
  steps: { n: string; title: string; body: string }[];
}) {
  return (
    <div>
      <Eyebrow color={color}>{label}</Eyebrow>
      <div className="mt-[22px] flex flex-col gap-6">
        {steps.map((s) => (
          <div key={s.n} className="flex items-start gap-5">
            <div className="flex-none text-lg font-extrabold" style={{ color, letterSpacing: "-0.02em" }}>
              {s.n}
            </div>
            <div>
              <div className="text-base font-bold">{s.title}</div>
              <div className="mt-[3px] text-sm leading-relaxed" style={{ color: BODY }}>
                {s.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className={SECTION} style={SECTION_PAD}>
      <h2 className="m-0 font-bold" style={{ fontSize: "clamp(30px,3.6vw,42px)", letterSpacing: "-0.03em" }}>
        How it works
      </h2>
      <div
        className="mt-10 grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: "clamp(36px,5vw,64px)",
        }}
      >
        <StepList label="For hirers" color="#F25722" steps={CLIENT_STEPS} />
        <StepList label="For artists" color="#EF1187" steps={ARTIST_STEPS} />
      </div>
    </section>
  );
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [audience, setAudience] = useState<keyof typeof HOME_FAQS>("hirers");
  const [open, setOpen] = useState(0);
  const faqs = HOME_FAQS[audience];

  function selectAudience(next: keyof typeof HOME_FAQS) {
    setAudience(next);
    setOpen(0);
  }

  return (
    <section id="faq" className={SECTION} style={SECTION_PAD}>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)] lg:gap-16">
        <div>
          <Eyebrow color={audience === "hirers" ? "#F25722" : "#EC008C"}>FAQs</Eyebrow>
          <h2 className="mt-4 font-bold" style={{ fontSize: "clamp(30px,3.6vw,42px)", lineHeight: 1.08, letterSpacing: "-0.03em" }}>
            Frequently Asked Questions
          </h2>
          <p className="mt-4 max-w-[32em] text-sm leading-relaxed" style={{ color: BODY }}>
            Couldn't find the answer you were looking for?{" "}
            <a href="mailto:contact@artswrk.com" className="font-bold" style={{ color: audience === "hirers" ? "#F25722" : "#EC008C" }}>
              Contact us at contact@artswrk.com
            </a>
          </p>
          <div className="mt-7 inline-flex rounded-full p-1" style={{ background: "#F3F3FC" }} role="group" aria-label="FAQ audience">
            {(["hirers", "artists"] as const).map((option) => {
              const active = audience === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectAudience(option)}
                  className="rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 active:scale-[0.97]"
                  style={{
                    color: active ? "#fff" : MUTED,
                    backgroundImage: active ? (option === "hirers" ? HIRER_GRAD : ARTIST_GRAD) : undefined,
                  }}
                >
                  For {option === "hirers" ? "Hirers" : "Artists"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white px-5 sm:px-7" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 16px 40px rgba(14,14,23,0.06)" }}>
          {faqs.map((f, i) => (
          <div key={f.q} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between gap-6 py-5 text-left"
            >
              <span className="text-base font-semibold">{f.q}</span>
              <span className="flex-none text-xl leading-none" style={{ color: FAINT }}>
                {open === i ? "−" : "+"}
              </span>
            </button>
            {open === i && (
              <p className="m-0 max-w-[60ch] pb-[22px] text-[15px] leading-[1.75]" style={{ color: BODY }}>
                {f.a}
              </p>
            )}
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA banner ───────────────────────────────────────────────────────────────

function CTABanner() {
  return (
    <section
      className={SECTION}
      style={{ padding: "clamp(72px,9vw,112px) clamp(20px,4vw,32px)" }}
    >
      <div
        className="rounded-[28px] text-center"
        style={{
          padding: "clamp(48px,7vw,88px) clamp(24px,4vw,48px)",
          backgroundImage: "linear-gradient(100deg,#EF1187 0%,#FF7171 52%,#F25722 100%)",
        }}
      >
        <h2
          className="m-0 font-extrabold text-white"
          style={{ fontSize: "clamp(32px,4.4vw,52px)", letterSpacing: "-0.03em", textWrap: "balance" as any }}
        >
          Hire Artists. Find WRK.
        </h2>
        <p
          className="mx-auto mt-4 max-w-[30em] leading-relaxed"
          style={{ fontSize: "clamp(15px,1.5vw,17px)", color: "rgba(255,255,255,0.9)" }}
        >
          Click below to join our network today!
        </p>
        <div className="mx-auto mt-8 flex w-full max-w-[320px] flex-col justify-center gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
          <Link
            href="/join?role=client"
            className="inline-flex w-full items-center justify-center rounded-full bg-white px-[34px] py-4 text-base font-bold sm:w-[140px]"
            style={{ color: INK }}
          >
            Post Job
          </Link>
          <Link
            href="/join?role=artist"
            className="inline-flex w-full items-center justify-center rounded-full px-[34px] py-4 text-base font-bold text-white transition-colors hover:bg-white/15 sm:w-[140px]"
            style={{ border: "1px solid rgba(255,255,255,0.6)" }}
          >
            Get Hired
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const legal = [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Contact", href: "mailto:contact@artswrk.com" },
  ];

  return (
    <footer style={{ borderTop: "1px solid rgba(14,14,23,0.08)" }}>
      <div
        className={`${SECTION} flex flex-wrap items-center justify-between gap-6`}
        style={{ padding: "40px clamp(20px,4vw,32px) 20px" }}
      >
        <img src="/manus-storage/artswrk-orange-source_39ee837b.png" alt="Artswrk" className="h-8 w-auto object-contain" />
      </div>
      <div
        className={`${SECTION} flex flex-wrap items-center justify-between gap-5`}
        style={{ padding: "16px clamp(20px,4vw,32px) 44px", borderTop: "1px solid rgba(14,14,23,0.06)" }}
      >
        <div className="text-[13px]" style={{ color: FAINT }}>
          © {new Date().getFullYear()} Artswrk Inc. All rights reserved.
        </div>
        <div className="flex gap-[22px] text-[13px]">
          {legal.map((l) => (
            <a key={l.label} href={l.href} style={{ color: MUTED }}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated) navigate("/app");
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white" style={{ color: INK }}>
      <Navbar />
      <Hero />
      <BrowseArtistsMarquee />
      <ForHirers />
      <ForArtists />
      <HowItWorks />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}
