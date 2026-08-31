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
  const [, navigate] = useLocation();
  const isArtist = mode === "artist";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ role: mode });
    if (email.trim()) params.set("email", email.trim());
    if (!isArtist && hiringFor.trim()) params.set("hiringFor", hiringFor.trim());
    navigate(`/join?${params.toString()}`);
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
        {isArtist ? "Get booked at your rate" : "Post your first job free"}
      </div>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY }}>
        {isArtist
          ? "One profile. Paid work near you, on the days you choose."
          : "Tell us the role and the dates — matching artists see it immediately."}
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
          <input
            type="text"
            value={hiringFor}
            onChange={(e) => setHiringFor(e.target.value)}
            placeholder="What are you hiring for?"
            className="h-[52px] w-full rounded-xl px-[18px] text-[15px] outline-none focus:border-[#0E0E17]"
            style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
          />
        )}
        <button
          type="submit"
          className="h-[52px] rounded-xl text-[15px] font-bold text-white transition-colors hover:bg-[#3D3D4A]"
          style={{ background: INK }}
        >
          {isArtist ? "Claim your profile" : "Post a job"} →
        </button>
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
    blurb: "Weekly classes, last-minute subs, guest artists and competition choreography.",
    icon: Building2,
    cta: "Post a studio job",
    href: "/dance-studios",
    tag: "RELIABLE TEACHERS",
    quote: "“We just wanted to follow up to tell you that we LOVE working with your teachers — they’re always reliable and committed.”",
    who: "Alexa S., Owner, Lambarri Dance Arts",
  },
  {
    title: "Dance Competitions",
    card: "/testimonials/competition-imagine.png",
    blurb: "Judges, emcees, tabulators and backstage crew — staffed city by city.",
    icon: Trophy,
    cta: "Post a competition job",
    href: "/dance-competitions",
    tag: "SAME-DAY JUDGE",
    quote: "“I posted a job at 7am and had a judge on a train to us by 10am — and she was absolutely AMAZING! I’m blown away by Artswrk.”",
    who: "Shaun M., Imagine Dance Challenge, Dance One",
  },
  {
    title: "Music Schools",
    card: "/testimonials/musicschool-ensemble.png",
    blurb: "Instrument instructors, voice teachers and accompanists on your schedule.",
    icon: Music4,
    cta: "Post a school job",
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
  { title: "Emcee (Touring)", org: "REVEL Dance Convention", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1773623236874x382468136169884900/REVEL%20Dance%20Convention.jpeg", city: "Work from anywhere", pay: "Competitive salary", posted: "PRO job" },
  { title: "Judge", org: "Journey Dance Competition", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1770425320895x475037908411778600/download.jpeg", city: "Work from anywhere", pay: "Per event", posted: "PRO job" },
  { title: "Executive Assistant", org: "Ensemble Performing Arts", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1787025383139x307662120689587800/EMS-square-logo%20%281%29.webp", city: "Work from anywhere", pay: "Competitive salary", posted: "PRO job" },
  { title: "Competition Photographers", org: "Thunderstruck Dance Competition", logo: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1769117147013x594580362321450200/image_processing20220906-9-1hh0ccy%20%281%29.png", city: "Multiple dates", pay: "Per event", posted: "PRO job" },
];

const CLIENT_STEPS = [
  { n: "01", title: "Post a job", body: "The role, the dates, the rate. Live in about a minute." },
  { n: "02", title: "Review vetted applicants", body: "Experience, references and availability already confirmed." },
  { n: "03", title: "Hire and pay in one place", body: "Agreements, reminders and one invoice — all through Artswrk." },
];

const ARTIST_STEPS = [
  { n: "01", title: "Create your profile", body: "Your disciplines, your rate, the days you want to teach." },
  { n: "02", title: "Apply in one tap", body: "Matching jobs land in your feed. No proposals to write." },
  { n: "03", title: "Teach and get paid", body: "Bookings are confirmed in-app and paid out after the session." },
];

const FAQS = [
  {
    q: "What does Artswrk cost?",
    a: "Browsing, profiles and job posts are free. Artswrk takes a flat service fee on completed bookings — no subscription, no listing fees.",
  },
  {
    q: "How are artists vetted?",
    a: "Every profile is reviewed before it goes live: teaching experience, references, and a background check where the role requires one.",
  },
  {
    q: "How fast will I hear back?",
    a: "Most jobs get their first qualified applicant within 48 hours. Last-minute subs are often filled the same day.",
  },
  {
    q: "Who handles contracts and payment?",
    a: "Artswrk does. Artists are paid after the session and you receive one invoice instead of chasing individual contractors.",
  },
];

function Hero() {
  return (
    <section
      id="top"
      className={`${SECTION} grid items-center`}
      style={{
        padding: "clamp(56px,8vw,104px) clamp(20px,4vw,32px) 0",
        gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
        gap: "clamp(36px,5vw,72px)",
      }}
    >
      <div>
        <h1
          className="m-0 font-extrabold"
          style={{ fontSize: "clamp(40px,6.4vw,76px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}
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
          </span>
        </h1>
        <p
          className="mt-6 max-w-[26em] leading-relaxed"
          style={{ fontSize: "clamp(17px,1.6vw,20px)", color: BODY, textWrap: "pretty" as any }}
        >
          The Jobs Platform for Artists. Join or Hire the industry's best today.
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
              href={shown.href}
              className="rounded-xl px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#3D3D4A]"
              style={{ background: INK }}
            >
              {shown.cta} &rarr;
            </Link>
          </div>
          <div className="mt-3 text-[13px]" style={{ color: MUTED }}>
            Free to post · No subscription · First applicants within 48 hours
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
        <Link href="/browse" className="text-sm font-bold" style={{ color: "#F25722" }}>
          Browse all artists →
        </Link>
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
            List once. Paid work near you lands in your feed and you apply with one tap — no
            proposals, no undercutting, no chasing invoices.
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
              Browse open wrk
            </Link>
          </div>
          <div className="mt-3.5 text-[13px]" style={{ color: MUTED }}>
            Free to join. You keep your rate.
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
            <Link href="/jobs" className="text-sm font-bold" style={{ color: "#F25722" }}>
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
  const [open, setOpen] = useState(-1);

  return (
    <section id="faq" className={SECTION} style={SECTION_PAD}>
      <h2 className="m-0 font-bold" style={{ fontSize: "clamp(26px,3vw,34px)", letterSpacing: "-0.025em" }}>
        FAQs
      </h2>
      <div className="mt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {FAQS.map((f, i) => (
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
          Hire artists. Find wrk.
        </h2>
        <p
          className="mx-auto mt-4 max-w-[30em] leading-relaxed"
          style={{ fontSize: "clamp(15px,1.5vw,17px)", color: "rgba(255,255,255,0.9)" }}
        >
          Whichever side you're on, it starts the same way — one profile, one post.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/post-job"
            className="rounded-full bg-white px-[34px] py-4 text-base font-bold"
            style={{ color: INK }}
          >
            Post Job
          </Link>
          <Link
            href="/join?role=artist"
            className="rounded-full px-[34px] py-4 text-base font-bold text-white transition-colors hover:bg-white/15"
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

const WORDMARK_PATH =
  "M 12.008 0 C 5.377 0 0 5.376 0 12.009 L 0 92.285 C 0 98.916 5.375 104.291 12.007 104.291 L 228.849 104.291 C 235.482 104.291 240.858 98.915 240.858 92.283 L 240.858 12.009 C 240.858 5.376 235.482 0 228.849 0 L 12.008 0 Z M 50.879 22.729 L 65.578 22.729 L 75.569 60.676 L 75.953 60.676 L 85.56 22.729 L 101.315 22.729 L 85.464 83.252 L 68.075 83.252 L 57.988 45.017 L 57.604 45.017 L 47.517 83.252 L 30.417 83.252 L 14.566 22.729 L 30.897 22.729 L 40.504 60.676 L 40.888 60.676 L 50.879 22.729 Z M 157.642 69.322 C 158.506 78.353 158.795 81.042 160.812 83.252 L 144.288 83.252 C 143.039 81.619 142.271 77.872 141.791 71.628 C 141.31 64.711 138.332 63.174 132.856 63.174 L 122.001 63.174 L 122.001 83.252 L 105.957 83.252 L 105.957 22.729 L 136.507 22.729 C 152.166 22.729 159.947 30.126 159.947 41.943 C 159.947 50.781 154.471 56.545 147.074 57.506 C 153.319 58.755 156.969 62.309 157.642 69.322 Z M 122.001 35.794 L 122.001 50.589 L 133.625 50.589 C 140.542 50.589 144 48.86 144 43.288 C 144 38.388 140.542 35.794 133.625 35.794 L 122.001 35.794 Z M 200.557 48.475 L 225.054 83.252 L 205.552 83.252 L 188.741 59.139 L 183.457 64.903 L 183.457 83.252 L 167.126 83.252 L 167.126 22.729 L 183.457 22.729 L 183.457 47.226 L 205.168 22.729 L 223.902 22.729 L 200.557 48.475 Z";

function Wordmark({ width, height, textSize, gradientId }: { width: number; height: number; textSize: number; gradientId: string }) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className="font-extrabold leading-none" style={{ fontSize: textSize, letterSpacing: "-0.02em" }}>
        arts
      </span>
      <svg width={width} height={height} viewBox="0 0 240.858 104.291" fill="none" role="img" aria-label="wrk">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EF1187" />
            <stop offset="100%" stopColor="#F25722" />
          </linearGradient>
        </defs>
        <path d={WORDMARK_PATH} fill={`url(#${gradientId})`} fillRule="evenodd" />
      </svg>
    </div>
  );
}

function Footer() {
  const nav = [
    { label: "Hire artists", href: "/post-job" },
    { label: "Find wrk", href: "/jobs" },
    { label: "How it works", href: "/about" },
    { label: "FAQ", href: "#faq" },
  ];
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
        <Wordmark width={53} height={23} textSize={18} gradientId="aw-footer-grad" />
        <div className="flex flex-wrap text-sm font-medium" style={{ gap: "clamp(16px,3vw,32px)" }}>
          {nav.map((l) => (
            <a key={l.label} href={l.href} style={{ color: BODY }}>
              {l.label}
            </a>
          ))}
        </div>
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
