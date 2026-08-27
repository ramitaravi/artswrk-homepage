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
