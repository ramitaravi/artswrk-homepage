/*
 * ARTSWRK HOMEPAGE — v3.0
 * Design: Professional hiring software + talent network
 * Inspired by useparallel.com — product-first, clear two-sided positioning
 */

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  MapPin, Clock, Sparkles, CheckCircle2, Users, ArrowRight,
  Zap, ChevronDown, Star, Building2, Trophy, Music4,
  Search, LayoutDashboard, CreditCard, MessageCircle,
  FileText, Bell, Briefcase, Plus, ChevronRight,
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

// ─── Job Post Flow ─────────────────────────────────────────────────────────────
const EXAMPLE_POSTS = [
  "Looking for a sub teacher this Saturday 3/15 from 4-5pm. Hip hop class, ages 8-12. $50/hr. Studio is in Lincoln Park, Chicago.",
  "Need a ballet teacher for recurring classes starting April. Mon/Wed evenings 5-7pm. Competitive rate. Evanston, IL.",
  "Hiring a dance competition judge for our spring showcase May 3rd. All day event in Oak Park. Open rate, travel covered.",
  "Looking for a piano teacher for private lessons, 2x per week. Flexible schedule. $40-60/hr. Naperville area.",
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
      <div className="flex flex-col items-center px-6 py-10">
        <div className="w-14 h-14 rounded-full hirer-grad-bg flex items-center justify-center mb-5 shadow-lg">
          <CheckCircle2 size={28} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-[#111] mb-2 text-center">
          Your job is ready to go live!
        </h2>
        <p className="text-gray-500 text-sm mb-6 max-w-md text-center">
          Create a free account to publish{" "}
          <span className="font-semibold text-[#111]">"{parsed?.title}"</span> to{" "}
          <span className="font-bold hirer-grad-text">6,000+ artists</span>.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all" />
          <input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all" />
          <button onClick={handleCreateAccount}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Sparkles size={16} /> Create Free Account & Publish Job
          </button>
          <p className="text-xs text-gray-400 text-center">No credit card required · Free to post</p>
        </div>
        <button onClick={() => setStep("preview")} className="mt-5 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">← Back</button>
      </div>
    );
  }

  if (step === "preview" && parsed) {
    return (
      <div className="flex flex-col items-center px-6 py-8">
        <p className="text-sm font-semibold text-gray-500 mb-5">Here's how your job will appear to artists</p>
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
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {parsed.location}</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-[#F25722] flex-shrink-0">{parsed.jobType}</span>
            </div>
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2"><Clock size={13} className="text-gray-400 flex-shrink-0" /><span>{parsed.date}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-400 text-xs font-bold">$</span><span className="font-semibold text-[#111]">{parsed.rate}</span></div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Users size={14} className="text-[#F25722] flex-shrink-0" />
              <p className="text-xs text-gray-600">Visible to <span className="font-bold text-[#111]">6,000+ artists</span> in the Artswrk network</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-md">
          <button onClick={() => setStep("input")}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">Edit</button>
          <button onClick={() => setStep("signup")}
            className="flex-[2] py-3 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            Publish to 6,000+ Artists <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-xl">
        <div className="relative">
          <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE_POSTS[exampleIdx]} rows={4}
            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none leading-relaxed shadow-sm" />
          <div className="absolute top-3 right-3 opacity-30"><Sparkles size={16} className="text-[#F25722]" /></div>
        </div>
        <div className="flex items-center justify-between mt-2 mb-4">
          <button onClick={handleUseExample}
            className="text-xs text-[#F25722] font-semibold hover:opacity-70 transition-opacity flex items-center gap-1">
            <Sparkles size={11} /> Try an example
          </button>
          <span className="text-xs text-gray-300">{text.length > 0 ? `${text.length} chars` : "Just describe it naturally"}</span>
        </div>
        <button onClick={handleAnalyze} disabled={!text.trim()}
          className={`w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            text.trim() ? "text-white hirer-grad-bg hover:opacity-90 shadow-md" : "text-gray-300 bg-gray-100 cursor-not-allowed"
          }`}>
          <Sparkles size={16} /> Preview My Job Post
        </button>
        <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
          {[
            { icon: <Users size={12} />, label: "6,000+ artists" },
            { icon: <Zap size={12} />, label: "Post in 60 seconds" },
            { icon: <CheckCircle2 size={12} />, label: "Free to post" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1 text-xs text-gray-400">{icon} {label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Mockup ──────────────────────────────────────────────────────────
function DashboardMockup() {
  const jobs = [
    { title: "Ballet Teacher", loc: "Evanston, IL", apps: 5, status: "Active", tag: "Recurring" },
    { title: "Hip Hop Sub", loc: "Chicago, IL", apps: 3, status: "Active", tag: "One-time" },
    { title: "Competition Judge", loc: "Oak Park, IL", apps: 8, status: "Active", tag: "Event" },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Browser chrome */}
      <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2.5 border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-3 bg-white rounded border border-gray-200 px-3 py-0.5 text-[10px] text-gray-400">artswrk.com/app</div>
      </div>
      {/* App UI */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-40 bg-white border-r border-gray-100 py-3 px-2 space-y-0.5 flex-shrink-0">
          <div className="px-2.5 py-2 rounded-lg bg-orange-50 text-[11px] font-semibold text-[#F25722] flex items-center gap-2">
            <LayoutDashboard size={11} /> Overview
          </div>
          {[
            { icon: <Briefcase size={11} />, label: "My Jobs" },
            { icon: <Users size={11} />, label: "Applicants" },
            { icon: <MessageCircle size={11} />, label: "Messages" },
            { icon: <CreditCard size={11} />, label: "Payments" },
          ].map(({ icon, label }) => (
            <div key={label} className="px-2.5 py-2 rounded-lg text-[11px] text-gray-400 flex items-center gap-2">{icon} {label}</div>
          ))}
        </div>
        {/* Main */}
        <div className="flex-1 p-4 bg-[#fafafa]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#111]">My Jobs</p>
            <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg hirer-grad-bg text-white text-[10px] font-bold">
              <Plus size={9} /> Post Job
            </button>
          </div>
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.title} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg hirer-grad-bg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0">
                  {job.title[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[#111] leading-none">{job.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{job.loc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-[#F25722]">{job.apps} apps</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold">{job.status}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[{ val: "16", label: "Total Applicants" }, { val: "3", label: "Active Jobs" }, { val: "2", label: "Hired" }].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                <p className="text-base font-black text-[#111]">{s.val}</p>
                <p className="text-[9px] text-gray-400 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Artist Profile Mockup ─────────────────────────────────────────────────────
function ArtistProfileMockup() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2.5 border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-3 bg-white rounded border border-gray-200 px-3 py-0.5 text-[10px] text-gray-400">artswrk.com/app/jobs</div>
      </div>
      <div className="p-4 bg-[#fafafa]">
        <p className="text-xs font-bold text-[#111] mb-3">Open Jobs Near You</p>
        <div className="space-y-2">
          {[
            { title: "Ballet Teacher", studio: "Allegra Dance", loc: "Greenwich, CT", rate: "$70/hr", tag: "Recurring" },
            { title: "Competition Judge", studio: "Elite Comp Group", loc: "Atlanta, GA", rate: "Open Rate", tag: "Event" },
            { title: "Hip Hop Instructor", studio: "Susten Collective", loc: "Chicago, IL", rate: "$55/hr", tag: "Recurring" },
          ].map((job) => (
            <div key={job.title} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg artist-grad-bg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0">
                {job.title[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#111]">{job.title}</p>
                <p className="text-[10px] text-gray-400">{job.studio} · {job.loc}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[11px] font-bold text-[#111]">{job.rate}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-50 text-[#ec008c] font-semibold">{job.tag}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Earnings card */}
        <div className="mt-3 bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400">This Month's Earnings</p>
            <p className="text-base font-black text-[#111]">$2,340</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
            <span>↑ 18%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative bg-[#0a0a0a] overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />
      {/* Gradient glow */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.08] blur-3xl" style={{ background: "linear-gradient(135deg, #FFBC5D, #F25722)" }} />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-3xl" style={{ background: "linear-gradient(135deg, #ec008c, #ff7171)" }} />

      <div className="relative z-10 mx-auto px-5 lg:px-10 max-w-7xl pt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/70 text-xs font-medium tracking-wide">6,000+ artists ready to work</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-[4.25rem] font-black text-white leading-[1.05] tracking-tight mb-6">
              The hiring platform
              <br />
              <span className="hirer-grad-text">built for dance.</span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">
              Post a job in 60 seconds. Manage applications, message artists, and book — all from one dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link href="/join"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity shadow-xl shadow-orange-900/20">
                Post Your First Job <ArrowRight size={18} />
              </Link>
              <Link href="/browse"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-semibold text-white/80 border border-white/20 hover:bg-white/8 transition-colors">
                Browse Artists
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {[
                { value: "6,000+", label: "Vetted artists" },
                { value: "50+", label: "Cities" },
                { value: "Free", label: "To post" },
                { value: "< 24hrs", label: "First applicants" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Dashboard mockup */}
          <div className="hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </div>

      {/* Wave */}
      <div className="relative z-10 w-full overflow-hidden" style={{ height: "56px" }}>
        <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
          <path d="M0,56 C400,0 1000,56 1440,20 L1440,56 Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}

// ─── Trusted By Strip ──────────────────────────────────────────────────────────
const STUDIO_NAMES = [
  "Susten Dance Collective", "Ferrari Dance Center NYC", "Allegra Dance Greenwich",
  "Armonk Center for Dance", "Broadway Dance Theater", "Midwest Dance Academy",
  "Pacific Arts Studio", "Elite Competition Group", "Golden State Dance",
  "Uptown Studios NYC", "Velocity Dance Academy", "Arts & Motion Chicago",
];

function TrustedBy() {
  const doubled = [...STUDIO_NAMES, ...STUDIO_NAMES];
  return (
    <section className="py-10 bg-white border-b border-gray-100">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
        Trusted by 1,000+ performing arts businesses
      </p>
      <div className="overflow-hidden">
        <div className="ticker-track" style={{ animationDuration: "30s" }}>
          {doubled.map((name, i) => (
            <div key={i} className="flex-shrink-0 flex items-center gap-2.5 mx-8">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Hirers ────────────────────────────────────────────────────────────────
const HIRER_FEATURES = [
  { icon: <Zap size={16} />, title: "Post in 60 seconds", desc: "Describe the role naturally — AI fills the rest." },
  { icon: <Users size={16} />, title: "Track every applicant", desc: "One dashboard. All applications. No spreadsheets." },
  { icon: <MessageCircle size={16} />, title: "Message artists directly", desc: "No middleman. Chat, negotiate, and confirm." },
  { icon: <CreditCard size={16} />, title: "Pay securely", desc: "Digital payments or your own payroll — your choice." },
];

function ForHirers() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#F25722] mb-4">For Studio Owners & Event Directors</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-5">
              Your full hiring workflow.
              <br />One platform.
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-8">
              Stop posting in Facebook groups and chasing down responses. Artswrk gives you a real hiring dashboard — post, review, message, and book artists in one place.
            </p>

            <div className="space-y-4 mb-8">
              {HIRER_FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-bold text-[#111] text-sm">{f.title}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/join"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
              Post Your First Job <ArrowRight size={16} />
            </Link>
          </div>

          {/* Right: dashboard mockup */}
          <div>
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── For Artists ───────────────────────────────────────────────────────────────
const ARTIST_FEATURES = [
  { icon: <Search size={16} />, title: "Discover jobs near you", desc: "Filter by city, style, and rate to find perfect-fit gigs." },
  { icon: <FileText size={16} />, title: "Build your profile", desc: "Showcase your services, rates, and availability in one place." },
  { icon: <CreditCard size={16} />, title: "Get paid securely", desc: "Direct deposit after every booking. No chasing invoices." },
  { icon: <Star size={16} />, title: "Earn a PRO badge", desc: "Top-rated artists get boosted visibility across the network." },
];

function ForArtists() {
  return (
    <section className="py-24 bg-[#fafafa]">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: profile mockup */}
          <div className="order-2 lg:order-1">
            <ArtistProfileMockup />
          </div>

          {/* Right: copy */}
          <div className="order-1 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#ec008c] mb-4">For Performing Artists</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-5">
              Get discovered.
              <br />Get booked. Get paid.
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-8">
              Teaching gigs, judging opportunities, choreography work — find everything in one network built specifically for performing arts professionals.
            </p>

            <div className="space-y-4 mb-8">
              {ARTIST_FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl artist-grad-bg flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-bold text-[#111] text-sm">{f.title}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/join"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity">
              Create Your Profile <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works + Demo ───────────────────────────────────────────────────────
const HOW_STEPS = [
  { badge: "01", title: "Describe your need", desc: "Type it out like you would in a text message — \"Need a sub hip hop teacher Saturday, $50/hr, Lincoln Park.\"", icon: "✍️" },
  { badge: "02", title: "Artswrk parses it", desc: "We turn your description into a clean, professional job listing — title, rate, location, and schedule auto-filled.", icon: "⚡" },
  { badge: "03", title: "Artists apply, you hire", desc: "Your listing goes live to 6,000+ artists. Review profiles, message applicants, and book — all in one place.", icon: "🎉" },
];

function HowItWorks() {
  return (
    <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />
      <div className="relative z-10 mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4">How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            From idea to hired in{" "}
            <span className="hirer-grad-text">3 steps</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-lg mx-auto">
            No account needed to preview. See exactly how your listing looks before you publish.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {HOW_STEPS.map((step, i) => (
            <div key={step.badge} className="relative bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/7 transition-colors">
              {i < HOW_STEPS.length - 1 && (
                <ChevronRight size={16} className="hidden md:block absolute top-10 -right-3 text-white/20 z-10" />
              )}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black text-sm">
                  {step.badge}
                </div>
                <span className="text-xl">{step.icon}</span>
              </div>
              <h3 className="text-lg font-black text-white mb-2">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Interactive demo */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
          <div className="hirer-grad-bg px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
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

// ─── Live Jobs Ticker ──────────────────────────────────────────────────────────
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
  const { data: jobs } = trpc.jobs.publicListEnriched.useQuery({ limit: 20, offset: 0 });
  const tickerItems = jobs?.length
    ? jobs.map((j: { description?: string | null; locationAddress?: string | null }) => {
        const titleMatch = j.description?.match(/(?:looking for|hiring|need|seeking)\s+(?:a\s+)?([^.!?\n,]{3,40})/i);
        const title = titleMatch ? titleMatch[1].trim() : (j.description?.slice(0, 40) || "Open Role");
        return `${title} · ${j.locationAddress || "Remote"}`;
      })
    : SAMPLE_JOB_TICKERS;
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <section className="py-10 bg-white border-b border-gray-100">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">
        Live on Artswrk Right Now
      </p>
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
        <Link href="/browse"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
          Browse All Open Jobs <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

// ─── Artist Strip ──────────────────────────────────────────────────────────────
function ArtistStrip() {
  const doubled = [...STRIP, ...STRIP];
  return (
    <section className="py-8 bg-[#fafafa] overflow-hidden">
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

// ─── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "I posted a job at 9pm and had 4 qualified applicants by morning. This is exactly what the dance industry needed.",
    name: "Sarah M.",
    role: "Studio Owner · Chicago, IL",
    color: "hirer-grad-bg",
  },
  {
    quote: "As a competition director, finding judges used to take weeks of emails. Artswrk cut that down to a single afternoon.",
    name: "Marcus T.",
    role: "Competition Director · Atlanta, GA",
    color: "artist-grad-bg",
  },
  {
    quote: "I've picked up 3 recurring teaching gigs through Artswrk this year. The platform actually understands how dance work works.",
    name: "Jenna L.",
    role: "Dance Teacher · New York, NY",
    color: "hirer-grad-bg",
  },
];

function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">What People Are Saying</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight">
            Loved by the dance community
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-[#fafafa] rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex text-yellow-400 text-sm mb-5">★★★★★</div>
              <blockquote className="text-[#111] font-medium text-base leading-relaxed mb-6">
                "{t.quote}"
              </blockquote>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${t.color} flex-shrink-0`} />
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

// ─── Audience Cards ────────────────────────────────────────────────────────────
const AUDIENCE_CARDS = [
  {
    icon: Building2,
    eyebrow: "Dance Studios",
    headline: "Fill your roster fast",
    desc: "Sub teachers, recurring instructors, choreographers — post any role and get qualified applicants within hours.",
    cta: "Post a Job",
    href: "/join",
    grad: "hirer-grad-bg",
    gradText: "hirer-grad-text",
    img: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&q=80",
  },
  {
    icon: Trophy,
    eyebrow: "Competitions & Events",
    headline: "Book judges & faculty",
    desc: "Certified judges, choreographers, and faculty for your next event — all in one network, no Facebook groups needed.",
    cta: "Browse Artists",
    href: "/browse",
    grad: "artist-grad-bg",
    gradText: "artist-grad-text",
    img: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&q=80",
  },
  {
    icon: Music4,
    eyebrow: "Music Schools",
    headline: "Find teaching talent",
    desc: "Piano, violin, voice — hire vetted music teachers for lessons, recitals, and everything in between.",
    cta: "Post a Job",
    href: "/join",
    grad: "hirer-grad-bg",
    gradText: "hirer-grad-text",
    img: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80",
  },
];

function AudienceCards() {
  return (
    <section className="py-24 bg-[#fafafa]">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Built For</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight max-w-2xl">
            Every corner of the performing arts industry
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {AUDIENCE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.eyebrow} className="group relative rounded-2xl overflow-hidden bg-white border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="h-48 overflow-hidden">
                  <img src={card.img} alt={card.eyebrow} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 h-48 bg-gradient-to-b from-transparent to-black/30" />
                </div>
                <div className="p-6">
                  <div className={`w-10 h-10 rounded-xl ${card.grad} flex items-center justify-center mb-4 shadow-md`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${card.gradText}`}>{card.eyebrow}</p>
                  <h3 className="text-xl font-black text-[#111] leading-tight mb-2">{card.headline}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-5">{card.desc}</p>
                  <Link href={card.href}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white ${card.grad} hover:opacity-90 transition-opacity`}>
                    {card.cta} <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────────────────
const HIRER_FAQS = [
  { q: "Are there fees to hire on Artswrk?", a: "It is free to post unlimited jobs on Artswrk. To unlock applications, you can do a one-time job unlock or subscribe for unlimited access." },
  { q: "How do payments work?", a: "You can pay artists directly through Artswrk with digital payment links, or process payment through your regular payroll." },
  { q: "Do I have to provide tax documentation?", a: "If payment is processed through Artswrk, our partner Stripe Connect handles 1099-NEC tax documentation for eligible artists. Otherwise, documentation comes from your business." },
  { q: "Who are the Artswrk artists?", a: "Artswrk artists are vetted performing arts professionals — dance teachers, judges, musicians, photographers, videographers, and production staff." },
];

const ARTIST_FAQS = [
  { q: "How do I get booked on Artswrk?", a: "Create your artist profile with your services, rates, and availability. Hirers can find and book you directly, or you can apply to open job listings." },
  { q: "How do payments work?", a: "You receive payment directly to your bank account via direct deposit after each completed booking. Artswrk handles all payment processing." },
  { q: "How do taxes work?", a: "Artswrk issues 1099-NEC forms to eligible artists. All your earnings are tracked in one place, making tax season much simpler." },
  { q: "Who are the Artswrk clients?", a: "Artswrk clients include dance studios, music schools, competition companies, event production, and individuals hiring performing arts professionals." },
];

type FaqTab = "hirers" | "artists";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button className="w-full flex items-center justify-between py-4 text-left gap-4 group" onClick={() => setOpen(!open)}>
        <span className="font-semibold text-[#111] text-sm group-hover:opacity-70 transition-opacity">{q}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4 text-gray-500 text-sm leading-relaxed">{a}</div>}
    </div>
  );
}

function FAQ() {
  const [tab, setTab] = useState<FaqTab>("hirers");
  const faqs = tab === "hirers" ? HIRER_FAQS : ARTIST_FAQS;

  return (
    <section className="py-24 bg-white">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">FAQs</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-6">
              Frequently asked questions
            </h2>
            <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full p-1 mb-6">
              {(["hirers", "artists"] as FaqTab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    tab === t ? "bg-white text-[#111] shadow-sm" : "text-gray-500"
                  }`}>
                  For {t === "hirers" ? "Hirers" : "Artists"}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-sm">
              Still have questions?{" "}
              <a href="mailto:contact@artswrk.com" className="font-medium text-[#F25722] underline underline-offset-2 hover:opacity-70">
                Email us at contact@artswrk.com
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

// ─── CTA Banner ────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.12] blur-3xl" style={{ background: "linear-gradient(135deg, #FFBC5D, #F25722)" }} />

      <div className="relative z-10 mx-auto px-5 lg:px-10 max-w-4xl text-center">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-6">Ready to Get Started?</p>
        <h2 className="text-5xl md:text-6xl font-black text-white leading-tight mb-5">
          The dance industry's
          <br />
          <span className="hirer-grad-text">hiring platform.</span>
        </h2>
        <p className="text-gray-500 text-xl mb-10 max-w-xl mx-auto">
          Join 1,000+ studios and 6,000+ artists already connecting on Artswrk.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/join"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold text-[#111] bg-white hover:bg-gray-50 transition-colors shadow-xl">
            Post Your First Job <ArrowRight size={18} />
          </Link>
          <Link href="/browse"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold text-white/80 border border-white/20 hover:bg-white/8 transition-colors">
            Browse Artists
          </Link>
        </div>
        <p className="text-gray-600 text-xs mt-6">Free to post · No credit card required</p>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#050505] text-gray-500 py-14">
      <div className="mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <img src={LOGO_URL} alt="Artswrk" className="h-7 mb-4" />
            <p className="text-sm leading-relaxed">The hiring platform for performing arts professionals.</p>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">For Hirers</h4>
            <ul className="space-y-2.5 text-sm">
              {["Post a Job", "Browse Artists", "Pricing", "How It Works"].map((l) => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">For Artists</h4>
            <ul className="space-y-2.5 text-sm">
              {["Create Profile", "Find Jobs", "Get Paid", "Resources"].map((l) => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "About", href: "/about" },
                { label: "Job Board", href: "/jobs" },
                { label: "Contact", href: "mailto:contact@artswrk.com" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map((l) => (
                <li key={l.label}><a href={l.href} className="hover:text-white transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-700">© 2024 Artswrk. All rights reserved.</p>
          <p className="text-xs text-gray-700">contact@artswrk.com</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <TrustedBy />
      <ForHirers />
      <HowItWorks />
      <ForArtists />
      <LiveJobsTicker />
      <ArtistStrip />
      <Testimonials />
      <AudienceCards />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}
