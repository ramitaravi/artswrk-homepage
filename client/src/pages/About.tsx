import { Link } from "wouter";
import { Mail, Instagram, Linkedin } from "lucide-react";
import Navbar from "@/components/Navbar";

const NICK_SILVERIO_PHOTO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/nick-silverio_dcf05567.jpg";
const NICK_HEADSHOT =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/nick-silverio-headshot_c7a73b70.jpeg";
const RAMITA_PHOTO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/ramita-ravi_17b3d8bb.png";

export default function About() {
  return (
    <div className="bg-white min-h-screen font-[Poppins,sans-serif]">
      <Navbar />
      {/* ── Hero ─────────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-4">
              About Artswrk
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111] leading-tight mb-6">
              Shattering the Starving Artist Stigma
            </h1>
            <p className="text-gray-500 text-lg leading-relaxed mb-8 max-w-lg">
              Artswrk was built by artists for artists with a mission to help
              performing artists make money doing what they love.
            </p>
            <a
              href="mailto:contact@artswrk.com"
              className="inline-block bg-[#111] text-white text-sm font-bold px-7 py-3.5 rounded-full hover:bg-gray-800 transition-colors"
            >
              Get In Touch
            </a>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gray-100">
              <img
                src={NICK_SILVERIO_PHOTO}
                alt="Nick Silverio — Co-Founder of Artswrk"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl px-5 py-3 border border-gray-100">
              <p className="text-xs text-gray-400 font-medium">Artists on platform</p>
              <p className="text-2xl font-black text-[#111]">5,000+</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission & Vision ────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 px-5 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3 text-center">
            Why Artswrk?
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-12">
            Our Mission &amp; Vision
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="w-12 h-12 rounded-2xl hirer-grad-bg flex items-center justify-center mb-5 text-xl">
                ❤️
              </div>
              <h3 className="text-xl font-black text-[#111] mb-3">Our Mission</h3>
              <p className="text-gray-500 leading-relaxed">
                We're on a mission to shatter the starving artist stigma for
                millions of performing artists worldwide.
              </p>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="w-12 h-12 rounded-2xl hirer-grad-bg flex items-center justify-center mb-5 text-xl">
                ✨
              </div>
              <h3 className="text-xl font-black text-[#111] mb-3">Our Vision</h3>
              <p className="text-gray-500 leading-relaxed">
                Our vision is to use technology to empower artists &amp; small
                businesses in the 21st century.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quote + Photo ───────────────────────────────────────────────── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gray-100">
              <img
                src={NICK_SILVERIO_PHOTO}
                alt="Nick Silverio in front of Frozen Broadway"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>
          <div>
            <div className="w-12 h-1 hirer-grad-bg rounded-full mb-8" />
            <blockquote className="text-2xl md:text-3xl font-bold text-[#111] leading-snug mb-8">
              "We spent years working across TV/Film/Theater, yet faced the
              age-old artist roller coaster. We built Artswrk to give artists
              an opportunity to pick up work, build a safety net, and find
              stability doing what they love."
            </blockquote>
            <div>
              <p className="font-black text-[#111] text-lg">
                Ramita Ravi &amp; Nick Silverio
              </p>
              <p className="text-gray-400 text-sm mt-1">Co-Founders, Artswrk</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 px-5 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3 text-center">
            About Artswrk
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-3">
            Built by Artists, For Artists
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            Artswrk's founding team brings together 10+ years of partnership
            &amp; arts-tech expertise
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Nick */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                <img
                  src={NICK_HEADSHOT}
                  alt="Nick Silverio"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-black text-[#111]">Nick Silverio</h3>
                <p className="text-sm hirer-grad-text font-semibold mb-3">
                  Co-Founder
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Nick Silverio graduated from Wharton with a degree in
                  Commercial Dance Management. He was most recently seen on the
                  Broadway National Tour of Frozen, Saturday Night Live, and in
                  the Marvelous Mrs. Maisel. By day, he opened the NYC markets
                  of [solidcore] and Equinox+.
                </p>
              </div>
            </div>
            {/* Ramita */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                <img
                  src={RAMITA_PHOTO}
                  alt="Ramita Ravi"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-black text-[#111]">Ramita Ravi</h3>
                <p className="text-sm hirer-grad-text font-semibold mb-3">
                  Co-Founder
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Ramita Ravi is a UPenn alum. She was one of the first South
                  Asians on So You Think You Can Dance and in the Radio City
                  Christmas Spectacular. She has also choreographed for
                  Coachella and Miss America. By day, she was an 8x product
                  designer and marketer for early stage startups backed by YC
                  &amp; a16z.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Advisors & Investors ─────────────────────────────────────────── */}
      <section className="py-20 px-5 lg:px-10 max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black text-[#111] text-center mb-3">
          Advisors &amp; Investors
        </h2>
        <p className="text-gray-500 text-center mb-12">
          Artswrk is backed &amp; advised by leaders from
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale">
          {["Google", "Meta", "Spotify", "Airbnb", "Stripe", "Sequoia"].map(
            (co) => (
              <div
                key={co}
                className="text-xl font-black text-gray-400 tracking-tight"
              >
                {co}
              </div>
            )
          )}
        </div>
      </section>

      {/* ── Get In Touch ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 px-5 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold hirer-grad-text uppercase tracking-widest mb-3">
            Get In Touch
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-3">
            Connect with us
          </h2>
          <p className="text-gray-500 mb-12">
            Interested in working together? Reach out to us.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href="mailto:contact@artswrk.com"
              className="flex items-center gap-3 bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="w-10 h-10 rounded-xl hirer-grad-bg flex items-center justify-center">
                <Mail size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 font-medium">Email</p>
                <p className="text-sm font-bold text-[#111]">
                  contact@artswrk.com
                </p>
              </div>
            </a>
            <a
              href="https://instagram.com/artswrkofficial"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="w-10 h-10 rounded-xl artist-grad-bg flex items-center justify-center">
                <Instagram size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 font-medium">Instagram</p>
                <p className="text-sm font-bold text-[#111]">
                  @artswrkofficial
                </p>
              </div>
            </a>
            <a
              href="https://linkedin.com/company/artswrk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0077B5] flex items-center justify-center">
                <Linkedin size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 font-medium">LinkedIn</p>
                <p className="text-sm font-bold text-[#111]">
                  linkedin.com/company/artswrk
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
