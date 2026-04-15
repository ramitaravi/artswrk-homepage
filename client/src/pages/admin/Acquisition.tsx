/*
 * ARTSWRK ACQUISITION TOOL
 * Admin-only page for parsing Facebook group posts and generating outreach.
 * Two views:
 *   1. Parse — paste text, AI extracts leads, review by session
 *   2. All Leads — unified table across all sessions with filters, expand, outreach
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Megaphone, Users, Briefcase, ChevronDown, ChevronUp,
  Copy, CheckCheck, Send, MapPin, DollarSign, Phone,
  RefreshCw, Sparkles, Clock, TrendingUp, UserPlus,
  ChevronRight, Search, Filter, ExternalLink, X,
  Table2, PlusCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Lead = {
  id: number;
  leadType: "job" | "artist";
  name: string;
  studioName: string;
  title: string;
  location: string;
  rate: string;
  contactInfo: string;
  disciplines: string[];
  description: string;
  rawPostText: string;
  status: "new" | "outreach_sent" | "clicked" | "joined";
  outreachMessage: string;
  outreachSentAt: Date | null;
  createdAt: Date;
  groupName: string;
  groupUrl: string;
};

type SessionLead = {
  id: number;
  sessionId: number;
  leadType: "job" | "artist";
  name: string | null;
  studioName?: string | null;
  title: string | null;
  location: string | null;
  rate: string | null;
  contactInfo: string | null;
  disciplines: string | null;
  description: string | null;
  rawPostText: string | null;
  outreachMessage: string | null;
  magicLinkToken: string | null;
  status: "new" | "outreach_sent" | "clicked" | "joined";
  createdAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:           { label: "New",           color: "bg-gray-100 text-gray-600",   dot: "bg-gray-400" },
  outreach_sent: { label: "Outreach Sent", color: "bg-blue-50 text-blue-600",    dot: "bg-blue-500" },
  clicked:       { label: "Clicked Link",  color: "bg-amber-50 text-amber-600",  dot: "bg-amber-500" },
  joined:        { label: "Joined",        color: "bg-green-50 text-green-600",  dot: "bg-green-500" },
};

function parseDisciplines(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function getMagicLink(token: string | null): string {
  if (!token) return "";
  return `${window.location.origin}/join?ref=${token}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-black text-[#111]">{value}</p>
      </div>
    </div>
  );
}

// ─── Outreach Modal ───────────────────────────────────────────────────────────
function OutreachModal({
  lead,
  magicToken,
  onClose,
  onSent,
}: {
  lead: { id: number; name: string | null; outreachMessage: string | null };
  magicToken: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const magicLink = getMagicLink(magicToken);

  const markSent = trpc.acquisition.markOutreachSent.useMutation({
    onSuccess: () => { onSent(); toast.success("Marked as outreach sent"); onClose(); },
  });

  const displayMessage = lead.outreachMessage
    ? lead.outreachMessage.replace("[MAGIC_LINK]", magicLink || "[magic link]")
    : "";

  function copyMsg() {
    navigator.clipboard.writeText(displayMessage);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(magicLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-[#111]">Outreach Message</h3>
            <p className="text-xs text-gray-400 mt-0.5">For {lead.name || "this lead"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Message */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">DM Message</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
              {displayMessage || <span className="text-gray-400 italic">No message generated yet</span>}
            </div>
            {displayMessage && (
              <button
                onClick={copyMsg}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#111] transition-colors"
              >
                {copiedMsg ? <><CheckCheck size={13} className="text-green-500" /> Copied!</> : <><Copy size={13} /> Copy Message</>}
              </button>
            )}
          </div>

          {/* Magic link */}
          {magicLink && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Magic Link</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-500 truncate flex-1">{magicLink}</span>
                <button onClick={copyLink} className="text-gray-400 hover:text-[#111] transition-colors flex-shrink-0">
                  {copiedLink ? <CheckCheck size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => markSent.mutate({ leadId: lead.id })}
              disabled={markSent.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Send size={14} /> Mark as Sent
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── All Leads Table Row ──────────────────────────────────────────────────────
function LeadsTableRow({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const isJob = lead.leadType === "job";
  const statusCfg = STATUS_CONFIG[lead.status];

  const generateOutreach = trpc.acquisition.generateOutreach.useMutation({
    onSuccess: (data) => {
      setGeneratedToken(data.magicLinkToken);
      utils.acquisition.getAllLeads.invalidate();
      setOutreachOpen(true);
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const updateStatus = trpc.acquisition.updateLeadStatus.useMutation({
    onSuccess: () => { onRefresh(); },
  });

  const outreachLead = {
    id: lead.id,
    name: lead.name,
    outreachMessage: lead.outreachMessage,
  };

  return (
    <>
      {outreachOpen && (
        <OutreachModal
          lead={outreachLead}
          magicToken={generatedToken}
          onClose={() => setOutreachOpen(false)}
          onSent={() => { setOutreachOpen(false); onRefresh(); }}
        />
      )}

      {/* Main row */}
      <tr
        className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${expanded ? "bg-gray-50/50" : ""}`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Type */}
        <td className="px-4 py-3 w-10">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isJob ? "bg-orange-50 text-[#F25722]" : "bg-pink-50 text-pink-500"}`}>
            {isJob ? <Briefcase size={13} /> : <Users size={13} />}
          </div>
        </td>

        {/* Name + Studio */}
        <td className="px-4 py-3 min-w-[160px]">
          <p className="font-semibold text-[#111] text-sm leading-tight">{lead.name || "—"}</p>
          {lead.studioName && <p className="text-xs text-gray-400 mt-0.5">{lead.studioName}</p>}
        </td>

        {/* Role / Title */}
        <td className="px-4 py-3 min-w-[140px]">
          <p className="text-sm text-gray-700">{lead.title || "—"}</p>
        </td>

        {/* Disciplines */}
        <td className="px-4 py-3 min-w-[180px]">
          <div className="flex flex-wrap gap-1">
            {lead.disciplines.slice(0, 3).map(d => (
              <span key={d} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{d}</span>
            ))}
            {lead.disciplines.length > 3 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">+{lead.disciplines.length - 3}</span>
            )}
          </div>
        </td>

        {/* Location */}
        <td className="px-4 py-3 min-w-[120px]">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin size={11} className="flex-shrink-0" /> {lead.location || "—"}
          </span>
        </td>

        {/* Contact */}
        <td className="px-4 py-3 min-w-[160px]">
          <span className="text-xs text-gray-500 break-all">{lead.contactInfo || "—"}</span>
        </td>

        {/* Group */}
        <td className="px-4 py-3 min-w-[140px]">
          <span className="text-xs text-gray-400">{lead.groupName || "—"}</span>
        </td>

        {/* Date */}
        <td className="px-4 py-3 min-w-[90px]">
          <span className="text-xs text-gray-400">
            {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3 min-w-[120px]" onClick={e => e.stopPropagation()}>
          <select
            value={lead.status}
            onChange={e => updateStatus.mutate({ leadId: lead.id, status: e.target.value as any })}
            className={`text-[11px] font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${statusCfg.color}`}
          >
            <option value="new">New</option>
            <option value="outreach_sent">Outreach Sent</option>
            <option value="clicked">Clicked Link</option>
            <option value="joined">Joined</option>
          </select>
        </td>

        {/* Outreach button */}
        <td className="px-4 py-3 min-w-[110px]" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => {
              if (lead.outreachMessage) {
                setOutreachOpen(true);
              } else {
                generateOutreach.mutate({ leadId: lead.id });
              }
            }}
            disabled={generateOutreach.isPending}
            className="flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:text-[#d94e1a] transition-colors disabled:opacity-50"
          >
            {generateOutreach.isPending
              ? <RefreshCw size={12} className="animate-spin" />
              : <Sparkles size={12} />
            }
            {lead.outreachMessage ? "View DM" : "Generate DM"}
          </button>
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 w-8">
          <div className="text-gray-300">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="bg-gray-50/80 border-b border-gray-100">
          <td colSpan={11} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lead.description && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">AI Summary</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{lead.description}</p>
                </div>
              )}
              {lead.rawPostText && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Original Post</p>
                  <p className="text-xs text-gray-500 leading-relaxed bg-white rounded-xl p-3 border border-gray-100 max-h-32 overflow-y-auto whitespace-pre-wrap">{lead.rawPostText}</p>
                </div>
              )}
              {lead.rate && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Rate</p>
                  <p className="text-xs text-gray-600 flex items-center gap-1"><DollarSign size={11} />{lead.rate}</p>
                </div>
              )}
              {lead.groupUrl && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Group</p>
                  <a
                    href={lead.groupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={11} /> {lead.groupName}
                  </a>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── All Leads Table ──────────────────────────────────────────────────────────
function AllLeadsTable() {
  const [typeFilter, setTypeFilter] = useState<"all" | "job" | "artist">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "outreach_sent" | "clicked" | "joined">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const utils = trpc.useUtils();

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const { data: rawLeads = [], isLoading, refetch } = trpc.acquisition.getAllLeads.useQuery({
    leadType: typeFilter,
    status: statusFilter,
    search: debouncedSearch || undefined,
  });

  // Normalize disciplines
  const leads: Lead[] = useMemo(() =>
    rawLeads.map(l => ({
      ...l,
      disciplines: parseDisciplines(l.disciplines as any),
    })),
    [rawLeads]
  );

  const jobCount = leads.filter(l => l.leadType === "job").length;
  const artistCount = leads.filter(l => l.leadType === "artist").length;

  function refresh() {
    utils.acquisition.getAllLeads.invalidate();
    utils.acquisition.getStats.invalidate();
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search name, studio, contact..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-colors"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1.5">
          {(["all", "job", "artist"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                typeFilter === t ? "bg-[#111] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {t === "all" ? "All Types" : t === "job" ? `Jobs (${jobCount})` : `Artists (${artistCount})`}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 focus:outline-none focus:border-[#F25722] transition-colors bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="outreach_sent">Outreach Sent</option>
          <option value="clicked">Clicked Link</option>
          <option value="joined">Joined</option>
        </select>

        {/* Count + refresh */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400">{leads.length} lead{leads.length !== 1 ? "s" : ""}</span>
          <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-gray-300" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <Table2 size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No leads yet</p>
            <p className="text-xs text-gray-400 mt-1">Parse some Facebook posts to start building your acquisition pipeline.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-10"></th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Role / Title</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Disciplines</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Group</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Outreach</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <LeadsTableRow key={lead.id} lead={lead} onRefresh={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Parse Input Panel ────────────────────────────────────────────────────────
function ParsePanel({ onParsed }: { onParsed: (sessionId: number) => void }) {
  const [groupName, setGroupName] = useState("Dance Teacher Subs Maryland");
  const [groupUrl, setGroupUrl] = useState("https://www.facebook.com/groups/1642967025976347");
  const [rawText, setRawText] = useState("");

  const parseMutation = trpc.acquisition.parsePosts.useMutation({
    onSuccess: (data) => {
      toast.success(`Parsed ${data.jobCount} jobs and ${data.artistCount} artists!`);
      setRawText("");
      onParsed(data.sessionId);
    },
    onError: (e) => toast.error("Parse failed: " + e.message),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
          <Megaphone size={16} className="text-[#F25722]" />
        </div>
        <div>
          <h2 className="font-bold text-[#111] text-sm">Parse Facebook Group Posts</h2>
          <p className="text-xs text-gray-400">Paste raw text from a Facebook group — AI will extract jobs and artists</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Group Name</label>
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Dance Teacher Subs Maryland"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Group URL (optional)</label>
          <input
            value={groupUrl}
            onChange={e => setGroupUrl(e.target.value)}
            placeholder="https://facebook.com/groups/..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
          Pasted Post Text <span className="text-gray-300 font-normal normal-case">— copy posts from Facebook and paste here</span>
        </label>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="Paste the raw text from Facebook group posts here. You can paste multiple posts at once — AI will separate and classify each one automatically."
          rows={8}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-colors resize-none font-mono text-xs leading-relaxed"
        />
        <p className="text-[10px] text-gray-400 mt-1">{rawText.length.toLocaleString()} characters pasted</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          AI will extract names, studios, locations, disciplines, and contact info from each post.
        </p>
        <button
          onClick={() => parseMutation.mutate({ rawText, groupName, groupUrl: groupUrl || undefined })}
          disabled={parseMutation.isPending || rawText.trim().length < 10}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FFBC5D] to-[#F25722] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {parseMutation.isPending ? (
            <><RefreshCw size={15} className="animate-spin" /> Parsing...</>
          ) : (
            <><Sparkles size={15} /> Parse Posts</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Session Leads View ───────────────────────────────────────────────────────
function SessionLeadsView({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
  const [filter, setFilter] = useState<"all" | "job" | "artist">("all");
  const utils = trpc.useUtils();

  const { data: leads = [], isLoading } = trpc.acquisition.getSessionLeads.useQuery({ sessionId });

  const jobs = leads.filter(l => l.leadType === "job");
  const artists = leads.filter(l => l.leadType === "artist");
  const filtered = filter === "all" ? leads : leads.filter(l => l.leadType === filter);

  function refresh() {
    utils.acquisition.getSessionLeads.invalidate({ sessionId });
    utils.acquisition.getAllLeads.invalidate();
    utils.acquisition.getStats.invalidate();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <div>
          <h2 className="font-bold text-[#111]">Parsed Results</h2>
          <p className="text-xs text-gray-400">{jobs.length} jobs · {artists.length} artists found</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "job", "artist"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === f ? "bg-[#111] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            {f === "all" ? `All (${leads.length})` : f === "job" ? `Jobs (${jobs.length})` : `Artists (${artists.length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No leads found</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(lead => (
            <SessionLeadCard key={lead.id} lead={lead as SessionLead} onStatusChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Session Lead Card (used in session view) ─────────────────────────────────
function SessionLeadCard({ lead, onStatusChange }: { lead: SessionLead; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const isJob = lead.leadType === "job";
  const statusCfg = STATUS_CONFIG[lead.status];
  const disciplines = parseDisciplines(lead.disciplines);

  const generateOutreach = trpc.acquisition.generateOutreach.useMutation({
    onSuccess: (data) => {
      setGeneratedToken(data.magicLinkToken);
      utils.acquisition.getSessionLeads.invalidate();
      utils.acquisition.getAllLeads.invalidate();
      setOutreachOpen(true);
    },
    onError: (e) => toast.error("Failed to generate message: " + e.message),
  });

  const updateStatus = trpc.acquisition.updateLeadStatus.useMutation({
    onSuccess: () => { onStatusChange(); },
  });

  return (
    <>
      {outreachOpen && (
        <OutreachModal
          lead={{ id: lead.id, name: lead.name, outreachMessage: lead.outreachMessage }}
          magicToken={generatedToken || lead.magicLinkToken}
          onClose={() => setOutreachOpen(false)}
          onSent={() => { setOutreachOpen(false); onStatusChange(); }}
        />
      )}

      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isJob ? "border-orange-100" : "border-pink-100"}`}>
        <div className="px-5 py-4 flex items-start gap-3">
          <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isJob ? "bg-orange-50 text-[#F25722]" : "bg-pink-50 text-pink-500"}`}>
            {isJob ? <Briefcase size={15} /> : <Users size={15} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-[#111] text-sm leading-tight">{lead.name || "Unknown"}</p>
                {lead.studioName && <p className="text-xs text-gray-400">{lead.studioName}</p>}
                <p className="text-xs text-gray-500 mt-0.5">{lead.title || (isJob ? "Job Posting" : "Artist")}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-2">
              {lead.location && <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={11} /> {lead.location}</span>}
              {lead.rate && <span className="flex items-center gap-1 text-xs text-gray-400"><DollarSign size={11} /> {lead.rate}</span>}
              {lead.contactInfo && <span className="flex items-center gap-1 text-xs text-gray-400"><Phone size={11} /> {lead.contactInfo}</span>}
            </div>

            {disciplines.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {disciplines.map(d => (
                  <span key={d} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{d}</span>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {expanded && (
          <div className="px-5 pb-4 space-y-3 border-t border-gray-50 pt-3">
            {lead.description && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Summary</p>
                <p className="text-xs text-gray-600 leading-relaxed">{lead.description}</p>
              </div>
            )}
            {lead.rawPostText && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Original Post</p>
                <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-xl p-3 max-h-28 overflow-y-auto whitespace-pre-wrap">{lead.rawPostText}</p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Update status:</span>
              {(["new", "outreach_sent", "clicked", "joined"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus.mutate({ leadId: lead.id, status: s })}
                  disabled={lead.status === s || updateStatus.isPending}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-40 ${
                    lead.status === s
                      ? STATUS_CONFIG[s].color + " border-transparent"
                      : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (lead.outreachMessage) { setOutreachOpen(true); }
                else { generateOutreach.mutate({ leadId: lead.id }); }
              }}
              disabled={generateOutreach.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FFBC5D] to-[#F25722] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generateOutreach.isPending
                ? <><RefreshCw size={13} className="animate-spin" /> Generating...</>
                : lead.outreachMessage
                  ? <><Send size={13} /> View Outreach Message</>
                  : <><Sparkles size={13} /> Generate Outreach DM</>
              }
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sessions List ────────────────────────────────────────────────────────────
function SessionsList({ onSelectSession }: { onSelectSession: (id: number) => void }) {
  const { data: sessions = [], isLoading } = trpc.acquisition.listSessions.useQuery({ limit: 20, offset: 0 });

  if (isLoading || sessions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous Parse Sessions</h3>
      <div className="space-y-2">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            className="w-full bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between hover:border-gray-300 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-semibold text-[#111]">{s.groupName || "Facebook Group"}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.jobCount} jobs · {s.artistCount} artists ·{" "}
                {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <ChevronRight size={15} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Acquisition Section ─────────────────────────────────────────────────
export default function AcquisitionSection() {
  const [tab, setTab] = useState<"parse" | "leads">("parse");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: stats } = trpc.acquisition.getStats.useQuery();

  function handleParsed(sessionId: number) {
    utils.acquisition.listSessions.invalidate();
    utils.acquisition.getAllLeads.invalidate();
    utils.acquisition.getStats.invalidate();
    setActiveSessionId(sessionId);
    setTab("leads");
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#111]">Acquisition</h1>
          <p className="text-sm text-gray-400 mt-0.5">Parse Facebook group posts to find jobs and artists, then generate personalized outreach</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Sessions" value={stats.totalSessions} icon={<Clock size={16} />} color="bg-gray-100 text-gray-600" />
          <StatCard label="Total Leads" value={stats.totalLeads} icon={<TrendingUp size={16} />} color="bg-orange-50 text-[#F25722]" />
          <StatCard label="Jobs Found" value={stats.totalJobs} icon={<Briefcase size={16} />} color="bg-amber-50 text-amber-600" />
          <StatCard label="Artists Found" value={stats.totalArtists} icon={<Users size={16} />} color="bg-pink-50 text-pink-500" />
          <StatCard label="Outreach Sent" value={stats.outreachSent} icon={<Send size={16} />} color="bg-blue-50 text-blue-600" />
          <StatCard label="Joined" value={stats.joined} icon={<UserPlus size={16} />} color="bg-green-50 text-green-600" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        <button
          onClick={() => { setTab("parse"); setActiveSessionId(null); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === "parse"
              ? "border-[#F25722] text-[#F25722]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <PlusCircle size={15} /> Parse Posts
        </button>
        <button
          onClick={() => { setTab("leads"); setActiveSessionId(null); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === "leads"
              ? "border-[#F25722] text-[#F25722]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Table2 size={15} /> All Leads {stats && stats.totalLeads > 0 && <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{stats.totalLeads}</span>}
        </button>
      </div>

      {/* Tab content */}
      {tab === "parse" ? (
        <div className="space-y-6">
          {activeSessionId ? (
            <SessionLeadsView
              sessionId={activeSessionId}
              onBack={() => setActiveSessionId(null)}
            />
          ) : (
            <>
              <ParsePanel onParsed={handleParsed} />
              <SessionsList onSelectSession={setActiveSessionId} />
            </>
          )}
        </div>
      ) : (
        <AllLeadsTable />
      )}
    </div>
  );
}
