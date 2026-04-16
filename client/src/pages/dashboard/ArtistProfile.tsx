/*
 * ARTSWRK DASHBOARD — ARTIST PROFILE
 * Route: /app/artists/:artistId
 * Layout: Two-column (portrait photo + name overlay on left, tabs on right)
 * Tabs: About | History | Resume
 */
import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft, Instagram, Globe, Youtube, ExternalLink,
  Loader2, AlertCircle, MapPin, CheckCircle2, XCircle,
  DollarSign, Calendar, MessageSquare, Briefcase, Star,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
];

function getArtistColor(seed: string | null | undefined) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(cents: number | null | undefined) {
  if (!cents) return null;
  return `$${(cents / 100).toFixed(0)}`;
}

// Parse a JSON array field stored as string
function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string" && !v.startsWith("165"));
    return [];
  } catch {
    return [];
  }
}

// Normalize an Instagram value to a clean handle
function normalizeInstagram(val: string | null | undefined): string | null {
  if (!val) return null;
  const match = val.match(/instagram\.com\/([^/?#]+)/);
  if (match) return `@${match[1]}`;
  if (val.startsWith("@")) return val;
  return `@${val}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg: Record<string, { cls: string; icon?: React.ReactNode }> = {
    Confirmed: { cls: "bg-blue-100 text-blue-700", icon: <CheckCircle2 size={11} /> },
    Declined: { cls: "bg-red-100 text-red-600", icon: <XCircle size={11} /> },
    Interested: { cls: "bg-orange-50 text-[#F25722]" },
    "Completed": { cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
    "Completed/Paid": { cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
    "Confirmed/Unpaid": { cls: "bg-blue-100 text-blue-700" },
    "Pay Now": { cls: "bg-orange-100 text-orange-700" },
  };
  const { cls, icon } = cfg[status ?? ""] ?? { cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {icon}{status ?? "Unknown"}
    </span>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function AboutTab({ artist }: { artist: NonNullable<ReturnType<typeof useArtistData>["artist"]> }) {
  const disciplines = parseJsonArray(artist.artistDisciplines);
  const services = parseJsonArray(artist.artistServices);
  const masterTypes = parseJsonArray(artist.masterArtistTypes);
  const experiences = parseJsonArray(artist.artistExperiences);
  const allTags = Array.from(new Set([...disciplines, ...services, ...masterTypes])).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Bio */}
      {artist.bio ? (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">About</h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{artist.bio}</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-5 text-center">
          <p className="text-sm text-gray-400">No bio available yet.</p>
        </div>
      )}

      {/* Disciplines / Services */}
      {allTags.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Disciplines & Services</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#ec008c]/10 text-[#ec008c]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {experiences.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Experience</h3>
          <div className="flex flex-wrap gap-2">
            {experiences.map((exp) => (
              <span key={exp} className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                {exp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Details</h3>
        <div className="space-y-2">
          {artist.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 flex-shrink-0" />
              <span>{artist.location}</span>
            </div>
          )}
          {artist.pronouns && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-gray-400 text-xs font-bold w-3.5 text-center flex-shrink-0">✦</span>
              <span>{artist.pronouns}</span>
            </div>
          )}
          {artist.businessOrIndividual && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
              <span>{artist.businessOrIndividual}</span>
            </div>
          )}
          {artist.optionAvailability && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={14} className="text-gray-400 flex-shrink-0" />
              <span>{artist.optionAvailability}</span>
            </div>
          )}
          {(artist.artswrkPro || artist.artswrkBasic) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Star size={14} className="text-[#F25722] flex-shrink-0" />
              <span className="font-semibold text-[#F25722]">
                {artist.artswrkPro ? "Artswrk PRO" : "Artswrk Basic"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Social links */}
      {(artist.instagram || artist.youtube || artist.tiktok || artist.website || artist.portfolio) && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Links</h3>
          <div className="flex flex-wrap gap-2">
            {artist.instagram && (
              <a
                href={artist.instagram.startsWith("http") ? artist.instagram : `https://instagram.com/${artist.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
              >
                <Instagram size={13} />
                {normalizeInstagram(artist.instagram)}
              </a>
            )}
            {artist.youtube && (
              <a
                href={artist.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <Youtube size={13} />
                YouTube
              </a>
            )}
            {artist.tiktok && (
              <a
                href={artist.tiktok.startsWith("http") ? artist.tiktok : `https://tiktok.com/@${artist.tiktok}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <ExternalLink size={13} />
                TikTok
              </a>
            )}
            {artist.portfolio && (
              <a
                href={artist.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Globe size={13} />
                Portfolio
              </a>
            )}
            {artist.website && (
              <a
                href={artist.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Globe size={13} />
                Website
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ artistId }: { artistId: number }) {
  const { data: history, isLoading } = trpc.artists.getHistory.useQuery({ artistId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!history) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400">No history available.</p>
      </div>
    );
  }

  const { applications, bookings, conversations } = history;
  const hasAny = applications.length > 0 || bookings.length > 0 || conversations.length > 0;

  if (!hasAny) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400">No history with this artist yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-[#F25722]">{applications.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Applications</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-blue-600">{bookings.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Bookings</p>
        </div>
        <div className="bg-pink-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-[#ec008c]">{conversations.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Conversations</p>
        </div>
      </div>

      {/* Bookings */}
      {bookings.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-green-500" />
            Bookings
          </h3>
          <div className="space-y-2">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={booking.bookingStatus} />
                    {booking.clientRate && (
                      <span className="text-sm font-bold text-[#111]">
                        {formatCurrency(booking.clientRate)}
                      </span>
                    )}
                  </div>
                  {booking.startDate && (
                    <p className="text-xs text-gray-400">{formatDate(booking.startDate)}</p>
                  )}
                  {booking.locationAddress && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{booking.locationAddress}</p>
                  )}
                </div>
                {booking.stripeCheckoutUrl && (
                  <a
                    href={booking.stripeCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Receipt <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applications */}
      {applications.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Briefcase size={14} className="text-orange-500" />
            Job Applications
          </h3>
          <div className="space-y-2">
            {applications.map((app) => (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    {app.jobDescription && (
                      <p className="text-sm text-gray-700 line-clamp-2">{app.jobDescription}</p>
                    )}
                    {app.jobLocationAddress && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin size={10} />{app.jobLocationAddress}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {app.bubbleCreatedAt && <span>{formatDate(app.bubbleCreatedAt)}</span>}
                  {app.artistHourlyRate && (
                    <span className="font-semibold text-gray-600">{formatCurrency(app.artistHourlyRate)}/hr</span>
                  )}
                  {app.artistFlatRate && (
                    <span className="font-semibold text-gray-600">{formatCurrency(app.artistFlatRate)} flat</span>
                  )}
                </div>
                {app.message && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-600 italic">"{app.message}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      {conversations.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MessageSquare size={14} className="text-pink-500" />
            Conversations
          </h3>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div key={conv.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Conversation #{conv.id}</p>
                  {conv.lastMessageDate && (
                    <p className="text-xs text-gray-400 mt-0.5">Last message: {formatDate(conv.lastMessageDate)}</p>
                  )}
                </div>
                <Link
                  href="/app/messages"
                  className="text-xs font-semibold text-[#ec008c] hover:underline flex items-center gap-1"
                >
                  View <ChevronRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resume Tab ───────────────────────────────────────────────────────────────

function ResumeTab({ artist }: { artist: NonNullable<ReturnType<typeof useArtistData>["artist"]> }) {
  const resumes = parseJsonArray(artist.resumes);
  const videos = parseJsonArray(artist.videos);

  const hasContent = resumes.length > 0 || videos.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400">No resume or media files available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {resumes.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Resume Files</h3>
          <div className="space-y-2">
            {resumes.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-300 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <ExternalLink size={14} className="text-blue-500" />
                </div>
                <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                  Resume {resumes.length > 1 ? i + 1 : ""}
                </span>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Videos</h3>
          <div className="space-y-2">
            {videos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-300 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Youtube size={14} className="text-red-500" />
                </div>
                <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                  Video {videos.length > 1 ? i + 1 : ""}
                </span>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useArtistData(artistId: number) {
  const { data: artist, isLoading, error } = trpc.artists.getById.useQuery({ artistId });
  return { artist, isLoading, error };
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "about" | "history" | "resume";

export default function ArtistProfile() {
  const params = useParams<{ artistId: string }>();
  const artistId = parseInt(params.artistId ?? "0", 10);
  const [activeTab, setActiveTab] = useState<Tab>("about");

  const { artist, isLoading, error } = useArtistData(artistId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-gray-500">Artist not found.</p>
        <Link href="/app/artists" className="text-sm text-[#F25722] font-semibold hover:underline">
          ← Back to Artists
        </Link>
      </div>
    );
  }

  const displayName = artist.firstName && artist.lastName
    ? `${artist.firstName} ${artist.lastName}`
    : artist.name ?? "Artist";

  const color = getArtistColor(artist.firstName ?? artist.name);
  const initials = getInitials(artist.firstName, artist.lastName, artist.name);

  const TABS: { key: Tab; label: string }[] = [
    { key: "about", label: "About" },
    { key: "history", label: "History with You" },
    { key: "resume", label: "Resume & Media" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/app/artists" className="hover:text-gray-600 transition-colors">
          Artists
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-700 font-medium truncate">{displayName}</span>
      </nav>

      {/* Profile layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — portrait + info */}
        <div className="lg:w-72 flex-shrink-0">
          {/* Portrait card */}
          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-100 shadow-sm mb-4">
            {artist.profilePicture ? (
              <>
                <img
                  src={artist.profilePicture}
                  alt={displayName}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = "none";
                    const fb = el.nextElementSibling as HTMLElement;
                    if (fb) fb.style.display = "flex";
                  }}
                />
                <div
                  className={`absolute inset-0 ${color} flex items-center justify-center text-white text-6xl font-black`}
                  style={{ display: "none" }}
                >
                  {initials}
                </div>
              </>
            ) : (
              <div className={`w-full h-full ${color} flex items-center justify-center text-white text-6xl font-black`}>
                {initials}
              </div>
            )}

            {/* Name overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
              <h1 className="text-xl font-black text-white leading-tight">{displayName}</h1>
              {artist.slug && (
                <p className="text-white/70 text-sm mt-0.5">@{artist.slug}</p>
              )}
            </div>

            {/* PRO badge */}
            {(artist.artswrkPro || artist.artswrkBasic) && (
              <div className="absolute top-3 right-3">
                <span className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide">
                  {artist.artswrkPro ? "PRO" : "BASIC"}
                </span>
              </div>
            )}
          </div>

          {/* Quick info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
            {artist.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                <span>{artist.location}</span>
              </div>
            )}
            {artist.pronouns && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-gray-400 text-xs font-bold w-3.5 text-center flex-shrink-0">✦</span>
                <span>{artist.pronouns}</span>
              </div>
            )}
            {artist.instagram && (
              <a
                href={artist.instagram.startsWith("http") ? artist.instagram : `https://instagram.com/${artist.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-pink-600 hover:text-pink-700 transition-colors"
              >
                <Instagram size={14} className="flex-shrink-0" />
                <span className="truncate">{normalizeInstagram(artist.instagram)}</span>
              </a>
            )}
            {artist.portfolio && (
              <a
                href={artist.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Globe size={14} className="flex-shrink-0" />
                <span className="truncate">Portfolio</span>
                <ExternalLink size={11} />
              </a>
            )}
            {artist.website && !artist.portfolio && (
              <a
                href={artist.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Globe size={14} className="flex-shrink-0" />
                <span className="truncate">Website</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          {/* Back button (mobile) */}
          <div className="mt-4 lg:hidden">
            <Link
              href="/app/artists"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Artists
            </Link>
          </div>
        </div>

        {/* Right column — tabs + content */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#F25722] text-[#F25722]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {activeTab === "about" && <AboutTab artist={artist} />}
            {activeTab === "history" && <HistoryTab artistId={artistId} />}
            {activeTab === "resume" && <ResumeTab artist={artist} />}
          </div>
        </div>
      </div>
    </div>
  );
}
