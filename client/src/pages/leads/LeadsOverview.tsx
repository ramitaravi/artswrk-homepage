/**
 * Leads Dashboard — Overview
 * KPI cards + top recent campaigns table
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
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}18` }}
      >
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

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}
function fmt(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(n);
}

export default function LeadsOverview() {
  const { data: overview, isLoading: ovLoading, refetch: refetchOv } =
    trpc.leads.getOverview.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const { data: campaigns, isLoading: campLoading } =
    trpc.leads.getCampaigns.useQuery(
      { limit: 10, offset: 0, status: "sent", sort: "desc" },
      { staleTime: 5 * 60 * 1000 }
    );

  const loading = ovLoading || campLoading;

  return (
    <LeadsLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#111]">Leads Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Powered by Brevo · data refreshes every 5 min
            </p>
          </div>
          <button
            onClick={() => refetchOv()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0B5FFF] transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiCard
                label="Total Contacts"
                value={fmt(overview?.totalContacts ?? 0)}
                sub={`${fmt(overview?.totalLists ?? 0)} lists`}
                icon={Users}
                accent="#0B5FFF"
              />
              <KpiCard
                label="Campaigns Sent"
                value={fmt(overview?.totalCampaignsSent ?? 0)}
                icon={Mail}
                accent="#F25722"
              />
              <KpiCard
                label="Avg. Open Rate"
                value={pct(overview?.avgOpenRate ?? 0)}
                sub="across last 50 sent"
                icon={TrendingUp}
                accent="#10B981"
              />
              <KpiCard
                label="Avg. Click Rate"
                value={pct(overview?.avgClickRate ?? 0)}
                sub={`${fmt(overview?.totalDelivered ?? 0)} delivered`}
                icon={MousePointerClick}
                accent="#8B5CF6"
              />
            </div>

            {/* Secondary row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              <KpiCard
                label="Total Delivered"
                value={fmt(overview?.totalDelivered ?? 0)}
                icon={Send}
                accent="#0B5FFF"
              />
              <KpiCard
                label="Total Unsubscribes"
                value={fmt(overview?.totalUnsubscribes ?? 0)}
                icon={UserMinus}
                accent="#EF4444"
              />
              <KpiCard
                label="Total Lists"
                value={fmt(overview?.totalLists ?? 0)}
                icon={List}
                accent="#F59E0B"
              />
            </div>

            {/* Recent campaigns table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#111]">Recent Campaigns</h2>
                <a
                  href="/leads/campaigns"
                  className="text-xs text-[#0B5FFF] hover:underline font-medium"
                >
                  View all →
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      {["Campaign", "Sent Date", "Delivered", "Opens", "Clicks", "Unsubs"].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-semibold text-gray-400 px-6 py-3"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(campaigns?.campaigns ?? []).map((c) => {
                      const gs = c.statistics?.globalStats;
                      const openRate =
                        gs && gs.delivered > 0
                          ? ((gs.uniqueViews / gs.delivered) * 100).toFixed(1)
                          : "—";
                      const clickRate =
                        gs && gs.delivered > 0
                          ? ((gs.uniqueClicks / gs.delivered) * 100).toFixed(1)
                          : "—";
                      return (
                        <tr
                          key={c.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-6 py-3">
                            <p className="font-medium text-[#111] truncate max-w-[200px]">
                              {c.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">
                              {c.subject}
                            </p>
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {c.sentDate
                              ? new Date(c.sentDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="px-6 py-3 text-xs font-medium text-[#111]">
                            {gs ? fmt(gs.delivered) : "—"}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`text-xs font-semibold ${
                                parseFloat(openRate) >= 20
                                  ? "text-emerald-600"
                                  : parseFloat(openRate) >= 10
                                  ? "text-amber-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {openRate !== "—" ? `${openRate}%` : "—"}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="text-xs font-semibold text-[#0B5FFF]">
                              {clickRate !== "—" ? `${clickRate}%` : "—"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-400">
                            {gs ? fmt(gs.unsubscriptions) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {(campaigns?.campaigns ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">
                          No campaigns found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </LeadsLayout>
  );
}
