/**
 * "Artswrk went through a refresh" announcement — a compact, collapsible bar
 * at the top of the dashboard (onboarding-checklist style, not a big banner).
 * Collapsed by default each session; dismissal is persisted per-browser via
 * localStorage so it stops showing up entirely once closed. Artist and
 * client copy differ; render with the right one for the dashboard it's on.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Sparkles, X, ChevronDown } from "lucide-react";

const DISMISS_KEY_PREFIX = "artswrk-refresh-banner-dismissed-";

function PlanLink({ href, accent, children }: { href: string; accent: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold underline underline-offset-2" style={{ color: accent }}>
      {children}
    </Link>
  );
}

export default function RefreshAnnouncementBanner({ variant }: { variant: "artist" | "client" }) {
  const storageKey = DISMISS_KEY_PREFIX + variant;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Private browsing / storage blocked — dismiss for this view anyway.
    }
    setDismissed(true);
  }

  const accent = variant === "artist" ? "#ec008c" : "#F25722";
  const bg = variant === "artist" ? "from-pink-50 to-orange-50" : "from-orange-50 to-amber-50";

  return (
    <div className={`relative mx-4 lg:mx-6 mt-4 rounded-xl border bg-gradient-to-r ${bg} flex-shrink-0 overflow-hidden`} style={{ borderColor: `${accent}33` }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 pl-4 pr-11 py-2.5 text-left"
      >
        <Sparkles size={14} className="flex-shrink-0" style={{ color: accent }} />
        <span className="text-sm font-bold text-[#111] truncate">Artswrk went through a refresh</span>
        <span className="text-xs text-gray-500 hidden sm:inline truncate">— here's what's new</span>
        <ChevronDown
          size={16}
          className={`ml-auto flex-shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <button
        onClick={dismiss}
        className="absolute top-2 right-2.5 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {variant === "artist" ? (
            <ul className="space-y-2.5 text-sm text-gray-700 leading-relaxed">
              <li>
                <strong className="text-[#111]">No more commission</strong> — in an effort to get you connected with more clients and the work you love, we've made the Artswrk platform completely commission free! Feel free to talk freely about rates and more.
              </li>
              <li>
                <strong className="text-[#111]">Annual Unlock:</strong> and it's cheaper than ever — PRO is now <b>$9.16/mo</b> billed annually ($110/yr), down from the old $10.99/mo plan. Access PRO with a 7 day free trial for more connections, more flexibility, and more opportunities.{" "}
                <PlanLink href="/app/settings" accent={accent}>Subscribe or upgrade to annual →</PlanLink>
              </li>
              <li>
                <strong className="text-[#111]">Benefits Portal:</strong> we're thrilled to share our brand new benefits portal! Get access to thousands in partner discounts from studios like Broadway Dance Center to the curriculum and software you need to power your arts career. For Artswrk PRO members only.{" "}
                <PlanLink href="/app/benefits" accent={accent}>Explore the Benefits Portal →</PlanLink>
              </li>
              <li>
                <strong className="text-[#111]">Feature improvements:</strong> Saved resumes, saved applications, boosted profile visibility, better filtering and so much more. We're here to make Artswrk the best experience it can be!
              </li>
            </ul>
          ) : (
            // Client bullets are deliberately link-free for now — the
            // destinations aren't ready to be pointed at yet. Add the same
            // PlanLink CTAs the artist variant uses when they are.
            <ul className="space-y-2.5 text-sm text-gray-700 leading-relaxed">
              <li>
                <strong className="text-[#111]">No more commission</strong> — in an effort to connect you with the best artists, Artswrk is now completely commission free. Talk rates and details freely, directly with the artists you hire.
              </li>
              <li>
                <strong className="text-[#111]">Posting a job is easier:</strong> type what you need and we'll do the rest — no long forms.
              </li>
              <li>
                <strong className="text-[#111]">Boost your jobs</strong> to get more visibility and reach more artists, faster.
              </li>
              <li>
                <strong className="text-[#111]">Your own hiring page:</strong> a customizable, shareable page for your business that shows who you are and what you're hiring for.
              </li>
              <li>
                <strong className="text-[#111]">Browse artists sitewide</strong> and save your favorites to build a go-to roster you can rehire in a click. <span className="text-gray-500">Premium members only.</span>
              </li>
              <li>
                <strong className="text-[#111]">Benefits Portal:</strong> partner discounts valuable enough to pay back your annual subscription three times over. <span className="text-gray-500">Premium members only.</span>
              </li>
            </ul>
          )}

          <p className="text-xs text-gray-500 mt-4">
            If you have any questions, concerns, or bugs — don't hesitate to reach out to us at{" "}
            <a href="mailto:contact@artswrk.com" className="font-semibold underline" style={{ color: accent }}>
              contact@artswrk.com
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
