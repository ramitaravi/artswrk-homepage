/**
 * ARTSWRK ACQUISITION TOOL
 * Admin-only page for parsing Facebook group posts and generating outreach.
 * Flow: Paste text → AI parses → review leads → generate DM → copy & send → track status
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Megaphone, Users, Briefcase, ChevronDown, ChevronUp,
  Copy, CheckCheck, Send, MapPin, DollarSign, Phone,
  Music, RefreshCw, ArrowRight, Sparkles, Clock,
  TrendingUp, UserPlus, Link2, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Lead = {
  id: number;
  sessionId: number;
  leadType: "job" | "artist";
  name: string | null;
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
  new: { label: "New", color: "bg-gray-100 text-gray-600" },
  outreach_sent: { label: "Outreach Sent", color: "bg-blue-50 text-blue-600" },
  clicked: { label: "Clicked Link", color: "bg-amber-50 text-amber-600" },
  joined: { label: "Joined Artswrk", color: "bg-green-50 text-green-600" },
};

function parseDisciplines(raw: string | null): string[] {
  if (!raw) return [];
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

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead, onStatusChange }: { lead: Lead; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const utils = trpc.useUtils();

  const generateOutreach = trpc.acquisition.generateOutreach.useMutation({
    onSuccess: () => {
      utils.acquisition.getSessionLeads.invalidate();
      setOutreachOpen(true);
    },
    onError: (e) => toast.error("Failed to generate message: " + e.message),
  });

  const markSent = trpc.acquisition.markOutreachSent.useMutation({
    onSuccess: () => {
      onStatusChange();
      toast.success("Marked as outreach sent");
    },
  });

  const updateStatus = trpc.acquisition.updateLeadStatus.useMutation({
    onSuccess: () => {
      onStatusChange();
    },
  });

  const disciplines = parseDisciplines(lead.disciplines);
  const magicLink = getMagicLink(lead.magicLinkToken);
  const statusCfg = STATUS_CONFIG[lead.status];
  const isJob = lead.leadType === "job";

  function copyMessage() {
    if (!lead.outreachMessage) return;
    const msg = lead.outreachMessage.replace("[MAGIC_LINK]", magicLink);
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(magicLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isJob ? "border-orange-100" : "border-pink-100"}`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-3">
        {/* Type badge */}
        <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isJob ? "bg-orange-50 text-[#F25722]" : "bg-pink-50 text-pink-500"}`}>
          {isJob ? <Briefcase size={15} /> : <Users size={15} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-[#111] text-sm leading-tight">{lead.name || "Unknown"}</p>
              <p className="text-xs text-gray-500 mt-0.5">{lead.title || (isJob ? "Job Posting" : "Artist")}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 mt-2">
            {lead.location && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={11} /> {lead.location}
              </span>
            )}
            {lead.rate && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <DollarSign size={11} /> {lead.rate}
              </span>
            )}
            {lead.contactInfo && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Phone size={11} /> {lead.contactInfo}
              </span>
            )}
          </div>

          {/* Disciplines */}
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

      {/* Expanded: description + raw post */}
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
              <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-xl p-3 max-h-28 overflow-y-auto">{lead.rawPostText}</p>
            </div>
          )}

          {/* Status changer */}
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
        </div>
      )}

      {/* Outreach panel */}
      {outreachOpen && lead.outreachMessage && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#F25722]" /> AI-Generated DM
            </p>
            <button onClick={() => setOutreachOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
            {lead.outreachMessage.replace("[MAGIC_LINK]", magicLink)}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copyMessage}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#111] text-white hover:bg-gray-800 transition-colors"
            >
              {copiedMessage ? <CheckCheck size={13} /> : <Copy size={13} />}
              {copiedMessage ? "Copied!" : "Copy Full Message"}
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {copiedLink ? <CheckCheck size={13} /> : <Link2 size={13} />}
              {copiedLink ? "Copied!" : "Copy Magic Link"}
            </button>
            {lead.status === "new" && (
              <button
                onClick={() => markSent.mutate({ leadId: lead.id })}
                disabled={markSent.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-60"
              >
                <Send size={13} />
                Mark as Sent
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!outreachOpen && (
            <button
              onClick={() => {
                if (lead.outreachMessage) {
                  setOutreachOpen(true);
                } else {
                  generateOutreach.mutate({ leadId: lead.id });
                }
              }}
              disabled={generateOutreach.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-gradient-to-r from-[#FFBC5D] to-[#F25722] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {generateOutreach.isPending ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {generateOutreach.isPending ? "Generating..." : lead.outreachMessage ? "View Outreach" : "Generate Outreach"}
            </button>
          )}
        </div>
        <span className="text-[10px] text-gray-300">ID #{lead.id}</span>
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
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <div>
          <h2 className="font-bold text-[#111]">Parsed Results</h2>
          <p className="text-xs text-gray-400">{jobs.length} jobs · {artists.length} artists found</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "job", "artist"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === f
                ? "bg-[#111] text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"
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
            <LeadCard key={lead.id} lead={lead as Lead} onStatusChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sessions List ────────────────────────────────────────────────────────────
function SessionsList({ onSelectSession }: { onSelectSession: (id: number) => void }) {
  const { data: sessions = [], isLoading } = trpc.acquisition.listSessions.useQuery({ limit: 20, offset: 0 });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw size={20} className="animate-spin text-gray-300" />
    </div>
  );

  if (sessions.length === 0) return null;

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
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: stats } = trpc.acquisition.getStats.useQuery();

  function handleParsed(sessionId: number) {
    utils.acquisition.listSessions.invalidate();
    setActiveSessionId(sessionId);
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

      {/* Main content */}
      {activeSessionId ? (
        <SessionLeadsView
          sessionId={activeSessionId}
          onBack={() => setActiveSessionId(null)}
        />
      ) : (
        <div className="space-y-6">
          <ParsePanel onParsed={handleParsed} />
          <SessionsList onSelectSession={setActiveSessionId} />
        </div>
      )}
    </div>
  );
}
