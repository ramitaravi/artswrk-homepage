/**
 * ARTIST PROFILE PAGE
 * Matches the live Artswrk profile tab design at artswrk.com/version-live/app?tab=profile
 * Tabs: About | Services | Reviews | Media | Resume
 */

import { useState } from "react";
import {
  MapPin,
  Calendar,
  Share2,
  Edit3,
  Star,
  ExternalLink,
  Instagram,
  Youtube,
  Globe,
  FileText,
  Image,
  ChevronDown,
  ChevronUp,
  Loader2,
  BadgeCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import EditProfileModal from "./EditProfileModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJoinDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "2-digit", year: "2-digit" }).format(new Date(date));
}

function Avatar({ src, name, size = "lg" }: { src?: string; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "w-10 h-10 text-sm", md: "w-14 h-14 text-base", lg: "w-24 h-24 text-2xl", xl: "w-32 h-32 text-3xl" };
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0 border-2 border-white shadow-md`}
      />
    );
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-black flex-shrink-0 border-2 border-white shadow-md`}>
      {initials}
    </div>
  );
}

function Chip({ label, variant = "default" }: { label: string; variant?: "default" | "pink" | "orange" | "blue" }) {
  const styles = {
    default: "bg-gray-100 text-gray-700",
    pink: "bg-pink-50 text-pink-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${styles[variant]}`}>
      {label}
    </span>
  );
}

// ─── Tab: About ───────────────────────────────────────────────────────────────

function AboutTab({ profile }: { profile: any }) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const bioWords = (profile.bio || "").split(" ");
  const isLong = bioWords.length > 80;
  const displayBio = isLong && !bioExpanded ? bioWords.slice(0, 80).join(" ") + "…" : profile.bio;

  return (
    <div className="space-y-6">
      {/* Bio */}
      {profile.bio && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Bio</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{displayBio}</p>
          {isLong && (
            <button
              onClick={() => setBioExpanded(e => !e)}
              className="mt-2 text-xs font-semibold text-orange-600 flex items-center gap-1 hover:text-orange-700 transition-colors"
            >
              {bioExpanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Read more</>}
            </button>
          )}
        </div>
      )}

      {/* Work Types */}
      {profile.workTypes?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Work</h3>
          <div className="flex flex-wrap gap-2">
            {profile.workTypes.map((w: string) => (
              <Chip key={w} label={w} variant="orange" />
            ))}
          </div>
        </div>
      )}

      {/* Disciplines */}
      {profile.artistDisciplines?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Disciplines</h3>
          <div className="flex flex-wrap gap-2">
            {profile.artistDisciplines.map((d: string) => (
              <Chip key={d} label={d} />
            ))}
          </div>
        </div>
      )}

      {/* Styles */}
      {profile.masterStyles?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Styles</h3>
          <div className="flex flex-wrap gap-2">
            {profile.masterStyles.map((s: string) => (
              <Chip key={s} label={s} variant="blue" />
            ))}
          </div>
        </div>
      )}

      {/* Social Links */}
      {(profile.instagram || profile.tiktok || profile.youtube || profile.website || profile.portfolio) && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Links</h3>
          <div className="flex flex-wrap gap-3">
            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-pink-600 transition-colors"
              >
                <Instagram size={14} /> @{profile.instagram.replace("@", "")}
              </a>
            )}
            {profile.youtube && (
              <a
                href={profile.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-red-600 transition-colors"
              >
                <Youtube size={14} /> YouTube
              </a>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Globe size={14} /> Website
              </a>
            )}
            {profile.portfolio && (
              <a
                href={profile.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-orange-600 transition-colors"
              >
                <ExternalLink size={14} /> Portfolio
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Services ────────────────────────────────────────────────────────────

function ServicesTab({ profile }: { profile: any }) {
  const services = profile.artistServices || [];
  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Star size={20} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No services listed yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {services.map((service: string) => (
        <div key={service} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Star size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">{service}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Reviews ─────────────────────────────────────────────────────────────

function ReviewsTab({ profile }: { profile: any }) {
  return (
    <div className="text-center py-12">
      <div className="flex items-center justify-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={20} className={i <= Math.round((profile.ratingScore || 0) / 10) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
        ))}
      </div>
      {profile.reviewCount > 0 ? (
        <p className="text-sm text-gray-500">{profile.reviewCount} review{profile.reviewCount !== 1 ? "s" : ""}</p>
      ) : (
        <p className="text-sm text-gray-500">No reviews yet.</p>
      )}
    </div>
  );
}

// ─── Tab: Media ───────────────────────────────────────────────────────────────

function MediaTab({ profile }: { profile: any }) {
  const photos = profile.mediaPhotos || [];
  const videos = profile.videos || [];

  if (photos.length === 0 && videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Image size={20} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No media uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Photos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Media ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-xl hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}
      {videos.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Videos</h3>
          <div className="space-y-2">
            {videos.map((url: string, i: number) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Youtube size={16} className="text-red-500 flex-shrink-0" />
                Video {i + 1}
                <ExternalLink size={12} className="ml-auto text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Resume ──────────────────────────────────────────────────────────────

function ResumeTab({ profile }: { profile: any }) {
  const resumeFiles = profile.resumeFiles || [];
  const resumes = profile.resumes || [];

  // Combine both formats
  const allResumes: { url: string; name: string }[] = [
    ...resumeFiles,
    ...resumes.map((url: string, i: number) => ({ url, name: `Resume ${i + 1}` })),
  ];

  if (allResumes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <FileText size={20} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No resume uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allResumes.map((r, i) => (
        <a
          key={i}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-orange-50 hover:border-orange-100 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center flex-shrink-0">
            <FileText size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
            <p className="text-xs text-gray-400">Click to view</p>
          </div>
          <ExternalLink size={14} className="text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

type ProfileTab = "about" | "services" | "reviews" | "media" | "resume";

export default function ArtistProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("about");
  const [editOpen, setEditOpen] = useState(false);

  const { data: profile, isLoading, error, refetch } = trpc.artistProfile.getMyProfile.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-500">Could not load profile. Please try again.</p>
      </div>
    );
  }

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "about", label: "About" },
    { id: "services", label: "Services" },
    { id: "reviews", label: "Reviews" },
    { id: "media", label: "Media" },
    { id: "resume", label: "Resume" },
  ];

  const joinDate = profile.bubbleCreatedAt || profile.joinedAt;

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: profile?.name ?? "", url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      {/* ── Profile Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Cover gradient */}
        <div className="h-20 bg-gradient-to-r from-orange-400 via-pink-400 to-rose-500" />

        {/* Avatar + actions row */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <Avatar src={profile.profilePicture} name={profile.name} size="xl" />
              {profile.isPro && (
                <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                  PRO
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 pb-1">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Share2 size={13} /> Share
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(90deg,#FFBC5D,#F25722)" }}
              >
                <Edit3 size={13} /> Edit Profile
              </button>
            </div>
          </div>

          {/* Name + meta */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-gray-900">
                {profile.name || `${profile.firstName} ${profile.lastName}`.trim() || "Your Name"}
              </h1>
              {profile.pronouns && (
                <span className="text-xs text-gray-400 font-medium">({profile.pronouns})</span>
              )}
              {profile.isPro && (
                <BadgeCheck size={18} className="text-amber-500" />
              )}
            </div>

            {/* Booking count */}
            {profile.bookingCount > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">({profile.bookingCount} Bookings)</p>
            )}

            {/* Work types */}
            {profile.workTypes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.workTypes.map((w: string) => (
                  <span key={w} className="text-xs font-semibold text-gray-700">{w}</span>
                )).reduce((acc: React.ReactNode[], el: React.ReactNode, i: number) => {
                  if (i > 0) acc.push(<span key={`sep-${i}`} className="text-gray-300 text-xs">·</span>);
                  acc.push(el);
                  return acc;
                }, [])}
              </div>
            )}

            {/* Location + Join date */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {profile.location}
                </span>
              )}
              {joinDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> Joined {formatJoinDate(joinDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Resume quick link (if available) ── */}
      {(profile.resumeFiles?.length > 0 || profile.resumes?.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText size={15} className="text-orange-500" />
            {profile.resumeFiles?.[0]?.name || "Resume"}
          </div>
          <a
            href={profile.resumeFiles?.[0]?.url || profile.resumes?.[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            View <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-orange-600 border-b-2 border-orange-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === "about" && <AboutTab profile={profile} />}
          {activeTab === "services" && <ServicesTab profile={profile} />}
          {activeTab === "reviews" && <ReviewsTab profile={profile} />}
          {activeTab === "media" && <MediaTab profile={profile} />}
          {activeTab === "resume" && <ResumeTab profile={profile} />}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <EditProfileModal
          profile={profile!}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
