/**
 * Leads Dashboard — Campaigns
 * Paginated campaign table with status filter and inline stats bars.
 */
import { useState } from "react";
import LeadsLayout from "@/components/LeadsLayout";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
} from "lucide-react";

const PAGE_SIZE = 25;

type Status = "sent" | "draft" | "queued" | "archive" | "inProcess" | "all";

const STATUS_TABS: { label: string; value: Status }[] = [
  { label: "All", value: "all" },
  { label: "Sent", value: "sent" },
  { label: "Draft", value: "draft" },
  { label: "Queued", value: "queued" },
  { label: "Archived", value: "archive" },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-600",
  draft: "bg-gray-100 text-gray-500",
  queued: "bg-amber-50 text-amber-600",
  archive: "bg-gray-100 text-gray-400",
  inProcess: "bg-blue-50 text-blue-600",
};

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function fmt(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(n);
}

export default function LeadsCampaigns() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<Status>("all");

  const { data, isLoading } = trpc.leads.getCampaigns.useQuery(
    {
      limit: PAGE_SIZE,
      offset,
      status: status === "all" ? undefined : status,
      sort: "desc",
    },
    { staleTime: 5 * 60 * 1000 }
  );

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <LeadsLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#111]">Campaigns</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {data ? `${data.count.toLocaleString()} campaigns` : "Loading…"}
            </p>
          </div>
          <a
            href="https://app.brevo.com/campaigns"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#0B5FFF] hover:underline font-medium"
          >
            Open in Brevo <ExternalLink size={11} />
          </a>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatus(t.value); setOffset(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                status === t.value
                  ? "bg-white text-[#111] shadow-sm"
                  : "text-gray-500 hover:text-[#111]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Campaign", "Status", "Sent Date", "Delivered", "Opens", "Clicks"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-gray-400 px-6 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 size={22} className="animate-spin text-[#0B5FFF] mx-auto" />
                    </td>
                  </tr>
                ) : (data?.campaigns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      No campaigns found
                    </td>
                  </tr>
                ) : (
                  (data?.campaigns ?? []).map((c) => {
                    const gs = c.statistics?.globalStats;
                    const delivered = gs?.delivered ?? 0;
                    const openRate =
                      gs && delivered > 0
                        ? ((gs.uniqueViews / delivered) * 100).toFixed(1)
                        : null;
                    const clickRate =
                      gs && delivered > 0
                        ? ((gs.uniqueClicks / delivered) * 100).toFixed(1)
                        : null;

                    return (
                      <tr
                        key={c.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 max-w-[220px]">
                          <p className="font-medium text-[#111] truncate">{c.name}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{c.subject}</p>
                          {c.tag && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                              {c.tag}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                              STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                          {c.sentDate
                            ? new Date(c.sentDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-[#111]">
                          {delivered > 0 ? fmt(delivered) : "—"}
                        </td>
                        <td className="px-6 py-4 min-w-[80px]">
                          {openRate !== null ? (
                            <>
                              <span
                                className={`text-xs font-semibold ${
                                  parseFloat(openRate) >= 20
                                    ? "text-emerald-600"
                                    : parseFloat(openRate) >= 10
                                    ? "text-amber-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {openRate}%
                              </span>
                              <StatBar
                                value={parseFloat(openRate)}
                                max={50}
                                color={
                                  parseFloat(openRate) >= 20
                                    ? "#10B981"
                                    : parseFloat(openRate) >= 10
                                    ? "#F59E0B"
                                    : "#D1D5DB"
                                }
                              />
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 min-w-[80px]">
                          {clickRate !== null ? (
                            <>
                              <span className="text-xs font-semibold text-[#0B5FFF]">
                                {clickRate}%
                              </span>
                              <StatBar
                                value={parseFloat(clickRate)}
                                max={20}
                                color="#0B5FFF"
                              />
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(data?.count ?? 0) > PAGE_SIZE && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.count ?? 0)} of{" "}
                {(data?.count ?? 0).toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={offset + PAGE_SIZE >= (data?.count ?? 0)}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </LeadsLayout>
  );
}
