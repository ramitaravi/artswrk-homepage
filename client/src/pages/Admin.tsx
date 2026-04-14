/*
 * ARTSWRK ADMIN DASHBOARD — /admin
 * Mirrors the Bubble admin structure:
 * Dashboard | Artists | Clients | Jobs | Bookings | Payments | Settings
 *
 * Protected: only accessible when logged in as admin or owner.
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, Users, Briefcase, BookOpen, CreditCard, Settings,
  Search, Shield, ChevronLeft, ChevronRight, Menu, X, TrendingUp,
  DollarSign, Calendar, Star, UserCheck, Building2, Key,
  AlertCircle, CheckCircle2, Eye, EyeOff, LogOut, Filter,
  MapPin, Clock, ArrowUpRight, UserCog, ArrowLeft, Sparkles, Globe, ExternalLink,
} from "lucide-react";
import { ADMIN_SESSION_COOKIE_NAME } from "@shared/const";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminSection = "dashboard" | "artists" | "clients" | "jobs" | "pro-jobs" | "bookings" | "payments" | "settings";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function displayName(row: { name?: string | null; firstName?: string | null; lastName?: string | null }) {
  if (row.firstName && row.lastName) return `${row.firstName} ${row.lastName}`;
  return row.name || "—";
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { id: "artists", label: "Artists", icon: <Users size={16} /> },
  { id: "clients", label: "Clients", icon: <Building2 size={16} /> },
  { id: "jobs", label: "Jobs", icon: <Briefcase size={16} /> },
  { id: "pro-jobs", label: "PRO Jobs", icon: <Sparkles size={16} /> },
  { id: "bookings", label: "Bookings", icon: <BookOpen size={16} /> },
  { id: "payments", label: "Payments", icon: <CreditCard size={16} /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} /> },
];

function Sidebar({ active, onSelect, collapsed, onToggle }: {
  active: AdminSection;
  onSelect: (s: AdminSection) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={`flex flex-col bg-[#111] text-white transition-all duration-200 ${collapsed ? "w-14" : "w-56"} min-h-screen flex-shrink-0`}>
      {/* Logo + toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <span className="font-black text-lg tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-lg tracking-tight bg-white text-[#111] px-1 py-0.5 rounded text-xs">WRK</span>
            <span className="text-[10px] text-white/40 ml-1 font-semibold uppercase tracking-wider">Admin</span>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors ml-auto">
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active === item.id
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white hover:bg-white/8"
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom: link to client dashboard */}
      {!collapsed && (
        <div className="p-3 border-t border-white/10">
          <Link href="/dashboard">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowUpRight size={13} />
              Client Dashboard
            </button>
          </Link>
        </div>
      )}
    </aside>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent || "bg-orange-50 text-[#F25722]"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-black text-[#111] leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Impersonation Banner ────────────────────────────────────────────────────
function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const utils = trpc.useUtils();
  const stopMutation = trpc.admin.stopImpersonating.useMutation({
    onSuccess: () => {
      utils.invalidate();
      window.location.href = "/admin";
    },
  });

  useEffect(() => {
    // Check if the admin backup cookie exists (means we're impersonating)
    const cookies = document.cookie.split(";").map(c => c.trim());
    const hasBackup = cookies.some(c => c.startsWith(ADMIN_SESSION_COOKIE_NAME + "="));
    setIsImpersonating(hasBackup);
  }, []);

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-[#F25722] text-white px-5 py-2.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <UserCog size={16} />
        <span>You are viewing as another user</span>
      </div>
      <button
        onClick={() => stopMutation.mutate()}
        disabled={stopMutation.isPending}
        className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {stopMutation.isPending ? (
          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <ArrowLeft size={13} />
        )}
        Return to Admin
      </button>
    </div>
  );
}

// ─── Run As Button ────────────────────────────────────────────────────────────
function RunAsButton({ userId, userName, userRole, enterprise }: {
  userId: number;
  userName: string;
  userRole?: string | null;
  enterprise?: boolean | null;
}) {
  const impersonateMutation = trpc.admin.impersonate.useMutation({
    onSuccess: (data) => {
      // Redirect to the appropriate dashboard based on user type
      if (data.targetUser.enterprise) {
        window.location.href = "/enterprise";
      } else if (data.targetUser.userRole === "Artist") {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    },
    onError: (err) => {
      alert("Failed to impersonate: " + err.message);
    },
  });

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (confirm(`Run as ${userName}?`)) {
          impersonateMutation.mutate({ userId });
        }
      }}
      disabled={impersonateMutation.isPending}
      title={`Run as ${userName}`}
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-orange-50 text-[#F25722] hover:bg-orange-100 transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {impersonateMutation.isPending ? (
        <div className="w-3 h-3 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" />
      ) : (
        <UserCog size={11} />
      )}
      Run As
    </button>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
      <span>Page {page} of {pages} ({total.toLocaleString()} total)</span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft size={13} /> Back
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Overview ───────────────────────────────────────────────────────
function DashboardSection() {
  const { data: stats, isLoading } = trpc.admin.overview.useQuery();
  const [paymentsPage, setPaymentsPage] = useState(1);
  const LIMIT = 25;
  const { data: paymentsData } = trpc.admin.payments.useQuery({ limit: LIMIT, offset: (paymentsPage - 1) * LIMIT });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#111]">Dashboard ({stats?.totalUsers?.toLocaleString() ?? "—"})</h1>
        <p className="text-sm text-gray-400 mt-0.5">Here are the latest insights</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={fmt$(stats?.totalRevenueCents ?? 0)} icon={<DollarSign size={18} />} />
        <StatCard label="Commission" value={fmt$(stats?.totalCommissionCents ?? 0)} icon={<TrendingUp size={18} />} accent="bg-green-50 text-green-600" />
        <StatCard label="Bookings" value={(stats?.totalBookings ?? 0).toLocaleString()} icon={<BookOpen size={18} />} accent="bg-blue-50 text-blue-600" />
        <StatCard label="Future Revenue" value={fmt$(stats?.futureRevenueCents ?? 0)} icon={<Calendar size={18} />} accent="bg-purple-50 text-purple-600" />
      </div>

      {/* User breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Artists</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total", value: stats?.totalArtists ?? 0 },
              { label: "Basic", value: stats?.basicArtists ?? 0 },
              { label: "Priority", value: "—" },
              { label: "PRO", value: stats?.proArtists ?? 0 },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-black text-[#111]">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Clients</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total", value: stats?.totalClients ?? 0 },
              { label: "Premium", value: stats?.premiumClients ?? 0 },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-black text-[#111]">{s.value.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#111]">Recent Payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {paymentsData?.payments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-[#111] text-xs">
                      {p.clientName || p.clientFirstName ? displayName({ name: p.clientName, firstName: p.clientFirstName, lastName: p.clientLastName }) : p.clientCompanyName || "—"}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">{p.stripeId || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      p.status === "Success" || p.stripeStatus === "succeeded"
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.status || p.stripeStatus || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#111] text-xs">
                    {p.stripeAmount ? fmt$(p.stripeAmount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(p.paymentDate || p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paymentsData && (
          <div className="px-5 py-3">
            <Pagination page={paymentsPage} total={paymentsData.total} limit={LIMIT} onPage={setPaymentsPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Artists Section ──────────────────────────────────────────────────────────
function ArtistsSection() {
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [artistType, setArtistType] = useState("");
  const [state, setState] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDebouncedSearch(search); setDebouncedLocation(locationSearch); setPage(1); }, 400);
    return () => clearTimeout(timer.current);
  }, [search, locationSearch]);

  const { data, isLoading } = trpc.admin.artists.useQuery({
    search: debouncedSearch || undefined,
    locationSearch: debouncedLocation || undefined,
    artistType: artistType || undefined,
    state: state || undefined,
    plan: plan || undefined,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  });

  const ARTIST_TYPES = ["Dance Educator", "Photographer", "Dance Adjudicator", "Videographer", "Acting Coach", "Vocal Coach", "Side Jobs", "Music Teacher"];
  const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">All Artists ({data?.total?.toLocaleString() ?? "…"})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={artistType} onChange={e => { setArtistType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Artist Type</option>
          {ARTIST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={state} onChange={e => { setState(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">State</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Plan</option>
          <option value="Basic">Basic</option>
          <option value="PRO">PRO</option>
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Artists..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
          <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search Location..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Artist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Types</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.artists.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">No artists found</td></tr>
              ) : data?.artists.map(a => {
                const types = (() => { try { return JSON.parse(a.masterArtistTypes || "[]"); } catch { return []; } })();
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {a.profilePicture ? (
                          <img src={a.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                            {(displayName(a)[0] || "?").toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[#111] text-xs">{displayName(a)}</p>
                          <p className="text-[10px] text-gray-400">{a.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.location || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {types.slice(0, 2).map((t: string) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">{t}</span>
                        ))}
                        {types.length > 2 && <span className="text-[10px] text-gray-400">+{types.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.artswrkPro ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">PRO</span>
                      ) : a.artswrkBasic ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Basic</span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Free</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(a.bubbleCreatedAt || a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <RunAsButton userId={a.id} userName={displayName(a)} userRole="Artist" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clients Section ──────────────────────────────────────────────────────────
function ClientsSection() {
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [hiringCategory, setHiringCategory] = useState("");
  const [state, setState] = useState("");
  const [plan, setPlan] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCompany, setDebouncedCompany] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedCompany(companySearch);
      setDebouncedLocation(locationSearch);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [search, companySearch, locationSearch]);

  const { data, isLoading } = trpc.admin.clients.useQuery({
    search: debouncedSearch || undefined,
    companySearch: debouncedCompany || undefined,
    locationSearch: debouncedLocation || undefined,
    hiringCategory: hiringCategory || undefined,
    state: state || undefined,
    plan: plan || undefined,
    businessType: businessType || undefined,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  });

  const HIRING_CATS = ["Dance Educator", "Photographer", "Dance Adjudicator", "Videographer", "Acting Coach", "Vocal Coach", "Side Jobs", "Music Teacher"];
  const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-[#111]">All Clients ({data?.total?.toLocaleString() ?? "…"})</h1>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={hiringCategory} onChange={e => { setHiringCategory(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Hiring Category</option>
          {HIRING_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={state} onChange={e => { setState(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">State</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Plan</option>
          <option value="Basic">Basic</option>
          <option value="Premium">Premium</option>
        </select>
        <select value={businessType} onChange={e => { setBusinessType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Business?</option>
          <option value="Business">Business</option>
          <option value="Individual">Individual</option>
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Clients..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Building2 size={13} className="text-gray-400 flex-shrink-0" />
          <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Search Company..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
          <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search Location..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.clients.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-xs">No clients found</td></tr>
              ) : data?.clients.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {c.profilePicture ? (
                        <img src={c.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                          {(displayName(c)[0] || "?").toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#111] text-xs">{displayName(c)}</p>
                        <p className="text-[10px] text-gray-400">{c.email || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{c.clientCompanyName || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.location || "—"}</td>
                  <td className="px-4 py-3">
                    {c.clientPremium ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Premium</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Basic</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.businessOrIndividual || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.bubbleCreatedAt || c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <RunAsButton userId={c.id} userName={displayName(c)} userRole="Client" enterprise={(c as any).enterprise} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Jobs Section ─────────────────────────────────────────────────────────────
function JobsSection() {
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCompany, setDebouncedCompany] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedCompany(companySearch);
      setDebouncedLocation(locationSearch);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [search, companySearch, locationSearch]);

  const { data, isLoading } = trpc.admin.jobs.useQuery({
    search: debouncedSearch || undefined,
    companySearch: debouncedCompany || undefined,
    locationSearch: debouncedLocation || undefined,
    status: status || undefined,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  });

  const JOB_STATUSES = ["Active", "Completed", "Lost - No Revenue", "Confirmed", "Deleted by Client", "Submissions Paused", "Pending Payment"];

  const statusColor = (s: string | null | undefined) => {
    if (!s) return "bg-gray-100 text-gray-500";
    if (s === "Active") return "bg-green-50 text-green-600";
    if (s === "Completed") return "bg-blue-50 text-blue-600";
    if (s === "Confirmed") return "bg-purple-50 text-purple-600";
    if (s.includes("Lost") || s.includes("Deleted")) return "bg-red-50 text-red-500";
    return "bg-gray-100 text-gray-500";
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-[#111]">All Jobs ({data?.total?.toLocaleString() ?? "…"})</h1>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Status</option>
          {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Clients..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Building2 size={13} className="text-gray-400 flex-shrink-0" />
          <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Search Company..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
          <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search Location..." className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client / Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Posted</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.jobs.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-xs">No jobs found</td></tr>
              ) : data?.jobs.map(j => (
                <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#111] text-xs">
                      {j.clientName || j.clientFirstName ? displayName({ name: j.clientName, firstName: j.clientFirstName, lastName: j.clientLastName }) : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400">{j.clientCompanyName || j.clientEmail || "—"}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-xs text-gray-700 line-clamp-2">{j.description || "—"}</p>
                    {j.locationAddress && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={9} /> {j.locationAddress}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#111]">
                    {j.openRate ? "Open Rate" : j.clientHourlyRate ? `$${j.clientHourlyRate}/hr` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(j.requestStatus)}`}>
                      {j.requestStatus || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(j.bubbleCreatedAt || j.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bookings Section ─────────────────────────────────────────────────────────
function BookingsSection() {
  const [upcoming, setUpcoming] = useState<boolean | undefined>(true);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const { data, isLoading } = trpc.admin.bookings.useQuery({
    upcoming,
    paymentStatus: paymentStatus || undefined,
    bookingStatus: bookingStatus || undefined,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  });

  const bookingStatusColor = (s: string | null | undefined) => {
    if (s === "Confirmed") return "bg-green-50 text-green-600";
    if (s === "Completed") return "bg-blue-50 text-blue-600";
    if (s === "Cancelled") return "bg-red-50 text-red-500";
    return "bg-gray-100 text-gray-500";
  };
  const paymentStatusColor = (s: string | null | undefined) => {
    if (s === "Paid") return "bg-green-50 text-green-600";
    if (s === "Unpaid") return "bg-orange-50 text-orange-600";
    if (s === "Refunded") return "bg-purple-50 text-purple-600";
    return "bg-gray-100 text-gray-500";
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-[#111]">💰 Bookings ({data?.total?.toLocaleString() ?? "…"})</h1>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {[{ label: "Upcoming", val: true }, { label: "Past", val: false }, { label: "All", val: undefined }].map(opt => (
            <button
              key={opt.label}
              onClick={() => { setUpcoming(opt.val); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                upcoming === opt.val ? "bg-[#111] text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Payment Status</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Paid">Paid</option>
          <option value="Refunded">Refunded</option>
        </select>
        <select value={bookingStatus} onChange={e => { setBookingStatus(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Booking Status</option>
          <option value="Completed">Completed</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Client Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Artist Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Gross Profit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Payment</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.bookings.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">No bookings found</td></tr>
              ) : data?.bookings.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-700 whitespace-nowrap">{fmtDateTime(b.startDate)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#111]">{b.clientRate ? fmt$(b.clientRate * 100) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{b.artistRate ? fmt$(b.artistRate * 100) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-green-600 font-semibold">{b.grossProfit ? fmt$(b.grossProfit * 100) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bookingStatusColor(b.bookingStatus)}`}>
                      {b.bookingStatus || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paymentStatusColor(b.paymentStatus)}`}>
                      {b.paymentStatus || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payments Section ─────────────────────────────────────────────────────────
function PaymentsSection() {
  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const { data, isLoading } = trpc.admin.payments.useQuery({ limit: LIMIT, offset: (page - 1) * LIMIT });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-[#111]">Payments ({data?.total?.toLocaleString() ?? "…"})</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">App Fee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Stripe ID</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.payments.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">No payments found</td></tr>
              ) : data?.payments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#111] text-xs">
                      {p.clientName || p.clientFirstName ? displayName({ name: p.clientName, firstName: p.clientFirstName, lastName: p.clientLastName }) : p.clientCompanyName || "—"}
                    </p>
                    {p.clientCompanyName && (p.clientName || p.clientFirstName) && (
                      <p className="text-[10px] text-gray-400">{p.clientCompanyName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === "Success" || p.stripeStatus === "succeeded"
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.status || p.stripeStatus || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#111]">{p.stripeAmount ? fmt$(p.stripeAmount) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.stripeApplicationFeeAmount ? fmt$(p.stripeApplicationFeeAmount) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(p.paymentDate || p.createdAt)}</td>
                  <td className="px-4 py-3 text-[10px] text-gray-400 font-mono">{p.stripeId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PRO Jobs Section ───────────────────────────────────────────────────────
function ProJobsSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const LIMIT = 50;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.admin.premiumJobs.useQuery({
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });

  // Fetch interested artists for expanded job
  const { data: artistsData, isLoading: artistsLoading } = trpc.admin.premiumJobArtists.useQuery(
    { jobId: expandedId! },
    { enabled: expandedId !== null }
  );

  const statuses = ["Active", "Inactive", "Draft", "Closed"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">
          PRO Jobs
          <span className="ml-2 text-sm font-normal text-gray-400">({data?.total?.toLocaleString() ?? "…"} total)</span>
        </h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FFBC5D]/20 to-[#F25722]/20 border border-[#F25722]/20">
          <Sparkles size={13} className="text-[#F25722]" />
          <span className="text-xs font-semibold text-[#F25722]">Enterprise / PRO Listings</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search company, role, category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#F25722] bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#F25722] bg-white"
        >
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Budget</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Interested</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Remote</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Posted</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.jobs.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-xs">No PRO jobs found</td></tr>
              ) : data?.jobs.map(job => (
                <>
                  <tr
                    key={job.id}
                    className={`border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer ${
                      expandedId === job.id ? "bg-orange-50/40" : ""
                    }`}
                    onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  >
                    {/* Company */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {job.logo ? (
                          <img src={job.logo.startsWith('//') ? `https:${job.logo}` : job.logo}
                            alt={job.company || ''}
                            className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                            {(job.company || 'P')[0]}
                          </div>
                        )}
                        <span className="font-semibold text-[#111] text-xs">{job.company || '—'}</span>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-[#111] max-w-[180px] truncate">{job.serviceType || '—'}</p>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">
                        {job.category || '—'}
                      </span>
                    </td>
                    {/* Budget */}
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate">{job.budget || '—'}</td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        job.status === 'Active' ? 'bg-green-50 text-green-600'
                        : job.status === 'Inactive' || job.status === 'Closed' ? 'bg-red-50 text-red-500'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {job.status || '—'}
                      </span>
                    </td>
                    {/* Interested count */}
                    <td className="px-4 py-3">
                      {(job as any).interestedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722]">
                          <Users size={10} />
                          {(job as any).interestedCount}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    {/* Remote */}
                    <td className="px-4 py-3">
                      {job.workFromAnywhere ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-semibold">
                          <Globe size={10} /> Remote
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">On-site</span>
                      )}
                    </td>
                    {/* Posted date */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(job.createdAt)}</td>
                  </tr>

                  {/* Expanded: interested artists */}
                  {expandedId === job.id && (
                    <tr key={`${job.id}-expanded`} className="bg-orange-50/20">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#111]">Interested Artists ({(job as any).interestedCount ?? 0})</p>
                            {job.applyEmail && (
                              <a href={`mailto:${job.applyEmail}`} className="text-[10px] text-[#F25722] hover:underline flex items-center gap-1">
                                <ExternalLink size={10} /> {job.applyEmail}
                              </a>
                            )}
                          </div>
                          {artistsLoading ? (
                            <p className="text-xs text-gray-400">Loading artists…</p>
                          ) : !artistsData || artistsData.length === 0 ? (
                            <p className="text-xs text-gray-400">No interested artists recorded yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {(artistsData as any[]).map((a: any) => (
                                <div key={a.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100 shadow-sm">
                                  {a.artistProfilePicture ? (
                                    <img src={a.artistProfilePicture} alt={a.artistName || ''}
                                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                      onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ec008c] to-[#ff7171] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                                      {(a.artistFirstName || a.artistName || '?')[0]}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-semibold text-[#111]">
                                      {a.artistFirstName && a.artistLastName
                                        ? `${a.artistFirstName} ${a.artistLastName}`
                                        : a.artistName || 'Unknown'}
                                    </p>
                                    {a.artistLocation && (
                                      <p className="text-[10px] text-gray-400">{a.artistLocation}</p>
                                    )}
                                  </div>
                                  {a.artswrkPro && (
                                    <span className="text-[9px] font-black text-[#F25722] bg-orange-50 px-1.5 py-0.5 rounded-full">PRO</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Description preview */}
                          {job.description && (
                            <details className="mt-2">
                              <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">View description</summary>
                              <p className="mt-2 text-xs text-gray-600 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                                {job.description.replace(/\[.*?\]/g, '').substring(0, 600)}{job.description.length > 600 ? '…' : ''}
                              </p>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Section (password tool) ────────────────────────────────────────
function SettingsSection({ user }: { user: { email?: string | null } }) {
  const [searchEmail, setSearchEmail] = useState("");
  const [queriedEmail, setQueriedEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isTemporary, setIsTemporary] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const userQuery = trpc.artswrkUsers.getByEmail.useQuery({ email: queriedEmail! }, { enabled: !!queriedEmail });
  const setPasswordMutation = trpc.admin.setPassword.useMutation({
    onSuccess: (data) => { setSuccessMsg(data.message); setNewPassword(""); setConfirmPassword(""); setErrorMsg(""); },
    onError: (err) => { setErrorMsg(err.message || "Failed to set password."); setSuccessMsg(""); },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(""); setErrorMsg("");
    setQueriedEmail(searchEmail.trim().toLowerCase());
  }
  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(""); setErrorMsg("");
    if (newPassword !== confirmPassword) { setErrorMsg("Passwords do not match."); return; }
    if (newPassword.length < 6) { setErrorMsg("Password must be at least 6 characters."); return; }
    setPasswordMutation.mutate({ email: queriedEmail!, password: newPassword, isTemporary });
  }

  const foundUser = userQuery.data;

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-2xl font-black text-[#111]">Settings</h1>
      <p className="text-sm text-gray-400">Logged in as <strong>{user.email}</strong></p>

      {/* Set Password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2"><Search size={15} className="text-[#F25722]" /> Find User</h2>
        <p className="text-xs text-gray-400 mb-4">Enter the email address of the account you want to manage.</p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input type="email" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="user@example.com" required className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hirer-grad-bg hover:opacity-90 transition-opacity whitespace-nowrap">Look Up</button>
        </form>

        {queriedEmail && userQuery.isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-4"><div className="w-4 h-4 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin" /> Looking up user...</div>
        )}
        {queriedEmail && userQuery.isSuccess && !foundUser && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3 mt-4"><AlertCircle size={14} /> No user found with email <strong>{queriedEmail}</strong></div>
        )}
        {foundUser && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-start gap-3 mt-4">
            <div className="w-9 h-9 rounded-full hirer-grad-bg flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5">
              {((foundUser.firstName || foundUser.name || "?")[0]).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-[#111]">{foundUser.firstName && foundUser.lastName ? `${foundUser.firstName} ${foundUser.lastName}` : foundUser.name || foundUser.email}</p>
              <p className="text-xs text-gray-500">{foundUser.email}</p>
              {foundUser.clientCompanyName && <p className="text-xs text-gray-400">{foundUser.clientCompanyName}</p>}
            </div>
          </div>
        )}
      </div>

      {foundUser && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2"><Key size={15} className="text-[#F25722]" /> Set Password</h2>
          <p className="text-xs text-gray-400 mb-4">Set a password for <strong>{foundUser.email}</strong>.</p>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all pr-11" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
              <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <input type="checkbox" id="isTemporary" checked={isTemporary} onChange={e => setIsTemporary(e.target.checked)} className="w-4 h-4 rounded accent-[#F25722]" />
              <label htmlFor="isTemporary" className="text-xs text-gray-600 cursor-pointer"><span className="font-semibold text-[#111]">Mark as temporary</span> — user will be prompted to change it on next login</label>
            </div>
            {errorMsg && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600"><AlertCircle size={14} className="flex-shrink-0" />{errorMsg}</div>}
            {successMsg && <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-green-700"><CheckCircle2 size={14} className="flex-shrink-0" />{successMsg}</div>}
            <button type="submit" disabled={setPasswordMutation.isPending} className="w-full py-3.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60">
              {setPasswordMutation.isPending ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Setting Password...</> : <><Key size={15} />Set Password for {foundUser.firstName || foundUser.email?.split("@")[0]}</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-6 h-6 border-2 border-[#F25722]/40 border-t-[#F25722] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <Shield size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">You must be logged in to access this page.</p>
          <Link href="/login">
            <button className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hirer-grad-bg">Go to Login</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f8f8]">
      <ImpersonationBanner />
      <Sidebar active={section} onSelect={setSection} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {section === "dashboard" && <DashboardSection />}
          {section === "artists" && <ArtistsSection />}
          {section === "clients" && <ClientsSection />}
          {section === "jobs" && <JobsSection />}
          {section === "pro-jobs" && <ProJobsSection />}
          {section === "bookings" && <BookingsSection />}
          {section === "payments" && <PaymentsSection />}
          {section === "settings" && <SettingsSection user={user} />}
        </div>
      </main>
    </div>
  );
}
