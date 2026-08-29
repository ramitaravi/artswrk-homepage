/**
 * Canonical location model, shared by the client (Google Places Autocomplete)
 * and the server (Google Geocoding via the Maps proxy).
 *
 * Every location field on the site resolves to one of these: a human-readable
 * label plus the structured, real place data we filter on (lat/lng, city,
 * state, place id). Free-typed text still round-trips — `formatted` is the
 * only required field — but anything picked from the dropdown carries
 * coordinates, which is what radius filtering needs.
 */

/** A single Google `address_components` entry. Identical shape in the JS
 *  Places API and the REST Geocoding API, so one parser serves both. */
export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface PlaceLocation {
  /** Human-readable label — what we show and store in the `location` column. */
  formatted: string;
  /** Google place id, stable across renames. Empty for free-typed text. */
  placeId?: string;
  lat?: number;
  lng?: number;
  /** City / locality (falls back to sublocality or postal town). */
  city?: string;
  /** State long name, e.g. "New York". */
  state?: string;
  /** State short code, e.g. "NY". */
  stateCode?: string;
  country?: string;
  /** ISO country code, e.g. "US". */
  countryCode?: string;
  postalCode?: string;
}

/** An empty, free-text-only location. */
export function textLocation(formatted: string): PlaceLocation {
  return { formatted };
}

/** True when the location carries real coordinates we can filter on. */
export function hasCoordinates(loc: PlaceLocation | null | undefined): boolean {
  return !!loc && typeof loc.lat === "number" && typeof loc.lng === "number"
    && Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
}

function pick(components: AddressComponent[], type: string): AddressComponent | undefined {
  return components.find((c) => c.types.includes(type));
}

/**
 * Build a PlaceLocation from Google's `address_components` + geometry.
 * Works for both `places.PlaceResult` (client) and a geocoding result (server).
 */
export function parseAddressComponents(input: {
  formatted: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  components?: AddressComponent[];
}): PlaceLocation {
  const components = input.components ?? [];

  const cityComponent =
    pick(components, "locality") ??
    pick(components, "postal_town") ??
    pick(components, "sublocality_level_1") ??
    pick(components, "sublocality") ??
    pick(components, "administrative_area_level_3") ??
    pick(components, "administrative_area_level_2");
  const stateComponent = pick(components, "administrative_area_level_1");
  const countryComponent = pick(components, "country");
  const postalComponent = pick(components, "postal_code");

  return {
    formatted: input.formatted,
    placeId: input.placeId || undefined,
    lat: typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : undefined,
    lng: typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : undefined,
    city: cityComponent?.long_name || undefined,
    state: stateComponent?.long_name || undefined,
    stateCode: stateComponent?.short_name || undefined,
    country: countryComponent?.long_name || undefined,
    countryCode: countryComponent?.short_name || undefined,
    postalCode: postalComponent?.long_name || undefined,
  };
}

/**
 * "City, ST" when we have structured data, otherwise the raw label.
 * Used for compact display (cards, filter chips) where a full street address
 * would blow out the layout.
 */
export function shortLabel(loc: PlaceLocation | null | undefined): string {
  if (!loc) return "";
  if (loc.city && loc.stateCode) return `${loc.city}, ${loc.stateCode}`;
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  if (loc.city) return loc.city;
  return loc.formatted;
}

/**
 * Best-effort city extraction from a free-text location string, for rows that
 * predate structured capture (migrated Bubble records, hand-typed values).
 *
 * A full street address ("123 Main St, New York, NY 10030, USA") never appears
 * verbatim inside a job's city-level location, so matching the raw string finds
 * nothing. Match on the city segment instead. Already-short values
 * ("New York, NY", or a bare city name) pass through unchanged.
 */
export function extractCity(raw: string): string {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return raw;

  // A trailing segment that is words-only (no digits) and longer than a state
  // code is a spelled-out country or state — "France", "Canada", "California".
  // Dropping it is what lets "Toronto, ON, Canada" and "Paris, France" reduce
  // to their city instead of to the country. A 2-letter tail ("NY", "UK") is
  // left alone; the state-code branch below handles it.
  const isSpelledOutTail = (segment: string) =>
    /^[A-Za-z][A-Za-z.\s'-]{2,}$/.test(segment);

  const withoutCountry =
    parts.length > 1 && isSpelledOutTail(parts[parts.length - 1])
      ? parts.slice(0, -1)
      : parts;

  if (withoutCountry.length <= 1) return withoutCountry[0] ?? raw;

  const last = withoutCountry[withoutCountry.length - 1];
  // "NY", "NY 10030" — a state code with an optional ZIP.
  const looksLikeStateZip = /^[A-Z]{2}\s*\d{0,6}$/i.test(last);
  const cityIndex = looksLikeStateZip ? withoutCountry.length - 2 : withoutCountry.length - 1;
  return withoutCountry[cityIndex] ?? raw;
}

/** Great-circle distance in miles. Mirrors the SQL haversine used for filtering. */
export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Default radius (miles) for "near me" style filtering. */
export const DEFAULT_RADIUS_MILES = 50;

/** Radius options offered in the UI. */
export const RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;
