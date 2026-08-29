/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

/**
 * Maps/Places script source.
 *
 * Preferred: our own Google Cloud key (VITE_GOOGLE_MAPS_API_KEY) hitting
 * maps.googleapis.com directly. Requires "Maps JavaScript API" + "Places API"
 * enabled on the project and an HTTP-referrer restriction for our domains.
 *
 * Fallback: the Forge maps proxy the template shipped with, so environments
 * without a Google key of their own keep working unchanged.
 */
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

const MAPS_ORIGIN = GOOGLE_MAPS_API_KEY ? "https://maps.googleapis.com" : MAPS_PROXY_URL;
const API_KEY = GOOGLE_MAPS_API_KEY || FORGE_API_KEY;

/** True when a real Google Places key is configured (vs. the proxy fallback). */
export const usingOwnGoogleKey = !!GOOGLE_MAPS_API_KEY;

const MAPS_LIBRARIES = ['marker', 'places', 'geocoding', 'geometry'] as const;

let _mapsScriptPromise: Promise<null> | null = null;

/**
 * Resolve once Maps AND every library we use are actually usable.
 *
 * Deliberately NOT using `loading=async`: with it, `script.onload` can fire
 * before `google.maps` exists at all, leaving nothing to await and no way to
 * tell "not ready yet" from "ready with nothing in it" — a Places Autocomplete
 * built at that moment silently binds to nothing. Without it, `onload` means
 * the libraries named in the URL are loaded, which is the guarantee we need.
 *
 * `importLibrary` is still awaited when present, so this stays correct if the
 * loading mode ever changes.
 */
async function whenLibrariesReady(): Promise<null> {
  const maps = (window as any).google?.maps;
  if (maps?.importLibrary) {
    await Promise.all(MAPS_LIBRARIES.map((lib) => maps.importLibrary(lib)));
  }
  return null;
}

/**
 * Resolve the Places library object itself.
 *
 * Under `loading=async`, `importLibrary("places")` resolves with the library
 * BEFORE the legacy `google.maps.places` namespace is populated — reading that
 * namespace right after awaiting is a race that intermittently sees undefined.
 * Callers should construct from what this returns, never from the global.
 */
export async function loadPlacesLibrary(): Promise<typeof google.maps.places> {
  await loadMapScript();
  const maps = (window as any).google?.maps;
  if (maps?.importLibrary) {
    return (await maps.importLibrary("places")) as typeof google.maps.places;
  }
  return maps?.places;
}

export function loadMapScript(): Promise<null> {
  // Already loaded — but still wait on the libraries, for the same reason.
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return whenLibrariesReady();
  }
  // Already loading — return the same promise (singleton)
  if (_mapsScriptPromise) return _mapsScriptPromise;

  _mapsScriptPromise = new Promise<null>((resolve, reject) => {
    // Double-check in case it loaded between the checks above and now
    if ((window as any).google?.maps) { resolve(null); return; }
    const script = document.createElement('script');
    script.src = `${MAPS_ORIGIN}/maps/api/js?key=${API_KEY}&v=weekly&libraries=${MAPS_LIBRARIES.join(',')}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(null);
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      _mapsScriptPromise = null; // Allow retry on error
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  }).then(whenLibrariesReady);

  return _mapsScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    await loadMapScript();
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
      mapId: "DEMO_MAP_ID",
    });
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
