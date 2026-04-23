/**
 * Leads Dashboard — Unsubscribes
 * Merged suppression list from Brevo (emailBlacklisted) + SendGrid global unsubscribes.
 * Shows gaps between the two systems and allows syncing with one click.
 */
import { useState, useMemo } from "react";
import LeadsLayout from "@/components/LeadsLayout";
import { trpc } from "@/lib/trpc";
import {
  UserMinus,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Plus,
  Download,
  Loader2,
  Mail,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

type FilterType = "all" | "both" | "brevo_only" | "sendgrid_only";

const FILTER_LABELS: Record<FilterType, string> = {
  all: "All",
  both: "In Both",
  brevo_only: "Brevo Only",
  sendgrid_only: "SendGrid Only",
};

function SourceBadge({ source }: { source: "brevo" | "sendgrid" | "both" }) {
  if (source === "both") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={9} /> Both
      </span>
    );
  }
  if (source === "brevo") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
        Brevo only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
      SendGrid only
    </span>
  );
}

function GapWarning({ onlyBrevo, onlySendGrid }: { onlyBrevo: number; onlySendGrid: number }) {
  const total = onlyBrevo + onlySendGrid;
  if (total === 0) return null;
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">
          {total} email{total !== 1 ? "s" : ""} suppressed in only one system
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {onlyBrevo > 0 && `${onlyBrevo} in Brevo but not SendGrid. `}
          {onlySendGrid > 0 && `${onlySendGrid} in SendGrid but not Brevo. `}
          These contacts could still receive emails from the other system. Use "Sync Gaps" to fix this.
        </p>
      </div>
    </div>
  );
}

export default function LeadsUnsubscribes() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [addEmail, setAddEmail] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading, refetch, isFetching } = trpc.leads.getUnsubscribes.useQuery(
    { limit: 1000, filter, search: search || undefined },
    { staleTime: 2 * 60 * 1000 }
  );

  const syncMutation = trpc.leads.syncUnsubscribes.useMutation({
    onSuccess: (result) => {
      const total = result.addedToBrevo + result.addedToSendGrid;
      if (total === 0) {
        toast.success("Already in sync — no gaps found!");
      } else {
        toast.success(
          `Synced ${total} email${total !== 1 ? "s" : ""}: ${result.addedToBrevo} added to Brevo, ${result.addedToSendGrid} added to SendGrid`
        );
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} error(s) during sync`);
      }
      utils.leads.getUnsubscribes.invalidate();
    },
    onError: () => toast.error("Sync failed — please try again"),
  });

  const addMutation = trpc.leads.addUnsubscribe.useMutation({
    onSuccess: (result) => {
      const parts = [];
      if (result.brevoOk) parts.push("Brevo");
      if (result.sgOk) parts.push("SendGrid");
      toast.success(`Added to ${parts.join(" & ")}`);
      setAddEmail("");
      setShowAddForm(false);
      utils.leads.getUnsubscribes.invalidate();
    },
    onError: () => toast.error("Failed to add email"),
  });

  function handleExportCSV() {
    if (!data?.contacts) return;
    const rows = [
      ["Email", "In Brevo", "In SendGrid", "Brevo Added", "SendGrid Added"],
      ...data.contacts.map((c) => [
        c.email,
        c.inBrevo ? "Yes" : "No",
        c.inSendGrid ? "Yes" : "No",
        c.brevoCreatedAt ? new Date(c.brevoCreatedAt).toLocaleDateString() : "",
        c.sendgridCreatedAt ? new Date(c.sendgridCreatedAt).toLocaleDateString() : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artswrk-unsubscribes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const contacts = data?.contacts ?? [];

  return (
    <LeadsLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#111]">Unsubscribes</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Merged suppression list from Brevo + SendGrid
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0B5FFF] transition-colors px-3 py-2 rounded-xl border border-gray-200 hover:border-blue-200 bg-white"
            >
              <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!data?.contacts?.length}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#111] transition-colors px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 bg-white"
            >
              <Download size={12} />
              Export CSV
            </button>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors px-3 py-2 rounded-xl"
            >
              {syncMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ArrowRightLeft size={12} />
              )}
              Sync Gaps
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#111] hover:bg-gray-800 transition-colors px-3 py-2 rounded-xl"
            >
              <Plus size={12} />
              Add Email
            </button>
          </div>
        </div>

        {/* Add email form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
            <p className="text-sm font-semibold text-[#111] mb-3">
              Add email to both Brevo & SendGrid suppression lists
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addEmail) addMutation.mutate({ email: addEmail });
                }}
              />
              <button
                onClick={() => addEmail && addMutation.mutate({ email: addEmail })}
                disabled={!addEmail || addMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#111] hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
              >
                {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Add to Both"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* KPI cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total", value: data.brevoCount + data.sendgridCount - data.bothCount, color: "#111", bg: "#f9fafb" },
              { label: "In Both", value: data.bothCount, color: "#10B981", bg: "#ecfdf5" },
              { label: "Brevo Total", value: data.brevoCount, color: "#0B5FFF", bg: "#eff6ff" },
              { label: "SendGrid Total", value: data.sendgridCount, color: "#8B5CF6", bg: "#f5f3ff" },
              { label: "Gaps", value: data.onlyBrevoCount + data.onlySendGridCount, color: "#F59E0B", bg: "#fffbeb" },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-gray-100 p-3 text-center" style={{ backgroundColor: k.bg }}>
                <p className="text-xs text-gray-400 font-medium mb-0.5">{k.label}</p>
                <p className="text-xl font-black" style={{ color: k.color }}>{k.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Gap warning */}
        {data && (
          <GapWarning
            onlyBrevo={data.onlyBrevoCount}
            onlySendGrid={data.onlySendGridCount}
          />
        )}

        {/* Search + filter */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] transition-colors bg-white"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  filter === f ? "bg-white text-[#111] shadow-sm" : "text-gray-500 hover:text-[#111]"
                }`}
              >
                {FILTER_LABELS[f]}
                {f === "brevo_only" && data ? ` (${data.onlyBrevoCount})` : ""}
                {f === "sendgrid_only" && data ? ` (${data.onlySendGridCount})` : ""}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 ml-auto">
            {contacts.length.toLocaleString()} result{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Contact cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <UserMinus size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No unsubscribes found</p>
            <p className="text-xs mt-1">
              {search ? "Try a different search term" : "Your suppression lists are empty"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {contacts.map((c) => (
              <div
                key={c.email}
                className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col gap-2.5 ${
                  c.sources !== "both" ? "border-amber-200" : "border-gray-100"
                }`}
              >
                {/* Email + source */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Mail size={12} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-[#111] truncate">{c.email}</p>
                  </div>
                  <SourceBadge source={c.sources} />
                </div>

                {/* System presence */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.inBrevo ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.inBrevo ? "bg-blue-400" : "bg-gray-300"}`} />
                    Brevo
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.inSendGrid ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.inSendGrid ? "bg-purple-400" : "bg-gray-300"}`} />
                    SendGrid
                  </div>
                </div>

                {/* Dates */}
                {(c.brevoCreatedAt || c.sendgridCreatedAt) && (
                  <p className="text-[10px] text-gray-400">
                    {c.brevoCreatedAt && `Brevo: ${new Date(c.brevoCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    {c.brevoCreatedAt && c.sendgridCreatedAt && " · "}
                    {c.sendgridCreatedAt && `SG: ${new Date(c.sendgridCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  </p>
                )}

                {/* Gap action */}
                {c.sources !== "both" && (
                  <button
                    onClick={() => addMutation.mutate({ email: c.email })}
                    disabled={addMutation.isPending}
                    className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <Plus size={9} />
                    Add to {c.sources === "brevo" ? "SendGrid" : "Brevo"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </LeadsLayout>
  );
}
