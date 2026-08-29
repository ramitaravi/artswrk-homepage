/**
 * The one location input for the whole site.
 *
 * Backed by Google Places Autocomplete, so every location the user picks
 * carries real place data — coordinates, city, state, country, place id —
 * not just a typed string. That structured payload is what radius filtering
 * and city matching run on; free-typed text still works, it just arrives
 * without coordinates.
 *
 * Drop-in for any plain location <input>: pass the display string as `value`
 * and take the full place off `onChange`.
 */
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { loadPlacesLibrary } from "@/components/Map";
import { parseAddressComponents, textLocation, type PlaceLocation } from "@shared/location";

export type { PlaceLocation };

/** What Places Autocomplete restricts suggestions to. */
export type LocationSearchKind =
  /** Cities only — the right default for profiles, filters and job locations. */
  | "cities"
  /** Street addresses — for an exact venue/shoot address. */
  | "address"
  /** Named businesses (studios, theaters, venues). */
  | "establishment"
  /** Anything Google will match. */
  | "any";

const TYPES_BY_KIND: Record<LocationSearchKind, string[] | undefined> = {
  cities: ["(cities)"],
  address: ["address"],
  establishment: ["establishment"],
  any: undefined,
};

export interface LocationAutocompleteInputProps {
  /** Current display text (the `formatted` value of the selected place). */
  value: string;
  /** Fires on every keystroke and on selection. Selections carry lat/lng. */
  onChange: (location: PlaceLocation) => void;
  placeholder?: string;
  /** Wrapper classes. */
  className?: string;
  /** Input classes — override to match the surrounding form's styling. */
  inputClassName?: string;
  /** What to suggest. Defaults to cities. */
  kind?: LocationSearchKind;
  /** ISO country codes to restrict to, e.g. ["us", "ca"]. */
  countries?: string[];
  /** Show the pin icon (and pad for it). */
  icon?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  onBlur?: () => void;
  "data-testid"?: string;
}

const DEFAULT_INPUT_CLASS =
  "w-full py-2 text-sm bg-transparent focus:outline-none";

export default function LocationAutocompleteInput({
  value,
  onChange,
  placeholder = "Search location…",
  className = "",
  inputClassName,
  kind = "cities",
  countries,
  icon = true,
  disabled = false,
  id,
  name,
  onBlur,
  "data-testid": testId,
}: LocationAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  // onChange is read from a ref inside the Google listener so the listener is
  // attached exactly once and never goes stale on re-render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep the DOM input in sync when the value is changed from outside (form
  // reset, loading a saved profile, clearing a filter). Google mutates the
  // input directly on selection, so React alone can't be trusted here.
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value ?? "";
    }
  }, [value]);

  useEffect(() => {
    let cancelled = false;

    loadPlacesLibrary()
      .then((places) => {
        if (cancelled || !inputRef.current || autocompleteRef.current) return;
        if (!places?.Autocomplete) return;

        const autocomplete = new places.Autocomplete(inputRef.current, {
          types: TYPES_BY_KIND[kind],
          fields: ["geometry.location", "formatted_address", "name", "address_components", "place_id"],
          ...(countries?.length ? { componentRestrictions: { country: countries } } : {}),
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const typed = inputRef.current?.value ?? "";

          // No geometry means the user hit Enter on raw text rather than
          // picking a prediction — keep what they typed, minus coordinates.
          if (!place?.geometry?.location) {
            onChangeRef.current(textLocation(place?.name || typed));
            return;
          }

          // Establishment results carry a business name that the formatted
          // address omits ("Elite Barbell" vs "123 25th St, Brooklyn…").
          const formatted =
            kind === "establishment" && place.name
              ? [place.name, place.formatted_address].filter(Boolean).join(", ")
              : place.formatted_address || place.name || typed;

          onChangeRef.current(
            parseAddressComponents({
              formatted,
              placeId: place.place_id,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              components: place.address_components as any,
            })
          );
        });

        autocompleteRef.current = autocomplete;
      })
      .catch((err) => {
        // Maps unavailable — the field degrades to a plain text input.
        console.warn("[LocationAutocompleteInput] Places unavailable:", err);
      });

    return () => { cancelled = true; };
    // Rebuilding on kind/countries changes is intentional; both are static per
    // usage in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, countries?.join(",")]);

  return (
    <div className={`relative ${className}`}>
      {icon && (
        <MapPin
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      )}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        defaultValue={value}
        disabled={disabled}
        onChange={(e) => onChange(textLocation(e.target.value))}
        onBlur={onBlur}
        onKeyDown={(e) => {
          // Enter while the Places dropdown is open picks a prediction — it
          // must not also submit the surrounding form.
          if (e.key === "Enter" && document.querySelector(".pac-container.pac-open")) {
            e.preventDefault();
          }
        }}
        placeholder={placeholder}
        data-testid={testId}
        className={inputClassName ?? `${DEFAULT_INPUT_CLASS} ${icon ? "pl-8" : "pl-3"} pr-3`}
      />
    </div>
  );
}
