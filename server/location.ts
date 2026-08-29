/**
 * Server-side location resolution.
 *
 * The client sends real Google Places data (lat/lng, city, state, place id)
 * for anything picked from the autocomplete dropdown. Two cases still reach us
 * without it: values typed and submitted without selecting a suggestion, and
 * the ~years of rows migrated from Bubble that are text-only. Both get
 * geocoded here so every stored location ends up with coordinates.
 */

import { z } from "zod";
import { makeRequest, type GeocodingResult } from "./_core/map";
import { ENV } from "./_core/env";
import {
  parseAddressComponents,
  type PlaceLocation,
  type AddressComponent,
} from "../shared/location";

/**
 * The structured place data the client sends alongside the display string.
 * Optional throughout: a location typed without picking a suggestion arrives
 * bare and gets geocoded server-side.
 */
export const locationInputSchema = z
  .object({
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    city: z.string().max(128).optional().nullable(),
    state: z.string().max(64).optional().nullable(),
    country: z.string().max(64).optional().nullable(),
    placeId: z.string().max(128).optional().nullable(),
  })
  .optional();

/** The location payload every mutation accepts alongside the display string. */
export interface LocationInput {
  lat?: number | string | null;
  lng?: number | string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  placeId?: string | null;
}

/**
 * Call the Geocoding API, preferring our own server key over the Forge proxy.
 *
 * The browser key can't be reused here — Google rejects referrer-restricted
 * keys on the REST APIs — so this needs its own IP-restricted key. Until one
 * is set, the Forge proxy (which the template already ships with) handles it.
 */
async function geocodeRequest(address: string): Promise<GeocodingResult> {
  const serverKey = ENV.googleMapsServerApiKey;
  if (serverKey) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", serverKey);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);
    return (await response.json()) as GeocodingResult;
  }
  return makeRequest<GeocodingResult>("/maps/api/geocode/json", { address });
}

/**
 * Geocode a free-text location into structured place data.
 * Returns null when Maps is unconfigured or the query has no match — callers
 * fall back to storing the raw text, never to failing the save.
 */
export async function geocodeLocation(query: string): Promise<PlaceLocation | null> {
  const trimmed = query?.trim();
  if (!trimmed) return null;

  try {
    const res = await geocodeRequest(trimmed);
    const top = res.results?.[0];
    if (!top || res.status !== "OK") return null;

    return parseAddressComponents({
      formatted: top.formatted_address ?? trimmed,
      placeId: top.place_id,
      lat: top.geometry?.location?.lat,
      lng: top.geometry?.location?.lng,
      components: top.address_components as AddressComponent[],
    });
  } catch {
    // Maps proxy down or unconfigured — the caller keeps the text value.
    return null;
  }
}

function coord(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? String(n) : null;
}

/** The DB column names each table uses for the display string. */
type AddressColumn = "location" | "locationAddress";

/**
 * Build the structured location columns for an update/insert.
 *
 * Pass whatever the client sent. When it carries coordinates we trust it
 * (it came straight from Places); when it doesn't, we geocode the text so the
 * row still lands with real data. Returns only the location columns, ready to
 * spread into a Drizzle patch.
 */
export async function buildLocationColumns(
  address: string | null | undefined,
  provided: LocationInput | undefined,
  addressColumn: AddressColumn = "location"
): Promise<Record<string, string | null>> {
  const text = address?.trim() || null;

  // Cleared field — null everything out so a stale city never keeps matching.
  if (!text) {
    return {
      [addressColumn]: null,
      locationLat: null,
      locationLng: null,
      locationCity: null,
      locationState: null,
      locationCountry: null,
      locationPlaceId: null,
    };
  }

  const lat = coord(provided?.lat);
  const lng = coord(provided?.lng);

  if (lat && lng) {
    return {
      [addressColumn]: text,
      locationLat: lat,
      locationLng: lng,
      locationCity: provided?.city || null,
      locationState: provided?.state || null,
      locationCountry: provided?.country || null,
      locationPlaceId: provided?.placeId || null,
    };
  }

  const geocoded = await geocodeLocation(text);
  if (!geocoded) {
    // Keep the user's text; leave coordinates empty rather than guessing.
    return {
      [addressColumn]: text,
      locationLat: null,
      locationLng: null,
      locationCity: null,
      locationState: null,
      locationCountry: null,
      locationPlaceId: null,
    };
  }

  return {
    [addressColumn]: text,
    locationLat: coord(geocoded.lat),
    locationLng: coord(geocoded.lng),
    locationCity: geocoded.city ?? null,
    locationState: geocoded.stateCode ?? geocoded.state ?? null,
    locationCountry: geocoded.countryCode ?? geocoded.country ?? null,
    locationPlaceId: geocoded.placeId ?? null,
  };
}

/**
 * Same as buildLocationColumns, minus the country column — jobs, bookings,
 * client_companies and premium_jobs store city/state/placeId only.
 */
export async function buildLocationColumnsNoCountry(
  address: string | null | undefined,
  provided: LocationInput | undefined,
  addressColumn: AddressColumn = "locationAddress"
): Promise<Record<string, string | null>> {
  const cols = await buildLocationColumns(address, provided, addressColumn);
  delete cols.locationCountry;
  return cols;
}

/**
 * Resolve the location columns for a job-shaped mutation.
 *
 * Accepts both the legacy flat `locationLat`/`locationLng` strings the job
 * forms already send and the richer `locationData` payload from the shared
 * autocomplete, preferring the latter. Geocodes when neither carries
 * coordinates, so a typed address still lands with a real lat/lng.
 */
export async function resolveJobLocation(input: {
  locationAddress?: string | null;
  locationLat?: string | null;
  locationLng?: string | null;
  locationData?: LocationInput;
}): Promise<{
  locationAddress: string | null;
  locationLat: string | null;
  locationLng: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationPlaceId: string | null;
}> {
  const cols = await buildLocationColumnsNoCountry(
    input.locationAddress,
    {
      lat: input.locationData?.lat ?? input.locationLat,
      lng: input.locationData?.lng ?? input.locationLng,
      city: input.locationData?.city,
      state: input.locationData?.state,
      placeId: input.locationData?.placeId,
    },
    "locationAddress"
  );
  return cols as Awaited<ReturnType<typeof resolveJobLocation>>;
}


/**
 * Resolve location columns for premium jobs, which store the display string in
 * a `location` column rather than `locationAddress`.
 */
export async function resolvePremiumJobLocation(input: {
  location?: string | null;
  locationData?: LocationInput;
}): Promise<Record<string, string | null>> {
  return buildLocationColumnsNoCountry(input.location, input.locationData, "location");
}
