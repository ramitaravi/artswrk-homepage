/**
 * EDIT PROFILE MODAL
 * Full-featured profile editor matching the Artswrk edit profile flow.
 * Sections: Basic Info | Bio | Work & Disciplines | Social Links | Media & Resume
 */

import { useState, useRef } from "react";
import { X, Plus, Trash2, Loader2, Upload, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Common field options ─────────────────────────────────────────────────────

const WORK_TYPE_OPTIONS = [
  "Dance Adjudicator",
  "Dance Educator",
  "Choreographer",
  "Performer",
  "Competition Choreographer",
  "Master Class Teacher",
  "Substitute Teacher",
  "Yoga Instructor",
  "Pilates Instructor",
  "Fitness Instructor",
  "Model",
  "Actor",
  "Singer",
  "Musician",
  "Emcee",
  "Event Staff",
  "Content Creator",
  "Photographer",
  "Videographer",
];

const DISCIPLINE_OPTIONS = [
  "Ballet",
  "Jazz",
  "Hip Hop",
  "Contemporary",
  "Modern",
  "Tap",
  "Lyrical",
  "Musical Theater",
  "Acrobatics",
  "Tumbling",
  "Ballroom",
  "Latin",
  "Salsa",
  "Bachata",
  "Swing",
  "Breakdance",
  "Popping",
  "Locking",
  "Waacking",
  "Vogue",
  "House",
  "Bollywood",
  "Bharatanatyam",
  "Kathak",
  "Flamenco",
  "Irish Dance",
  "Cheer",
  "Pom",
  "Aerial",
  "Yoga",
  "Pilates",
  "Fitness",
];

const PRONOUN_OPTIONS = [
  "She/Her/Hers",
  "He/Him/His",
  "They/Them/Theirs",
  "She/They",
  "He/They",
  "Ze/Zir",
  "Xe/Xem",
  "Any/All",
  "Prefer not to say",
];

// ─── Multi-select chip input ──────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 transition-colors"
        >
          <span className="text-gray-500 text-xs">
            {value.length > 0 ? `${value.length} selected` : "Select…"}
          </span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl max-h-52 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                  value.includes(opt)
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {value.includes(opt) ? "✓ " : ""}{opt}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {value.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter(x => x !== v))}
                className="hover:text-orange-900 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Text input ───────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
      />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all resize-none"
      />
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all bg-white"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

// ─── URL list input ───────────────────────────────────────────────────────────

function UrlList({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  function add() {
    onChange([...value, ""]);
  }
  function update(i: number, v: string) {
    const next = [...value];
    next[i] = v;
    onChange(next);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="space-y-2">
        {value.map((url, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => update(i, e.target.value)}
              placeholder={placeholder || "https://…"}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
        >
          <Plus size={13} /> Add URL
        </button>
      </div>
    </div>
  );
}

// ─── Resume file list ─────────────────────────────────────────────────────────

function ResumeList({
  value,
  onChange,
}: {
  value: { url: string; name: string }[];
  onChange: (v: { url: string; name: string }[]) => void;
}) {
  function add() {
    onChange([...value, { url: "", name: "" }]);
  }
  function update(i: number, field: "url" | "name", v: string) {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Resume Files</label>
      <div className="space-y-3">
        {value.map((r, i) => (
          <div key={i} className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={r.name}
                onChange={e => update(i, "name", e.target.value)}
                placeholder="Resume name (e.g. Dance Resume)"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-all"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              type="url"
              value={r.url}
              onChange={e => update(i, "url", e.target.value)}
              placeholder="https://… (PDF URL)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-all"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
        >
          <Plus size={13} /> Add Resume
        </button>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3 className="text-sm font-black text-gray-800 whitespace-nowrap">{title}</h3>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface EditProfileModalProps {
  profile: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  // Form state
  const [firstName, setFirstName] = useState(profile.firstName || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [pronouns, setPronouns] = useState(profile.pronouns || "");
  const [tagline, setTagline] = useState(profile.tagline || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [location, setLocation] = useState(profile.location || "");
  const [profilePicture, setProfilePicture] = useState(profile.profilePicture || "");
  const [workTypes, setWorkTypes] = useState<string[]>(profile.workTypes || []);
  const [artistDisciplines, setArtistDisciplines] = useState<string[]>(profile.artistDisciplines || []);
  const [artistServices, setArtistServices] = useState<string[]>(profile.artistServices || []);
  const [mediaPhotos, setMediaPhotos] = useState<string[]>(profile.mediaPhotos || []);
  const [resumeFiles, setResumeFiles] = useState<{ url: string; name: string }[]>(profile.resumeFiles || []);
  const [instagram, setInstagram] = useState(profile.instagram || "");
  const [tiktok, setTiktok] = useState(profile.tiktok || "");
  const [youtube, setYoutube] = useState(profile.youtube || "");
  const [website, setWebsite] = useState(profile.website || "");
  const [portfolio, setPortfolio] = useState(profile.portfolio || "");

  const updateMutation = trpc.artistProfile.updateMyProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated!");
      onSaved();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save profile");
    },
  });

  function handleSave() {
    updateMutation.mutate({
      firstName,
      lastName,
      pronouns,
      tagline,
      bio,
      location,
      profilePicture,
      workTypes,
      artistDisciplines,
      artistServices,
      mediaPhotos,
      resumeFiles,
      instagram,
      tiktok,
      youtube,
      website,
      portfolio,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-black text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── Basic Info ── */}
          <SectionHeader title="Basic Info" />

          <div className="space-y-3">
            {/* Profile picture URL */}
            <Field
              label="Profile Photo URL"
              value={profilePicture}
              onChange={setProfilePicture}
              placeholder="https://… (image URL)"
              hint="Paste a direct image URL for your profile photo"
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" value={firstName} onChange={setFirstName} placeholder="First" />
              <Field label="Last Name" value={lastName} onChange={setLastName} placeholder="Last" />
            </div>

            <Select
              label="Pronouns"
              value={pronouns}
              onChange={setPronouns}
              options={PRONOUN_OPTIONS}
              placeholder="Select pronouns…"
            />

            <Field label="Location" value={location} onChange={setLocation} placeholder="City, State" />
            <Field label="Tagline" value={tagline} onChange={setTagline} placeholder="e.g. Professional Dancer & Choreographer" />
          </div>

          {/* ── Bio ── */}
          <SectionHeader title="Bio" />
          <TextArea
            label="About You"
            value={bio}
            onChange={setBio}
            placeholder="Tell hirers about your background, experience, and what makes you unique…"
            rows={5}
          />

          {/* ── Work & Disciplines ── */}
          <SectionHeader title="Work & Disciplines" />
          <div className="space-y-3">
            <MultiSelect
              label="Work Types"
              options={WORK_TYPE_OPTIONS}
              value={workTypes}
              onChange={setWorkTypes}
            />
            <MultiSelect
              label="Disciplines"
              options={DISCIPLINE_OPTIONS}
              value={artistDisciplines}
              onChange={setArtistDisciplines}
            />
            <MultiSelect
              label="Services Offered"
              options={WORK_TYPE_OPTIONS}
              value={artistServices}
              onChange={setArtistServices}
            />
          </div>

          {/* ── Social Links ── */}
          <SectionHeader title="Social & Links" />
          <div className="space-y-3">
            <Field
              label="Instagram"
              value={instagram}
              onChange={setInstagram}
              placeholder="@yourhandle"
              hint="Handle only, no URL needed"
            />
            <Field label="TikTok" value={tiktok} onChange={setTiktok} placeholder="@yourhandle or URL" />
            <Field label="YouTube" value={youtube} onChange={setYoutube} placeholder="https://youtube.com/…" type="url" />
            <Field label="Website" value={website} onChange={setWebsite} placeholder="https://yoursite.com" type="url" />
            <Field label="Portfolio" value={portfolio} onChange={setPortfolio} placeholder="https://…" type="url" />
          </div>

          {/* ── Media ── */}
          <SectionHeader title="Media Photos" />
          <UrlList
            label="Photo URLs"
            value={mediaPhotos}
            onChange={setMediaPhotos}
            placeholder="https://… (image URL)"
          />

          {/* ── Resume ── */}
          <SectionHeader title="Resume" />
          <ResumeList value={resumeFiles} onChange={setResumeFiles} />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(90deg,#FFBC5D,#F25722)" }}
          >
            {updateMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              "Save Profile"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
