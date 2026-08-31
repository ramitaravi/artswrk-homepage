/*
 * ARTSWRK DASHBOARD — BENEFITS HUB
 *   - Savings banner (unlocked) or upgrade banner (locked)
 *   - Category filter tabs (horizontal scroll)
 *   - Benefit cards: logo + name + category + description + offer pill
 *     + redemption details when unlocked, or a lock badge when not
 * Data loaded from DB via trpc.benefits.list. The server, not this
 * component, is what actually withholds `howToRedeem` from anyone who
 * isn't artist_pro / client_premium — see server/routers.ts. This page
 * only decides how to *display* what the server already sent.
 */

import { useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink, Lock, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUpgrade } from "@/components/UpgradeModal";
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

function BenefitCard({ benefit, locked, onUpgrade }: { benefit: any; locked: boolean; onUpgrade?: () => void }) {
  const logoUrl = fixUrl(benefit.logoUrl);
  const category = benefit.categories?.[0] ?? "";
  const href = !locked ? fixUrl(benefit.url) : undefined;
  const Wrapper = href ? "a" : "div";

  return (
    <Wrapper
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`block bg-white rounded-2xl border border-gray-100 shadow-sm transition-shadow p-5 group ${href ? "hover:shadow-md" : ""}`}
    >
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 ${locked ? "opacity-60" : ""}`}>
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
                {!locked && <ChevronRight size={14} />}
              </span>
            </div>
          )}
          {locked ? (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                <Lock size={11} /> Code hidden
              </span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpgrade?.(); }}
                className="rounded-full bg-[#F25722] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#d94a1c]"
              >
                Unlock with Premium →
              </button>
            </div>
          ) : benefit.howToRedeem && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-orange-50/60 border border-orange-100">
              <p className="text-[11px] font-bold text-[#F25722] uppercase tracking-wide mb-0.5">How to redeem</p>
              <p className="text-xs text-gray-600 leading-relaxed">{benefit.howToRedeem}</p>
            </div>
          )}
        </div>

        {/* Arrow */}
        {!locked && (
          <ChevronRight
            size={20}
            className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1"
          />
        )}
      </div>
    </Wrapper>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Benefits() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Determine audience type from planTier (available directly from auth)
  const planTier = (user as any)?.planTier as string | undefined;
  const audienceType = planTier?.startsWith("artist_") ? "Artist" : "Client";

  const { data, isLoading } = trpc.benefits.list.useQuery(
    { audienceType },
    { enabled: !!user }
  );

  // Enterprise: this page doesn't exist for them, full stop — no teaser,
  // no "upgrade to unlock" (there's nothing to upgrade to here).
  if (data?.enterprise) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Partner benefits aren't part of your plan.</p>
        </div>
      </div>
    );
  }

  const locked = data?.locked ?? false;
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

  const upgradeLabel = audienceType === "Artist" ? "Artswrk PRO" : "Artswrk Premium";
  // The banner used to fire Stripe checkout the moment you clicked it — no
  // price, no plan, straight to a card form. Now it opens the shared modal.
  const { open } = useUpgrade();
  const goUpgrade = () =>
    open({
      audience: audienceType === "Artist" ? "artist" : "client",
      feature: "The Benefits Portal",
      returnPath: "/app/benefits",
    });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#111] mb-1">Benefits Hub</h1>
        <p className="text-gray-500 text-sm">Exclusive Discounts for Artswrk Subscribers</p>
      </div>

      {/* Savings banner — unlocked, or an upgrade pitch when locked */}
      {allBenefits.length > 0 && (
        locked ? (
          <button
            type="button"
            onClick={goUpgrade}
            className="flex w-full items-start justify-between gap-4 bg-gradient-to-r from-pink-50 to-orange-50 border border-orange-100 rounded-xl px-4 py-4 mb-7 text-left hover:border-orange-200 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="text-[#F25722] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#111]">
                  $1000+ in savings waiting behind {upgradeLabel}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {allBenefits.length} real partner discount{allBenefits.length !== 1 ? "s" : ""} — upgrade to unlock every code below.
                </p>
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-bold text-white bg-[#F25722] px-3 py-2 rounded-full whitespace-nowrap self-center">
              Upgrade →
            </span>
          </button>
        ) : (
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
        )
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
            <BenefitCard key={benefit.id} benefit={benefit} locked={locked} onUpgrade={goUpgrade} />
          ))}
        </div>
      )}
    </div>
  );
}
