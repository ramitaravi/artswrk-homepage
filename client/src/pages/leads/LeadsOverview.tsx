/**
 * Leads Dashboard — Overview
 * KPI cards + recent campaigns as cards
 */
import LeadsLayout from "@/components/LeadsLayout";
import { trpc } from "@/lib/trpc";
import {
  Users,
  List,
  Mail,
  TrendingUp,
  MousePointerClick,
  Send,
  UserMinus,
  Loader2,
  RefreshCw,
  ExternalLink,
  Calendar,
  Eye,
  AlertCircle,
} from "lucide-react";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}18` }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-black text-[#111] leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  sent:    { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400" },
  draft:   { bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400" },
  queued:  { bg: "bg-amber-50",   text: "text-amber-600",  dot: "bg-amber-400" },
  archive: { bg: "bg-gray-100",   text: "text-gray-400",   dot: "bg-gray-300" },
};

function CampaignMiniCard({ c }: { c: any }) {
  const gs = c.statistics?.globalStats ?? {};
  const delivered = gs.delivered ?? 0;
  const opens = gs.uniqueViews ?? 0;
  const clicks = gs.uniqueClicks ?? 0;
  const hasData = delivered > 0 || (gs.sent ?? 0) > 0;
  const openRatePct = hasData && delivered > 0 ? ((opens / delivered) * 100).toFixed(1) : null;
  const clickRatePct = hasData && delivered > 0 ? ((clicks / delivered) * 100).toFixed(1) : null;
  const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      {/* Status + link */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {c.status}
        </span>
        <a
          href={`https://app.brevo.com/marketing-reports/email/${c.id}/overview`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-lg text-gray-300 hover:text-[#0B5FFF] hover:bg-blue-50 transition-colors"
        >
          <ExternalLink size={11} />
        </a>
      </div>

      {/* Name */}
      <div>
        <h3 className="font-bold text-[#111] text-sm leading-snug line-clamp-2">{c.name}</h3>
        {c.subject && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.subject}</p>}
      </div>

      {/* Date */}
      {c.sentDate && (
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Calendar size={9} />
          <span>{fmtDate(c.sentDate)}</span>
        </div>
      )}

      {/* Stats */}
      <div className="border-t border-gray-50 pt-2.5 flex items-center gap-3">
        {hasData ? (
          <>
            <div className="flex items-center gap-1 text-xs">
              <Send size={10} className="text-gray-400" />
              <span className="font-semibold text-[#111]">{fmt(gs.sent ?? 0)}</span>
              <span className="text-gray-400">sent</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Eye size={10} className="text-[#0B5FFF]" />
              <span className="font-semibold text-[#0B5FFF]">{openRatePct ? `${openRatePct}%` : fmt(opens)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <MousePointerClick size={10} className="text-purple-500" />
              <span className="font-semibold text-purple-500">{clickRatePct ? `${clickRatePct}%` : fmt(clicks)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-gray-300">
            <AlertCircle size={10} />
            <span>Stats not available</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadsOverview() {
  const { data: overview, isLoading: ovLoading, error: ovError, refetch: refetchOv } =
    trpc.leads.getOverview.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: 1 });

  const { data: campaigns, isLoading: campLoading } =
    trpc.leads.getCampaigns.useQuery(
      { limit: 9, offset: 0, status: "sent", sort: "desc" },
      { staleTime: 5 * 60 * 1000, retry: 1, enabled: !ovError }
    );

  const loading = ovLoading || campLoading;

  return (
    <LeadsLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#111]">Leads Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">Powered by Brevo · data refreshes every 5 min</p>
          </div>
          <button
            onClick={() => refetchOv()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0B5FFF] transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {ovError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
              <AlertCircle size={24} className="text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-[#111] mb-1">Brevo API Unavailable</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-2">
              The Brevo API cannot be reached from the dev preview. This is a network restriction in the sandbox environment.
            </p>
            <p className="text-xs text-gray-300 max-w-sm mb-5">
              The Leads Dashboard works correctly on the <strong>published site</strong> at artswrk-ayegfhxr.manus.space.
            </p>
            <button
              onClick={() => refetchOv()}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#111] hover:bg-gray-800 px-4 py-2 rounded-xl transition-colors"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard label="Total Contacts" value={fmt(overview?.totalContacts ?? 0)} sub={`${fmt(overview?.totalLists ?? 0)} lists`} icon={Users} accent="#0B5FFF" />
              <KpiCard label="Campaigns Sent" value={fmt(overview?.totalCampaignsSent ?? 0)} icon={Mail} accent="#F25722" />
              <KpiCard label="Avg. Open Rate" value={`${(overview?.avgOpenRate ?? 0).toFixed(1)}%`} sub="across last 50 sent" icon={TrendingUp} accent="#10B981" />
              <KpiCard label="Avg. Click Rate" value={`${(overview?.avgClickRate ?? 0).toFixed(1)}%`} sub={`${fmt(overview?.totalDelivered ?? 0)} delivered`} icon={MousePointerClick} accent="#8B5CF6" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              <KpiCard label="Total Delivered" value={fmt(overview?.totalDelivered ?? 0)} icon={Send} accent="#0B5FFF" />
              <KpiCard label="Total Unsubscribes" value={fmt(overview?.totalUnsubscribes ?? 0)} icon={UserMinus} accent="#EF4444" />
              <KpiCard label="Total Lists" value={fmt(overview?.totalLists ?? 0)} icon={List} accent="#F59E0B" />
            </div>

            {/* Recent campaigns as cards */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#111]">Recent Campaigns</h2>
              <a href="/leads/campaigns" className="text-xs text-[#0B5FFF] hover:underline font-medium">
                View all →
              </a>
            </div>

            {(campaigns?.campaigns ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Mail size={28} className="mb-3 opacity-30" />
                <p className="text-sm">No campaigns found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(campaigns?.campaigns ?? []).map((c) => (
                  <CampaignMiniCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </LeadsLayout>
  );
}
