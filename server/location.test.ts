/**
 * Tests for the shared location model (shared/location.ts).
 *
 * These are the pure functions every location field and filter depends on:
 * turning a Google place into structured data, reducing a free-text location
 * to a city term for matching, and measuring distance for radius search.
 */
import { describe, it, expect } from "vitest";
import {
  parseAddressComponents,
  extractCity,
  distanceMiles,
  shortLabel,
  hasCoordinates,
  textLocation,
  type AddressComponent,
} from "../shared/location";

// Shape Google returns for "Brooklyn, NY, USA"
const BROOKLYN: AddressComponent[] = [
  { long_name: "Brooklyn", short_name: "Brooklyn", types: ["locality", "political"] },
  { long_name: "Kings County", short_name: "Kings County", types: ["administrative_area_level_2", "political"] },
  { long_name: "New York", short_name: "NY", types: ["administrative_area_level_1", "political"] },
  { long_name: "United States", short_name: "US", types: ["country", "political"] },
];

describe("parseAddressComponents", () => {
  it("pulls city, state code and country out of a Google result", () => {
    const place = parseAddressComponents({
      formatted: "Brooklyn, NY, USA",
      placeId: "ChIJCSF8lBZEwokRhngABHRcdoI",
      lat: 40.6782,
      lng: -73.9442,
      components: BROOKLYN,
    });

    expect(place).toMatchObject({
      formatted: "Brooklyn, NY, USA",
      placeId: "ChIJCSF8lBZEwokRhngABHRcdoI",
      city: "Brooklyn",
      state: "New York",
      stateCode: "NY",
      country: "United States",
      countryCode: "US",
    });
    expect(place.lat).toBeCloseTo(40.6782, 4);
    expect(place.lng).toBeCloseTo(-73.9442, 4);
  });

  it("falls back down the city chain when there is no locality", () => {
    // Some places (neighbourhoods, UK towns) have no `locality`.
    const place = parseAddressComponents({
      formatted: "Camden, London, UK",
      components: [
        { long_name: "Camden", short_name: "Camden", types: ["sublocality_level_1", "political"] },
        { long_name: "London", short_name: "London", types: ["postal_town"] },
      ],
    });
    // postal_town outranks sublocality in the fallback chain.
    expect(place.city).toBe("London");
  });

  it("survives a place with no address components at all", () => {
    const place = parseAddressComponents({ formatted: "Somewhere" });
    expect(place.formatted).toBe("Somewhere");
    expect(place.city).toBeUndefined();
    expect(place.lat).toBeUndefined();
  });

  it("drops non-finite coordinates rather than storing NaN", () => {
    const place = parseAddressComponents({
      formatted: "Nowhere",
      lat: Number.NaN,
      lng: Number.POSITIVE_INFINITY,
    });
    expect(place.lat).toBeUndefined();
    expect(place.lng).toBeUndefined();
  });
});

describe("extractCity", () => {
  it("passes a bare city through unchanged", () => {
    expect(extractCity("New York")).toBe("New York");
  });

  it("takes the city out of 'City, ST'", () => {
    expect(extractCity("New York, NY")).toBe("New York");
  });

  it("takes the city out of a full US street address", () => {
    // This is the case the filter exists for: an artist's saved profile
    // address never appears verbatim in a job's city-level location.
    expect(extractCity("123 Main St, New York, NY 10030, USA")).toBe("New York");
  });

  it("strips a trailing USA before looking for the city", () => {
    expect(extractCity("Brooklyn, NY, USA")).toBe("Brooklyn");
  });

  it("handles 'United States' spelled out", () => {
    expect(extractCity("Chicago, IL, United States")).toBe("Chicago");
  });

  // Regression: a spelled-out trailing country used to be returned AS the city,
  // so searching "Toronto" matched on "Canada" and missed every Toronto studio.
  it("drops a spelled-out country outside the US", () => {
    expect(extractCity("Paris, France")).toBe("Paris");
    expect(extractCity("Berlin, Germany")).toBe("Berlin");
    expect(extractCity("Toronto, ON, Canada")).toBe("Toronto");
  });

  it("drops a spelled-out state", () => {
    expect(extractCity("Los Angeles, California")).toBe("Los Angeles");
    expect(extractCity("New York, New York")).toBe("New York");
  });

  it("keeps a two-letter tail as a state code, not a country", () => {
    expect(extractCity("London, UK")).toBe("London");
    expect(extractCity("San Francisco, CA 94103")).toBe("San Francisco");
  });
});

describe("distanceMiles", () => {
  const nyc = { lat: 40.7128, lng: -74.006 };

  it("returns zero for the same point", () => {
    // Guards the acos domain: floating-point drift past 1.0 yields NaN.
    expect(distanceMiles(nyc, nyc)).toBe(0);
  });

  it("measures a known city pair", () => {
    // NYC -> Philadelphia is ~80 miles.
    const philly = { lat: 39.9526, lng: -75.1652 };
    expect(distanceMiles(nyc, philly)).toBeGreaterThan(75);
    expect(distanceMiles(nyc, philly)).toBeLessThan(85);
  });

  it("is symmetric", () => {
    const la = { lat: 34.0522, lng: -118.2437 };
    expect(distanceMiles(nyc, la)).toBeCloseTo(distanceMiles(la, nyc), 6);
  });
});

describe("shortLabel", () => {
  it("prefers 'City, ST'", () => {
    expect(shortLabel({ formatted: "Brooklyn, NY, USA", city: "Brooklyn", stateCode: "NY" }))
      .toBe("Brooklyn, NY");
  });

  it("falls back to city and country outside the US", () => {
    expect(shortLabel({ formatted: "Paris, France", city: "Paris", country: "France" }))
      .toBe("Paris, France");
  });

  it("falls back to the raw label when nothing is structured", () => {
    expect(shortLabel({ formatted: "Anywhere" })).toBe("Anywhere");
  });

  it("is empty for a missing location", () => {
    expect(shortLabel(null)).toBe("");
  });
});

describe("hasCoordinates", () => {
  it("is true only for a real pair", () => {
    expect(hasCoordinates({ formatted: "x", lat: 1, lng: 2 })).toBe(true);
  });

  it("is false for free text", () => {
    expect(hasCoordinates(textLocation("typed by hand"))).toBe(false);
  });

  it("is false when only one side is present", () => {
    expect(hasCoordinates({ formatted: "x", lat: 1 })).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(hasCoordinates(null)).toBe(false);
    expect(hasCoordinates(undefined)).toBe(false);
  });
});
