/*
 * ARTSWRK — UNIFIED ARTIST PROFILE
 * Route: /app/artists/:artistId (client view)
 * Same layout as the artist's own profile (/app/profile) — photo card + tabs.
 * Adds "History with You" tab for client context.
 */
import { useState } from "react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Instagram, Globe, Youtube, ExternalLink,
  Loader2, AlertCircle, MapPin, Calendar, CheckCircle2, XCircle,
  DollarSign, MessageSquare, Briefcase, Star, ChevronRight,
  Share2, Lock, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useUpgrade } from "@/components/UpgradeModal";
import { formatLocation } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter((v: any) => typeof v === "string" && !v.startsWith("165"));
    return [];
  } catch { return []; }
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  const date = new Date(d as string);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || amount === 0) return null;
  return `$${Number(amount).toLocaleString()}`;
}

function normalizeInstagram(val: string | null | undefined): string | null {
  if (!val) return null;
  const match = val.match(/instagram\.com\/([^/?#]+)/);
  if (match) return `@${match[1]}`;
  return val.startsWith("@") ? val : `@${val}`;
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size}
          className={i <= full ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
        />
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg: Record<string, { cls: string; icon?: React.ReactNode }> = {
    Confirmed:           { cls: "bg-blue-100 text-blue-700",   icon: <CheckCircle2 size={11} /> },
    Declined:            { cls: "bg-red-100 text-red-600",     icon: <XCircle size={11} /> },
    Interested:          { cls: "bg-orange-50 text-[#F25722]"  },
    Completed:           { cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
    "Completed/Paid":    { cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
    "Confirmed/Unpaid":  { cls: "bg-blue-100 text-blue-700"    },
    "Pay Now":           { cls: "bg-orange-100 text-orange-700" },
  };
  const { cls, icon } = cfg[status ?? ""] ?? { cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {icon}{status ?? "Unknown"}
    </span>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x: any) => typeof x === "string");
  return parseJsonArray(v);
}

function AboutTab({ profile, userId }: { profile: any; userId: number }) {
  const mediaPhotos: string[] = arr(profile.mediaPhotos);
  const resumeFiles: { url: string; name: string }[] = Array.isArray(profile.resumeFiles) ? profile.resumeFiles : [];
  const disciplines = arr(profile.artistDisciplines);
  const services = arr(profile.artistServices);
  // profile.masterArtistTypes holds raw Bubble internal IDs, not display
  // names — deliberately excluded. profile.workTypes is the pre-resolved,
  // human-readable equivalent already synced for display (same fix as the
  // parent component's own workTypes usage below).
  const workTypes = arr(profile.workTypes);
  const allTags = Array.from(new Set([...workTypes, ...disciplines, ...services])).filter(Boolean);

  const { data: categories = [] } = trpc.artistProfile.getPublicServiceCategories.useQuery({ userId });
  const { data: affiliations = [] } = trpc.artists.getArtistAffiliations.useQuery({ userId });

  return (
    <div className="space-y-8">
      {/* Media grid */}
      {mediaPhotos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Media</h3>
          <div className="grid grid-cols-3 gap-3">
            {mediaPhotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Resume files */}
      {resumeFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Resume</h3>
          <div className="space-y-2">
            {resumeFiles.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <ExternalLink size={14} className="text-[#ec008c]" />
                </div>
                <span className="text-sm font-medium text-gray-700 flex-1">{f.name}</span>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Bio */}
      {profile.bio && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
        </div>
      )}

      {/* Disciplines & art form tags */}
      {allTags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Specialties</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#ec008c]/10 text-[#ec008c]">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Affiliations */}
      {(affiliations as any[]).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Affiliations</h3>
          <div className="flex flex-wrap gap-3">
            {(affiliations as any[]).map((aff: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white">
                {aff.logoUrl ? (
                  <img
                    src={aff.logoUrl.startsWith("//") ? `https:${aff.logoUrl}` : aff.logoUrl}
                    alt={aff.display}
                    className="w-5 h-5 rounded-sm object-contain flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded-sm bg-gray-200 flex items-center justify-center text-[8px] font-black text-gray-500 flex-shrink-0">
                    {(aff.display ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700">{aff.display}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social links */}
      {(profile.instagram || profile.youtube || profile.tiktok || profile.website || profile.portfolio) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Links</h3>
          <div className="flex flex-col gap-2">
            {profile.instagram && (
              <a href={profile.instagram.startsWith("http") ? profile.instagram : `https://instagram.com/${profile.instagram.replace("@","")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors">
                <Instagram size={13} />{normalizeInstagram(profile.instagram)}
              </a>
            )}
            {profile.youtube && (
              <a href={profile.youtube} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                <Youtube size={13} />YouTube
              </a>
            )}
            {profile.tiktok && (
              <a href={profile.tiktok.startsWith("http") ? profile.tiktok : `https://tiktok.com/@${profile.tiktok}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                <ExternalLink size={13} />TikTok
              </a>
            )}
            {profile.portfolio && (
              <a href={profile.portfolio} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                <Globe size={13} />Portfolio
              </a>
            )}
            {profile.website && !profile.portfolio && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                <Globe size={13} />Website
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

function ReviewsTab({ userId }: { userId: number }) {
  const { data: reviews = [], isLoading } = trpc.artistProfile.getPublicReviews.useQuery({ userId });

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i=>(
        <div key={i} className="p-5 rounded-xl border border-gray-100 animate-pulse">
          <div className="flex gap-1 mb-3">{[1,2,3,4,5].map(j=><div key={j} className="w-4 h-4 rounded bg-gray-100"/>)}</div>
          <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"/>
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-4"/>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100"/>
            <div className="space-y-1.5"><div className="h-3 bg-gray-100 rounded w-24"/><div className="h-3 bg-gray-100 rounded w-16"/></div>
          </div>
        </div>
      ))}
    </div>
  );

  if (reviews.length === 0) return <div className="text-center py-12 text-gray-400 text-sm">No reviews yet.</div>;

  return (
    <div className="space-y-4">
      {(reviews as any[]).map(review => (
        <div key={review.id} className="p-5 rounded-xl border border-gray-100">
          <StarRow rating={review.rating} size={16} />
          <p className="text-sm text-gray-700 leading-relaxed my-3">{review.body}</p>
          <div className="flex items-center gap-3">
            {review.reviewerAvatar ? (
              <img src={review.reviewerAvatar} alt={review.reviewerName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-gray-500">{review.reviewerName?.[0] ?? "?"}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-[#111] leading-tight">{review.reviewerName}</p>
              {review.reviewerStudio && <p className="text-xs text-gray-500">{review.reviewerStudio}</p>}
              {review.reviewDate && <p className="text-xs text-gray-400">{new Date(review.reviewDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ artistId }: { artistId: number }) {
  const { data: history, isLoading } = trpc.artists.getHistory.useQuery({ artistId });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-gray-300" />
    </div>
  );

  if (!history) return <div className="text-center py-12"><p className="text-sm text-gray-400">No history available.</p></div>;

  const { applications, bookings, conversations } = history;
  const hasAny = applications.length > 0 || bookings.length > 0 || conversations.length > 0;

  if (!hasAny) return (
    <div className="text-center py-12">
      <p className="text-sm text-gray-400">No history with this artist yet.</p>
    </div>
  );

  return (
    <div className="space-y-6">
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

      {bookings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-green-500" /> Bookings
          </h3>
          <div className="space-y-2">
            {bookings.map((booking: any) => (
              <div key={booking.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={booking.bookingStatus} />
                    {booking.clientRate && <span className="text-sm font-bold text-[#111]">{formatCurrency(booking.clientRate)}</span>}
                  </div>
                  {booking.startDate && <p className="text-xs text-gray-400">{formatDate(booking.startDate)}</p>}
                  {booking.locationAddress && <p className="text-xs text-gray-400 truncate mt-0.5">{booking.locationAddress}</p>}
                </div>
                {booking.stripeCheckoutUrl && (
                  <a href={booking.stripeCheckoutUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                    Receipt <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Briefcase size={14} className="text-orange-500" /> Applications
          </h3>
          <div className="space-y-2">
            {applications.map((app: any) => (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    {app.jobDescription && <p className="text-sm text-gray-700 line-clamp-2">{app.jobDescription}</p>}
                    {app.jobLocationAddress && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin size={10} />{app.jobLocationAddress}</p>
                    )}
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {app.bubbleCreatedAt && <span>{formatDate(app.bubbleCreatedAt)}</span>}
                  {app.artistHourlyRate && <span className="font-semibold text-gray-600">{formatCurrency(app.artistHourlyRate)}/hr</span>}
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

      {conversations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MessageSquare size={14} className="text-pink-500" /> Conversations
          </h3>
          <div className="space-y-2">
            {conversations.map((conv: any) => (
              <div key={conv.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Conversation #{conv.id}</p>
                  {conv.lastMessageDate && <p className="text-xs text-gray-400 mt-0.5">Last message: {formatDate(conv.lastMessageDate)}</p>}
                </div>
                <Link href="/app/messages"
                  className="text-xs font-semibold text-[#ec008c] hover:underline flex items-center gap-1">
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

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "about" | "reviews" | "history";

export default function ArtistProfile() {
  const params = useParams<{ artistId: string }>();
  const artistId = parseInt(params.artistId ?? "0", 10);
  const search = useSearch();
  const queryTab = new URLSearchParams(search).get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    queryTab && ["about", "reviews", "history"].includes(queryTab) ? queryTab : "about"
  );
  const [, navigate] = useLocation();

  const { data: profile, isLoading, error } = trpc.artistProfile.getPublicProfile.useQuery(
    { userId: artistId },
    { enabled: artistId > 0 }
  );

  const { open: openUpgrade } = useUpgrade();

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: profile?.name ?? "Artist Profile", url });
    else navigator.clipboard.writeText(url);
  };

  if (isLoading) return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 animate-pulse">
      <div className="w-full md:w-72 flex-shrink-0">
        <div className="rounded-2xl overflow-hidden border border-gray-100">
          <div className="aspect-[3/4] bg-gray-200" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 pt-2">
        <div className="flex gap-8 border-b border-gray-100 pb-3">
          {["About","Reviews","History"].map(t=><div key={t} className="h-4 w-14 bg-gray-100 rounded"/>)}
        </div>
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-4 bg-gray-100 rounded"/>)}</div>
      </div>
    </div>
  );

  if (error || !profile) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-sm text-gray-500">Artist not found.</p>
      <Link href="/app/artists" className="text-sm text-[#F25722] font-semibold hover:underline">← Back to Artists</Link>
    </div>
  );

  if ((profile as any).locked) {
    const lp = profile as any;
    const lockedName = lp.firstName
      ? `${lp.firstName}${lp.lastName ? " " + lp.lastName[0] + "." : ""}`.trim()
      : lp.name || "This artist";
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
          {lp.profilePicture ? (
            <img src={lp.profilePicture} alt={lockedName} className="w-full h-full object-cover blur-[3px]" />
          ) : (
            <Lock size={22} className="text-gray-400" />
          )}
        </div>
        <div>
          <p className="text-lg font-black text-[#111]">{lockedName}'s full profile is locked</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Subscribe to Artswrk Premium to view bios, social links, and contact info — and message artists directly.
          </p>
        </div>
        <button
          onClick={() => openUpgrade({ audience: "client", feature: "Full artist profiles" })}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#111] hover:opacity-90 transition-opacity"
        >
          <Sparkles size={15} />
          See Premium
        </button>
        <Link href="/app/artists" className="text-sm text-gray-400 font-semibold hover:text-[#111]">← Back to Artists</Link>
      </div>
    );
  }

  const p = profile as any;
  const displayName = p.firstName
    ? `${p.firstName}${p.lastName ? " " + p.lastName[0] + "." : ""}`.trim()
    : p.name ?? "Artist";

  // p.masterArtistTypes holds raw Bubble internal IDs, not display names —
  // deliberately excluded. p.workTypes is the pre-resolved, human-readable
  // equivalent already synced for display.
  const workTypes: string[] = (Array.isArray(p.workTypes) ? p.workTypes : [])
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

  // No real reviews system exists yet — show a full rating rather than an
  // empty/broken-looking one until a real review system ships.
  const ratingDisplay = p.ratingScore ? p.ratingScore / 10 : 5;
  const joinDate = p.bubbleCreatedAt || p.joinedAt || null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "about",   label: "About" },
    { key: "reviews", label: "Reviews" },
    { key: "history", label: "History with You" },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 items-start">
      {/* ── Left: Profile Card ─────────────────────────────────────────────── */}
      <div className="w-full md:w-72 flex-shrink-0 md:sticky md:top-6">
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
          {/* Photo with name/PRO overlay */}
          <div className="relative">
            <div className="aspect-[3/4] max-h-80 md:max-h-none bg-gray-200">
              {p.profilePicture ? (
                <img src={p.profilePicture} alt={p.name ?? "Profile"}
                  className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <span className="text-7xl font-black text-gray-300">
                    {(p.firstName?.[0] ?? p.name?.[0] ?? "?").toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
              <h2 className="text-xl font-black text-white leading-tight">{displayName}</h2>
              {p.pronouns && <p className="text-sm text-white/80 mt-0.5">{p.pronouns}</p>}
            </div>
            {p.isPro && (
              <div className="absolute bottom-4 right-4 bg-[#ec008c] text-white text-xs font-black px-2.5 py-1 rounded-md tracking-wider shadow">
                PRO
              </div>
            )}
          </div>

          {/* Card body */}
          <div className="p-4 space-y-3">
            {/* Stars + bookings */}
            <div className="flex items-center gap-2">
              <StarRow rating={ratingDisplay} />
              <span className="text-sm text-gray-500">({p.bookingCount ?? 0} Bookings)</span>
            </div>

            {/* Location + Joined */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {p.location && (
                <span className="flex items-center gap-1"><MapPin size={12} className="text-gray-400" />{formatLocation(p.location)}</span>
              )}
              {joinDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-gray-400" />
                  Joined {new Date(joinDate).toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"2-digit"})}
                </span>
              )}
            </div>

            {/* Work type chips */}
            {workTypes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {workTypes.map(wt => (
                  <span key={wt} className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white">{wt}</span>
                ))}
              </div>
            )}

            {/* Message button */}
            <Link href="/app/messages">
              <button className="w-full py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                <MessageSquare size={14} /> Message
              </button>
            </Link>

            {/* Public profile link */}
            {p.slug && (
              <a href={`/book/${p.slug}`} target="_blank" rel="noopener noreferrer">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <ExternalLink size={14} /> View Public Profile
                </button>
              </a>
            )}

            {/* Share */}
            <button onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
              <Share2 size={14} /> Share Profile
            </button>

            {/* Back link */}
            <button onClick={() => navigate("/app/artists")}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={12} /> Back to Artists
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Tabs + Content ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#ec008c] text-[#ec008c]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === "about"   && <AboutTab profile={p} userId={artistId} />}
          {activeTab === "reviews" && <ReviewsTab userId={artistId} />}
          {activeTab === "history" && <HistoryTab artistId={artistId} />}
        </div>
      </div>
    </div>
  );
}
