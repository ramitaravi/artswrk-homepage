/**
 * A multi-select you type into, for lists too long to scan as chips.
 *
 * The admin artist form used a wall of toggle chips — every artist type, every
 * service, every style laid out at once. Finding "Aerial Arts" among a hundred
 * chips is slower than typing three letters, and there was no way to tell
 * which services belonged to the artist type you had just picked.
 *
 * Selected values show as removable chips; everything else lives behind the
 * search box. `allowCreate` turns an unmatched search into a new option, which
 * is how an affiliation that does not exist yet gets added.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

export interface TypeaheadOption {
  value: string;
  label: string;
  /** Shown to the right of the label — a group name, a count. */
  hint?: string;
}

export default function TypeaheadMultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Type to search…",
  allowCreate = false,
  onCreate,
  required = false,
  emptyHint,
  id,
}: {
  label: string;
  options: TypeaheadOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Offer "Add <query>" when the search matches nothing. */
  allowCreate?: boolean;
  onCreate?: (value: string) => void;
  required?: boolean;
  /** Shown under the field when nothing is selected. */
  emptyHint?: string;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere else closes the list. Without this the dropdown stays
  // over the fields below it and swallows their clicks.
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const labelFor = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return (v: string) => map.get(v) ?? v;
  }, [options]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      options
        .filter((o) => !selected.includes(o.value))
        .filter((o) => !q || o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
        .slice(0, 50),
    [options, selected, q],
  );

  // Only offer to create something that is genuinely not in the list, matched
  // case-insensitively so "BOCO" and "boco" don't become two schools.
  const exact = options.some((o) => o.label.toLowerCase() === q);
  const canCreate = allowCreate && q.length > 0 && !exact;

  function add(value: string) {
    if (!selected.includes(value)) onChange([...selected, value]);
    setQuery("");
  }

  return (
    <div ref={boxRef}>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-[#F25722]">*</span>}
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-[#111] text-white text-xs font-semibold">
              {labelFor(v)}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== v))}
                aria-label={`Remove ${labelFor(v)}`}
                className="p-0.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // This lives inside a <form>; Enter must pick an option, never submit.
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) add(matches[0].value);
              else if (canCreate && onCreate) { onCreate(query.trim()); setQuery(""); }
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !query && selected.length) {
              onChange(selected.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#F25722] transition-colors bg-white"
        />

        {open && (matches.length > 0 || canCreate) && (
          <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1">
            {matches.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => add(o.value)}
                className="w-full text-left px-3.5 py-2 text-sm text-[#111] hover:bg-gray-50 flex items-center justify-between gap-3"
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="text-xs text-gray-400 flex-shrink-0">{o.hint}</span>}
              </button>
            ))}
            {canCreate && onCreate && (
              <button
                type="button"
                onClick={() => { onCreate(query.trim()); setQuery(""); }}
                className="w-full text-left px-3.5 py-2 text-sm font-semibold text-[#F25722] hover:bg-orange-50 flex items-center gap-2 border-t border-gray-100"
              >
                <Plus size={13} /> Add “{query.trim()}”
              </button>
            )}
          </div>
        )}
      </div>

      {selected.length === 0 && emptyHint && (
        <p className="text-[11px] text-gray-400 mt-1.5">{emptyHint}</p>
      )}
    </div>
  );
}
