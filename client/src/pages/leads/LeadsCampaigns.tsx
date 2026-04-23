/**
 * Leads Dashboard — Campaigns
 * Compact list-style rows with status filter and inline historical stats.
 */
import { useState } from "react";
import LeadsLayout from "@/components/LeadsLayout";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Mail,
  MousePointerClick,
  Eye,
  Send,
  AlertCircle,
  Calendar,
} from "lucide-react";

const PAGE_SIZE = 50;

type Status = "sent" | "draft" | "queued" | "archive" | "all";

const STATUS_TABS: { label: string; value: Status }[] = [
  { label: "All", value: "all" },
  { label: "Sent", value: "sent" },
  { label: "Draft", value: "draft" },
  { label: "Queued", value: "queued" },
  { label: "Archived", value: "archive" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  sent:      { bg: "bg-emerald-50",  text: "text-emerald-600", dot: "bg-emerald-400" },
  draft:     { bg: "bg-gray-100",    text: "text-gray-500",    dot: "bg-gray-400" },
  queued:    { bg: "bg-amber-50",    text: "text-amber-600",   dot: "bg-amber-400" },
  archive:   { bg: "bg-gray-100",    text: "text-gray-400",    dot: "bg-gray-300" },
  inProcess: { bg: "bg-blue-50",     text: "text-blue-600",    dot: "bg-blue-400" },
  suspended: { bg: "bg-red-50",      text: "text-red-500",     dot: "bg-red-400" },
};

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LeadsCampaigns() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<Status>("all");

  const { data, isLoading } = trpc.leads.getCampaigns.useQuery(
    { limit: PAGE_SIZE, offset, status: status === "all" ? undefined : status, sort: "desc" },
    { staleTime: 5 * 60 * 1000 }
  );

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const campaigns = data?.campaigns ?? [];

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
                status === t.value ? "bg-white text-[#111] shadow-sm" : "text-gray-500 hover:text-[#111]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Campaign rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Mail size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No campaigns found</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {campaigns.map((c: any) => {
              const gs = c.statistics?.globalStats ?? {};
              const sent = gs.sent ?? 0;
              const delivered = gs.delivered ?? 0;
              const opens = gs.uniqueViews ?? 0;
              const clicks = gs.uniqueClicks ?? 0;
              const bounces = (gs.hardBounces ?? 0) + (gs.softBounces ?? 0);
              const opensRate = gs.opensRate ?? 0;
              const hasData = sent > 0 || delivered > 0;
              const openRatePct = hasData && delivered > 0
                ? ((opens / delivered) * 100).toFixed(1)
                : opensRate > 0 ? opensRate.toFixed(1) : null;
              const clickRatePct = hasData && delivered > 0
                ? ((clicks / delivered) * 100).toFixed(1)
                : null;
              const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft;

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} title={c.status} />

                  {/* Name + subject */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#111] truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.sentDate && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Calendar size={8} />
                          {fmtDate(c.sentDate)}
                        </span>
                      )}
                      {c.subject && (
                        <span className="text-[10px] text-gray-400 truncate hidden sm:block">
                          · {c.subject}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats — shown when available */}
                  {hasData ? (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500" title="Sent">
                        <Send size={9} className="text-gray-400" />
                        <span className="font-medium">{fmtNum(sent)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 hidden sm:flex" title="Delivered">
                        <Mail size={9} className="text-gray-400" />
                        <span className="font-medium">{fmtNum(delivered)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]" title="Open rate">
                        <Eye size={9} className={openRatePct && parseFloat(openRatePct) >= 20 ? "text-emerald-500" : "text-gray-400"} />
                        <span className={`font-medium ${openRatePct && parseFloat(openRatePct) >= 20 ? "text-emerald-600" : "text-gray-500"}`}>
                          {openRatePct ? `${openRatePct}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#0B5FFF] hidden md:flex" title="Click rate">
                        <MousePointerClick size={9} />
                        <span className="font-medium">{clickRatePct ? `${clickRatePct}%` : "—"}</span>
                      </div>
                      {bounces > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400 hidden lg:flex" title="Bounces">
                          <AlertCircle size={9} />
                          <span className="font-medium">{fmtNum(bounces)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-300 flex-shrink-0 hidden sm:block">No stats</span>
                  )}

                  {/* Status badge */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 hidden md:inline-flex items-center gap-1 ${sc.bg} ${sc.text}`}>
                    {c.status}
                  </span>

                  {/* Brevo link */}
                  <a
                    href={`https://app.brevo.com/marketing-reports/email/${c.id}/overview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-[#0B5FFF] hover:bg-[#EEF3FF] transition-colors flex-shrink-0"
                    title="View in Brevo"
                  >
                    <ExternalLink size={11} />
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.count ?? 0)} of {(data?.count ?? 0).toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="p-2 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 font-semibold px-2">{currentPage} / {totalPages}</span>
              <button disabled={offset + PAGE_SIZE >= (data?.count ?? 0)} onClick={() => setOffset(offset + PAGE_SIZE)} className="p-2 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </LeadsLayout>
  );
}
