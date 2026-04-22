/*
 * ARTSWRK DASHBOARD — BENEFITS HUB
 * Matches the design in the screenshot:
 *   - Green savings banner
 *   - Category filter tabs (horizontal scroll)
 *   - Benefit cards: logo + name + category + description + offer pill
 * Data loaded from DB via trpc.benefits.list, filtered by the logged-in user's role.
 */

import { useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Benefit Card ───────────────────────────────────────────────────────────────

function BenefitCard({ benefit }: { benefit: any }) {
  const logoUrl = fixUrl(benefit.logoUrl);
  const category = benefit.categories?.[0] ?? "";
  const href = fixUrl(benefit.url);

  return (
    <a
      href={href ?? undefined}
      target={href ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 group"
    >
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={benefit.companyName}
              className="w-full h-full object-contain p-1"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
              {initials(benefit.companyName || "B")}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#111] text-base mb-0.5 leading-snug">
            {benefit.companyName}
          </h3>
          {category && (
            <p className="text-sm font-semibold text-gray-500 mb-2">{category}</p>
          )}
          {benefit.businessDescription && (
            <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-3">
              {benefit.businessDescription}
            </p>
          )}
          {benefit.discountOffering && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full border border-[#F25722] text-[#F25722] text-xs font-semibold flex-shrink-0">
                Offer
              </span>
              <span className="text-sm text-[#F25722] font-medium flex items-center gap-1">
                {benefit.discountOffering}
                <ChevronRight size={14} />
              </span>
            </div>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight
          size={20}
          className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1"
        />
      </div>
    </a>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Benefits() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Determine audience type from user role (available directly from auth)
  const audienceType = user?.userRole === "Artist" ? "Artist" : "Client";

  const { data, isLoading } = trpc.benefits.list.useQuery(
    { audienceType },
    { enabled: !!user }
  );

  const allBenefits = data?.benefits ?? [];

  // Collect all unique categories across loaded benefits
  const allCategories = Array.from(
    new Set(allBenefits.flatMap((b: any) => b.categories ?? []))
  ).sort() as string[];

  const categories = ["All", ...allCategories];

  const filtered =
    activeCategory === "All"
      ? allBenefits
      : allBenefits.filter((b: any) => b.categories?.includes(activeCategory));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#111] mb-1">Benefits Hub</h1>
        <p className="text-gray-500 text-sm">Exclusive Discounts for Artswrk Subscribers</p>
      </div>

      {/* Savings banner */}
      {allBenefits.length > 0 && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3.5 mb-7">
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">
              $1000+ in savings unlocked with your Artswrk Membership
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              You have access to {allBenefits.length} exclusive benefit{allBenefits.length !== 1 ? "s" : ""} with your Artswrk Membership. Get connected to the industry's leading services below.
            </p>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === cat
                  ? "border-[#111] bg-[#111] text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Benefits list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/5" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No benefits found{activeCategory !== "All" ? ` in ${activeCategory}` : ""}.</p>
          {activeCategory !== "All" && (
            <button
              onClick={() => setActiveCategory("All")}
              className="mt-2 text-sm text-[#F25722] hover:underline"
            >
              Show all benefits
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((benefit: any) => (
            <BenefitCard key={benefit.id} benefit={benefit} />
          ))}
        </div>
      )}
    </div>
  );
}
