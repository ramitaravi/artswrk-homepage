/*
 * ARTSWRK HOMEPAGE
 * Design: Refined Modern "Premium Platform"
 * Font: Poppins (400–900)
 * Hirer gradient: #FFBC5D → #F25722  (class: hirer-grad-bg / hirer-grad-text)
 * Artist gradient: #ec008c → #ff7171 (class: artist-grad-bg / artist-grad-text)
 * All gradient text uses CSS classes — NO inline background+backgroundClip combos.
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { ChevronDown, Menu, X, MapPin, Clock, Sparkles, CheckCircle2, Users, ArrowRight, Zap } from "lucide-react";

type Tab = "hirers" | "artists";

function gradBgClass(tab: Tab) {
  return tab === "hirers" ? "hirer-grad-bg" : "artist-grad-bg";
}
function gradTextClass(tab: Tab) {
  return tab === "hirers" ? "hirer-grad-text" : "artist-grad-text";
}

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

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hirersOpen, setHirersOpen] = useState(false);
  const [artistsOpen, setArtistsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center select-none">
            <span className="font-black text-2xl tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
          </a>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/jobs" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Jobs</Link>
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">About</a>

            <div className="relative" onMouseEnter={() => setHirersOpen(true)} onMouseLeave={() => setHirersOpen(false)}>
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black transition-colors">
                For Hirers <ChevronDown size={14} className={`transition-transform ${hirersOpen ? "rotate-180" : ""}`} />
              </button>
              {hirersOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  {["Post a Job", "Browse Artists", "Pricing", "How It Works"].map((item) => (
                    <a key={item} href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">{item}</a>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" onMouseEnter={() => setArtistsOpen(true)} onMouseLeave={() => setArtistsOpen(false)}>
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black transition-colors">
                For Artists <ChevronDown size={14} className={`transition-transform ${artistsOpen ? "rotate-180" : ""}`} />
              </button>
              {artistsOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  {["Create Profile", "Find Jobs", "Get Paid", "Resources"].map((item) => (
                    <a key={item} href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors">{item}</a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">Login</a>
            <a href="#" className="text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full hover:bg-gray-800 transition-colors">Join</a>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-3">
          {["Jobs", "About", "For Hirers", "For Artists"].map((item) => (
            <a key={item} href="#" className="block text-sm font-medium text-gray-700 py-1">{item}</a>
          ))}
          <div className="flex gap-3 pt-2">
            <a href="#" className="text-sm font-medium text-gray-700">Login</a>
            <a href="#" className="text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full">Join</a>
          </div>
        </div>
      )}
    </nav>
  );
}

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

  // ── Step: Signup ──
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
          <span className="font-bold hirer-grad-text">5,000+ artists</span> — in under 60 seconds.
        </p>

        <div className="flex items-center gap-4 mb-8 text-xs text-gray-400 flex-wrap justify-center">
          <span className="flex items-center gap-1"><Users size={12} /> 5,000+ artists</span>
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
          <button className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
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

  // ── Step: Preview ──
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
                Visible to <span className="font-bold text-[#111]">5,000+ artists</span> in the Artswrk network
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
            Publish to 5,000+ Artists <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Input ──
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
            { icon: <Users size={12} />, label: "5,000+ artists" },
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
function Hero({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const [email, setEmail] = useState("");
  const headline = tab === "hirers" ? "The Hiring Platform for Artists" : "The Jobs Platform for Artists";
  const cta = "Find Work →";

  return (
    <section className="pt-28 pb-0 bg-white text-center">
      <div className="mx-auto px-5 lg:px-10 max-w-4xl">
        <div className="inline-flex items-center mb-6 select-none">
          <span className="font-black text-3xl tracking-tight hirer-grad-text">ARTS</span>
          <span className="font-black text-3xl tracking-tight bg-[#111] text-white px-2 py-0.5 rounded ml-1">WRK</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {(["hirers", "artists"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                tab === t ? `text-white shadow-md ${gradBgClass(t)}` : "text-gray-500 bg-gray-100 hover:bg-gray-200"
              }`}
            >
              for {t}
            </button>
          ))}
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-[#111] leading-[1.05] tracking-tight mb-3">
          {headline}
        </h1>

        {tab === "hirers" ? (
          <>
            <p className="text-gray-400 text-base mb-0 max-w-lg mx-auto">
              Describe your job below — we'll turn it into a listing and send it to 5,000+ artists instantly.
            </p>
            <JobPostFlow />
          </>
        ) : (
          <>
            <p className="text-gray-400 text-base mb-8 max-w-lg mx-auto">
              Browse open jobs from studios, schools, and companies across the country.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto pb-16">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full sm:flex-1 px-4 py-3 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all"
              />
              <button className="whitespace-nowrap px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 artist-grad-bg">
                {cta}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Artist Strip ─────────────────────────────────────────────────────────────
function ArtistStrip() {
  const doubled = [...STRIP, ...STRIP];
  return (
    <section className="py-6 bg-white overflow-hidden">
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

// ─── For Hirers ───────────────────────────────────────────────────────────────
const HIRER_ITEMS = [
  { emoji: "🩰", title: "Hire Dance Teachers", desc: "Hire part-time or full-time staff for your studio" },
  { emoji: "🎤", title: "Hire Dance Judges", desc: "Find experienced judges for your competitions" },
  { emoji: "🎵", title: "Hire Music Teachers", desc: "Connect with qualified music instructors" },
  { emoji: "📸", title: "Hire Photographers", desc: "Book professional arts photographers" },
  { emoji: "🎥", title: "Hire Videographers", desc: "Find videographers who specialize in the arts" },
  { emoji: "📽️", title: "Hire Event & Production Staff", desc: "Staff your next performance or event" },
];

function ForHirers() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <p className="eyebrow mb-3">For Hirers</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-8">
              Post Jobs & Hire Qualified Talent
            </h2>
            <div className="space-y-3">
              {HIRER_ITEMS.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl hover:bg-orange-50 transition-colors group cursor-pointer">
                  <span className="text-xl mt-0.5 flex-shrink-0">{item.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-[#111] text-sm group-hover:text-orange-600 transition-colors">{item.title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-[#111] rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a]">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="relative">
                <img src="https://images.unsplash.com/photo-1547153760-18fc86324498?w=700&q=80" alt="Artist profile" className="w-full h-72 object-cover opacity-80" />
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg max-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full hirer-grad-bg flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-xs text-[#111]">Ramita R.</p>
                      <p className="text-xs text-gray-500">she/her · New York, NY</p>
                    </div>
                  </div>
                  <div className="flex text-yellow-400 text-xs mb-2">★★★★★</div>
                  <button className="w-full text-xs font-semibold text-white py-1.5 rounded-lg hirer-grad-bg">
                    View Profile →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── For Artists ──────────────────────────────────────────────────────────────
const ARTIST_ITEMS = [
  { emoji: "🩰", title: "Dance Teachers", desc: "Find substitute, guest, or full-time work at dance studios" },
  { emoji: "🎤", title: "Dance Judges", desc: "Judge competitions and events across the country" },
  { emoji: "🎵", title: "Music Teachers", desc: "Teach piano, voice, violin, and more" },
  { emoji: "📸", title: "Photographers", desc: "Shoot performances, headshots, and events" },
  { emoji: "🎥", title: "Videographers", desc: "Film recitals, competitions, and productions" },
  { emoji: "📽️", title: "Event & Production Staff", desc: "Work backstage and behind the scenes" },
];

function ForArtists() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 artist-grad-text">For Artists</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-8">
              Jobs for Arts Workers
            </h2>
            <div className="space-y-3">
              {ARTIST_ITEMS.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl hover:bg-pink-50 transition-colors group cursor-pointer">
                  <span className="text-xl mt-0.5 flex-shrink-0">{item.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-[#111] text-sm group-hover:text-pink-600 transition-colors">{item.title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-6 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 artist-grad-bg">
              Learn More →
            </button>
          </div>

          <div className="relative">
            <div className="bg-[#111] rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a]">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="relative">
                <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=700&q=80" alt="Artist working" className="w-full h-72 object-cover opacity-85" />
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg max-w-[220px]">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Jobs For Artists ─────────────────────────────────────────────────────────
const SAMPLE_JOBS = [
  { title: "Substitute Teacher", location: "Mount Vernon, NY", posted: "21 hours ago", date: "Sat, Mar 28, 2026", rate: "$45.00/hr" },
  { title: "Voice Teacher", location: "Milford, MI", posted: "a day ago", date: "Mon, May 4, 2026", rate: "$22.00/hr" },
  { title: "Piano Teacher", location: "Orland Park, IL", posted: "3 days ago", date: "Mon, Apr 6, 2026", rate: "$28.00/hr" },
  { title: "Violin Teacher", location: "Naperville, IL", posted: "3 days ago", date: "Mon, Apr 6, 2026", rate: "$32.00/hr" },
];

function JobsForArtists() {
  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 artist-grad-text">Jobs for Artists</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight">Browse Open Jobs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_JOBS.map((job) => (
            <div key={job.title + job.location} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold artist-grad-bg">
                  {job.title[0]}
                </div>
                <button className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold text-white artist-grad-bg hover:opacity-90 transition-opacity">
                  Apply
                </button>
              </div>
              <h3 className="font-bold text-[#111] text-base mt-3 mb-1">{job.title}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                <span className="flex items-center gap-1"><Clock size={11} />Posted {job.posted}</span>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">{job.date}</span>
                <span className="text-sm font-bold text-green-600">{job.rate}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/jobs" className="px-8 py-3 rounded-full text-sm font-semibold text-white artist-grad-bg hover:opacity-90 transition-opacity inline-block">
            View All Open Jobs →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Logo Ticker ──────────────────────────────────────────────────────────────
const LOGOS = [
  "Austen Dance Collective", "Ferrari Dance Center NYC", "Allegra Dance Greenwich",
  "Armonk Center for Dance", "Broadway Dance Theater", "Steps on Broadway",
  "Peridance Center", "Broadway Dance Academy",
];

function LogoTicker({ tab }: { tab: Tab }) {
  const doubled = [...LOGOS, ...LOGOS];
  return (
    <div className="overflow-hidden py-6 border-y border-gray-100">
      <div className="ticker-track" style={{ animationDuration: "30s" }}>
        {doubled.map((name, i) => (
          <div key={i} className="flex-shrink-0 flex items-center gap-2 mx-8">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gradBgClass(tab)}`} />
            <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── For Businesses ───────────────────────────────────────────────────────────
const BUSINESS_CARDS = [
  { label: "Dance Studio", img: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&q=80" },
  { label: "Dance Competition", img: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&q=80" },
  { label: "Music School", img: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80" },
];

function ForBusinesses({ tab }: { tab: Tab }) {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="mb-10">
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${gradTextClass(tab)}`}>For Businesses</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-3">
            Hiring tools for performing arts businesses
          </h2>
          <p className="text-gray-500 text-lg">Join 700+ dance studios, music schools, and more hiring with Artswrk</p>
        </div>

        <LogoTicker tab={tab} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
          {BUSINESS_CARDS.map((card) => (
            <div key={card.label} className="relative rounded-2xl overflow-hidden h-72 group cursor-pointer">
              <img src={card.img} alt={card.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5">
                <p className="text-white/80 text-sm font-medium">I'm hiring for my</p>
                <h3 className="text-white text-2xl font-black">{card.label}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const HIRER_STEPS = [
  { title: "Post Jobs & Browse Artists", desc: "Post a job or browse thousands of vetted professional freelance artists", img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&q=80", badge: "01" },
  { title: "Book & Schedule Artists", desc: "View and schedule available artists on one simple screen. No more emails or FB groups", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80", badge: "02" },
  { title: "Pay Artists Online", desc: "Pay artists digitally with a simple payment link. We take care of the rest!", img: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&q=80", badge: "03" },
];

const ARTIST_STEPS = [
  { title: "Create your Artist Profile", desc: "Share your profile: list services, rates, and availability in one place", img: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=500&q=80", badge: "01" },
  { title: "Browse Open Jobs", desc: "Browse jobs near you — pick up one-time jobs or find long term work", img: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=500&q=80", badge: "02" },
  { title: "Get Booked & Paid Online", desc: "Tax season has never been easier. Get direct deposits for all your work and receive one 1099.", img: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&q=80", badge: "03" },
];

function HowItWorks({ tab }: { tab: Tab }) {
  const steps = tab === "hirers" ? HIRER_STEPS : ARTIST_STEPS;
  const headline = tab === "hirers" ? "One tool to find, hire, and pay artists" : "Get paid to do the work you love";

  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-14">
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${gradTextClass(tab)}`}>How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight">{headline}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.title} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
              <div className="bg-[#111] px-4 py-2.5 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              <div className="relative overflow-hidden h-48">
                <img src={step.img} alt={step.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black ${gradBgClass(tab)}`}>
                  {step.badge}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-black text-[#111] text-lg mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
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
  { q: "Are there fees to hire on Artswrk?", a: "Artswrk charges a small service fee on bookings made through the platform. There are no upfront subscription costs to post jobs or browse artists — you only pay when you successfully hire." },
  { q: "How do payments work?", a: "Payments are processed securely through Artswrk. Once you confirm a booking, you'll receive a simple payment link. Artists receive their payment after the booking is completed." },
  { q: "Is there a cancellation policy?", a: "Yes. Cancellations made more than 48 hours before the scheduled booking are eligible for a full refund. Cancellations within 48 hours may be subject to a partial fee." },
  { q: "Do I have to provide tax documentation?", a: "Artswrk handles 1099-NEC tax documentation for artists earning over $600 per year on the platform. As a hirer, you do not need to issue separate tax forms." },
  { q: "Does Artswrk work with my existing payroll?", a: "Artswrk is a separate payment system from traditional payroll. It's designed specifically for freelance and gig-based arts professionals." },
  { q: "Who are the Artswrk artists?", a: "Artswrk artists are vetted performing arts professionals including dance teachers, dance judges, musicians, photographers, videographers, and event production staff." },
];

const ARTIST_FAQS = [
  { q: "How do I get booked on Artswrk?", a: "Create your artist profile with your services, rates, and availability. Hirers can then find and book you directly through the platform, or you can apply to open job listings." },
  { q: "Why do I need to share my rates, location, etc.?", a: "Hirers use this information to find the right artist for their needs. Providing complete profile information significantly increases your chances of getting booked." },
  { q: "Is there a cancellation policy?", a: "Yes. Cancellations made more than 48 hours before the scheduled booking are eligible for a full refund. Cancellations within 48 hours may be subject to a partial fee." },
  { q: "How do payments work?", a: "You'll receive payment directly to your bank account via direct deposit after each completed booking. Artswrk handles all payment processing securely." },
  { q: "How do taxes work?", a: "Artswrk issues 1099-NEC forms to artists who earn over $600 in a calendar year on the platform, making tax season much simpler. All your earnings are tracked in one place." },
  { q: "Who are the Artswrk clients?", a: "Artswrk clients include dance studios, music schools, dance competitions, event production companies, and individual families looking to hire performing arts professionals." },
];

function FAQItem({ q, a }: { q: string; a: string; tab: Tab }) {
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

function FAQ({ tab }: { tab: Tab }) {
  const faqs = tab === "hirers" ? HIRER_FAQS : ARTIST_FAQS;
  const emailColor = tab === "hirers" ? "text-orange-500" : "text-pink-500";

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${gradTextClass(tab)}`}>FAQs</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-base">
              Couldn't find the answer you were looking for?{" "}
              <a href="mailto:contact@artswrk.com" className={`font-medium underline underline-offset-2 hover:opacity-70 transition-opacity ${emailColor}`}>
                Contact us at contact@artswrk.com
              </a>
            </p>
          </div>
          <div>
            {faqs.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} tab={tab} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner({ tab }: { tab: Tab }) {
  const headline = tab === "hirers" ? "Ready to hire your next artist?" : "Ready to find your next gig?";
  const sub = tab === "hirers" ? "Join 700+ performing arts businesses already hiring on Artswrk." : "Join 5,000+ artists already earning on Artswrk.";
  const cta = tab === "hirers" ? "Start Hiring →" : "Find Work →";

  return (
    <section className="py-20 bg-[#111]">
      <div className="mx-auto px-5 lg:px-10 max-w-4xl text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">{headline}</h2>
        <p className="text-gray-400 text-lg mb-8">{sub}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email address"
            className="w-full sm:flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none"
          />
          <button className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity ${gradBgClass(tab)}`}>
            {cta}
          </button>
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
            <div className="flex items-center mb-4 select-none">
              <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
              <span className="font-black text-xl tracking-tight bg-white text-[#111] px-1.5 py-0.5 rounded ml-0.5">WRK</span>
            </div>
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
              {["About", "Blog", "Contact", "Privacy Policy", "Terms of Service"].map((l) => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
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
  const [tab, setTab] = useState<Tab>("hirers");

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero tab={tab} setTab={setTab} />
      <ArtistStrip />

      {tab === "hirers" ? (
        <>
          <ForHirers />
          <ForBusinesses tab={tab} />
          <HowItWorks tab={tab} />
        </>
      ) : (
        <>
          <ForArtists />
          <JobsForArtists />
          <HowItWorks tab={tab} />
        </>
      )}

      <FAQ tab={tab} />
      <CTABanner tab={tab} />
      <Footer />
    </div>
  );
}
