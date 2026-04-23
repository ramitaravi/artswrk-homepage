/**
 * Leads Dashboard — Contacts
 * Searchable, paginated contact table with a right-side detail drawer.
 */
import { useState, useCallback } from "react";
import LeadsLayout from "@/components/LeadsLayout";
import { trpc } from "@/lib/trpc";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Calendar,
  Tag,
  CheckCircle,
  XCircle,
  Clock,
  MousePointerClick,
  Eye,
  AlertTriangle,
} from "lucide-react";

const PAGE_SIZE = 25;

// ── Event icon map ─────────────────────────────────────────────────────────────
function EventIcon({ event }: { event: string }) {
  const e = event.toLowerCase();
  if (e === "delivered") return <CheckCircle size={12} className="text-emerald-500" />;
  if (e === "opened" || e === "uniqueopened") return <Eye size={12} className="text-[#0B5FFF]" />;
  if (e === "clicked") return <MousePointerClick size={12} className="text-purple-500" />;
  if (e === "unsubscribed") return <XCircle size={12} className="text-red-400" />;
  if (e === "softbounce" || e === "hardbounce") return <AlertTriangle size={12} className="text-amber-500" />;
  return <Mail size={12} className="text-gray-400" />;
}

// ── Contact Detail Drawer ──────────────────────────────────────────────────────
function ContactDrawer({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.leads.getContact.useQuery({ email });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111]">Contact Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Contact not found
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Contact info */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-[#EEF3FF] flex items-center justify-center mb-3">
                <span className="text-lg font-black text-[#0B5FFF]">
                  {data.contact.email[0].toUpperCase()}
                </span>
              </div>
              <p className="font-bold text-[#111] text-base">{data.contact.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    data.contact.emailBlacklisted
                      ? "bg-red-50 text-red-500"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {data.contact.emailBlacklisted ? "Unsubscribed" : "Subscribed"}
                </span>
              </div>
            </div>

            {/* Attributes */}
            {Object.keys(data.contact.attributes).length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Attributes
                </p>
                <div className="space-y-2">
                  {Object.entries(data.contact.attributes)
                    .filter(([, v]) => v !== null && v !== "")
                    .map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3">
                        <span className="text-xs text-gray-400 capitalize">
                          {k.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <span className="text-xs font-medium text-[#111] text-right max-w-[180px] truncate">
                          {String(v)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Lists */}
            {data.contact.listIds.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Lists ({data.contact.listIds.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.contact.listIds.map((id) => (
                    <span
                      key={id}
                      className="text-xs bg-[#EEF3FF] text-[#0B5FFF] px-2 py-0.5 rounded-full font-medium"
                    >
                      List #{id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Email history */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Email History
              </p>
              {data.history.length === 0 ? (
                <p className="text-xs text-gray-400">No email events found</p>
              ) : (
                <div className="space-y-2">
                  {data.history.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0"
                    >
                      <div className="mt-0.5">
                        <EventIcon event={ev.event} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#111] capitalize">
                          {ev.event}
                        </p>
                        {ev.subject && (
                          <p className="text-xs text-gray-400 truncate">{ev.subject}</p>
                        )}
                        {ev.link && (
                          <p className="text-xs text-[#0B5FFF] truncate">{ev.link}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-300 whitespace-nowrap">
                        {new Date(ev.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LeadsContacts() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  // Debounce search input
  const handleSearch = useCallback(
    (val: string) => {
      setSearch(val);
      clearTimeout((window as any)._leadsSearchTimer);
      (window as any)._leadsSearchTimer = setTimeout(() => {
        setDebouncedSearch(val);
        setOffset(0);
      }, 400);
    },
    []
  );

  const { data, isLoading } = trpc.leads.getContacts.useQuery(
    { limit: PAGE_SIZE, offset, email: debouncedSearch || undefined, sort: "desc" },
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
            <h1 className="text-2xl font-black text-[#111]">Contacts</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {data ? `${data.count.toLocaleString()} total contacts` : "Loading…"}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-5 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email address…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] transition-all"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setDebouncedSearch(""); setOffset(0); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Email", "Status", "Lists", "Created", "Last Modified"].map((h) => (
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
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 size={22} className="animate-spin text-[#0B5FFF] mx-auto" />
                    </td>
                  </tr>
                ) : (data?.contacts ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  (data?.contacts ?? []).map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 hover:bg-[#F7F9FF] cursor-pointer transition-colors"
                      onClick={() => setSelectedEmail(c.email)}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#EEF3FF] flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-[#0B5FFF]">
                              {c.email[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-[#111]">{c.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.emailBlacklisted
                              ? "bg-red-50 text-red-500"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {c.emailBlacklisted ? "Unsubscribed" : "Subscribed"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-500">
                        {c.listIds.length > 0 ? (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {c.listIds.length} list{c.listIds.length !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.modifiedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))
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

      {/* Contact detail drawer */}
      {selectedEmail && (
        <ContactDrawer
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}
    </LeadsLayout>
  );
}
