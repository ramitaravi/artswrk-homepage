/**
 * Leads CRM — deal-flow list view
 *
 * Reads from the leads_contacts DB cache (populated by "Sync from Brevo" button).
 * Shows: name, email, city, user type, hiring category, email engagement,
 *        Artswrk status, jobs posted, bookings, premium flags.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  Users,
  Building2,
  MapPin,
  Mail,
  MousePointerClick,
  Eye,
  Briefcase,
  Star,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Link } from "wouter";

const PAGE_SIZE = 50;

const HIRING_CATEGORIES = [
  "Dance Studio",
  "Dance Competition",
  "Music School",
  "Other Business",
  "Dance Educator",
  "Dance Adjudicator",
  "Photographer",
  "Videographer",
];

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function PremiumBadge({ pro, basic, clientPremium }: { pro: boolean; basic: boolean; clientPremium: boolean }) {
  if (pro) return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5 py-0 h-4">Pro</Badge>;
  if (clientPremium) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 h-4">Premium</Badge>;
  if (basic) return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 h-4">Basic</Badge>;
  return null;
}

function RoleBadge({ brevoRole, artswrkRole }: { brevoRole: string | null; artswrkRole: string | null }) {
  const role = artswrkRole ?? brevoRole;
  if (!role) return <span className="text-gray-400 text-xs">—</span>;
  if (role === "Artist") return <Badge className="bg-pink-50 text-pink-700 border-pink-200 text-[10px] px-1.5 py-0 h-4">Artist</Badge>;
  if (role === "Client") return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0 h-4">Client</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{role}</Badge>;
}

export default function LeadsCRM() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userRole, setUserRole] = useState<"Artist" | "Client" | undefined>();
  const [hiringCategory, setHiringCategory] = useState<string | undefined>();
  const [isArtswrkUser, setIsArtswrkUser] = useState<boolean | undefined>();
  const [hasPostedJobs, setHasPostedJobs] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "most_opens" | "most_clicks">("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._leadSearchTimer);
    (window as any)._leadSearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(0);
    }, 350);
  };

  const { data: syncInfo, refetch: refetchSyncInfo } = trpc.leads.getCrmSyncInfo.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: stats, refetch: refetchStats } = trpc.leads.getCrmStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, refetch } = trpc.leads.getCrmContacts.useQuery(
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      search: debouncedSearch || undefined,
      userRole,
      hiringCategory,
      isArtswrkUser,
      hasPostedJobs: hasPostedJobs || undefined,
      isPremium: isPremium || undefined,
      sort,
    },
    { refetchOnWindowFocus: false }
  );

  const syncMutation = trpc.leads.syncCrm.useMutation({
    onSuccess: (result) => {
      toast.success(`Sync complete — ${result?.contactsUpserted?.toLocaleString() ?? 0} contacts synced, ${result?.artswrkMatched?.toLocaleString() ?? 0} matched to Artswrk users.`);
      refetch();
      refetchStats();
      refetchSyncInfo();
    },
    onError: (e) => {
      toast.error(`Sync failed: ${e.message}`);
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const isEmpty = !isLoading && (data?.contacts?.length ?? 0) === 0;
  const hasData = (stats?.total ?? 0) > 0;

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hasData
              ? `${stats?.total?.toLocaleString()} contacts · last synced ${formatRelativeTime(syncInfo?.completedAt)}`
              : "Sync from Brevo to populate the CRM"}
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="bg-[#111] hover:bg-gray-800 text-white text-sm"
        >
          <RefreshCw size={14} className={`mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing…" : "Sync from Brevo"}
        </Button>
      </div>

      {/* Stats bar */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
          {[
            { label: "Total", value: stats?.total, icon: Users, color: "text-gray-700" },
            { label: "On Artswrk", value: stats?.artswrkUsers, icon: CheckCircle2, color: "text-green-600" },
            { label: "Not Yet", value: stats?.notOnPlatform, icon: XCircle, color: "text-orange-500" },
            { label: "Clients", value: stats?.clients, icon: Building2, color: "text-blue-600" },
            { label: "Artists", value: stats?.artists, icon: Star, color: "text-pink-600" },
            { label: "Premium", value: stats?.premium, icon: Star, color: "text-purple-600" },
            { label: "Posted Jobs", value: stats?.hasPostedJobs, icon: Briefcase, color: "text-indigo-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className={`flex items-center gap-1.5 mb-1 ${s.color}`}>
                <s.icon size={13} />
                <span className="text-[11px] font-medium text-gray-500">{s.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{s.value?.toLocaleString() ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state — no sync yet */}
      {!hasData && !isLoading && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-orange-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">No contacts yet</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            Click "Sync from Brevo" to pull your 37,000+ contacts into the CRM. This takes 2–5 minutes on first run.
          </p>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-[#111] hover:bg-gray-800 text-white"
          >
            <RefreshCw size={14} className={`mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing… (this may take a few minutes)" : "Sync from Brevo"}
          </Button>
        </div>
      )}

      {/* Search + filters */}
      {hasData && (
        <>
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search name, email, city, company…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-9 text-sm ${showFilters ? "border-orange-300 text-orange-600 bg-orange-50" : ""}`}
            >
              <Filter size={13} className="mr-1.5" />
              Filters
              {(userRole || hiringCategory || isArtswrkUser !== undefined || hasPostedJobs || isPremium) && (
                <span className="ml-1.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center">
                  {[userRole, hiringCategory, isArtswrkUser !== undefined, hasPostedJobs, isPremium].filter(Boolean).length}
                </span>
              )}
            </Button>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as any); setPage(0); }}
              className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most_opens">Most opens</option>
              <option value="most_clicks">Most clicks</option>
            </select>
          </div>

          {showFilters && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-3 flex flex-wrap gap-3">
              {/* Role filter */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</p>
                <div className="flex gap-1.5">
                  {(["Artist", "Client"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => { setUserRole(userRole === r ? undefined : r); setPage(0); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        userRole === r
                          ? r === "Artist" ? "bg-pink-100 text-pink-700 border-pink-300" : "bg-orange-100 text-orange-700 border-orange-300"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hiring category */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Business Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {HIRING_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setHiringCategory(hiringCategory === cat ? undefined : cat); setPage(0); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        hiringCategory === cat
                          ? "bg-blue-100 text-blue-700 border-blue-300"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Artswrk status */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Artswrk Status</p>
                <div className="flex gap-1.5">
                  {[
                    { label: "On Platform", value: true },
                    { label: "Not Yet", value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => { setIsArtswrkUser(isArtswrkUser === opt.value ? undefined : opt.value); setPage(0); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isArtswrkUser === opt.value
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Boolean flags */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Activity</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setHasPostedJobs(!hasPostedJobs); setPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      hasPostedJobs ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Posted Jobs
                  </button>
                  <button
                    onClick={() => { setIsPremium(!isPremium); setPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isPremium ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Premium
                  </button>
                </div>
              </div>

              {/* Clear */}
              {(userRole || hiringCategory || isArtswrkUser !== undefined || hasPostedJobs || isPremium) && (
                <button
                  onClick={() => {
                    setUserRole(undefined);
                    setHiringCategory(undefined);
                    setIsArtswrkUser(undefined);
                    setHasPostedJobs(false);
                    setIsPremium(false);
                    setPage(0);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-1"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Results count */}
          <p className="text-xs text-gray-400 mb-2">
            {isLoading ? "Loading…" : `${data?.total?.toLocaleString() ?? 0} contacts`}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </p>

          {/* Contact list */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              <span>Contact</span>
              <span>City / Type</span>
              <span>Role</span>
              <span className="flex items-center gap-1"><Eye size={10} /> Opens</span>
              <span className="flex items-center gap-1"><MousePointerClick size={10} /> Clicks</span>
              <span>Artswrk</span>
              <span>Activity</span>
            </div>

            {isLoading && (
              <div className="py-12 text-center text-sm text-gray-400">Loading contacts…</div>
            )}

            {isEmpty && (
              <div className="py-12 text-center text-sm text-gray-400">
                No contacts match your filters.
              </div>
            )}

            {data?.contacts?.map((contact) => {
              const name = contact.fullName || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || contact.email;
              const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const openRate = contact.totalCampaignsReceived && contact.totalOpens
                ? Math.round(((contact.totalOpens ?? 0) / contact.totalCampaignsReceived) * 100)
                : null;

              return (
                <Link
                  key={contact.id}
                  href={`/leads/crm/${encodeURIComponent(contact.email)}`}
                  className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer items-center"
                >
                  {/* Contact */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {initials || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{contact.email}</p>
                    </div>
                  </div>

                  {/* City / Type */}
                  <div className="min-w-0">
                    {contact.city && (
                      <p className="text-xs text-gray-600 flex items-center gap-1 truncate">
                        <MapPin size={10} className="flex-shrink-0 text-gray-400" />
                        {contact.city.replace(/, USA$/, "")}
                      </p>
                    )}
                    {(contact.hiringCategory || contact.artswrkHiringCategory) && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {contact.artswrkHiringCategory ?? contact.hiringCategory}
                      </p>
                    )}
                    {contact.companyName && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{contact.companyName}</p>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    <RoleBadge brevoRole={contact.brevoUserRole} artswrkRole={contact.artswrkUserRole} />
                  </div>

                  {/* Opens */}
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {(contact.totalOpens ?? 0) > 0 ? contact.totalOpens : <span className="text-gray-300">—</span>}
                    </p>
                    {openRate !== null && openRate > 0 && (
                      <p className="text-[11px] text-gray-400">{openRate}% rate</p>
                    )}
                  </div>

                  {/* Clicks */}
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {(contact.totalClicks ?? 0) > 0 ? contact.totalClicks : <span className="text-gray-300">—</span>}
                    </p>
                    {contact.lastClickedAt && (
                      <p className="text-[11px] text-gray-400">{formatRelativeTime(contact.lastClickedAt)}</p>
                    )}
                  </div>

                  {/* Artswrk status */}
                  <div className="flex flex-col gap-1">
                    {contact.isArtswrkUser ? (
                      <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                        <CheckCircle2 size={11} /> On platform
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-orange-500">
                        <XCircle size={11} /> Not yet
                      </span>
                    )}
                    <PremiumBadge
                      pro={contact.artswrkPro ?? false}
                      basic={contact.artswrkBasic ?? false}
                      clientPremium={contact.clientPremium ?? false}
                    />
                  </div>

                  {/* Activity */}
                  <div className="text-[11px] text-gray-500 space-y-0.5">
                    {(contact.jobsPostedCount ?? 0) > 0 && (
                      <p className="flex items-center gap-1">
                        <Briefcase size={10} className="text-indigo-400" />
                        {contact.jobsPostedCount} job{contact.jobsPostedCount !== 1 ? "s" : ""}
                      </p>
                    )}
                    {(contact.bookingCount ?? 0) > 0 && (
                      <p className="flex items-center gap-1">
                        <CheckCircle2 size={10} className="text-green-400" />
                        {contact.bookingCount} booking{contact.bookingCount !== 1 ? "s" : ""}
                      </p>
                    )}
                    {contact.hasUnsubscribed && (
                      <p className="flex items-center gap-1 text-red-400">
                        <XCircle size={10} />
                        Unsubscribed
                      </p>
                    )}
                    {!contact.jobsPostedCount && !contact.bookingCount && !contact.hasUnsubscribed && (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">
                Page {page + 1} of {totalPages} · {data?.total?.toLocaleString()} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
