import { useState, useEffect } from "react";
import { ArrowLeft, UserCog, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { IMPERSONATION_MARKER_COOKIE } from "@shared/const";
import { toast } from "sonner";

type ArtistPlan = "free" | "basic" | "pro";
type ClientPlan = "free" | "premium" | "enterprise";

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();

  const stopMutation = trpc.admin.stopImpersonating.useMutation({
    onSuccess: () => {
      utils.invalidate();
      window.location.href = "/admin-dashboard";
    },
  });

  const setPlanMutation = trpc.admin.setUserPlan.useMutation({
    onSuccess: () => {
      toast.success("Plan updated — refreshing…");
      refresh();
      utils.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to update plan"),
  });

  useEffect(() => {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const hasMarker = cookies.some((c) => c.startsWith(IMPERSONATION_MARKER_COOKIE + "="));
    setIsImpersonating(hasMarker);
  }, []);

  if (!isImpersonating) return null;

  const displayName = user?.name || user?.firstName || user?.email || "another user";
  const artswrkUser = user as any;
  const isArtist = (artswrkUser?.planTier as string | undefined)?.startsWith("artist_") ?? false;

  const currentArtistPlan: ArtistPlan = artswrkUser?.planTier === "artist_pro" ? "pro" : artswrkUser?.planTier === "artist_basic" ? "basic" : "free";
  const currentClientPlan: ClientPlan = (artswrkUser?.planTier as string | undefined)?.startsWith("enterprise_") ? "enterprise" : artswrkUser?.planTier === "client_premium" ? "premium" : "free";

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#111] text-white px-5 py-2.5 flex items-center justify-between gap-4 shadow-lg flex-wrap">
      <div className="flex items-center gap-2 text-sm font-semibold flex-shrink-0">
        <UserCog size={16} className="text-[#FFBC5D] flex-shrink-0" />
        <span>
          Viewing as <span className="text-[#FFBC5D]">{displayName}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {artswrkUser?.id && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/50">Plan:</span>
            {setPlanMutation.isPending ? (
              <Loader2 size={13} className="animate-spin text-white/60" />
            ) : (
              <select
                value={isArtist ? currentArtistPlan : currentClientPlan}
                onChange={(e) => setPlanMutation.mutate({ userId: artswrkUser.id, plan: e.target.value as any })}
                className="text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1.5 border-none outline-none cursor-pointer text-white"
              >
                {isArtist ? (
                  <>
                    <option value="free" className="text-black">Free</option>
                    <option value="basic" className="text-black">Basic</option>
                    <option value="pro" className="text-black">PRO</option>
                  </>
                ) : (
                  <>
                    <option value="free" className="text-black">Free</option>
                    <option value="premium" className="text-black">Premium</option>
                    <option value="enterprise" className="text-black">Enterprise</option>
                  </>
                )}
              </select>
            )}
          </div>
        )}
        <button
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
          className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {stopMutation.isPending ? (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <ArrowLeft size={13} />
          )}
          Return to Admin
        </button>
      </div>
    </div>
  );
}
