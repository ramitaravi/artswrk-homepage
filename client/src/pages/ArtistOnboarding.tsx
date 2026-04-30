/**
 * ARTSWRK ARTIST ONBOARDING
 *
 * Step 1 — Artist Types & Services
 * Step 2 — Profile (photo, location, phone, bio, socials)
 * Step 3 — Verify Your Network (invite artists)
 * Step 4 — Choose Your Plan
 *
 * Step progress is saved to DB after each step so users can resume.
 * Redirects to /login if not authenticated.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import {
  CheckCircle2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp,
  Camera, MapPin, Phone, Instagram, Youtube, Plus, X, Mail,
  Zap, Star, Music, Trophy, Camera as CameraIcon, Video,
  Mic, BookOpen, Users, Dumbbell
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface ArtistTypeEntry {
  name: string;
  emoji: string;
  icon: React.ElementType;
  color: string;
  services: string[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ARTIST_TYPES: ArtistTypeEntry[] = [
  {
    name: "Dance Educator",
    emoji: "🩰",
    icon: Music,
    color: "from-orange-400 to-amber-400",
    services: ["Recurring Classes", "Substitute Teacher", "Master Classes", "Private Lessons", "Competition Choreography", "Event Choreography"],
  },
  {
    name: "Dance Adjudicator",
    emoji: "🏆",
    icon: Trophy,
    color: "from-pink-500 to-rose-400",
    services: ["Dance Competition Judge"],
  },
  {
    name: "Dance Competition Staff",
    emoji: "🎤",
    icon: Mic,
    color: "from-violet-500 to-purple-400",
    services: ["Dance Competition Judge", "Tabulator", "Emcee / Announcer", "Backstage Manager", "General Staff"],
  },
  {
    name: "Photographer",
    emoji: "📸",
    icon: CameraIcon,
    color: "from-blue-500 to-cyan-400",
    services: ["Photoshoot", "Corporate Photography", "Event Photography", "Headshots"],
  },
  {
    name: "Videographer",
    emoji: "🎥",
    icon: Video,
    color: "from-indigo-500 to-blue-400",
    services: ["Videoshoot", "Corporate Videography", "Event Videography", "Video Editing"],
  },
  {
    name: "Acting Coach",
    emoji: "🎭",
    icon: BookOpen,
    color: "from-emerald-500 to-teal-400",
    services: ["Acting Coach", "Audition Reader"],
  },
  {
    name: "Vocal Coach",
    emoji: "🎵",
    icon: Music,
    color: "from-fuchsia-500 to-pink-400",
    services: ["Private Voice Lessons", "Vocal Audition Prep"],
  },
  {
    name: "Music Teacher",
    emoji: "🎸",
    icon: Music,
    color: "from-yellow-500 to-orange-400",
    services: ["Guitar", "Piano Teacher", "Violin Teacher", "Voice Teacher", "Percussion Teacher", "Saxophone Teacher", "Woodwind Teacher", "Cello"],
  },
  {
    name: "Yoga Instructor",
    emoji: "🧘",
    icon: Dumbbell,
    color: "from-lime-500 to-green-400",
    services: ["Yoga Classes", "Private Yoga Sessions", "Corporate Yoga"],
  },
  {
    name: "Pilates Instructor",
    emoji: "🤸",
    icon: Dumbbell,
    color: "from-sky-500 to-blue-400",
    services: ["Mat Pilates", "Reformer Pilates", "Private Pilates Sessions"],
  },
  {
    name: "Event Performers",
    emoji: "✨",
    icon: Star,
    color: "from-amber-500 to-yellow-400",
    services: ["Live Performance", "Corporate Entertainment", "Private Events"],
  },
];

const STEPS: { label: string; sub: string }[] = [
  { label: "Artist Types", sub: "What you do" },
  { label: "Your Profile", sub: "About you" },
  { label: "Verify Network", sub: "Invite artists" },
  { label: "Choose Plan", sub: "Get started" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <a href="/" className="flex items-center select-none">
      <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
      <span className="font-black text-xl tracking-tight bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
    </a>
  );
}

function StepSidebar({ step, completedSteps }: { step: Step; completedSteps: Set<number> }) {
  return (
    <div className="hidden lg:flex flex-col w-64 shrink-0">
      <div className="mb-8">
        <Logo />
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Artist Onboarding</p>
      <div className="space-y-1">
        {STEPS.map((s, i) => {
          const num = (i + 1) as Step;
          const done = completedSteps.has(num);
          const current = step === num;
          return (
            <div
              key={num}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                current ? "bg-white shadow-sm" : "hover:bg-white/50"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  done
                    ? "bg-[#EC008C] text-white"
                    : current
                    ? "bg-[#111] text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : num}
              </div>
              <div>
                <p className={`text-sm font-semibold ${current ? "text-[#111]" : done ? "text-gray-500" : "text-gray-400"}`}>
                  {s.label}
                </p>
                <p className="text-xs text-gray-400">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-auto pt-8">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Progress</span>
          <span>{Math.round(((step - 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div
            className="h-full rounded-full artist-grad-bg transition-all duration-500"
            style={{ width: `${((step - 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function MobileProgress({ step }: { step: Step }) {
  return (
    <div className="lg:hidden flex items-center justify-between mb-6">
      <Logo />
      <div className="flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i + 1 <= step ? "w-6 artist-grad-bg" : "w-3 bg-gray-200"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400 font-medium">{step}/{STEPS.length}</span>
    </div>
  );
}

// ─── Step 1: Artist Types ──────────────────────────────────────────────────────

function Step1ArtistTypes({
  selected,
  services,
  onToggleType,
  onToggleService,
  onNext,
}: {
  selected: string[];
  services: string[];
  onToggleType: (name: string, typeServices: string[]) => void;
  onToggleService: (service: string) => void;
  onNext: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleTypeClick(type: ArtistTypeEntry) {
    onToggleType(type.name, type.services);
    if (!selected.includes(type.name)) {
      setExpanded(type.name);
    } else {
      setExpanded(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-[#111] mb-1">What do you do?</h2>
      <p className="text-gray-500 text-sm mb-6">Select all that apply — you can always update this later.</p>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {ARTIST_TYPES.map((type) => {
          const isSelected = selected.includes(type.name);
          const isExpanded = expanded === type.name;

          return (
            <div
              key={type.name}
              className={`rounded-xl border transition-all overflow-hidden ${
                isSelected
                  ? "border-[#EC008C] bg-pink-50/40"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              {/* Type row */}
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => handleTypeClick(type)}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center text-white text-base shrink-0`}>
                  {type.emoji}
                </div>
                <span className={`flex-1 text-sm font-semibold ${isSelected ? "text-[#111]" : "text-gray-700"}`}>
                  {type.name}
                </span>
                {isSelected && (
                  <span className="text-[10px] font-bold text-[#EC008C] bg-pink-100 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
                {type.services.length > 0 && (
                  <button
                    type="button"
                    className="ml-1 text-gray-400 hover:text-gray-600 p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(isExpanded ? null : type.name);
                    }}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </button>

              {/* Service types */}
              {isExpanded && type.services.length > 0 && (
                <div className="px-3 pb-3 pt-1 border-t border-pink-100">
                  <p className="text-xs text-gray-400 mb-2">Select specific services:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {type.services.map((svc) => {
                      const svcSelected = services.includes(svc);
                      return (
                        <button
                          key={svc}
                          type="button"
                          onClick={() => onToggleService(svc)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                            svcSelected
                              ? "bg-[#EC008C] text-white border-[#EC008C]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#EC008C] hover:text-[#EC008C]"
                          }`}
                        >
                          {svcSelected && <CheckCircle2 size={10} className="inline mr-1" />}
                          {svc}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={onNext}
        className="mt-5 w-full py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
      >
        Continue <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── Step 2: Profile ───────────────────────────────────────────────────────────

const INPUT_CLS = "w-full pl-8 pr-3 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#EC008C] transition-all";
const INPUT_CLS_SM = "w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#EC008C] transition-all";

function Step2Profile({
  initial,
  onNext,
  onBack,
  uploadPicture,
}: {
  initial: { profilePicture?: string | null; location?: string | null; phoneNumber?: string | null; bio?: string | null; instagram?: string | null; tiktok?: string | null; youtube?: string | null };
  onNext: (data: { profilePicture?: string; location: string; phoneNumber: string; bio: string; instagram: string; tiktok: string; youtube: string }) => void;
  onBack: (data: { profilePicture?: string; location: string; phoneNumber: string; bio: string; instagram: string; tiktok: string; youtube: string }) => void;
  uploadPicture: (base64: string, contentType: string) => Promise<string>;
}) {
  const [profilePicture, setProfilePicture] = useState(initial.profilePicture ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [instagram, setInstagram] = useState(initial.instagram ?? "");
  const [tiktok, setTiktok] = useState(initial.tiktok ?? "");
  const [youtube, setYoutube] = useState(initial.youtube ?? "");
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Wait for Google Maps to be available
  useEffect(() => {
    const check = () => {
      if ((window as any).google?.maps?.places) { setMapsLoaded(true); return true; }
      return false;
    };
    if (check()) return;
    const iv = setInterval(() => { if (check()) clearInterval(iv); }, 300);
    return () => clearInterval(iv);
  }, []);

  // Attach Places Autocomplete once Maps is ready
  useEffect(() => {
    if (!mapsLoaded || !locationInputRef.current || acRef.current) return;
    acRef.current = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, {
      types: ["(cities)"],
      fields: ["address_components", "formatted_address", "name"],
    });
    acRef.current.addListener("place_changed", () => {
      const place = acRef.current.getPlace();
      const components = place.address_components || [];
      const city = components.find((c: any) => c.types.includes("locality"))?.long_name
        || components.find((c: any) => c.types.includes("sublocality"))?.long_name
        || place.name || "";
      const state = components.find((c: any) => c.types.includes("administrative_area_level_1"))?.short_name || "";
      const country = components.find((c: any) => c.types.includes("country"))?.long_name || "";
      setLocation([city, state, country].filter(Boolean).join(", "));
    });
  }, [mapsLoaded]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      try {
        const url = await uploadPicture(base64, file.type);
        setProfilePicture(url);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function autoDetectLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const geocoder = new (window as any).google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any[], status: string) => {
            if (status === "OK" && results[0]) {
              const components = results[0].address_components;
              const city = components.find((c: any) => c.types.includes("locality"))?.long_name;
              const state = components.find((c: any) => c.types.includes("administrative_area_level_1"))?.short_name;
              const country = components.find((c: any) => c.types.includes("country"))?.long_name;
              setLocation([city, state, country].filter(Boolean).join(", "));
            }
            setLocating(false);
          });
        } catch {
          setLocating(false);
        }
      },
      () => setLocating(false)
    );
  }

  const canContinue = location.trim().length > 0;
  const currentData = { profilePicture: profilePicture || undefined, location, phoneNumber, bio, instagram, tiktok, youtube };

  return (
    <div>
      <h2 className="text-2xl font-black text-[#111] mb-1">Your Profile</h2>
      <p className="text-gray-500 text-sm mb-6">Help clients know who you are.</p>

      <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
        {/* Profile picture */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="w-20 h-20 rounded-full object-cover ring-2 ring-[#EC008C]/30" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
                <Camera size={28} />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#EC008C] text-white flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {uploading ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera size={13} />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111]">Profile Photo</p>
            <p className="text-xs text-gray-400 mt-0.5">JPG or PNG, recommended 400×400px</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#EC008C] font-semibold mt-1 hover:opacity-70 transition-opacity"
            >
              {profilePicture ? "Change photo" : "Upload photo"}
            </button>
          </div>
        </div>

        {/* Location — required */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Current Location <span className="text-[#EC008C]">*</span>
          </label>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                ref={locationInputRef}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className={INPUT_CLS}
              />
            </div>
            <button
              type="button"
              onClick={autoDetectLocation}
              disabled={locating}
              title="Use my current location"
              className="px-3 py-3 rounded-xl border border-gray-200 text-gray-500 hover:border-[#EC008C] hover:text-[#EC008C] transition-all disabled:opacity-50 shrink-0"
            >
              {locating ? (
                <span className="w-4 h-4 border-2 border-gray-300 border-t-[#EC008C] rounded-full animate-spin inline-block" />
              ) : (
                <MapPin size={16} />
              )}
            </button>
          </div>
          {!canContinue && (
            <p className="text-xs text-gray-400 mt-1">Required to continue</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="(555) 000-0000"
              className={INPUT_CLS}
            />
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Bio <span className="text-gray-400 font-normal">({bio.length}/300, optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 300))}
            placeholder="Tell clients a bit about yourself — your experience, style, and what makes you great..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#EC008C] transition-all resize-none"
          />
        </div>

        {/* Social links */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Social Links <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="space-y-2">
            <div className="relative">
              <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400" />
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourusername"
                className={INPUT_CLS_SM}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">TT</span>
              <input
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@yourtiktok"
                className={INPUT_CLS_SM}
              />
            </div>
            <div className="relative">
              <Youtube size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="YouTube channel URL"
                className={INPUT_CLS_SM}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => onBack(currentData)}
          className="px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={15} />
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onNext(currentData)}
          className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Verify Network ────────────────────────────────────────────────────

function Step3Network({
  onNext,
  onBack,
  onSkip,
  sendInvites,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  sendInvites: (emails: string[]) => Promise<{ sent: number; total: number }>;
}) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function addEmail() {
    if (emails.length < 10) setEmails([...emails, ""]);
  }

  function removeEmail(i: number) {
    setEmails(emails.filter((_, idx) => idx !== i));
  }

  function updateEmail(i: number, value: string) {
    const next = [...emails];
    next[i] = value;
    setEmails(next);
  }

  async function handleSend() {
    const valid = emails.map((e) => e.trim().toLowerCase()).filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (valid.length === 0) {
      setError("Please enter at least one valid email address.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await sendInvites(valid);
      setSent(true);
      setTimeout(() => onNext(), 1500);
    } catch {
      setError("Something went wrong sending invites. You can skip for now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center mx-auto mb-4 text-2xl">
          🤝
        </div>
        <h2 className="text-2xl font-black text-[#111] mb-2">Verify Your Network</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Invite at least one artist to Artswrk to get started. We do this as a vetting protocol to grow a safe, trusted network of artists.
        </p>
      </div>

      {sent ? (
        <div className="text-center py-6">
          <CheckCircle2 size={40} className="text-[#EC008C] mx-auto mb-2" />
          <p className="font-semibold text-[#111]">Invites sent!</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {emails.map((email, i) => (
              <div key={i} className="relative flex gap-2">
                <div className="relative flex-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(i, e.target.value)}
                    placeholder="artist@email.com"
                    className="w-full pl-8 pr-3 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                  />
                </div>
                {emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmail(i)}
                    className="p-3 rounded-xl border border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200 transition-all"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {emails.length < 10 && (
            <button
              type="button"
              onClick={addEmail}
              className="text-xs text-gray-500 hover:text-[#EC008C] transition-colors flex items-center gap-1 mb-4"
            >
              <Plus size={13} /> Add another artist
            </button>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2 mb-3">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white artist-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sending ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending...</> : <>Send Invites <ArrowRight size={16} /></>}
            </button>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="w-full mt-3 text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>
        </>
      )}
    </div>
  );
}

// ─── Step 4: Choose Plan ───────────────────────────────────────────────────────

function Step4Plan({
  onBack,
  onGoToArtswrk,
  onChooseBasic,
  onChoosePro,
  interval,
  setInterval: setIntervalFn,
  loading,
}: {
  onBack: () => void;
  onGoToArtswrk: () => void;
  onChooseBasic: () => void;
  onChoosePro: () => void;
  interval: "monthly" | "annual";
  setInterval: (v: "monthly" | "annual") => void;
  loading: boolean;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-[#111] mb-1">Choose Your Plan</h2>
        <p className="text-sm text-gray-500">Subscribe to Artswrk to take full advantage of the platform. Get paid to connect with work you love 💖</p>
      </div>

      {/* Interval toggle */}
      <div className="flex items-center justify-center gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit mx-auto">
        <button
          type="button"
          onClick={() => setIntervalFn("monthly")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${interval === "monthly" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setIntervalFn("annual")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${interval === "annual" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
        >
          Annual <span className="text-[#F25722]">–17% off</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Basic */}
        <div className="border border-gray-200 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Zap size={15} className="text-amber-500" />
            </div>
            <span className="font-bold text-sm text-[#111]">Basic</span>
          </div>
          <p className="text-2xl font-black text-[#111] mb-0.5">$30<span className="text-sm font-normal text-gray-400">/unlock</span></p>
          <p className="text-xs text-gray-400 mb-3">Per year · pay per job</p>
          <ul className="space-y-1.5 mb-4 flex-1">
            {["Unlock jobs on demand", "Apply to studio gigs", "Basic profile listing", "Email support"].map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onChooseBasic}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-bold border-2 border-[#F25722] text-[#F25722] hover:bg-orange-50 transition-colors disabled:opacity-60"
          >
            Choose Basic
          </button>
        </div>

        {/* PRO */}
        <div className="border-2 border-[#F25722] rounded-2xl p-4 flex flex-col relative">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#F25722] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
            MOST POPULAR
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Star size={15} className="text-[#F25722]" />
            </div>
            <span className="font-bold text-sm text-[#111]">PRO</span>
          </div>
          <p className="text-2xl font-black text-[#111] mb-0.5">
            {interval === "monthly" ? "$10.99" : "$9.17"}
            <span className="text-sm font-normal text-gray-400">/mo</span>
          </p>
          <p className="text-xs text-gray-400 mb-3">
            {interval === "annual" ? "Billed $110/yr" : "Billed monthly"}
          </p>
          <ul className="space-y-1.5 mb-4 flex-1">
            {["Everything in Basic", "Unlimited job applications", "Priority in search results", "PRO badge on profile", "Access competition jobs", "Dedicated support"].map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                <CheckCircle2 size={12} className="text-[#F25722] mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onChoosePro}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            Choose PRO
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onGoToArtswrk}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#111] bg-gray-100 hover:bg-gray-200 transition-colors mb-3"
      >
        Go to Artswrk →
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ArtistOnboarding() {
  const [step, setStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Step 2
  const [profileData, setProfileData] = useState<{
    profilePicture?: string; location: string; phoneNumber: string;
    bio: string; instagram: string; tiktok: string; youtube: string;
  }>({ location: "", phoneNumber: "", bio: "", instagram: "", tiktok: "", youtube: "" });

  // Step 4
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // ── tRPC ──────────────────────────────────────────────────────────────────
  const statusQuery = trpc.signup.getArtistOnboardingStatus.useQuery(undefined, {
    enabled: !!user,
  });

  const updateOnboarding = trpc.signup.updateArtistOnboarding.useMutation();
  const uploadPictureMutation = trpc.signup.uploadProfilePicture.useMutation();
  const sendInvitesMutation = trpc.signup.sendArtistInvites.useMutation();
  const basicCheckout = trpc.artistSubscription.createBasicCheckout?.useMutation?.();
  const proCheckout = trpc.artistSubscription.createProCheckout?.useMutation?.();

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login?next=/artist-onboarding");
    }
  }, [authLoading, user, navigate]);

  // ── Resume from saved step ─────────────────────────────────────────────────
  useEffect(() => {
    if (!statusQuery.data) return;
    const data = statusQuery.data;
    if (data.masterArtistTypes?.length) setSelectedTypes(data.masterArtistTypes);
    if (data.artistServices?.length) setSelectedServices(data.artistServices);
    setProfileData({
      profilePicture: data.profilePicture ?? undefined,
      location: data.location ?? "",
      phoneNumber: data.phoneNumber ?? "",
      bio: data.bio ?? "",
      instagram: data.instagram ?? "",
      tiktok: data.tiktok ?? "",
      youtube: data.youtube ?? "",
    });
    const savedStep = data.onboardingStep;
    if (savedStep >= 1 && savedStep <= 4) {
      const completed = new Set<number>();
      for (let i = 1; i < savedStep; i++) completed.add(i);
      setCompletedSteps(completed);
      setStep(Math.min(savedStep, 4) as Step);
    }
  }, [statusQuery.data]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function markComplete(s: number) {
    setCompletedSteps((prev) => new Set([...prev, s]));
  }

  function toggleType(name: string, typeServices: string[]) {
    if (selectedTypes.includes(name)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== name));
      setSelectedServices(selectedServices.filter((s) => !typeServices.includes(s)));
    } else {
      setSelectedTypes([...selectedTypes, name]);
      setSelectedServices([...new Set([...selectedServices, ...typeServices])]);
    }
  }

  function toggleService(service: string) {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter((s) => s !== service));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  }

  async function uploadPicture(base64: string, contentType: string) {
    const result = await uploadPictureMutation.mutateAsync({ base64, contentType });
    return result.url;
  }

  async function sendInvites(emails: string[]) {
    return sendInvitesMutation.mutateAsync({ emails });
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  async function handleStep1Next() {
    // Always confirm userRole = "Artist" here in case the join step was bypassed
    await updateOnboarding.mutateAsync({
      masterArtistTypes: selectedTypes,
      artistServices: selectedServices,
      onboardingStep: 2,
      userRole: "Artist",
    });
    markComplete(1);
    setStep(2);
  }

  // Save step 1 silently when going back from step 2
  async function handleStep2Back(currentData: typeof profileData) {
    setProfileData(currentData);
    // Persist any partial step-2 data + current types before going back
    updateOnboarding.mutate({
      ...currentData,
      masterArtistTypes: selectedTypes,
      artistServices: selectedServices,
      onboardingStep: 1,
    });
    setStep(1);
  }

  async function handleStep2Next(data: typeof profileData) {
    setProfileData(data);
    await updateOnboarding.mutateAsync({
      ...data,
      onboardingStep: 3,
    });
    markComplete(2);
    setStep(3);
  }

  async function handleStep3Back() {
    // Save step position when going back to step 2
    updateOnboarding.mutate({ onboardingStep: 2 });
    setStep(2);
  }

  async function handleStep3Next() {
    await updateOnboarding.mutateAsync({ onboardingStep: 4 });
    markComplete(3);
    setStep(4);
  }

  async function handleStep4Back() {
    updateOnboarding.mutate({ onboardingStep: 3 });
    setStep(3);
  }

  async function handleGoToArtswrk() {
    await updateOnboarding.mutateAsync({ onboardingStep: 5, userSignedUp: true });
    window.location.href = "/app";
  }

  async function handleChooseBasic() {
    setCheckoutLoading(true);
    try {
      await updateOnboarding.mutateAsync({ userSignedUp: true });
      window.location.href = "/app/settings";
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleChoosePro() {
    setCheckoutLoading(true);
    try {
      await updateOnboarding.mutateAsync({ userSignedUp: true });
      window.location.href = "/app/settings";
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (authLoading || statusQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-gray-200 border-t-[#F25722] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex pt-16">
      <Navbar />
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-64 shrink-0 p-8 border-r border-gray-100 bg-white">
        <StepSidebar step={step} completedSteps={completedSteps} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-lg">
          <MobileProgress step={step} />

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
            {step === 1 && (
              <Step1ArtistTypes
                selected={selectedTypes}
                services={selectedServices}
                onToggleType={toggleType}
                onToggleService={toggleService}
                onNext={handleStep1Next}
              />
            )}
            {step === 2 && (
              <Step2Profile
                initial={profileData}
                onNext={handleStep2Next}
                onBack={handleStep2Back}
                uploadPicture={uploadPicture}
              />
            )}
            {step === 3 && (
              <Step3Network
                onNext={handleStep3Next}
                onBack={handleStep3Back}
                onSkip={handleStep3Next}
                sendInvites={sendInvites}
              />
            )}
            {step === 4 && (
              <Step4Plan
                onBack={handleStep4Back}
                onGoToArtswrk={handleGoToArtswrk}
                onChooseBasic={handleChooseBasic}
                onChoosePro={handleChoosePro}
                interval={interval}
                setInterval={setInterval}
                loading={checkoutLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
