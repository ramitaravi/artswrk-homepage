/**
 * Paywall and teaser for client-facing premium features.
 *
 * Wrap the feature, not the nav item. Marking something `premium: true` in the
 * dashboard nav only draws a badge — it never blocked anything, so
 * /app/artists and friends were reachable by typing the URL regardless of
 * plan. This is the actual gate.
 *
 * Use it only where a free account has no business seeing the feature at all.
 * Where the content is itself the sales pitch — the artist roster, the jobs
 * board — leave the feature visible and gate the action instead; that's what
 * Browse Artists does, and it converts better than an empty page.
 *
 * The button goes straight to Stripe, like every other premium CTA on the
 * site — the bullets above it are the pitch, so there's nothing left to say
 * in between.
 */
import { Crown, Check } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useUpgrade } from "@/lib/useUpgrade";

/** Plans that carry the client premium feature set. */
export function hasClientPremium(planTier: string | null | undefined): boolean {
  return planTier === "client_premium"
    || planTier === "enterprise_subscription"
    || planTier === "enterprise_on_demand";
}

export function PremiumGate({
  title,
  blurb,
  bullets,
  children,
}: {
  title: string;
  blurb: string;
  bullets: string[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { start: startUpgrade, pending: upgradePending } = useUpgrade();
  const planTier = (user as any)?.planTier as string | undefined;

  // Don't flash the paywall at a subscriber while their plan is still loading.
  if (loading) return null;
  if (hasClientPremium(planTier)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
        <Crown size={26} className="text-amber-500" />
      </div>
      <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">
        <Crown size={11} /> PREMIUM
      </div>
      <h2 className="text-2xl font-black text-[#111]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-gray-500">{blurb}</p>

      <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[14.5px] text-gray-700">
            <Check size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
            {b}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => startUpgrade({ audience: "client" })}
        disabled={upgradePending}
        className="mt-7 inline-flex items-center justify-center rounded-xl bg-[#111] px-7 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#3D3D4A] disabled:opacity-60"
      >
        {upgradePending ? "Opening checkout…" : "Upgrade to Premium →"}
      </button>
      <p className="mt-3 text-xs text-gray-400">
        Questions? Email <a href="mailto:contact@artswrk.com" className="underline">contact@artswrk.com</a>
      </p>
    </div>
  );
}
