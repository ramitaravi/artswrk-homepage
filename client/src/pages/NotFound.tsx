/**
 * Last-resort landing for a URL nothing else matched.
 *
 * server/redirects.ts already maps every known legacy Bubble pattern, so
 * anything reaching here is genuinely unknown — a typo, a link we never had, or
 * a page that's gone. Rather than leaving someone parked on a dead end that
 * needs a click, this says what happened and takes them home on its own.
 *
 * The redirect REPLACES the history entry instead of pushing: pushing would
 * mean Back returns to this page, which would immediately bounce them forward
 * again, trapping them on the only screen they're trying to leave.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/** Long enough to read the message, short enough not to feel stuck. */
const REDIRECT_DELAY_MS = 2500;

export default function NotFound() {
  const [, setLocation] = useLocation();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setLocation("/", { replace: true });
      } catch {
        // If the router can't navigate for any reason, fall back to a hard
        // load — and if even that is blocked, the manual link below remains.
        try {
          window.location.replace("/");
        } catch {
          setFailed(true);
        }
      }
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [setLocation]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-5 font-[Poppins,sans-serif]">
      {/* aria-live so a screen reader announces the redirect rather than
          silently moving the user somewhere they didn't ask to go. */}
      <div className="text-center" role="status" aria-live="polite">
        <div className="mb-6 flex justify-center">
          <Loader2 size={28} className="animate-spin text-[#F25722] motion-reduce:animate-none" />
        </div>

        <h1 className="mb-2 text-2xl font-black text-[#111]">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-gray-500">
          {failed
            ? "Head back to the homepage to keep going."
            : "Taking you back to the homepage…"}
        </p>

        {/* Always rendered: it's the escape hatch if the timer never fires
            (JS error, bfcache restore) and lets an impatient visitor skip the
            wait rather than watching a spinner. */}
        <a
          href="/"
          className="inline-block rounded-xl bg-[#111] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#3D3D4A]"
        >
          Go to Artswrk
        </a>
      </div>
    </div>
  );
}
