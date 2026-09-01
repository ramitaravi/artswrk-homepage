/**
 * "Artswrk went through a refresh" announcement — shown once at the top of
 * the dashboard until dismissed (persisted per-browser via localStorage, so
 * it doesn't come back next visit). Artist and client copy differ; render
 * with the right one for the dashboard it's on.
 */
import { useState } from "react";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY_PREFIX = "artswrk-refresh-banner-dismissed-";

export default function RefreshAnnouncementBanner({ variant }: { variant: "artist" | "client" }) {
  const storageKey = DISMISS_KEY_PREFIX + variant;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function dismiss() {
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
    <div className={`relative mx-4 lg:mx-6 mt-4 rounded-2xl border bg-gradient-to-r ${bg} p-5 lg:p-6 flex-shrink-0`} style={{ borderColor: `${accent}33` }}>
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>

      <h2 className="text-lg font-black text-[#111] flex items-center gap-1.5 pr-8">
        Artswrk went through a refresh <Sparkles size={16} style={{ color: accent }} />
      </h2>
      <p className="text-sm font-semibold text-gray-600 mt-1 mb-3">Here's what's new:</p>

      {variant === "artist" ? (
        <ul className="space-y-2.5 text-sm text-gray-700 leading-relaxed">
          <li>
            <strong className="text-[#111]">No more commission</strong> — in an effort to get you connected with more clients and the work you love, we've made the Artswrk platform completely commission free! Feel free to talk freely about rates and more.
          </li>
          <li>
            <strong className="text-[#111]">Annual Unlock:</strong> Unlock the Artswrk platform for an entire year; access PRO with a 7 day free trial. More connections, more flexibility, and more opportunities.
          </li>
          <li>
            <strong className="text-[#111]">Benefits Portal:</strong> We are thrilled to share our brand new benefits portal! Get access to truly thousands in partner discounts from classes at studios like Broadway Dance Center to curriculum and software you need to power your arts career. For Artswrk PRO members only!
          </li>
          <li>
            <strong className="text-[#111]">Feature improvements:</strong> Saved resumes, saved applications, boosted profile visibility, better filtering and so much more. We're here to make Artswrk the best experience it can be!
          </li>
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic">(Client copy not set yet)</p>
      )}

      <p className="text-xs text-gray-500 mt-4">
        If you have any questions, concerns, or bugs — don't hesitate to reach out to us at{" "}
        <a href="mailto:contact@artswrk.com" className="font-semibold underline" style={{ color: accent }}>
          contact@artswrk.com
        </a>
        .
      </p>
    </div>
  );
}
