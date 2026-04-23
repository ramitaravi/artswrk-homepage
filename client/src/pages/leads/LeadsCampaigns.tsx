/**
 * Leads Dashboard — Campaigns
 * Card-based layout with status filter, full historical stats per card.
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

const PAGE_SIZE = 18;

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
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatPill({
  icon,
  label,
  value,
  color,
  hasData,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  hasData: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
      <div className={`text-xs font-black ${hasData ? color : "text-gray-300"}`}>{value}</div>
      <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
        <span className={hasData ? color : "text-gray-300"}>{icon}</span>
        {label}
      </div>
    </div>
  );
}

function CampaignCard({ c }: { c: any }) {
  const gs = c.statistics?.globalStats ?? {};
  const delivered = gs.delivered ?? 0;
  const sent = gs.sent ?? 0;
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {c.status}
            </span>
            {c.tag && (
              <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                {c.tag}
              </span>
            )}
          </div>
          <h3 className="font-bold text-[#111] text-sm leading-snug line-clamp-2">{c.name}</h3>
          {c.subject && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.subject}</p>
          )}
        </div>
        <a
          href={`https://app.brevo.com/campaigns/email/${c.id}/report`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-[#0B5FFF] hover:bg-blue-50 transition-colors"
          title="View in Brevo"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Sent date */}
      {c.sentDate && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Calendar size={11} />
          <span>Sent {fmtDate(c.sentDate)}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="border-t border-gray-50 pt-3">
        {hasData ? (
          <div className="flex items-center justify-between">
            <StatPill icon={<Send size={9} />} label="Sent" value={fmtNum(sent)} color="text-[#111]" hasData={true} />
            <div className="w-px h-6 bg-gray-100" />
            <StatPill icon={<Mail size={9} />} label="Delivered" value={fmtNum(delivered)} color="text-[#111]" hasData={true} />
            <div className="w-px h-6 bg-gray-100" />
            <StatPill
              icon={<Eye size={9} />}
              label="Opens"
              value={openRatePct ? `${openRatePct}%` : fmtNum(opens)}
              color={parseFloat(openRatePct ?? "0") >= 20 ? "text-emerald-600" : parseFloat(openRatePct ?? "0") >= 10 ? "text-amber-600" : "text-gray-500"}
              hasData={true}
            />
            <div className="w-px h-6 bg-gray-100" />
            <StatPill
              icon={<MousePointerClick size={9} />}
              label="Clicks"
              value={clickRatePct ? `${clickRatePct}%` : fmtNum(clicks)}
              color="text-[#0B5FFF]"
              hasData={true}
            />
            <div className="w-px h-6 bg-gray-100" />
            <StatPill icon={<AlertCircle size={9} />} label="Bounces" value={fmtNum(bounces)} color="text-red-400" hasData={bounces > 0} />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <AlertCircle size={12} />
            <span>Stats not available for this campaign</span>
          </div>
        )}
      </div>
    </div>
  );
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
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
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

        {/* Cards grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : (data?.campaigns ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Mail size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No campaigns found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data?.campaigns ?? []).map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data?.count ?? 0) > PAGE_SIZE && (
          <div className="mt-8 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.count ?? 0)} of{" "}
              {(data?.count ?? 0).toLocaleString()} campaigns
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="p-2 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 font-semibold px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={offset + PAGE_SIZE >= (data?.count ?? 0)}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="p-2 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </LeadsLayout>
  );
}
