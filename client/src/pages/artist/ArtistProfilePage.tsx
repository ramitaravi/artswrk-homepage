/**
 * ArtistProfilePage — matches the live artswrk.com profile design exactly.
 *
 * Layout: two-column split
 *   Left (~35%): sticky card — photo fills top, name/pronouns overlaid bottom-left,
 *                PRO badge bottom-right, stars + bookings, location + joined,
 *                work-type chips, black Edit Profile button, Share link
 *   Right (~65%): 3 tabs — About | Services | Reviews
 *     About:    Media grid (3 photos) + Resume row + Bio
 *     Services: category cards (image + title + sub-service chips)
 *     Reviews:  review cards (stars, text, reviewer avatar/name/studio/date)
 */

import { useState } from "react";
import { MapPin, Calendar, Share2, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import EditProfileModal from "./EditProfileModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonArray(val: string | null | undefined): string[] {
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

function parseJsonObjects<T>(val: string | null | undefined): T[] {
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

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
  const mediaPhotos = parseJsonArray(profile.mediaPhotos);
  const resumeFiles = parseJsonObjects<{ url: string; name: string }>(profile.resumeFiles);

  return (
    <div className="space-y-8">
      {/* Media */}
      {mediaPhotos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Media</h3>
          <div className="grid grid-cols-3 gap-3">
            {mediaPhotos.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resume */}
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

      {/* Bio */}
      {profile.bio && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Bio</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab() {
  const { data: categories = [], isLoading } = trpc.artistProfile.getMyServiceCategories.useQuery();

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
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No services added yet.
      </div>
    );
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
              <h3 className="text-base font-semibold text-gray-900 mb-3">{cat.name}</h3>
              <div className="flex flex-wrap gap-2">
                {cat.subServices.map((sub, j) => (
                  <span
                    key={j}
                    className="px-4 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 bg-white"
                  >
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

function ReviewsTab() {
  const { data: reviews = [], isLoading } = trpc.artistProfile.getMyReviews.useQuery();

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
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No reviews yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map(review => (
        <div key={review.id} className="p-5 rounded-xl border border-gray-100">
          <StarRow rating={review.rating} />
          <p className="text-sm text-gray-700 leading-relaxed my-3">{review.body}</p>
          <div className="flex items-center gap-3">
            {review.reviewerAvatar ? (
              <img
                src={review.reviewerAvatar}
                alt={review.reviewerName}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-gray-500">
                  {review.reviewerName?.[0] ?? "?"}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{review.reviewerName}</p>
              {review.reviewerStudio && (
                <p className="text-xs text-gray-500">{review.reviewerStudio}</p>
              )}
              {review.reviewDate && (
                <p className="text-xs text-gray-400">{formatReviewDate(review.reviewDate)}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "about" | "services" | "reviews";

export default function ArtistProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("about");
  const [editOpen, setEditOpen] = useState(false);

  const { data: profile, isLoading, refetch } = trpc.artistProfile.getMyProfile.useQuery();

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
      <div className="flex gap-6 p-6 animate-pulse">
        <div className="w-72 flex-shrink-0">
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
            {["About","Services","Reviews"].map(t => (
              <div key={t} className="h-4 w-14 bg-gray-100 rounded" />
            ))}
          </div>
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-100 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Profile not found.
      </div>
    );
  }

  const workTypes = parseJsonArray((profile as any).workTypes);
  const ratingDisplay = profile.ratingScore ? profile.ratingScore / 10 : 5;
  const joinDate = (profile as any).bubbleCreatedAt || null;

  // Display name: "Ramita R." format
  const p = profile as any;
  const displayName = p.firstName
    ? `${p.firstName} ${p.lastName ? p.lastName[0] + "." : ""}`.trim()
    : p.name ?? "";

  return (
    <>
      <div className="flex gap-6 p-6 items-start">
        {/* ── Left: Profile Card ────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 sticky top-6">
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
            {/* Photo with name/PRO overlay */}
            <div className="relative">
              <div className="aspect-[3/4] bg-gray-200">
                {profile.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt={profile.name ?? "Profile"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                    <span className="text-6xl font-black text-gray-400">
                      {profile.name?.[0] ?? "?"}
                    </span>
                  </div>
                )}
              </div>
              {/* Name + pronouns gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                <h2 className="text-xl font-black text-white leading-tight">{displayName}</h2>
                {profile.pronouns && (
                  <p className="text-sm text-white/80 mt-0.5">{profile.pronouns}</p>
                )}
              </div>
              {/* PRO badge */}
              {(profile as any).artswrkPro && (
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
                <span className="text-sm text-gray-600">({profile.bookingCount ?? 0} Bookings)</span>
              </div>

              {/* Location + Joined */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-gray-400" />
                    {profile.location}
                  </span>
                )}
                {joinDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-gray-400" />
                    Joined {formatDate(joinDate)}
                  </span>
                )}
              </div>

              {/* Work type chips */}
              {workTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {workTypes.map(wt => (
                    <span
                      key={wt}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white"
                    >
                      {wt}
                    </span>
                  ))}
                </div>
              )}

              {/* Edit Profile button */}
              <button
                onClick={() => setEditOpen(true)}
                className="w-full py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                Edit Profile
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Share2 size={15} />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Tabs ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 mb-6">
            {(["about", "services", "reviews"] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 mr-8 text-sm font-medium capitalize transition-colors relative ${
                  activeTab === tab
                    ? "text-[#ec008c]"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ec008c] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "about" && <AboutTab profile={profile} />}
          {activeTab === "services" && <ServicesTab />}
          {activeTab === "reviews" && <ReviewsTab />}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refetch();
          }}
        />
      )}
    </>
  );
}
