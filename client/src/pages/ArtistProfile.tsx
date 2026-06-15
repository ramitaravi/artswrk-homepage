/**
 * Public artist profile page — /book/:slug
 * Same two-column gold standard layout as /app/profile,
 * but with Navbar wrapper + Contact action instead of Edit Profile.
 */

import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  MapPin, Calendar, Share2, Star, Loader2,
  Globe, Instagram, Youtube, ExternalLink, MessageCircle, Pencil,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

function formatReviewDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= full ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
        />
      ))}
    </div>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function AboutTab({ profile }: { profile: any }) {
  const mediaPhotos: string[] = Array.isArray(profile.mediaPhotos) ? profile.mediaPhotos : [];
  const resumeFiles: { url: string; name: string }[] = Array.isArray(profile.resumeFiles) ? profile.resumeFiles : [];

  return (
    <div className="space-y-8">
      {mediaPhotos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Media</h3>
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

      {resumeFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Resume</h3>
          <div className="space-y-2">
            {resumeFiles.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ec008c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14,2 14,8 20,8" stroke="#ec008c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 flex-1">{f.name}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-400 group-hover:text-gray-600 flex-shrink-0">
                  <polyline points="9,18 15,12 9,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}

      {profile.bio && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Bio</h3>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({ userId }: { userId: number }) {
  const { data: categories = [], isLoading } = trpc.artistProfile.getPublicServiceCategories.useQuery({ userId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="flex gap-5 animate-pulse">
            <div className="w-40 h-32 rounded-xl bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="flex gap-2 flex-wrap">
                {[1,2,3].map(j => <div key={j} className="h-8 w-28 bg-gray-100 rounded-full" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No services listed yet.</div>;
  }

  return (
    <div className="space-y-6">
      {categories.map((cat, i) => (
        <div key={cat.id}>
          <div className="flex gap-5 items-start">
            {cat.imageUrl && (
              <div className="w-40 h-32 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 pt-1">
              <h3 className="text-base font-semibold text-[#111] mb-3">{cat.name}</h3>
              <div className="flex flex-wrap gap-2">
                {cat.subServices.map((sub, j) => (
                  <span key={j} className="px-4 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 bg-white">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {i < categories.length - 1 && <div className="border-b border-gray-100 mt-6" />}
        </div>
      ))}
    </div>
  );
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

function ReviewsTab({ userId }: { userId: number }) {
  const { data: reviews = [], isLoading } = trpc.artistProfile.getPublicReviews.useQuery({ userId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-5 rounded-xl border border-gray-100 animate-pulse">
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(j => <div key={j} className="w-4 h-4 rounded bg-gray-100" />)}
            </div>
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100" />
              <div className="space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No reviews yet.</div>;
  }

  return (
    <div className="space-y-4">
      {reviews.map(review => (
        <div key={review.id} className="p-5 rounded-xl border border-gray-100">
          <StarRow rating={review.rating} />
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
              {review.reviewDate && <p className="text-xs text-gray-400">{formatReviewDate(review.reviewDate)}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "about" | "services" | "reviews";

export default function ArtistProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("about");
  const { user } = useAuth();

  const { data: profile, isLoading } = trpc.artistProfile.getProfileBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: profile?.name ?? "Artist Profile", url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-32">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-32 text-center">
          <p className="text-2xl font-black text-[#111] mb-2">Artist not found</p>
          <p className="text-gray-400 text-sm mb-6">This profile doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate("/browse")}
            className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Browse Artists
          </button>
        </div>
      </div>
    );
  }

  const p = profile as any;

  // Owner detection: logged-in user's slug matches this profile's slug
  const isOwner = !!(user && p.slug && (user as any).slug === p.slug);

  const workTypes: string[] = [
    ...(Array.isArray(p.masterArtistTypes) ? p.masterArtistTypes : []),
    ...(Array.isArray(p.workTypes) ? p.workTypes : []),
  ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

  const ratingDisplay = p.ratingScore ? p.ratingScore / 10 : 0;
  const joinDate = p.bubbleCreatedAt || p.joinedAt || null;

  const displayName = p.firstName
    ? `${p.firstName} ${p.lastName ? p.lastName[0] + "." : ""}`.trim()
    : p.name ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Push content below fixed navbar (+ optional auth banner ~28px) */}
      <div className="pt-20 px-4 pb-12 max-w-5xl mx-auto">
        <div className="flex gap-6 items-start mt-4">
          {/* ── Left: Profile Card ────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 sticky top-24">
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
              {/* Photo with name/PRO overlay */}
              <div className="relative">
                <div className="aspect-[3/4] bg-gray-200">
                  {p.profilePicture ? (
                    <img
                      src={p.profilePicture}
                      alt={p.name ?? "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <span className="text-6xl font-black text-gray-400">{p.name?.[0] ?? "?"}</span>
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
                  <span className="text-sm text-gray-600">({p.bookingCount ?? 0} Bookings)</span>
                </div>

                {/* Location + Joined */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  {p.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-gray-400" /> {p.location}
                    </span>
                  )}
                  {joinDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-gray-400" /> Joined {formatDate(joinDate)}
                    </span>
                  )}
                </div>

                {/* Tagline */}
                {p.tagline && (
                  <p className="text-xs text-gray-500 italic">{p.tagline}</p>
                )}

                {/* Work type chips */}
                {workTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {workTypes.map((wt: string) => (
                      <span key={wt} className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white">
                        {wt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Social links */}
                {(p.instagram || p.website || p.youtube || p.tiktok || p.portfolio) && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 mt-3">
                    {p.instagram && (
                      <a
                        href={`https://instagram.com/${p.instagram.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-pink-500 hover:underline"
                      >
                        <Instagram size={12} /> @{p.instagram.replace("@", "")}
                      </a>
                    )}
                    {p.website && (
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-500 hover:underline">
                        <Globe size={12} /> Website
                      </a>
                    )}
                    {p.youtube && (
                      <a href={p.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                        <Youtube size={12} /> YouTube
                      </a>
                    )}
                    {p.portfolio && (
                      <a href={p.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                        <ExternalLink size={12} /> Portfolio
                      </a>
                    )}
                  </div>
                )}

                {/* Owner: go back to edit; Visitor: contact */}
                {isOwner ? (
                  <a href="/app/profile">
                    <button className="w-full py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mt-1">
                      <Pencil size={14} /> Edit Profile
                    </button>
                  </a>
                ) : (
                  <a href="/app/messages">
                    <button className="w-full py-3 rounded-xl bg-[#ec008c] text-white text-sm font-bold hover:bg-[#c40075] transition-colors flex items-center justify-center gap-2 mt-1">
                      <MessageCircle size={15} /> Contact
                    </button>
                  </a>
                )}

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-1.5 text-sm text-gray-600 hover:text-[#111] transition-colors"
                >
                  <Share2 size={15} /> Share
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Tabs ───────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="flex border-b border-gray-200 mb-6">
              {(["about", "services", "reviews"] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 mr-8 text-sm font-medium capitalize transition-colors relative ${
                    activeTab === tab ? "text-[#ec008c]" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ec008c] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {activeTab === "about" && <AboutTab profile={p} />}
            {activeTab === "services" && <ServicesTab userId={p.id} />}
            {activeTab === "reviews" && <ReviewsTab userId={p.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
