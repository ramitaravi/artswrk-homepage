import { Link } from "wouter";
import { MapPin, Clock } from "lucide-react";

/**
 * The single, standard job list-item card — used for the regular jobs list,
 * the PRO jobs list, and the applications list on the Jobs page (and
 * anywhere else a job/application needs to render as a row in a list).
 * Edit this one component to change how a job card looks anywhere it's used.
 */
export default function JobListCard({
  href,
  avatarUrl,
  avatarFallbackText,
  avatarGradient = "artist",
  avatarBlurred = false,
  borderVariant = "default",
  topBadge,
  title,
  subtitle,
  location,
  postedAgo,
  dateLabel,
  rate,
  cta,
}: {
  href: string;
  avatarUrl?: string | null;
  /** Text to derive the fallback initial from when there's no avatar image. */
  avatarFallbackText: string;
  /** "artist" = pink ec008c→ff7171 gradient fallback. "client" = orange FFBC5D→F25722 gradient fallback. */
  avatarGradient?: "artist" | "client";
  /** Blur the avatar (used for locked/un-unlocked PRO jobs). */
  avatarBlurred?: boolean;
  /** "pro" gives the card a pink-tinted border instead of the standard grey one. */
  borderVariant?: "default" | "pro";
  /** Small badge row above the title, e.g. "PRO Job", "Priority Listing". */
  topBadge?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  location?: string | null;
  postedAgo?: string | null;
  /** e.g. "Ongoing", or a formatted date/time string. */
  dateLabel?: string | null;
  rate?: string | null;
  /** Right-side pill — Apply/Applied/status/etc. */
  cta: React.ReactNode;
}) {
  const gradientClass = avatarGradient === "client" ? "hirer-grad-bg" : "artist-grad-bg";
  const borderClass =
    borderVariant === "pro"
      ? "border-pink-100 hover:border-pink-200"
      : "border-gray-100 hover:border-gray-200";

  return (
    <Link href={href} className="block">
      <div
        className={`flex items-start gap-4 p-5 rounded-2xl border ${borderClass} bg-white hover:shadow-sm transition-all duration-150 cursor-pointer`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={avatarFallbackText}
              className={`w-full h-full object-cover ${avatarBlurred ? "blur-md scale-125" : ""}`}
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const fb = el.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`w-full h-full flex items-center justify-center text-white text-base font-black ${gradientClass}`}
            style={{ display: avatarUrl ? "none" : "flex" }}
          >
            {avatarFallbackText[0]?.toUpperCase() ?? "?"}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {topBadge && <div className="flex items-center gap-1 mb-1.5">{topBadge}</div>}
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <h3 className="font-bold text-[#111] text-base leading-tight truncate">{title}</h3>
              {subtitle && <p className="text-sm text-gray-500 truncate mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex-shrink-0">{cta}</div>
          </div>
          {(location || postedAgo) && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
              {location && (
                <>
                  <MapPin size={10} className="flex-shrink-0" />
                  <span className="truncate">{location}</span>
                </>
              )}
              {location && postedAgo && <span className="text-gray-200 mx-1">·</span>}
              {postedAgo && <span className="flex-shrink-0">Posted {postedAgo}</span>}
            </div>
          )}
          {(dateLabel || rate) && (
            <div className="flex items-center gap-2 text-xs flex-wrap mt-2.5">
              {dateLabel && (
                <span className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fdeaf5", color: "#ec008c" }}>
                  <Clock size={10} />
                  {dateLabel}
                </span>
              )}
              {rate && (
                <span className="font-medium border rounded-full px-2 py-0.5 text-gray-600 border-gray-200">
                  {rate}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Standard Apply/Applied CTA pill — the shared visual for every job list card. */
export function ApplyCta({ applied }: { applied: boolean }) {
  return (
    <span
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${
        applied ? "text-green-700 bg-green-50 border border-green-200" : "text-white bg-[#111]"
      }`}
    >
      {applied ? "Applied" : "Apply →"}
    </span>
  );
}
