import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATE_ABBR: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
  "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
  "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA",
  "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT",
  "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
  "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
};

function abbreviateRegion(raw: string): string {
  const clean = raw.replace(/\d+/g, "").trim();
  if (!clean) return "";
  const abbr = STATE_ABBR[clean.toLowerCase()];
  if (abbr) return abbr;
  return clean.length <= 3 ? clean.toUpperCase() : clean;
}

/**
 * Formats a raw Google-Places-style location string (which may be a full
 * street address, e.g. "121 Dora Ave, Waldwick, NJ 07463, USA") down to a
 * clean "City, ST" display value. Structural rule: the last segment is the
 * country (dropped), the segment before that is state/zip, and the segment
 * before that is the city — regardless of whether earlier segments are a
 * street address or a neighborhood name.
 */
export function formatLocation(location?: string | null): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  if (parts.length === 2) {
    const second = parts[1].toLowerCase();
    if (second === "usa" || second === "us" || second === "united states") return parts[0];
    return `${parts[0]}, ${abbreviateRegion(parts[1])}`;
  }

  const city = parts[parts.length - 3];
  const region = abbreviateRegion(parts[parts.length - 2]);
  return region ? `${city}, ${region}` : city;
}

const JOB_TITLE_PATTERNS: [RegExp, string][] = [
  [/sub(stitute)?\s+teacher/i, "Substitute Teacher"],
  [/ballet/i, "Ballet Teacher"],
  [/hip\s*hop/i, "Hip Hop Instructor"],
  [/tap/i, "Tap Teacher"],
  [/jazz/i, "Jazz Teacher"],
  [/lyrical/i, "Lyrical Teacher"],
  [/contemporary/i, "Contemporary Teacher"],
  [/acro/i, "Acro Teacher"],
  [/piano/i, "Piano Teacher"],
  [/violin/i, "Violin Teacher"],
  [/voice|vocal/i, "Vocal Coach"],
  [/judge|adjudicat/i, "Dance Adjudicator"],
  [/choreograph/i, "Choreographer"],
  [/photograph/i, "Photographer"],
  [/videograph/i, "Videographer"],
  [/yoga/i, "Yoga Instructor"],
  [/pilates/i, "Pilates Instructor"],
  [/recurring|weekly|instructor/i, "Dance Instructor"],
  [/teacher|coach/i, "Dance Teacher"],
];

/**
 * A "short sweet title" for a regular (non-PRO) job — the single source of
 * truth used everywhere a job title is displayed. Bubble-sourced jobs often
 * have a full sentence/pitch stored directly in the title column (not just
 * missing), so a raw, non-empty `title` is not automatically trusted: it's
 * only used as-is when it actually reads like a short title. Otherwise falls
 * back to the first line of the description, then keyword-pattern matching,
 * then a truncated first line as a last resort.
 */
export function getJobTitle(
  title: string | null | undefined,
  description: string | null | undefined,
  posterName?: string | null,
): string {
  const rawTitle = title?.trim();
  const looksLikeShortTitle = !!rawTitle && rawTitle.length <= 60 && !/[.!?]$/.test(rawTitle);
  if (looksLikeShortTitle) return rawTitle!;

  const text = description?.trim() || rawTitle || "";
  if (!text) return "Open Position";

  const first = text.split("\n")[0].trim();
  const isPosterName = !!posterName && first.toLowerCase() === posterName.toLowerCase();
  if (first.length > 0 && first.length <= 60 && !isPosterName) return first;

  for (const [re, label] of JOB_TITLE_PATTERNS) {
    if (re.test(text)) return label;
  }

  return first.length > 60 ? `${first.slice(0, 60)}…` : (first || "Open Position");
}

/**
 * Normalizes an Instagram profile field that may be stored as a plain
 * handle ("ramita.ravi"), an "@handle", or a full pasted URL
 * ("https://www.instagram.com/ramita.ravi/") — all three show up in
 * synced Bubble data. Returns a clean handle for display and a correct
 * profile URL for the link, or null if the value can't be parsed.
 */
export function normalizeInstagram(raw?: string | null): { handle: string; url: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const path = new URL(trimmed).pathname;
      const handle = path.split("/").filter(Boolean)[0];
      if (!handle) return null;
      return { handle, url: `https://instagram.com/${handle}` };
    } catch {
      return null;
    }
  }

  const handle = trimmed.replace(/^@/, "").split("/").filter(Boolean)[0];
  if (!handle) return null;
  return { handle, url: `https://instagram.com/${handle}` };
}
