/*
 * ARTSWRK HOMEPAGE — Redesign 2.0
 * Design: Bold Dance-Industry Platform
 * Font: Poppins (400–900)
 * Hirer gradient: #FFBC5D → #F25722  (class: hirer-grad-bg / hirer-grad-text)
 * Artist gradient: #ec008c → #ff7171 (class: artist-grad-bg / artist-grad-text)
 * All gradient text uses CSS classes — NO inline background+backgroundClip combos.
 */

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  MapPin, Clock, Sparkles, CheckCircle2, Users, ArrowRight,
  Zap, ChevronDown, Star, Play, Building2, Trophy, Music4
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artswrk-logo-gradient_8e560567.png";

// ─── Artist Strip Images ───────────────────────────────────────────────────────
const STRIP = [
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-2-Vo37fp95iDpS9ybaZkYWJB.webp",
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-3-hjiUkBU9Pft72RAaeq8oxW.webp",
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-4-VXD8jrv6pEif6NSzyXHom4.webp",
  "https://images.unsplash.com/photo-1547153760-18fc86324498?w=300&q=80",
  "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=300&q=80",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&q=80",
  "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=300&q=80",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=300&q=80",
];

// ─── Job Post Flow ────────────────────────────────────────────────────────────
const EXAMPLE_POSTS = [
  "Looking for a sub teacher this Saturday 3/15 from 4-5pm. Hip hop class, ages 8-12. $50/hr. Studio is in Lincoln Park, Chicago. DM me if interested!",
  "Need a ballet teacher for recurring classes starting April. Mon/Wed evenings 5-7pm. Competitive rate, experience required. Evanston, IL.",
  "Hiring a dance competition judge for our spring showcase May 3rd. All day event in Oak Park. Open rate, travel covered. Please reach out!",
  "Looking for a piano teacher for private lessons, 2x per week. Flexible schedule. $40-60/hr depending on experience. Naperville area.",
];

function parseJobText(text: string) {
  const titleMap: [RegExp, string][] = [
    [/sub(stitute)?\s+teacher/i, "Substitute Teacher"],
    [/ballet/i, "Ballet Teacher"],
    [/hip\s*hop/i, "Hip Hop Teacher"],
    [/piano/i, "Piano Teacher"],
    [/violin/i, "Violin Teacher"],
    [/voice|vocal/i, "Vocal Coach"],
    [/judge|adjudicat/i, "Dance Adjudicator"],
    [/choreograph/i, "Competition Choreographer"],
    [/photograph/i, "Photographer"],
    [/videograph/i, "Videographer"],
    [/yoga/i, "Yoga Instructor"],
    [/pilates/i, "Pilates Instructor"],
    [/teacher|instructor|coach/i, "Dance Teacher"],
  ];
  let title = "Arts Professional";
  for (const [re, label] of titleMap) {
    if (re.test(text)) { title = label; break; }
  }

  const rateMatch = text.match(/(\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*hr)?|\$[\d]+-\$?[\d]+(?:\/hr)?|open rate)/i);
  const rate = rateMatch ? rateMatch[0].replace(/\s/g, "") : "Open rate";

  const locMatch = text.match(/(?:in|at|near|@)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/)
    || text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*,\s*[A-Z]{2})/);
  const location = locMatch ? locMatch[1].trim() : "Location TBD";

  const dateMatch = text.match(/(this\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[^,.]*/i);
  const date = dateMatch ? dateMatch[0].trim() : "Flexible / Ongoing";

  const isRecurring = /recurring|ongoing|weekly|monthly|regular|2x|3x|per week/i.test(text);
  const jobType = isRecurring ? "Recurring" : "One-time";

  return { title, rate, location, date, jobType };
}

function JobPostFlow() {
  const [step, setStep] = useState<"input" | "preview" | "signup">("input");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseJobText> | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();

  function handleCreateAccount() {
    if (text) sessionStorage.setItem("postJobText", text);
    navigate("/join");
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (!text) setExampleIdx((i) => (i + 1) % EXAMPLE_POSTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [text]);

  function handleAnalyze() {
    if (!text.trim()) return;
    setParsed(parseJobText(text));
    setStep("preview");
  }

  function handleUseExample() {
    setText(EXAMPLE_POSTS[exampleIdx]);
    if (textareaRef.current) textareaRef.current.focus();
  }

  if (step === "signup") {
    return (
      <div className="flex flex-col items-center px-5 py-10">
        <div className="w-16 h-16 rounded-full hirer-grad-bg flex items-center justify-center mb-5 shadow-lg">
          <CheckCircle2 size={32} className="text-white" />
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-2 text-center">
          Your job is ready to go live!
        </h2>
        <p className="text-gray-500 text-base mb-3 max-w-md text-center">
          Create a free account to publish{" "}
          <span className="font-semibold text-[#111]">"{parsed?.title}"</span> to{" "}
          <span className="font-bold hirer-grad-text">6,000+ artists</span> — in under 60 seconds.
        </p>
        <div className="flex items-center gap-4 mb-8 text-xs text-gray-400 flex-wrap justify-center">
          <span className="flex items-center gap-1"><Users size={12} /> 6,000+ artists</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span className="flex items-center gap-1"><Zap size={12} /> Avg. 3 applicants in 24hrs</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Free to post</span>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
          />
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
          />
          <button
            onClick={handleCreateAccount}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            Create Free Account & Publish Job
          </button>
          <p className="text-xs text-gray-400 text-center">No credit card required · Free to post</p>
        </div>
        <button
          onClick={() => setStep("preview")}
          className="mt-5 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          ← Back to preview
        </button>
      </div>
    );
  }

  if (step === "preview" && parsed) {
    return (
      <div className="flex flex-col items-center px-5 py-8">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-6 h-6 rounded-full hirer-grad-bg flex items-center justify-center">
            <CheckCircle2 size={14} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Here's how your job will appear to artists</p>
        </div>
        <div className="w-full max-w-md bg-white rounded-2xl border-2 border-gray-100 shadow-lg overflow-hidden mb-6">
          <div className="hirer-grad-bg px-5 py-3 flex items-center justify-between">
            <span className="text-white text-xs font-bold uppercase tracking-wider">Job Preview</span>
            <span className="text-white/80 text-xs">artswrk.com/jobs</span>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  {parsed.title[0]}
                </div>
                <div>
                  <h3 className="font-black text-[#111] text-base">{parsed.title}</h3>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {parsed.location}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-[#F25722] flex-shrink-0">
                {parsed.jobType}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-gray-400 flex-shrink-0" />
                <span>{parsed.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs font-bold">$</span>
                <span className="font-semibold text-[#111]">{parsed.rate}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 leading-relaxed mb-4 max-h-20 overflow-hidden relative">
              {text}
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50" />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Users size={14} className="text-[#F25722] flex-shrink-0" />
              <p className="text-xs text-gray-600">
                Visible to <span className="font-bold text-[#111]">6,000+ artists</span> in the Artswrk network
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-md">
          <button
            onClick={() => setStep("input")}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setStep("signup")}
            className="flex-[2] py-3 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Publish to 6,000+ Artists <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-5 py-8">
      <div className="w-full max-w-xl">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE_POSTS[exampleIdx]}
            rows={4}
            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none leading-relaxed shadow-sm"
          />
          <div className="absolute top-3 right-3 opacity-30">
            <Sparkles size={16} className="text-[#F25722]" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 mb-4">
          <button
            onClick={handleUseExample}
            className="text-xs text-[#F25722] font-semibold hover:opacity-70 transition-opacity flex items-center gap-1"
          >
            <Sparkles size={11} /> Try an example
          </button>
          <span className="text-xs text-gray-300">
            {text.length > 0 ? `${text.length} chars` : "Just describe it naturally"}
          </span>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!text.trim()}
          className={`w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            text.trim()
              ? "text-white hirer-grad-bg hover:opacity-90 shadow-md"
              : "text-gray-300 bg-gray-100 cursor-not-allowed"
          }`}
        >
          <Sparkles size={16} />
          Preview My Job Post
        </button>
        <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
          {[
            { icon: <Users size={12} />, label: "6,000+ artists" },
            { icon: <Zap size={12} />, label: "Post in 60 seconds" },
            { icon: <CheckCircle2 size={12} />, label: "Free to post" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1 text-xs text-gray-400">
              {icon} {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
const ROTATING_WORDS = ["Dance Studios", "Competitions", "Performing Artists"];

const FLOATING_CARDS = [
  { title: "Sub Teacher Needed", type: "Hip Hop", location: "Chicago, IL", rate: "$50/hr", tag: "One-time", color: "hirer-grad-bg" },
  { title: "Competition Judge", type: "Dance Judge", location: "Oak Park, IL", rate: "Open Rate", tag: "Event", color: "artist-grad-bg" },
  { title: "Ballet Teacher", type: "Recurring", location: "Evanston, IL", rate: "$65/hr", tag: "Recurring", color: "hirer-grad-bg" },
];

function Hero() {
  const [wordIdx, setWordIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setWordIdx((i) => (i + 1) % ROTATING_WORDS.length);
        setFading(false);
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen bg-[#0d0d0d] overflow-hidden flex flex-col">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px"
      }} />

      {/* Gradient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "linear-gradient(135deg, #FFBC5D, #F25722)" }} />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: "linear-gradient(135deg, #ec008c, #ff7171)" }} />

      <div className="relative z-10 flex-1 flex items-center">
        <div className="mx-auto px-5 lg:px-10 max-w-7xl w-full pt-24 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">

            {/* Left: Headline + CTAs */}
            <div>
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/80 text-xs font-medium">6,000+ artists ready to work</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.0] tracking-tight mb-4">
                The Hiring Platform
                <br />
                Built for
                <br />
                <span
                  className={`hirer-grad-text transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
                >
                  {ROTATING_WORDS[wordIdx]}
                </span>
              </h1>

              <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">
                Post a job in 60 seconds. Reach 6,000+ vetted performing artists — dance teachers, judges, choreographers, and more.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link
                  href="/join"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity shadow-lg"
                >
                  Post Your First Job
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/browse"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Browse Artists
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-6">
                {[
                  { value: "6,000+", label: "Vetted Artists" },
                  { value: "50+", label: "Cities" },
                  { value: "3", label: "Avg Applicants / 24hrs" },
                  { value: "Free", label: "To Post" },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Floating job cards */}
            <div className="relative h-[480px] hidden lg:block">
              {FLOATING_CARDS.map((card, i) => (
                <div
                  key={i}
                  className="absolute bg-white rounded-2xl shadow-2xl p-4 w-72"
                  style={{
                    top: `${i * 28 + 4}%`,
                    right: i === 1 ? "0" : i === 0 ? "8%" : "16%",
                    transform: `rotate(${i === 0 ? "-2deg" : i === 1 ? "1.5deg" : "-1deg"})`,
                    zIndex: 3 - i,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
                        {card.title[0]}
                      </div>
                      <div>
                        <p className="font-black text-[#111] text-sm leading-tight">{card.title}</p>
                        <p className="text-xs text-gray-400">{card.type}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] flex-shrink-0">
                      {card.tag}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={10} /> {card.location}</span>
                    <span className="font-semibold text-[#111]">{card.rate}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={10} className="fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">3 applicants</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave divider */}
      <div className="relative z-10 w-full overflow-hidden leading-none" style={{ height: "60px" }}>
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
          <path d="M0,60 C360,0 1080,60 1440,20 L1440,60 Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}

// ─── Audience Clarity ─────────────────────────────────────────────────────────
const AUDIENCE_CARDS = [
  {
    icon: Building2,
    eyebrow: "Dance Studio Owners",
    headline: "Fill Your Studio's Roster",
    desc: "Need a sub teacher last minute? A recurring hip hop instructor? Browse 6,000+ vetted artists and post a job in under 60 seconds.",
    cta: "Post a Job",
    href: "/join",
    gradClass: "hirer-grad-bg",
    gradText: "hirer-grad-text",
    hoverBg: "hover:bg-orange-50",
  },
  {
    icon: Trophy,
    eyebrow: "Competition & Event Owners",
    headline: "Find Your Faculty & Judges",
    desc: "Certified judges, choreographers, and faculty for your next competition or showcase — all in one place, no Facebook groups needed.",
    cta: "Browse Artists",
    href: "/browse",
    gradClass: "artist-grad-bg",
    gradText: "artist-grad-text",
    hoverBg: "hover:bg-pink-50",
  },
  {
    icon: Music4,
    eyebrow: "Performing Artists",
    headline: "Get Paid for Your Craft",
    desc: "Teaching gigs, judging opportunities, choreography work — find jobs near you and get paid securely through the platform.",
    cta: "Create Your Profile",
    href: "/join",
    gradClass: "hirer-grad-bg",
    gradText: "hirer-grad-text",
    hoverBg: "hover:bg-orange-50",
  },
];

function AudienceClarity() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Who Is Artswrk For?</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight">
            One platform. Every role in dance.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {AUDIENCE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.eyebrow}
                className={`group relative rounded-3xl border-2 border-gray-100 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${card.hoverBg}`}
              >
                <div className={`w-12 h-12 rounded-2xl ${card.gradClass} flex items-center justify-center mb-5 shadow-md`}>
                  <Icon size={22} className="text-white" />
                </div>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${card.gradText}`}>{card.eyebrow}</p>
                <h3 className="text-2xl font-black text-[#111] leading-tight mb-3">{card.headline}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{card.desc}</p>
                <Link
                  href={card.href}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white ${card.gradClass} hover:opacity-90 transition-opacity`}
                >
                  {card.cta} <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Artist Strip ─────────────────────────────────────────────────────────────
function ArtistStrip() {
  const doubled = [...STRIP, ...STRIP];
  return (
    <section className="py-6 bg-[#fafafa] overflow-hidden">
      <div className="ticker-track">
        {doubled.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-36 h-48 md:w-44 md:h-60 mx-1.5 rounded-2xl overflow-hidden">
            <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    badge: "01",
    title: "Describe Your Need",
    desc: "Just type it out like you would in a Facebook group — \"Need a sub hip hop teacher Saturday, $50/hr, Lincoln Park.\" That's it.",
    icon: "✍️",
  },
  {
    badge: "02",
    title: "We Parse It Instantly",
    desc: "Artswrk reads your description and turns it into a clean, professional job listing — title, rate, location, and schedule auto-filled.",
    icon: "⚡",
  },
  {
    badge: "03",
    title: "Artists Apply, You Hire",
    desc: "Your job goes live to 6,000+ artists immediately. Message applicants, review profiles, and book — all in one place.",
    icon: "🎉",
  },
];

function HowItWorksSection() {
  return (
    <section className="py-20 bg-[#0d0d0d] relative overflow-hidden">
      {/* Background dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px"
      }} />
      <div className="relative z-10 mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Post a job in{" "}
            <span className="hirer-grad-text">3 steps</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            No account required to preview. See exactly how your listing will look before you publish.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {HOW_STEPS.map((step, i) => (
            <div key={step.badge} className="relative">
              {/* Connector line */}
              {i < HOW_STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-white/10 z-0" style={{ width: "calc(100% - 2rem)", left: "calc(100% - 1rem)" }} />
              )}
              <div className="relative z-10 bg-white/5 border border-white/10 rounded-3xl p-7 hover:bg-white/8 transition-colors">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm">
                    {step.badge}
                  </div>
                  <span className="text-2xl">{step.icon}</span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive demo */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
          <div className="hirer-grad-bg px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/40" />
              <div className="w-3 h-3 rounded-full bg-white/40" />
              <div className="w-3 h-3 rounded-full bg-white/40" />
            </div>
            <span className="text-white text-xs font-bold uppercase tracking-wider">Try It Now — Free</span>
            <div className="w-16" />
          </div>
          <JobPostFlow />
        </div>
      </div>
    </section>
  );
}

// ─── Live Jobs Ticker ─────────────────────────────────────────────────────────
const SAMPLE_JOB_TICKERS = [
  "Hip Hop Sub Teacher · Chicago, IL",
  "Ballet Instructor · New York, NY",
  "Competition Judge · Atlanta, GA",
  "Choreographer · Los Angeles, CA",
  "Tap Teacher · Boston, MA",
  "Dance Adjudicator · Dallas, TX",
  "Contemporary Teacher · Seattle, WA",
  "Acro Instructor · Miami, FL",
  "Jazz Teacher · Nashville, TN",
  "Lyrical Teacher · Denver, CO",
];

function LiveJobsTicker() {
  const { data: jobs } = trpc.jobs.list.useQuery({ limit: 20, offset: 0 });
  const tickerItems = jobs?.jobs?.length
    ? jobs.jobs.map((j) => `${j.title} · ${j.location || "Remote"}`)
    : SAMPLE_JOB_TICKERS;
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <section className="py-12 bg-white border-y border-gray-100">
      <div className="text-center mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Live on Artswrk Right Now</p>
      </div>
      <div className="overflow-hidden">
        <div className="ticker-track" style={{ animationDuration: "40s" }}>
          {doubled.map((item, i) => (
            <div key={i} className="flex-shrink-0 flex items-center gap-2 mx-6">
              <div className="w-2 h-2 rounded-full hirer-grad-bg flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-center mt-8">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
        >
          Browse All Artists <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

// ─── Features Split ───────────────────────────────────────────────────────────
type Tab = "hirers" | "artists";

const HIRER_FEATURES = [
  { emoji: "⚡", title: "Post in 60 seconds", desc: "Describe your job opportunity — we do the rest." },
  { emoji: "🎯", title: "AI-powered matching", desc: "Our parser reads your post and surfaces the right artists instantly." },
  { emoji: "👥", title: "6,000+ vetted artists", desc: "Every artist is reviewed before joining the platform." },
  { emoji: "💬", title: "Message applicants directly", desc: "No middleman. Chat, negotiate, and book in one thread." },
  { emoji: "📋", title: "Track all applications", desc: "One dashboard for every job you've posted and every applicant." },
  { emoji: "💳", title: "Optional and secure artist payments", desc: "Pay online or through your regular payroll." },
];

const ARTIST_FEATURES = [
  { emoji: "🔍", title: "Get discovered", desc: "Studios and competitions search for artists like you every day." },
  { emoji: "📍", title: "Jobs near you", desc: "Filter by city, style, and rate to find the right fit." },
  { emoji: "🌟", title: "Build your profile", desc: "Showcase your services, rates, and availability in one place." },
  { emoji: "💰", title: "Get paid securely", desc: "Direct deposit after every booking. No chasing invoices." },
  { emoji: "📄", title: "Simplified taxes", desc: "One 1099 for all your Artswrk earnings. Tax season made easy." },
  { emoji: "🏆", title: "PRO badge", desc: "Top-rated artists earn a PRO badge that boosts their visibility." },
];

function FeaturesSplit() {
  const [tab, setTab] = useState<Tab>("hirers");

  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Everything You Need</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-6">
            Built for the dance industry
          </h2>
          <div className="inline-flex items-center gap-2 bg-white rounded-full border border-gray-200 p-1">
            {(["hirers", "artists"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? `text-white shadow-md ${t === "hirers" ? "hirer-grad-bg" : "artist-grad-bg"}`
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                For {t === "hirers" ? "Hirers" : "Artists"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(tab === "hirers" ? HIRER_FEATURES : ARTIST_FEATURES).map((feat) => (
              <div
                key={feat.title}
                className={`p-5 rounded-2xl bg-white border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 ${
                  tab === "hirers" ? "hover:border-orange-200" : "hover:border-pink-200"
                }`}
              >
                <span className="text-2xl mb-3 block">{feat.emoji}</span>
                <h3 className="font-bold text-[#111] text-sm mb-1">{feat.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            <div className="bg-[#111] rounded-3xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-[#1a1a1a]">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="text-gray-500 text-xs ml-2">artswrk.com</span>
              </div>
              <div className="relative">
                <img
                  src={tab === "hirers"
                    ? "https://images.unsplash.com/photo-1547153760-18fc86324498?w=700&q=80"
                    : "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=700&q=80"
                  }
                  alt="Platform preview"
                  className="w-full h-72 object-cover opacity-80"
                />
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg max-w-[220px]">
                  {tab === "hirers" ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full hirer-grad-bg flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-xs text-[#111]">Ramita R.</p>
                          <p className="text-xs text-gray-500">Hip Hop · New York, NY</p>
                        </div>
                      </div>
                      <div className="flex text-yellow-400 text-xs mb-2">★★★★★</div>
                      <button className="w-full text-xs font-semibold text-white py-1.5 rounded-lg hirer-grad-bg">
                        View Profile →
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full artist-grad-bg flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-xs text-[#111]">Dance Teacher</p>
                          <p className="text-xs text-gray-500">New York, NY · $45/hr</p>
                        </div>
                      </div>
                      <div className="flex text-yellow-400 text-xs mb-2">★★★★★</div>
                      <button className="w-full text-xs font-semibold text-white py-1.5 rounded-lg artist-grad-bg">
                        Apply Now →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "I posted a job at 9pm and had 4 qualified applicants by morning. This is exactly what the dance industry needed.",
    name: "Sarah M.",
    role: "Studio Owner · Chicago, IL",
    grad: "hirer-grad-bg",
  },
  {
    quote: "As a competition director, finding judges used to take weeks of emails. Artswrk cut that down to a single afternoon.",
    name: "Marcus T.",
    role: "Competition Director · Atlanta, GA",
    grad: "artist-grad-bg",
  },
  {
    quote: "I've picked up 3 recurring teaching gigs through Artswrk this year. The platform actually understands how dance work works.",
    name: "Jenna L.",
    role: "Dance Teacher · New York, NY",
    grad: "hirer-grad-bg",
  },
];

function Testimonials() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">What People Are Saying</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight">
            Loved by the dance community
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-[#fafafa] rounded-3xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex text-yellow-400 text-sm mb-5">★★★★★</div>
              <blockquote className="text-[#111] font-medium text-base leading-relaxed mb-6">
                "{t.quote}"
              </blockquote>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${t.grad} flex-shrink-0`} />
                <div>
                  <p className="font-bold text-[#111] text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Businesses ───────────────────────────────────────────────────────────
const LOGOS = [
  "Susten Dance Collective", "Ferrari Dance Center NYC", "Allegra Dance Greenwich",
  "Armonk Center for Dance", "Broadway Dance Theater", "Midwest Dance Academy",
  "Pacific Arts Studio", "Elite Competition Group",
];

const BUSINESS_CARDS = [
  { label: "Dance Studio", img: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&q=80" },
  { label: "Dance Competition", img: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&q=80" },
  { label: "Music School", img: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80" },
];

function ForBusinesses() {
  const doubled = [...LOGOS, ...LOGOS];
  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">For Businesses</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-3">
            Hiring tools for performing arts businesses
          </h2>
          <p className="text-gray-500 text-lg">Join 1000+ dance studios, music schools, and more hiring with Artswrk</p>
        </div>

        <div className="overflow-hidden py-6 border-y border-gray-200 mb-10">
          <div className="ticker-track" style={{ animationDuration: "30s" }}>
            {doubled.map((name, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 mx-8">
                <div className="w-2 h-2 rounded-full hirer-grad-bg flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">{name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BUSINESS_CARDS.map((card) => (
            <div key={card.label} className="relative rounded-3xl overflow-hidden h-72 group cursor-pointer">
              <img src={card.img} alt={card.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5">
                <p className="text-white/70 text-sm font-medium">I'm hiring for my</p>
                <h3 className="text-white text-2xl font-black">{card.label}</h3>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href="/join" className="px-5 py-2.5 rounded-full text-sm font-bold text-white hirer-grad-bg shadow-lg">
                  Post a Job →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const HIRER_FAQS = [
  { q: "Are there fees to hire on Artswrk?", a: "It is free to post unlimited jobs on Artswrk. We want you to receive as many candidates as possible! To unlock their applications, you can either do a one-time job unlock or subscribe for unlimited access." },
  { q: "How do payments work?", a: "Artswrk works with your business. You can pay artists directly through Artswrk with seamless digital payment links, or you can process payment through your regular payroll." },
  { q: "Do I have to provide tax documentation?", a: "If payment is processed through Artswrk, our partner Stripe Connect handles 1099-NEC tax documentation for eligible artists according to latest IRS guidelines. If payment is processed through your regular payroll, eligible tax documentation will come from your business." },
  { q: "Who are the Artswrk artists?", a: "Artswrk artists are vetted performing arts professionals including dance teachers, dance judges, musicians, photographers, videographers, and event production staff." },
];

const ARTIST_FAQS = [
  { q: "How do I get booked on Artswrk?", a: "Create your artist profile with your services, rates, and availability. Hirers can then find and book you directly through the platform, or you can apply to open job listings." },
  { q: "Why do I need to share my rates, location, etc.?", a: "Hirers use this information to find the right artist for their needs. Providing complete profile information significantly increases your chances of getting booked." },
  { q: "How do payments work?", a: "You'll receive payment directly to your bank account via direct deposit after each completed booking. Artswrk handles all payment processing securely." },
  { q: "How do taxes work?", a: "Artswrk issues 1099-NEC forms to eligible artists according to the latest IRS guidelines. All your earnings are tracked in one place, making tax season much simpler." },
  { q: "Who are the Artswrk clients?", a: "Artswrk clients include dance studios, music schools, dance competitions, event production companies, and individual families looking to hire performing arts professionals." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button className="w-full flex items-center justify-between py-4 text-left gap-4 group" onClick={() => setOpen(!open)}>
        <span className="font-semibold text-[#111] text-sm group-hover:opacity-70 transition-opacity">{q}</span>
        <ChevronDown size={18} className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4 text-gray-500 text-sm leading-relaxed">{a}</div>}
    </div>
  );
}

function FAQ() {
  const [tab, setTab] = useState<Tab>("hirers");
  const faqs = tab === "hirers" ? HIRER_FAQS : ARTIST_FAQS;

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">FAQs</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-6">
              Frequently Asked Questions
            </h2>
            <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full p-1 mb-6">
              {(["hirers", "artists"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    tab === t ? "bg-white text-[#111] shadow-sm" : "text-gray-500"
                  }`}
                >
                  For {t === "hirers" ? "Hirers" : "Artists"}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-sm">
              Couldn't find the answer you were looking for?{" "}
              <a href="mailto:contact@artswrk.com" className="font-medium text-[#F25722] underline underline-offset-2 hover:opacity-70 transition-opacity">
                Contact us at contact@artswrk.com
              </a>
            </p>
          </div>
          <div>
            {faqs.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-24 hirer-grad-bg relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/10" />

      <div className="relative z-10 mx-auto px-5 lg:px-10 max-w-4xl text-center">
        <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-4">Ready to Get Started?</p>
        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4">
          The dance industry's hiring platform.
        </h2>
        <p className="text-white/80 text-xl mb-10 max-w-xl mx-auto">
          Join 1000+ studios and 6,000+ artists already connecting on Artswrk. Free to post.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/join"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold text-[#F25722] bg-white hover:bg-gray-50 transition-colors shadow-lg"
          >
            Post Your First Job <ArrowRight size={18} />
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold text-white border-2 border-white/50 hover:bg-white/10 transition-colors"
          >
            Browse Artists
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-gray-400 py-12">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <img src={LOGO_URL} alt="Artswrk" className="h-8 mb-4" />
            <p className="text-sm text-gray-500 leading-relaxed">The hiring platform for performing arts professionals.</p>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">For Hirers</h4>
            <ul className="space-y-2 text-sm">
              {["Post a Job", "Browse Artists", "Pricing", "How It Works"].map((l) => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">For Artists</h4>
            <ul className="space-y-2 text-sm">
              {["Create Profile", "Find Jobs", "Get Paid", "Resources"].map((l) => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: "About", href: "/about" },
                { label: "Jobs", href: "/jobs" },
                { label: "Contact", href: "mailto:contact@artswrk.com" },
                { label: "Privacy Policy", href: "#" },
                { label: "Terms of Service", href: "#" },
              ].map((l) => (
                <li key={l.label}><a href={l.href} className="hover:text-white transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">© 2024 Artswrk. All rights reserved.</p>
          <p className="text-xs text-gray-600">contact@artswrk.com</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <AudienceClarity />
      <ArtistStrip />
      <HowItWorksSection />
      <LiveJobsTicker />
      <FeaturesSplit />
      <Testimonials />
      <ForBusinesses />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}
