import { useState, useEffect } from "react";
import { ArrowLeft, UserCog } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ADMIN_SESSION_COOKIE_NAME } from "@shared/const";

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const stopMutation = trpc.admin.stopImpersonating.useMutation({
    onSuccess: () => {
      utils.invalidate();
      window.location.href = "/admin-dashboard";
    },
  });

  useEffect(() => {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const hasBackup = cookies.some((c) => c.startsWith(ADMIN_SESSION_COOKIE_NAME + "="));
    setIsImpersonating(hasBackup);
  }, []);

  if (!isImpersonating) return null;

  const displayName = user?.name || user?.firstName || user?.email || "another user";

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#111] text-white px-5 py-2.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <UserCog size={16} className="text-[#FFBC5D] flex-shrink-0" />
        <span>
          Viewing as <span className="text-[#FFBC5D]">{displayName}</span>
        </span>
      </div>
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
  );
}
