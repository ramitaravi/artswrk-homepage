/*
 * ARTSWRK HOMEPAGE
 * Design: Refined Modern "Premium Platform"
 * Sections: Navbar, Hero, Artist Strip, For Hirers, For Businesses, How It Works, FAQ, Footer
 * Colors: White base, #111 text, orange-coral gradient (#F97316 → #E91E8C)
 * Fonts: Syne (headlines) + DM Sans (body)
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

// ─── Asset URLs ───────────────────────────────────────────────────────────────
const ASSETS = {
  heroDancer: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/hero-dancer-RNsAHegik3KLZQWD8UhWAz.webp",
  strip1: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
  strip2: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-2-Vo37fp95iDpS9ybaZkYWJB.webp",
  strip3: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-3-hjiUkBU9Pft72RAaeq8oxW.webp",
  strip4: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-4-VXD8jrv6pEif6NSzyXHom4.webp",
};

// Unsplash images for business cards and app mockup backgrounds
const BUSINESS_CARDS = [
  {
    label: "Dance Studio",
    img: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&q=80",
  },
  {
    label: "Dance Competition",
    img: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&q=80",
  },
  {
    label: "Music School",
    img: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80",
  },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hirersOpen, setHirersOpen] = useState(false);
  const [artistsOpen, setArtistsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-white"
      }`}
    >
      <div className="container mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-0 select-none">
            <span
              className="font-black text-2xl tracking-tight"
              style={{
                fontFamily: "Syne, sans-serif",
                background: "linear-gradient(135deg, #F97316, #E91E8C)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ARTS
            </span>
            <span
              className="font-black text-2xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              WRK
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">
              Jobs
            </a>
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">
              About
            </a>

            {/* For Hirers dropdown */}
            <div className="relative" onMouseEnter={() => setHirersOpen(true)} onMouseLeave={() => setHirersOpen(false)}>
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black transition-colors">
                For Hirers <ChevronDown size={14} className={`transition-transform ${hirersOpen ? "rotate-180" : ""}`} />
              </button>
              {hirersOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  {["Post a Job", "Browse Artists", "Pricing", "How It Works"].map((item) => (
                    <a key={item} href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                      {item}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* For Artists dropdown */}
            <div className="relative" onMouseEnter={() => setArtistsOpen(true)} onMouseLeave={() => setArtistsOpen(false)}>
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black transition-colors">
                For Artists <ChevronDown size={14} className={`transition-transform ${artistsOpen ? "rotate-180" : ""}`} />
              </button>
              {artistsOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  {["Create Profile", "Find Jobs", "Get Paid", "Resources"].map((item) => (
                    <a key={item} href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                      {item}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a href="#" className="text-sm font-medium text-gray-700 hover:text-black transition-colors">
              Login
            </a>
            <a
              href="#"
              className="text-sm font-semibold text-white bg-[#111] px-4 py-2 rounded-full hover:bg-gray-800 transition-colors"
            >
              Join
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-3">
          {["Jobs", "About", "For Hirers", "For Artists"].map((item) => (
            <a key={item} href="#" className="block text-sm font-medium text-gray-700 py-1">
              {item}
            </a>
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

// ─── Hero Section ─────────────────────────────────────────────────────────────
function Hero() {
  const [activeTab, setActiveTab] = useState<"hirers" | "artists">("hirers");
  const [email, setEmail] = useState("");

  return (
    <section className="pt-28 pb-0 bg-white text-center relative overflow-hidden">
      <div className="container mx-auto px-5 lg:px-10 max-w-4xl">
        {/* Logo badge */}
        <div className="inline-flex items-center gap-0 mb-6 select-none">
          <span
            className="font-black text-3xl tracking-tight"
            style={{
              fontFamily: "Syne, sans-serif",
              background: "linear-gradient(135deg, #F97316, #E91E8C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ARTS
          </span>
          <span
            className="font-black text-3xl tracking-tight bg-[#111] text-white px-2 py-0.5 rounded ml-1"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            WRK
          </span>
        </div>

        {/* Toggle pills */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab("hirers")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === "hirers"
                ? "text-white shadow-md"
                : "text-gray-500 bg-gray-100 hover:bg-gray-200"
            }`}
            style={
              activeTab === "hirers"
                ? { background: "linear-gradient(135deg, #F97316, #E91E8C)" }
                : {}
            }
          >
            for hirers
          </button>
          <button
            onClick={() => setActiveTab("artists")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === "artists"
                ? "text-white shadow-md"
                : "text-gray-500 bg-gray-100 hover:bg-gray-200"
            }`}
            style={
              activeTab === "artists"
                ? { background: "linear-gradient(135deg, #F97316, #E91E8C)" }
                : {}
            }
          >
            for artists
          </button>
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-black text-[#111] leading-[1.05] tracking-tight mb-8"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          {activeTab === "hirers"
            ? "The Hiring Platform for Artists"
            : "Find Your Next Gig in the Arts"}
        </h1>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto mb-0">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full sm:flex-1 px-4 py-3 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
          />
          <button
            className="btn-gradient whitespace-nowrap px-6 py-3 rounded-full text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #F97316, #E91E8C)" }}
          >
            {activeTab === "hirers" ? "Start Hiring →" : "Find Jobs →"}
          </button>
        </div>
      </div>

    </section>
  );
}

// ─── Artist Strip ─────────────────────────────────────────────────────────────
function ArtistStrip() {
  const images = [
    ASSETS.strip1,
    ASSETS.strip2,
    ASSETS.strip3,
    ASSETS.strip4,
    ASSETS.heroDancer,
    // Unsplash extras for variety
    "https://images.unsplash.com/photo-1547153760-18fc86324498?w=300&q=80",
    "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=300&q=80",
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=300&q=80",
  ];

  // Duplicate for seamless loop
  const doubled = [...images, ...images];

  return (
    <section className="py-10 bg-white overflow-hidden">
      <div className="relative overflow-hidden">
        <div className="ticker-track">
          {doubled.map((src, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-36 h-48 md:w-44 md:h-60 mx-1.5 rounded-2xl overflow-hidden"
            >
              <img
                src={src}
                alt={`Artist ${i}`}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Hirers Section ───────────────────────────────────────────────────────
function ForHirers() {
  const hireItems = [
    { emoji: "🩰", title: "Hire Dance Teachers", desc: "Hire part-time or full-time staff for your studio" },
    { emoji: "🎤", title: "Hire Dance Judges", desc: "Find experienced judges for your competitions" },
    { emoji: "🎵", title: "Hire Music Teachers", desc: "Connect with qualified music instructors" },
    { emoji: "📸", title: "Hire Photographers", desc: "Book professional arts photographers" },
    { emoji: "🎥", title: "Hire Videographers", desc: "Find videographers who specialize in the arts" },
    { emoji: "📽️", title: "Hire Event & Production Staff", desc: "Staff your next performance or event" },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: text */}
          <div>
            <p className="eyebrow mb-3">For Hirers</p>
            <h2
              className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-8"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Post Jobs & Hire Qualified Talent
            </h2>
            <div className="space-y-4">
              {hireItems.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-orange-50 transition-colors group cursor-pointer"
                >
                  <span className="text-xl mt-0.5 flex-shrink-0">{item.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-[#111] text-sm group-hover:text-orange-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: app mockup */}
          <div className="relative">
            <div className="bg-[#111] rounded-2xl overflow-hidden shadow-2xl">
              {/* Mockup top bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a]">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              {/* Mockup content */}
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1547153760-18fc86324498?w=700&q=80"
                  alt="Artist profile"
                  className="w-full h-72 object-cover opacity-80"
                />
                {/* WRK badge */}
                <div className="absolute bottom-4 right-4 bg-white rounded-lg px-3 py-1.5 shadow-lg">
                  <span
                    className="font-black text-lg"
                    style={{ fontFamily: "Syne, sans-serif" }}
                  >
                    WRK
                  </span>
                </div>
                {/* Profile card overlay */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg max-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500" />
                    <div>
                      <p className="font-semibold text-xs text-[#111]">Ramita R.</p>
                      <p className="text-xs text-gray-500">she/her · New York, NY</p>
                    </div>
                  </div>
                  <div className="flex text-yellow-400 text-xs mb-2">★★★★★</div>
                  <button
                    className="w-full text-xs font-semibold text-white py-1.5 rounded-lg"
                    style={{ background: "linear-gradient(135deg, #F97316, #E91E8C)" }}
                  >
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

// ─── Logo Ticker ──────────────────────────────────────────────────────────────
function LogoTicker() {
  const logos = [
    "Austen Dance Collective",
    "Ferrari Dance Center NYC",
    "Allegra Dance Greenwich",
    "Armonk Center for Dance",
    "Broadway Dance Theater",
    "Steps on Broadway",
    "Peridance Center",
    "Broadway Dance Academy",
  ];
  const doubled = [...logos, ...logos];

  return (
    <div className="overflow-hidden py-6 border-y border-gray-100">
      <div className="ticker-track" style={{ animationDuration: "30s" }}>
        {doubled.map((name, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex items-center gap-2 mx-8"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #F97316, #E91E8C)" }}
            />
            <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── For Businesses Section ───────────────────────────────────────────────────
function ForBusinesses() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="mb-10">
          <p className="eyebrow mb-3">For Businesses</p>
          <h2
            className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-3"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Hiring tools for performing arts businesses
          </h2>
          <p className="text-gray-500 text-lg">
            Join 700+ dance studios, music schools, and more hiring with Artswrk
          </p>
        </div>

        <LogoTicker />

        {/* Business type cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
          {BUSINESS_CARDS.map((card) => (
            <div
              key={card.label}
              className="relative rounded-2xl overflow-hidden h-72 group cursor-pointer"
            >
              <img
                src={card.img}
                alt={card.label}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Text */}
              <div className="absolute bottom-5 left-5">
                <p className="text-white/80 text-sm font-medium">I'm hiring for my</p>
                <h3
                  className="text-white text-2xl font-black"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  {card.label}
                </h3>
              </div>
              {/* Arrow */}
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works Section ─────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      title: "Post Jobs & Browse Artists",
      desc: "Post a job or browse thousands of vetted professional freelance artists",
      img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&q=80",
      badge: "01",
    },
    {
      title: "Book & Schedule Artists",
      desc: "View and schedule available artists on one simple screen. No more emails or FB groups",
      img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80",
      badge: "02",
    },
    {
      title: "Pay Artists Online",
      desc: "Pay artists digitally with a simple payment link. We take care of the rest!",
      img: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&q=80",
      badge: "03",
    },
  ];

  return (
    <section className="py-20 bg-[#fafafa]" id="how-it-works">
      <div className="container mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="text-center mb-14">
          <p className="eyebrow mb-3">How It Works</p>
          <h2
            className="text-4xl md:text-5xl font-black text-[#111] leading-tight"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            One tool to find, hire, and pay artists
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.title} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
              {/* Mockup header */}
              <div className="bg-[#111] px-4 py-2.5 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              {/* Image */}
              <div className="relative overflow-hidden h-48">
                <img
                  src={step.img}
                  alt={step.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Step badge */}
                <div
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black"
                  style={{ background: "linear-gradient(135deg, #F97316, #E91E8C)", fontFamily: "Syne, sans-serif" }}
                >
                  {step.badge}
                </div>
              </div>
              {/* Content */}
              <div className="p-5">
                <h3
                  className="font-black text-[#111] text-lg mb-2"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Are there fees to hire on Artswrk?",
    a: "Artswrk charges a small service fee on bookings made through the platform. There are no upfront subscription costs to post jobs or browse artists — you only pay when you successfully hire.",
  },
  {
    q: "How do payments work?",
    a: "Payments are processed securely through Artswrk. Once you confirm a booking, you'll receive a simple payment link. Artists receive their payment after the booking is completed, and Artswrk handles all the processing.",
  },
  {
    q: "Is there a cancellation policy?",
    a: "Yes. Cancellations made more than 48 hours before the scheduled booking are eligible for a full refund. Cancellations within 48 hours may be subject to a partial fee. Full details are available in our Terms of Service.",
  },
  {
    q: "Do I have to provide tax documentation?",
    a: "Artswrk handles 1099-NEC tax documentation for artists earning over $600 per year on the platform. As a hirer, you do not need to issue separate tax forms for artists you pay through Artswrk.",
  },
  {
    q: "Does Artswrk work with my existing payroll?",
    a: "Artswrk is a separate payment system from traditional payroll. It's designed specifically for freelance and gig-based arts professionals. You can use it alongside your existing payroll for full-time staff.",
  },
  {
    q: "Who are the Artswrk artists?",
    a: "Artswrk artists are vetted performing arts professionals including dance teachers, dance judges, musicians, photographers, videographers, and event production staff. All artists go through a profile review process before being listed.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between py-4 text-left gap-4 group"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-[#111] text-sm group-hover:text-orange-600 transition-colors">
          {q}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-4 text-gray-500 text-sm leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

function FAQ() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left */}
          <div>
            <p className="eyebrow mb-3">FAQs</p>
            <h2
              className="text-4xl md:text-5xl font-black text-[#111] leading-tight mb-4"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-base">
              Couldn't find the answer you were looking for?{" "}
              <a
                href="mailto:contact@artswrk.com"
                className="font-medium underline underline-offset-2 hover:text-orange-600 transition-colors"
                style={{ color: "#F97316" }}
              >
                Contact us at contact@artswrk.com
              </a>
            </p>
          </div>

          {/* Right: accordion */}
          <div>
            {FAQ_ITEMS.map((item) => (
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
    <section className="py-20 bg-[#111]">
      <div className="container mx-auto px-5 lg:px-10 max-w-4xl text-center">
        <h2
          className="text-4xl md:text-5xl font-black text-white leading-tight mb-4"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Ready to hire your next artist?
        </h2>
        <p className="text-gray-400 text-lg mb-8">
          Join 700+ performing arts businesses already hiring on Artswrk.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email address"
            className="w-full sm:flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-orange-400 transition-all"
          />
          <button
            className="whitespace-nowrap px-6 py-3 rounded-full text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #F97316, #E91E8C)" }}
          >
            Start Hiring →
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
      <div className="container mx-auto px-5 lg:px-10 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-0 mb-4 select-none">
              <span
                className="font-black text-xl tracking-tight"
                style={{
                  fontFamily: "Syne, sans-serif",
                  background: "linear-gradient(135deg, #F97316, #E91E8C)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ARTS
              </span>
              <span
                className="font-black text-xl tracking-tight bg-white text-[#111] px-1.5 py-0.5 rounded ml-0.5"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                WRK
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              The hiring platform for performing arts professionals.
            </p>
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
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <ArtistStrip />
      <ForHirers />
      <ForBusinesses />
      <HowItWorks />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}
