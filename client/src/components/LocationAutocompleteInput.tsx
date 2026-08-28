/**
 * Real-place location search input, backed by Google Places Autocomplete.
 * Drop-in replacement for a plain text location filter/input anywhere on
 * the site — reuses the same lazy-loaded Maps script as MapView (Map.tsx).
 */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadMapScript } from "@/components/Map";

export interface PlaceResult {
  query: string;
  lat?: number;
  lng?: number;
}

export default function LocationAutocompleteInput({
  value,
  onChange,
  placeholder = "Search location…",
  className = "",
  types = ["(cities)"],
  icon = true,
}: {
  value: string;
  onChange: (result: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  types?: string[];
  icon?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapScript().then(() => { if (!cancelled) setReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types,
      fields: ["geometry", "formatted_address"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const query = place.formatted_address ?? inputRef.current?.value ?? "";
      if (place.geometry?.location) {
        onChange({ query, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      } else {
        onChange({ query });
      }
    });
    autocompleteRef.current = autocomplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className={`relative ${className}`}>
      {icon && <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange({ query: e.target.value })}
        placeholder={placeholder}
        className={`w-full ${icon ? "pl-8" : "pl-3"} pr-3 py-2 text-sm bg-transparent focus:outline-none`}
      />
    </div>
  );
}
