/**
 * State for a location form field.
 *
 * Holds the full Google Places result behind the display string, so a form can
 * bind `value`/`onChange` to <LocationAutocompleteInput> and spread
 * `locationData` straight into the mutation — no page needs to know how the
 * structured place data is shaped.
 */
import { useCallback, useState } from "react";
import { hasCoordinates, type PlaceLocation } from "@shared/location";

/** The `locationData` payload our tRPC mutations accept. */
export interface LocationDataPayload {
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  country?: string;
  placeId?: string;
}

/** Strip a PlaceLocation down to the mutation payload (undefined when bare). */
export function toLocationData(place: PlaceLocation): LocationDataPayload | undefined {
  if (!hasCoordinates(place) && !place.city && !place.placeId) return undefined;
  return {
    lat: place.lat,
    lng: place.lng,
    city: place.city,
    // The server column stores the short code ("NY") when Google gives us one.
    state: place.stateCode ?? place.state,
    country: place.countryCode ?? place.country,
    placeId: place.placeId,
  };
}

export function useLocationField(initial?: string | null) {
  const [place, setPlace] = useState<PlaceLocation>({ formatted: initial ?? "" });

  /** Replace the field from outside — loading a saved profile, clearing a form. */
  const reset = useCallback((formatted?: string | null) => {
    setPlace({ formatted: formatted ?? "" });
  }, []);

  return {
    /** Bind to LocationAutocompleteInput's `value`. */
    value: place.formatted,
    /** Bind to LocationAutocompleteInput's `onChange`. */
    onChange: setPlace,
    /** The full place, including coordinates when one was picked. */
    place,
    /** Spread into a mutation as `locationData`. */
    locationData: toLocationData(place),
    /** True once a real place (not free text) is selected. */
    hasPlace: hasCoordinates(place),
    reset,
    setPlace,
  };
}
