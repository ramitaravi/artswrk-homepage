/**
 * Leads Dashboard — Contacts
 * Compact list-style rows with Artswrk user cross-reference (artist/client badge).
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
  Tag,
  CheckCircle,
  XCircle,
  Eye,
  MousePointerClick,
  AlertTriangle,
  ExternalLink,
  Users,
  CheckCircle2,
  Clock,
} from "lucide-react";

const PAGE_SIZE = 50;

function avatarColor(email: string) {
  const colors = [
    "bg-orange-100 text-orange-600",
    "bg-pink-100 text-pink-600",
    "bg-blue-100 text-blue-600",
    "bg-purple-100 text-purple-600",
    "bg-emerald-100 text-emerald-600",
    "bg-amber-100 text-amber-600",
  ];
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function initials(email: string, attrs: Record<string, any>) {
  const first = attrs?.FIRSTNAME ?? "";
  const last = attrs?.LASTNAME ?? "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function ArtswrkBadge({ userRole }: { userRole: string | null | undefined }) {
  if (!userRole) return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    Artist: { label: "Artist", color: "#ec008c", bg: "#fdf2f8" },
    Client: { label: "Client", color: "#F25722", bg: "#fff5f0" },
    Admin:  { label: "Admin",  color: "#0B5FFF", bg: "#eff6ff" },
  };
  const style = map[userRole] ?? { label: userRole, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.label}
    </span>
  );
}

function EventIcon({ event }: { event: string }) {
  const e = event.toLowerCase();
  if (e === "delivered") return <CheckCircle size={12} className="text-emerald-500" />;
  if (e === "opened" || e === "uniqueopened") return <Eye size={12} className="text-[#0B5FFF]" />;
  if (e === "clicked") return <MousePointerClick size={12} className="text-purple-500" />;
  if (e === "unsubscribed") return <XCircle size={12} className="text-red-400" />;
  if (e === "softbounce" || e === "hardbounce") return <AlertTriangle size={12} className="text-amber-500" />;
  return <Mail size={12} className="text-gray-400" />;
}

// ── Contact detail drawer ─────────────────────────────────────────────────────
function ContactDrawer({ email, onClose }: { email: string; onClose: () => void }) {
  const { data, isLoading } = trpc.leads.getContact.useQuery({ email });
  const av = avatarColor(email);
  const attrs = data?.contact?.attributes ?? {};
  const name = [attrs.FIRSTNAME, attrs.LASTNAME].filter(Boolean).join(" ") || null;
  const artswrkUser = (data?.contact as any)?.artswrkUser;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111]">Contact Detail</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Contact not found</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Profile */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black mb-3 ${av}`}>
                {initials(email, attrs)}
              </div>
              {name && <p className="font-black text-[#111] text-base">{name}</p>}
              <p className="text-sm text-gray-400 mt-0.5">{data.contact.email}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${data.contact.emailBlacklisted ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
                  {data.contact.emailBlacklisted ? "Unsubscribed" : "Subscribed"}
                </span>
                {artswrkUser && (
                  <>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#EEF3FF] text-[#0B5FFF] flex items-center gap-1">
                      <CheckCircle2 size={10} /> On Artswrk
                    </span>
                    <ArtswrkBadge userRole={artswrkUser.userRole} />
                  </>
                )}
              </div>
            </div>

            {/* Artswrk account info */}
            {artswrkUser && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Artswrk Account</p>
                <div className="space-y-2">
                  {artswrkUser.name && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-gray-400">Name</span>
                      <span className="text-xs font-medium text-[#111]">{artswrkUser.name}</span>
                    </div>
                  )}
                  {artswrkUser.userRole && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-gray-400">Role</span>
                      <ArtswrkBadge userRole={artswrkUser.userRole} />
                    </div>
                  )}
                  {artswrkUser.clientCompanyName && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-gray-400">Company</span>
                      <span className="text-xs font-medium text-[#111]">{artswrkUser.clientCompanyName}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-gray-400">Joined</span>
                    <span className="text-xs text-gray-600">
                      {new Date(artswrkUser.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-gray-400">Last seen</span>
                    <span className="text-xs text-gray-600">
                      {new Date(artswrkUser.lastSignedIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-6 py-4 border-b border-gray-100 flex gap-2">
              <a href={`mailto:${email}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#111] text-white text-xs font-semibold hover:bg-gray-800 transition-colors">
                <Mail size={12} /> Email
              </a>
              <a href={`https://app.brevo.com/contacts/details/${data.contact.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <ExternalLink size={12} /> Brevo
              </a>
            </div>

            {/* Lists */}
            {data.contact.listIds.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lists ({data.contact.listIds.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.contact.listIds.map((id) => (
                    <span key={id} className="text-xs bg-[#EEF3FF] text-[#0B5FFF] px-2.5 py-1 rounded-full font-medium">List #{id}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Attributes */}
            {Object.keys(attrs).length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Brevo Attributes</p>
                <div className="space-y-2">
                  {Object.entries(attrs).filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3">
                      <span className="text-xs text-gray-400 capitalize">{k.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="text-xs font-medium text-[#111] text-right max-w-[180px] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email history */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Email History</p>
              {data.history.length === 0 ? (
                <p className="text-xs text-gray-400">No email events found</p>
              ) : (
                <div className="space-y-2">
                  {data.history.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                      <div className="mt-0.5"><EventIcon event={ev.event} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#111] capitalize">{ev.event}</p>
                        {ev.subject && <p className="text-xs text-gray-400 truncate">{ev.subject}</p>}
                      </div>
                      <span className="text-[10px] text-gray-300 whitespace-nowrap">
                        {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((window as any)._leadsSearchTimer);
    (window as any)._leadsSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setOffset(0);
    }, 400);
  }, []);

  const { data, isLoading, isFetching } = trpc.leads.getContacts.useQuery(
    { limit: PAGE_SIZE, offset, email: debouncedSearch || undefined, sort: "desc" },
    { staleTime: 5 * 60 * 1000 }
  );

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const contacts = data?.contacts ?? [];

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
          <a href="https://app.brevo.com/contacts" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#0B5FFF] hover:underline font-medium">
            Open in Brevo <ExternalLink size={11} />
          </a>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative max-w-sm flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email address…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] transition-all"
            />
            {search && (
              <button onClick={() => { setSearch(""); setDebouncedSearch(""); setOffset(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>
          {isFetching && !isLoading && <Loader2 size={13} className="animate-spin text-gray-400" />}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Subscribed</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Unsubscribed</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={9} className="text-[#0B5FFF]" /> On Artswrk</span>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Users size={32} className="mb-3 opacity-30" />
            <p className="text-sm">{search ? "No contacts match your search" : "No contacts found"}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {contacts.map((c: any, i: number) => {
              const attrs = c.attributes ?? {};
              const name = [attrs.FIRSTNAME, attrs.LASTNAME].filter(Boolean).join(" ") || c.artswrkUser?.name || null;
              const subscribed = !c.emailBlacklisted;
              const av = avatarColor(c.email ?? "");

              return (
                <button
                  key={c.id ?? i}
                  onClick={() => setSelectedEmail(c.email)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-b-0"
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${av}`}>
                    {initials(c.email ?? "?", attrs)}
                  </div>

                  {/* Status dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subscribed ? "bg-emerald-400" : "bg-red-400"}`}
                    title={subscribed ? "Subscribed" : "Unsubscribed"}
                  />

                  {/* Email + name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#111] truncate">{c.email}</p>
                    {name && <p className="text-[10px] text-gray-400 truncate">{name}</p>}
                  </div>

                  {/* Artswrk status */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.artswrkUser ? (
                      <>
                        <CheckCircle2 size={10} className="text-[#0B5FFF]" />
                        <ArtswrkBadge userRole={c.artswrkUser.userRole} />
                        {c.artswrkUser.clientCompanyName && (
                          <span className="text-[10px] text-gray-400 max-w-[90px] truncate hidden md:block">
                            {c.artswrkUser.clientCompanyName}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-300 hidden sm:block">Not on platform</span>
                    )}
                  </div>

                  {/* List count */}
                  {c.listIds && c.listIds.length > 0 && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 hidden lg:flex items-center gap-1">
                      <Tag size={9} /> {c.listIds.length}
                    </span>
                  )}

                  {/* Last modified */}
                  {c.modifiedAt && (
                    <span className="text-[10px] text-gray-300 flex-shrink-0 hidden xl:flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(c.modifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {(data?.count ?? 0) > PAGE_SIZE && (
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

      {selectedEmail && <ContactDrawer email={selectedEmail} onClose={() => setSelectedEmail(null)} />}
    </LeadsLayout>
  );
}
