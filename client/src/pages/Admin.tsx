/*
 * ARTSWRK ADMIN DASHBOARD — /admin
 * Mirrors the Bubble admin structure:
 * Dashboard | Artists | Clients | Jobs | Bookings | Payments | Settings
 *
 * Protected: only accessible when logged in as admin or owner.
 */

import { useState, useEffect, useRef, type MutableRefObject } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard, Users, Briefcase, BookOpen, CreditCard, Settings,
  Search, Shield, ChevronLeft, ChevronRight, Menu, X, TrendingUp,
  DollarSign, Calendar, Star, UserCheck, Building2, Key,
  AlertCircle, CheckCircle2, Eye, EyeOff, LogOut, Filter,
  MapPin, Clock, ArrowUpRight, UserCog, ArrowLeft, Sparkles, Globe, ExternalLink, Megaphone,
  Plus, Edit2, Mail, ChevronDown, ToggleLeft, ToggleRight, Instagram, Link as LinkIcon, Send,
} from "lucide-react";
import AcquisitionSection from "./admin/Acquisition";
import { ADMIN_SESSION_COOKIE_NAME, IMPERSONATION_MARKER_COOKIE } from "@shared/const";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminSection = "dashboard" | "artists" | "clients" | "jobs" | "pro-jobs" | "enterprise-clients" | "bookings" | "payments" | "subscriptions" | "acquisition" | "settings";

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
  { id: "enterprise-clients", label: "Enterprise Clients", icon: <Building2 size={16} /> },
  { id: "bookings", label: "Bookings", icon: <BookOpen size={16} /> },
  { id: "payments", label: "Payments", icon: <CreditCard size={16} /> },
  { id: "subscriptions", label: "Subscriptions", icon: <TrendingUp size={16} /> },
  { id: "acquisition", label: "Acquisition", icon: <Megaphone size={16} /> },
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

      {/* Bottom: links to other dashboards */}
      {!collapsed && (
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link href="/leads">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowUpRight size={13} />
              Leads Dashboard
            </button>
          </Link>
          <Link href="/app">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowUpRight size={13} />
              App Dashboard
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-3 min-w-0 overflow-hidden">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accent || "bg-orange-50 text-[#F25722]"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
        <p className="text-lg font-black text-[#111] leading-tight break-words">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>}
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
    const hasMarker = cookies.some(c => c.startsWith(IMPERSONATION_MARKER_COOKIE + "="));
    setIsImpersonating(hasMarker);
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
        window.location.href = "/app";
      } else {
        window.location.href = "/app";
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
        <StatCard label="Revenue" value={fmt$(stats?.totalRevenueCents ?? 0)} sub="Synced payments only" icon={<DollarSign size={18} />} />
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

// ─── Artist constants ─────────────────────────────────────────────────────────
const MASTER_ARTIST_TYPES = [
  "Dance Teacher", "Choreographer", "Substitute Teacher", "Competition Coach",
  "Yoga Instructor", "Pilates Instructor", "Fitness Instructor", "Vocal Coach",
  "Music Teacher", "Photographer", "Videographer", "Event Performer",
  "Dance Educator", "Dance Adjudicator", "Acting Coach", "Side Jobs",
];
const ARTIST_SERVICES = [
  "Private Lessons", "Group Classes", "Workshops", "Masterclasses",
  "Audition Coaching", "Competition Prep", "Choreography", "Performance",
  "Adjudication", "Photography", "Videography", "Event Coverage",
];
const MASTER_STYLES = [
  "Ballet", "Contemporary", "Jazz", "Hip Hop", "Tap", "Lyrical", "Modern",
  "Ballroom", "Latin", "Salsa", "Swing", "Breakdancing", "Acrobatics",
  "Musical Theatre", "Commercial", "K-Pop", "Afrobeats",
];

// ─── Multi-select chip picker ─────────────────────────────────────────────────
function ChipPicker({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(o)
                ? "bg-[#F25722] border-[#F25722] text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Artist Form ────────────────────────────────────────────────────────
function AdminArtistForm({
  initial,
  onSave,
  onCancel,
  isCreate,
}: {
  initial?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isCreate?: boolean;
}) {
  const parseArr = (v?: string | null) => { try { return JSON.parse(v || "[]") as string[]; } catch { return []; } };

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [pronouns, setPronouns] = useState(initial?.pronouns ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [profilePicture, setProfilePicture] = useState(initial?.profilePicture ?? "");
  const [types, setTypes] = useState<string[]>(parseArr(initial?.masterArtistTypes));
  const [services, setServices] = useState<string[]>(parseArr(initial?.artistServices));
  const [styles, setStyles] = useState<string[]>(parseArr(initial?.masterStyles));
  const [artswrkPro, setArtswrkPro] = useState<boolean>(!!initial?.artswrkPro);
  const [artswrkBasic, setArtswrkBasic] = useState<boolean>(!!initial?.artswrkBasic);
  const [sendWelcome, setSendWelcome] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      firstName, lastName, email, pronouns, location, bio, website,
      instagram, tagline, profilePicture, masterArtistTypes: types,
      artistServices: services, masterStyles: styles, artswrkPro, artswrkBasic,
      ...(isCreate ? { password: password || undefined, sendWelcomeEmail: sendWelcome } : {}),
    });
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#F25722] transition-colors bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Basic Info</h3>

        {/* Profile picture URL */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0 overflow-hidden">
            {profilePicture ? (
              <img src={profilePicture} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <span>{(firstName[0] || "?").toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1">
            <label className={labelCls}>Profile Picture URL</label>
            <input value={profilePicture} onChange={e => setProfilePicture(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Last Name *</label>
            <input required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Email *</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className={inputCls} />
        </div>

        {isCreate && (
          <div>
            <label className={labelCls}>Password (optional — leave blank to set later)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className={inputCls} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Pronouns</label>
            <input value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="She/her" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="New York, NY" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Tagline</label>
          <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Short one-liner that appears on their profile" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell their story…" rows={4} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Specialties */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Specialties</h3>
        <ChipPicker label="Artist Types" options={MASTER_ARTIST_TYPES} selected={types} onChange={setTypes} />
        <ChipPicker label="Services" options={ARTIST_SERVICES} selected={services} onChange={setServices} />
        <ChipPicker label="Styles" options={MASTER_STYLES} selected={styles} onChange={setStyles} />
      </div>

      {/* Social & Web */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Social & Web</h3>
        <div>
          <label className={labelCls}>Website</label>
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://janedoe.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Instagram handle</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input value={instagram} onChange={e => setInstagram(e.target.value.replace("@", ""))} placeholder="janedoe" className={`${inputCls} pl-8`} />
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Plan</h3>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setArtswrkBasic(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${artswrkBasic ? "bg-blue-500" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${artswrkBasic ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm font-medium text-[#111]">Basic</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setArtswrkPro(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${artswrkPro ? "bg-amber-500" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${artswrkPro ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm font-medium text-[#111]">PRO</span>
          </label>
        </div>
      </div>

      {/* Welcome email (create only) */}
      {isCreate && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-[#111]">Send welcome email</p>
              <p className="text-xs text-gray-400 mt-0.5">Sends the Artswrk welcome email to this artist after creation</p>
            </div>
            <button type="button" onClick={() => setSendWelcome(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${sendWelcome ? "bg-[#F25722]" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sendWelcome ? "translate-x-4" : ""}`} />
            </button>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
          {isCreate ? "Create Artist" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Artist Applications Tab ──────────────────────────────────────────────────
function ArtistApplicationsTab({ artistId }: { artistId: number }) {
  const { data: apps, isLoading } = trpc.admin.artistApplications.useQuery({ artistId });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!apps || apps.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <Briefcase size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-sm">No applications yet</p>
    </div>
  );

  const statusColor = (s: string | null) => {
    if (!s) return "bg-gray-100 text-gray-500";
    if (s === "Confirmed") return "bg-green-50 text-green-600";
    if (s === "Declined") return "bg-red-50 text-red-500";
    return "bg-blue-50 text-blue-600";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-400 font-medium">{apps.length} application{apps.length !== 1 ? "s" : ""}</p>
      </div>
      {apps.map((a: any) => (
        <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {a.clientProfilePicture ? (
                <img src={a.clientProfilePicture} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <Building2 size={14} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111] truncate">{a.clientCompanyName || "Unknown Client"}</p>
                {a.description && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{a.description}</p>
                )}
              </div>
            </div>
            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(a.status)}`}>
              {a.status || "Interested"}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-400">
            {a.locationAddress && <span className="flex items-center gap-1"><MapPin size={10} />{a.locationAddress}</span>}
            {a.startDate && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(a.startDate)}</span>}
            {a.hiringCategory && <span className="flex items-center gap-1"><Star size={10} />{a.hiringCategory}</span>}
            {(a.artistHourlyRate || a.jobArtistRate) && (
              <span className="flex items-center gap-1"><DollarSign size={10} />${a.artistHourlyRate ?? a.jobArtistRate}/hr</span>
            )}
            <span className="ml-auto">{fmtDate(a.bubbleCreatedAt || a.createdAt)}</span>
          </div>
          {a.converted && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-green-600">
              <CheckCircle2 size={11} /> Converted to booking
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Artist Bookings & Earnings Tab ──────────────────────────────────────────
function ArtistBookingsTab({ artistId }: { artistId: number }) {
  const { data, isLoading } = trpc.admin.artistBookings.useQuery({ artistId });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;

  const bookings = data?.bookings ?? [];
  const totalEarnings = data?.totalEarningsCents ?? 0;
  const completedCount = data?.completedCount ?? 0;
  const totalBookings = bookings.length;

  if (totalBookings === 0) return (
    <div className="text-center py-16 text-gray-400">
      <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-sm">No bookings yet</p>
    </div>
  );

  const statusColor = (s: string | null) => {
    if (!s) return "bg-gray-100 text-gray-500";
    if (s === "Completed") return "bg-green-50 text-green-600";
    if (s === "Confirmed") return "bg-blue-50 text-blue-600";
    if (s === "Cancelled") return "bg-red-50 text-red-500";
    return "bg-amber-50 text-amber-600";
  };

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-[#111]">{totalBookings}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Bookings</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-green-600">{completedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Completed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-[#F25722]">{fmt$(totalEarnings)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Earned</p>
        </div>
      </div>

      {/* Bookings list */}
      <div className="space-y-3">
        {bookings.map((b: any) => {
          const artistEarning = b.totalArtistRate ?? b.artistRate;
          return (
            <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {b.clientProfilePicture ? (
                    <img src={b.clientProfilePicture} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <Building2 size={14} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111] truncate">{b.clientCompanyName || "Unknown Client"}</p>
                    {b.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{b.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(b.bookingStatus)}`}>
                    {b.bookingStatus || "—"}
                  </span>
                  {artistEarning ? (
                    <span className="text-xs font-bold text-[#111]">{fmt$(Number(artistEarning))}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-400">
                {b.startDate && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(b.startDate)}</span>}
                {b.locationAddress && <span className="flex items-center gap-1"><MapPin size={10} />{b.locationAddress}</span>}
                {b.hours && <span className="flex items-center gap-1"><Clock size={10} />{b.hours}h</span>}
                {b.paymentStatus && (
                  <span className={`flex items-center gap-1 font-medium ${b.paymentStatus === "Paid" ? "text-green-500" : "text-amber-500"}`}>
                    <CreditCard size={10} />{b.paymentStatus}
                  </span>
                )}
                {b.externalPayment && <span className="text-gray-400">External payment</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin Artist Detail ──────────────────────────────────────────────────────
function AdminArtistDetail({ artistId, onBack, onEdit }: { artistId: number; onBack: () => void; onEdit: () => void }) {
  const { data: artist, isLoading } = trpc.admin.getArtist.useQuery({ id: artistId });
  const [tab, setTab] = useState<"overview" | "applications" | "bookings">("overview");
  const sendWelcome = trpc.admin.sendWelcomeEmail.useMutation({
    onSuccess: () => alert("Welcome email sent!"),
    onError: (e) => alert("Failed: " + e.message),
  });

  const parseArr = (v?: string | null) => { try { return JSON.parse(v || "[]") as string[]; } catch { return []; } };

  if (isLoading) return (
    <div className="flex justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" />
    </div>
  );
  if (!artist) return <div className="text-center py-24 text-gray-400 text-sm">Artist not found</div>;

  const name = displayName(artist);
  const types = parseArr(artist.masterArtistTypes);
  const services = parseArr(artist.artistServices);
  const styles = parseArr(artist.masterStyles);

  const TABS = [
    { id: "overview" as const, label: "Overview" },
    { id: "applications" as const, label: "Applications" },
    { id: "bookings" as const, label: "Bookings & Earnings" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
          <ChevronLeft size={14} /> Artists
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">{name}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            {artist.profilePicture ? (
              <img src={artist.profilePicture} alt={name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
                {(name[0] || "?").toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-2xl font-black text-[#111]">{name}</h2>
                {artist.artswrkPro && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">PRO</span>}
                {artist.artswrkBasic && !artist.artswrkPro && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Basic</span>}
                {artist.priorityList && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Featured</span>}
              </div>
              {artist.tagline && <p className="text-sm text-gray-500 mb-1">{artist.tagline}</p>}
              <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                {artist.email && <span className="flex items-center gap-1"><Mail size={11} />{artist.email}</span>}
                {artist.location && <span className="flex items-center gap-1"><MapPin size={11} />{artist.location}</span>}
                {artist.pronouns && <span>{artist.pronouns}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => sendWelcome.mutate({ artistId })}
              disabled={sendWelcome.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Send size={13} />
              {sendWelcome.isPending ? "Sending…" : "Send Welcome"}
            </button>
            <RunAsButton userId={artist.id} userName={name} userRole="Artist" />
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[#F25722] text-white hover:opacity-90 transition-opacity"
            >
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-[#F25722] text-[#F25722]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {artist.bio && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bio</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{artist.bio}</p>
              </div>
            )}
            {(types.length > 0 || services.length > 0 || styles.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Specialties</p>
                {types.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Artist Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {types.map((t: string) => <span key={t} className="px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-medium">{t}</span>)}
                    </div>
                  </div>
                )}
                {services.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((s: string) => <span key={s} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{s}</span>)}
                    </div>
                  </div>
                )}
                {styles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Styles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {styles.map((s: string) => <span key={s} className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-medium">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Details</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">ID</span>
                  <span className="font-mono text-xs text-gray-600">{artist.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Joined</span>
                  <span className="text-xs text-gray-600">{fmtDate(artist.bubbleCreatedAt || artist.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Plan</span>
                  <span className="text-xs font-semibold">{artist.artswrkPro ? "PRO" : artist.artswrkBasic ? "Basic" : "Free"}</span>
                </div>
                {artist.slug && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">Slug</span>
                    <span className="text-xs text-gray-600 font-mono">@{artist.slug}</span>
                  </div>
                )}
                {!!artist.bookingCount && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">Bookings</span>
                    <span className="text-xs text-gray-600">{artist.bookingCount}</span>
                  </div>
                )}
              </div>
            </div>
            {(artist.website || artist.instagram) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Links</p>
                <div className="space-y-2">
                  {artist.website && (
                    <a href={artist.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#F25722] hover:underline">
                      <Globe size={12} /> {artist.website}
                    </a>
                  )}
                  {artist.instagram && (
                    <a href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#F25722] hover:underline">
                      <Instagram size={12} /> @{artist.instagram}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "applications" && <ArtistApplicationsTab artistId={artistId} />}
      {tab === "bookings" && <ArtistBookingsTab artistId={artistId} />}
    </div>
  );
}

// ─── Artists Section ──────────────────────────────────────────────────────────
function ArtistsSection() {
  type View = { mode: "list" } | { mode: "detail"; id: number } | { mode: "edit"; id: number } | { mode: "create" };
  const [view, setView] = useState<View>({ mode: "list" });

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
  }, { enabled: view.mode === "list" });

  const utils = trpc.useUtils();

  const updateArtist = trpc.admin.updateArtist.useMutation({
    onSuccess: (updated) => {
      utils.admin.getArtist.invalidate({ id: (view as any).id });
      utils.admin.artists.invalidate();
      if (updated) setView({ mode: "detail", id: updated.id });
    },
    onError: (e) => alert("Save failed: " + e.message),
  });

  const createArtist = trpc.admin.createArtist.useMutation({
    onSuccess: (created) => {
      utils.admin.artists.invalidate();
      if (created) setView({ mode: "detail", id: created.id });
    },
    onError: (e) => alert("Create failed: " + e.message),
  });

  const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

  // ── Sub-views ──────────────────────────────────────────────────────────────
  if (view.mode === "detail") {
    return (
      <AdminArtistDetail
        artistId={view.id}
        onBack={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "edit", id: view.id })}
      />
    );
  }

  if (view.mode === "edit") {
    const id = view.id;
    return (
      <AdminArtistEditWrapper
        artistId={id}
        onBack={() => setView({ mode: "detail", id })}
        onSave={(data: any) => updateArtist.mutate({ id, ...data })}
        isSaving={updateArtist.isPending}
      />
    );
  }

  if (view.mode === "create") {
    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setView({ mode: "list" })} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
            <ChevronLeft size={14} /> Artists
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-[#111] font-semibold">Create Artist</span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#111]">Create Artist</h1>
          <p className="text-sm text-gray-400 mt-0.5">Add a new artist to the platform</p>
        </div>
        <AdminArtistForm
          isCreate
          onCancel={() => setView({ mode: "list" })}
          onSave={(data: any) => createArtist.mutate(data)}
        />
        {createArtist.isPending && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-[#F25722] rounded-full animate-spin" />
            Creating artist…
          </div>
        )}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">All Artists ({data?.total?.toLocaleString() ?? "…"})</h1>
        <button
          onClick={() => setView({ mode: "create" })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> Create Artist
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={artistType} onChange={e => { setArtistType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Artist Type</option>
          {MASTER_ARTIST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
                  <tr
                    key={a.id}
                    className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer"
                    onClick={() => setView({ mode: "detail", id: a.id })}
                  >
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
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setView({ mode: "detail", id: a.id })}
                          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Eye size={11} /> View
                        </button>
                        <RunAsButton userId={a.id} userName={displayName(a)} userRole="Artist" />
                      </div>
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

// ─── Edit wrapper (loads artist then renders form) ────────────────────────────
function AdminArtistEditWrapper({ artistId, onBack, onSave, isSaving }: {
  artistId: number;
  onBack: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const { data: artist, isLoading } = trpc.admin.getArtist.useQuery({ id: artistId });

  if (isLoading) return (
    <div className="flex justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" />
    </div>
  );
  if (!artist) return <div className="text-center py-24 text-gray-400 text-sm">Artist not found</div>;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
          <ChevronLeft size={14} /> {displayName(artist)}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">Edit</span>
      </div>
      <div>
        <h1 className="text-2xl font-black text-[#111]">Edit Artist</h1>
        <p className="text-sm text-gray-400 mt-0.5">{displayName(artist)} · {artist.email}</p>
      </div>
      <AdminArtistForm initial={artist} onCancel={onBack} onSave={onSave} />
      {isSaving && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[#F25722] rounded-full animate-spin" />
          Saving…
        </div>
      )}
    </div>
  );
}

// ─── Client constants ─────────────────────────────────────────────────────────
const HIRING_CATEGORIES = [
  "Dance Educator", "Choreographer", "Photographer", "Videographer",
  "Dance Adjudicator", "Acting Coach", "Vocal Coach", "Music Teacher",
  "Fitness Instructor", "Event Performer", "Competition Coach",
];

// ─── Admin Client Form ────────────────────────────────────────────────────────
function AdminClientForm({
  initial,
  onSave,
  onCancel,
  isCreate,
}: {
  initial?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isCreate?: boolean;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [clientCompanyName, setClientCompanyName] = useState(initial?.clientCompanyName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [profilePicture, setProfilePicture] = useState(initial?.profilePicture ?? "");
  const [businessOrIndividual, setBusinessOrIndividual] = useState(initial?.businessOrIndividual ?? "");
  const [hiringCategory, setHiringCategory] = useState(initial?.hiringCategory ?? "");
  const [clientPremium, setClientPremium] = useState<boolean>(!!initial?.clientPremium);
  const [enterprise, setEnterprise] = useState<boolean>(!!initial?.enterprise);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      firstName, lastName, email, clientCompanyName, location, website,
      instagram, profilePicture, businessOrIndividual, hiringCategory,
      clientPremium, enterprise,
      ...(isCreate ? { password: password || undefined } : {}),
    });
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#F25722] transition-colors bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Basic Info</h3>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0 overflow-hidden">
            {profilePicture ? (
              <img src={profilePicture} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <span>{(firstName[0] || "?").toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1">
            <label className={labelCls}>Profile Picture URL</label>
            <input value={profilePicture} onChange={e => setProfilePicture(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Last Name *</label>
            <input required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Email *</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" className={inputCls} />
        </div>

        {isCreate && (
          <div>
            <label className={labelCls}>Password (optional — leave blank to set later)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className={inputCls} />
          </div>
        )}

        <div>
          <label className={labelCls}>Company Name</label>
          <input value={clientCompanyName} onChange={e => setClientCompanyName(e.target.value)} placeholder="Acme Dance Studio" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="New York, NY" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Business or Individual</label>
            <select value={businessOrIndividual} onChange={e => setBusinessOrIndividual(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              <option value="Business">Business</option>
              <option value="Individual">Individual</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Primary Hiring Category</label>
          <select value={hiringCategory} onChange={e => setHiringCategory(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {HIRING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Social & Web */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Social & Web</h3>
        <div>
          <label className={labelCls}>Website</label>
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://company.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Instagram handle</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input value={instagram} onChange={e => setInstagram(e.target.value.replace("@", ""))} placeholder="company" className={`${inputCls} pl-8`} />
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Plan & Access</h3>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setClientPremium(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${clientPremium ? "bg-amber-500" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${clientPremium ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm font-medium text-[#111]">Premium</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setEnterprise(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${enterprise ? "bg-purple-500" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enterprise ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm font-medium text-[#111]">Enterprise</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
          {isCreate ? "Create Client" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Client Edit Wrapper ──────────────────────────────────────────────────────
function AdminClientEditWrapper({ clientId, onBack, onSave, isSaving }: {
  clientId: number;
  onBack: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const { data: client, isLoading } = trpc.admin.getClient.useQuery({ id: clientId });
  if (isLoading) return <div className="flex justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!client) return <div className="text-center py-24 text-gray-400 text-sm">Client not found</div>;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
          <ChevronLeft size={14} /> {displayName(client)}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">Edit</span>
      </div>
      <div>
        <h1 className="text-2xl font-black text-[#111]">Edit Client</h1>
        <p className="text-sm text-gray-400 mt-0.5">{displayName(client)} · {client.email}</p>
      </div>
      <AdminClientForm initial={client} onCancel={onBack} onSave={onSave} />
      {isSaving && <div className="flex items-center gap-2 text-sm text-gray-500"><div className="w-4 h-4 border-2 border-gray-300 border-t-[#F25722] rounded-full animate-spin" />Saving…</div>}
    </div>
  );
}

// ─── Client Jobs Tab ──────────────────────────────────────────────────────────
function ClientJobsTab({ clientId }: { clientId: number }) {
  const { data: jobs, isLoading } = trpc.admin.clientJobs.useQuery({ clientId });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!jobs || jobs.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <Briefcase size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-sm">No jobs posted yet</p>
    </div>
  );

  const statusColor = (s: string | null) => {
    if (!s) return "bg-gray-100 text-gray-500";
    if (s === "Active") return "bg-green-50 text-green-600";
    if (s === "Completed") return "bg-blue-50 text-blue-600";
    if (s === "Confirmed") return "bg-purple-50 text-purple-600";
    if (s.includes("Lost") || s.includes("Deleted")) return "bg-red-50 text-red-500";
    return "bg-gray-100 text-gray-500";
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 font-medium">{jobs.length} job{jobs.length !== 1 ? "s" : ""} posted</p>
      {jobs.map((j: any) => (
        <div key={j.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111] line-clamp-1">{j.description || "Untitled job"}</p>
              {j.hiringCategory && <p className="text-xs text-gray-500 mt-0.5">{j.hiringCategory}</p>}
            </div>
            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(j.requestStatus)}`}>
              {j.requestStatus || "—"}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-400">
            {j.locationAddress && <span className="flex items-center gap-1"><MapPin size={10} />{j.locationAddress}</span>}
            {j.startDate && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(j.startDate)}</span>}
            {j.artistHourlyRate && <span className="flex items-center gap-1"><DollarSign size={10} />${j.artistHourlyRate}/hr artist</span>}
            <span className="flex items-center gap-1"><Users size={10} />{Number(j.applicantCount)} applicant{Number(j.applicantCount) !== 1 ? "s" : ""}</span>
            {Number(j.bookingCount) > 0 && (
              <span className="flex items-center gap-1 text-green-500 font-medium"><CheckCircle2 size={10} />{Number(j.bookingCount)} booked</span>
            )}
            <span className="ml-auto">{fmtDate(j.bubbleCreatedAt || j.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Client Bookings & Spend Tab ──────────────────────────────────────────────
function ClientBookingsTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = trpc.admin.clientBookings.useQuery({ clientId });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;

  const bookings = data?.bookings ?? [];
  const totalSpend = data?.totalSpendCents ?? 0;
  const completedCount = data?.completedCount ?? 0;

  if (bookings.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-sm">No bookings yet</p>
    </div>
  );

  const statusColor = (s: string | null) => {
    if (!s) return "bg-gray-100 text-gray-500";
    if (s === "Completed") return "bg-green-50 text-green-600";
    if (s === "Confirmed") return "bg-blue-50 text-blue-600";
    if (s === "Cancelled") return "bg-red-50 text-red-500";
    return "bg-amber-50 text-amber-600";
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-[#111]">{bookings.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Bookings</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-green-600">{completedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Completed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-[#F25722]">{fmt$(totalSpend)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Spent</p>
        </div>
      </div>

      <div className="space-y-3">
        {bookings.map((b: any) => {
          const artistName = [b.artistFirstName, b.artistLastName].filter(Boolean).join(" ") || b.artistName || "Unknown Artist";
          const clientCost = b.totalClientRate ?? b.clientRate;
          return (
            <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {b.artistProfilePicture ? (
                    <img src={b.artistProfilePicture} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {(artistName[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111] truncate">{artistName}</p>
                    {b.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{b.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(b.bookingStatus)}`}>{b.bookingStatus || "—"}</span>
                  {clientCost ? <span className="text-xs font-bold text-[#111]">{fmt$(Number(clientCost))}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-400">
                {b.startDate && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(b.startDate)}</span>}
                {b.locationAddress && <span className="flex items-center gap-1"><MapPin size={10} />{b.locationAddress}</span>}
                {b.hours && <span className="flex items-center gap-1"><Clock size={10} />{b.hours}h</span>}
                {b.paymentStatus && (
                  <span className={`flex items-center gap-1 font-medium ${b.paymentStatus === "Paid" ? "text-green-500" : "text-amber-500"}`}>
                    <CreditCard size={10} />{b.paymentStatus}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin Client Detail ──────────────────────────────────────────────────────
function AdminClientDetail({ clientId, onBack, onEdit }: { clientId: number; onBack: () => void; onEdit: () => void }) {
  const { data: client, isLoading } = trpc.admin.getClient.useQuery({ id: clientId });
  const [tab, setTab] = useState<"overview" | "jobs" | "bookings">("overview");

  if (isLoading) return <div className="flex justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!client) return <div className="text-center py-24 text-gray-400 text-sm">Client not found</div>;

  const name = displayName(client);
  const TABS = [
    { id: "overview" as const, label: "Overview" },
    { id: "jobs" as const, label: "Jobs Posted" },
    { id: "bookings" as const, label: "Bookings & Spend" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
          <ChevronLeft size={14} /> Clients
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">{name}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            {client.profilePicture ? (
              <img src={client.profilePicture} alt={name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
                {(name[0] || "?").toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-2xl font-black text-[#111]">{name}</h2>
                {client.enterprise && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Enterprise</span>}
                {client.clientPremium && !client.enterprise && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Premium</span>}
              </div>
              {client.clientCompanyName && <p className="text-sm text-gray-500 mb-1 font-medium">{client.clientCompanyName}</p>}
              <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                {client.email && <span className="flex items-center gap-1"><Mail size={11} />{client.email}</span>}
                {client.location && <span className="flex items-center gap-1"><MapPin size={11} />{client.location}</span>}
                {client.businessOrIndividual && <span>{client.businessOrIndividual}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <RunAsButton userId={client.id} userName={name} userRole="Client" enterprise={client.enterprise} />
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[#F25722] text-white hover:opacity-90 transition-opacity">
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id ? "border-[#F25722] text-[#F25722]" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {client.hiringCategory && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Hiring Focus</p>
                <span className="px-3 py-1.5 rounded-full bg-pink-50 text-pink-600 text-sm font-medium">{client.hiringCategory}</span>
              </div>
            )}
          </div>
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Details</p>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-400 text-xs">ID</span><span className="font-mono text-xs text-gray-600">{client.id}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 text-xs">Joined</span><span className="text-xs text-gray-600">{fmtDate(client.bubbleCreatedAt || client.createdAt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 text-xs">Plan</span><span className="text-xs font-semibold">{client.enterprise ? "Enterprise" : client.clientPremium ? "Premium" : "Basic"}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 text-xs">Type</span><span className="text-xs text-gray-600">{client.businessOrIndividual || "—"}</span></div>
                {client.slug && <div className="flex justify-between"><span className="text-gray-400 text-xs">Slug</span><span className="text-xs font-mono text-gray-600">@{client.slug}</span></div>}
              </div>
            </div>
            {(client.website || client.instagram) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Links</p>
                <div className="space-y-2">
                  {client.website && <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#F25722] hover:underline"><Globe size={12} />{client.website}</a>}
                  {client.instagram && <a href={`https://instagram.com/${client.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#F25722] hover:underline"><Instagram size={12} />@{client.instagram}</a>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "jobs" && <ClientJobsTab clientId={clientId} />}
      {tab === "bookings" && <ClientBookingsTab clientId={clientId} />}
    </div>
  );
}

// ─── Clients Section ──────────────────────────────────────────────────────────
function ClientsSection() {
  type View = { mode: "list" } | { mode: "detail"; id: number } | { mode: "edit"; id: number } | { mode: "create" };
  const [view, setView] = useState<View>({ mode: "list" });

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
  }, { enabled: view.mode === "list" });

  const utils = trpc.useUtils();

  const updateClient = trpc.admin.updateClient.useMutation({
    onSuccess: (updated) => {
      utils.admin.getClient.invalidate({ id: (view as any).id });
      utils.admin.clients.invalidate();
      if (updated) setView({ mode: "detail", id: updated.id });
    },
    onError: (e) => alert("Save failed: " + e.message),
  });

  const createClient = trpc.admin.createClient.useMutation({
    onSuccess: (created) => {
      utils.admin.clients.invalidate();
      if (created) setView({ mode: "detail", id: created.id });
    },
    onError: (e) => alert("Create failed: " + e.message),
  });

  const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

  if (view.mode === "detail") {
    return <AdminClientDetail clientId={view.id} onBack={() => setView({ mode: "list" })} onEdit={() => setView({ mode: "edit", id: view.id })} />;
  }

  if (view.mode === "edit") {
    const id = view.id;
    return <AdminClientEditWrapper clientId={id} onBack={() => setView({ mode: "detail", id })} onSave={(data: any) => updateClient.mutate({ id, ...data })} isSaving={updateClient.isPending} />;
  }

  if (view.mode === "create") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setView({ mode: "list" })} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
            <ChevronLeft size={14} /> Clients
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-[#111] font-semibold">Create Client</span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#111]">Create Client</h1>
          <p className="text-sm text-gray-400 mt-0.5">Add a new client to the platform</p>
        </div>
        <AdminClientForm isCreate onCancel={() => setView({ mode: "list" })} onSave={(data: any) => createClient.mutate(data)} />
        {createClient.isPending && <div className="flex items-center gap-2 text-sm text-gray-500"><div className="w-4 h-4 border-2 border-gray-300 border-t-[#F25722] rounded-full animate-spin" />Creating client…</div>}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">All Clients ({data?.total?.toLocaleString() ?? "…"})</h1>
        <button onClick={() => setView({ mode: "create" })} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
          <Plus size={15} /> Create Client
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={hiringCategory} onChange={e => { setHiringCategory(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Hiring Category</option>
          {HIRING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                <tr
                  key={c.id}
                  className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer"
                  onClick={() => setView({ mode: "detail", id: c.id })}
                >
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
                    {(c as any).enterprise ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Enterprise</span>
                    ) : c.clientPremium ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Premium</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Basic</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.businessOrIndividual || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.bubbleCreatedAt || c.createdAt)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setView({ mode: "detail", id: c.id })} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                        <Eye size={11} /> View
                      </button>
                      <RunAsButton userId={c.id} userName={displayName(c)} userRole="Client" enterprise={(c as any).enterprise} />
                    </div>
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

// ─── Shared helpers ───────────────────────────────────────────────────────────
const jobStatusColor = (s: string | null | undefined) => {
  if (!s) return "bg-gray-100 text-gray-500";
  if (s === "Active") return "bg-green-50 text-green-600";
  if (s === "Completed") return "bg-blue-50 text-blue-600";
  if (s === "Confirmed") return "bg-purple-50 text-purple-600";
  if (s.includes("Lost") || s.includes("Deleted") || s === "Closed" || s === "Inactive") return "bg-red-50 text-red-500";
  return "bg-gray-100 text-gray-500";
};

const appStatusColor = (s: string | null) => {
  if (!s) return "bg-gray-100 text-gray-500";
  if (s === "Confirmed") return "bg-green-50 text-green-600";
  if (s === "Declined") return "bg-red-50 text-red-500";
  return "bg-blue-50 text-blue-600";
};

// ─── Job Applicants Tab ───────────────────────────────────────────────────────
function JobApplicantsTab({ jobId }: { jobId: number }) {
  const { data: apps, isLoading } = trpc.admin.jobApplicants.useQuery({ jobId });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!apps || apps.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <Users size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-sm">No applicants yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 font-medium">{apps.length} applicant{apps.length !== 1 ? "s" : ""}</p>
      {apps.map((a: any) => {
        const name = [a.artistFirstName, a.artistLastName].filter(Boolean).join(" ") || a.artistName || "Unknown Artist";
        const types = (() => { try { return JSON.parse(a.artistDisciplines || "[]").slice(0, 3) as string[]; } catch { return []; } })();
        const profileUrl = a.artistSlug ? `https://artswrk.com/artists/${a.artistSlug}` : null;
        return (
          <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {a.artistProfilePicture ? (
                  <img src={a.artistProfilePicture} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                    {(name[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#111]">{name}</p>
                    {a.artswrkPro && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">PRO</span>}
                  </div>
                  {a.artistLocation && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={9} />{a.artistLocation}</p>}
                </div>
              </div>
              <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${appStatusColor(a.status)}`}>
                {a.status || "Interested"}
              </span>
            </div>
            {types.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {types.map((t: string) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">{t}</span>)}
              </div>
            )}
            {a.message && <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">{a.message}</p>}
            <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-400">
              {(a.artistHourlyRate || a.clientHourlyRate) && <span className="flex items-center gap-1"><DollarSign size={10} />${a.artistHourlyRate ?? a.clientHourlyRate}/hr</span>}
              {a.converted && <span className="flex items-center gap-1 text-green-500 font-medium"><CheckCircle2 size={10} />Converted to booking</span>}
              <span className="ml-auto">{fmtDate(a.bubbleCreatedAt || a.createdAt)}</span>
              {a.resumeLink && <a href={a.resumeLink} target="_blank" rel="noopener noreferrer" className="text-[#F25722] font-semibold hover:underline flex items-center gap-1"><ExternalLink size={10} />Resume</a>}
              {profileUrl && <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-semibold hover:underline flex items-center gap-1"><ExternalLink size={10} />Profile</a>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Job Bookings Tab ─────────────────────────────────────────────────────────
function JobBookingsTab({ jobId }: { jobId: number }) {
  const { data: bookings, isLoading } = trpc.admin.jobBookings.useQuery({ jobId });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!bookings || bookings.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-sm">No bookings for this job</p>
    </div>
  );

  const bkStatusColor = (s: string | null) => {
    if (s === "Completed") return "bg-green-50 text-green-600";
    if (s === "Confirmed") return "bg-blue-50 text-blue-600";
    if (s === "Cancelled") return "bg-red-50 text-red-500";
    return "bg-amber-50 text-amber-600";
  };

  const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (b.bookingStatus === "Completed" ? Number(b.totalClientRate ?? b.clientRate ?? 0) : 0), 0);

  return (
    <div className="space-y-4">
      {totalRevenue > 0 && (
        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <DollarSign size={16} className="text-green-600" />
          <div>
            <p className="text-sm font-bold text-green-800">Revenue from completed bookings: {fmt$(totalRevenue)}</p>
            <p className="text-xs text-green-600">{bookings.filter((b: any) => b.bookingStatus === "Completed").length} of {bookings.length} completed</p>
          </div>
        </div>
      )}
      {bookings.map((b: any) => {
        const name = [b.artistFirstName, b.artistLastName].filter(Boolean).join(" ") || b.artistName || "Unknown";
        return (
          <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {b.artistProfilePicture ? (
                  <img src={b.artistProfilePicture} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xs font-black flex-shrink-0">{(name[0] || "?").toUpperCase()}</div>
                )}
                <p className="text-sm font-semibold text-[#111]">{name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bkStatusColor(b.bookingStatus)}`}>{b.bookingStatus || "—"}</span>
                {(b.totalClientRate || b.clientRate) && <span className="text-xs font-bold text-[#111]">{fmt$(Number(b.totalClientRate ?? b.clientRate))}</span>}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-400">
              {b.startDate && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(b.startDate)}</span>}
              {b.locationAddress && <span className="flex items-center gap-1"><MapPin size={10} />{b.locationAddress}</span>}
              {b.hours && <span className="flex items-center gap-1"><Clock size={10} />{b.hours}h</span>}
              {b.paymentStatus && <span className={`flex items-center gap-1 font-medium ${b.paymentStatus === "Paid" ? "text-green-500" : "text-amber-500"}`}><CreditCard size={10} />{b.paymentStatus}</span>}
              {b.totalArtistRate || b.artistRate ? <span className="text-gray-400">Artist: {fmt$(Number(b.totalArtistRate ?? b.artistRate))}</span> : null}
              {b.grossProfit ? <span className="text-gray-400">Profit: {fmt$(Number(b.grossProfit))}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Admin Job Detail ─────────────────────────────────────────────────────────
function AdminJobDetail({ jobId, onBack, onEdit }: { jobId: number; onBack: () => void; onEdit: () => void }) {
  const { data: job, isLoading } = trpc.admin.getJob.useQuery({ id: jobId });
  const [tab, setTab] = useState<"overview" | "applicants" | "bookings">("overview");

  if (isLoading) return <div className="flex justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!job) return <div className="text-center py-24 text-gray-400 text-sm">Job not found</div>;

  const clientName = job.clientCompanyName || (job.clientFirstName ? displayName({ name: job.clientName, firstName: job.clientFirstName, lastName: job.clientLastName }) : null) || job.clientEmail || "Unknown Client";

  const TABS = [
    { id: "overview" as const, label: "Overview" },
    { id: "applicants" as const, label: "Applicants" },
    { id: "bookings" as const, label: "Bookings" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1"><ChevronLeft size={14} /> Jobs</button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold line-clamp-1 max-w-xs">{job.description?.slice(0, 50) || `Job #${job.id}`}</span>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {job.clientProfilePicture ? (
              <img src={job.clientProfilePicture} alt={clientName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                {(clientName[0] || "?").toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Posted by</p>
              <h2 className="text-xl font-black text-[#111]">{clientName}</h2>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(job.requestStatus)}`}>{job.requestStatus || "—"}</span>
                {job.hiringCategory && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 font-semibold">{job.hiringCategory}</span>}
                {job.locationAddress && <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={10} />{job.locationAddress}</span>}
                {job.startDate && <span className="flex items-center gap-1 text-xs text-gray-400"><Calendar size={10} />{fmtDate(job.startDate)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[#F25722] text-white hover:opacity-90 transition-opacity">
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === t.id ? "border-[#F25722] text-[#F25722]" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {job.description && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
          </div>
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Details</p>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-400 text-xs">Job ID</span><span className="font-mono text-xs text-gray-600">{job.id}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 text-xs">Posted</span><span className="text-xs text-gray-600">{fmtDate(job.bubbleCreatedAt || job.createdAt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400 text-xs">Rate</span><span className="text-xs font-semibold text-[#111]">{job.openRate ? "Open Rate" : job.clientHourlyRate ? `$${job.clientHourlyRate}/hr` : "—"}</span></div>
                {job.artistHourlyRate && <div className="flex justify-between"><span className="text-gray-400 text-xs">Artist Rate</span><span className="text-xs text-gray-600">${job.artistHourlyRate}/hr</span></div>}
                {job.dateType && <div className="flex justify-between"><span className="text-gray-400 text-xs">Date Type</span><span className="text-xs text-gray-600">{job.dateType}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === "applicants" && <JobApplicantsTab jobId={jobId} />}
      {tab === "bookings" && <JobBookingsTab jobId={jobId} />}
    </div>
  );
}

// ─── Admin Job Edit Wrapper ───────────────────────────────────────────────────
function AdminJobEditWrapper({ jobId, onBack, onSave, isSaving }: { jobId: number; onBack: () => void; onSave: (d: any) => void; isSaving: boolean }) {
  const { data: job, isLoading } = trpc.admin.getJob.useQuery({ id: jobId });
  const [description, setDescription] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [hiringCategory, setHiringCategory] = useState("");
  const [clientHourlyRate, setClientHourlyRate] = useState("");
  const [artistHourlyRate, setArtistHourlyRate] = useState("");
  const [openRate, setOpenRate] = useState(false);

  useEffect(() => {
    if (job) {
      setDescription(job.description || "");
      setRequestStatus(job.requestStatus || "");
      setLocationAddress(job.locationAddress || "");
      setHiringCategory(job.hiringCategory || "");
      setClientHourlyRate(job.clientHourlyRate ? String(job.clientHourlyRate) : "");
      setArtistHourlyRate(job.artistHourlyRate ? String(job.artistHourlyRate) : "");
      setOpenRate(!!job.openRate);
    }
  }, [job]);

  if (isLoading) return <div className="flex justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;

  const JOB_STATUSES = ["Active", "Completed", "Lost - No Revenue", "Confirmed", "Deleted by Client", "Submissions Paused", "Pending Payment"];
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#F25722] transition-colors bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1"><ChevronLeft size={14} /> Job</button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">Edit</span>
      </div>
      <h1 className="text-2xl font-black text-[#111]">Edit Job #{jobId}</h1>
      <form onSubmit={e => { e.preventDefault(); onSave({ description, requestStatus, locationAddress, hiringCategory, clientHourlyRate: clientHourlyRate ? Number(clientHourlyRate) : null, artistHourlyRate: artistHourlyRate ? Number(artistHourlyRate) : null, openRate }); }} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className={`${inputCls} resize-none`} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Status</label>
              <select value={requestStatus} onChange={e => setRequestStatus(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Location</label><input value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="City, State" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Hiring Category</label>
            <select value={hiringCategory} onChange={e => setHiringCategory(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {HIRING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Client Rate ($/hr)</label><input type="number" value={clientHourlyRate} onChange={e => setClientHourlyRate(e.target.value)} placeholder="0" className={inputCls} /></div>
            <div><label className={labelCls}>Artist Rate ($/hr)</label><input type="number" value={artistHourlyRate} onChange={e => setArtistHourlyRate(e.target.value)} placeholder="0" className={inputCls} /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setOpenRate(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${openRate ? "bg-[#F25722]" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${openRate ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm font-medium text-[#111]">Open Rate (artist sets own rate)</span>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">Save Changes</button>
        </div>
      </form>
      {isSaving && <div className="flex items-center gap-2 text-sm text-gray-500"><div className="w-4 h-4 border-2 border-gray-300 border-t-[#F25722] rounded-full animate-spin" />Saving…</div>}
    </div>
  );
}

// ─── Jobs Section ─────────────────────────────────────────────────────────────
function JobsSection() {
  type View = { mode: "list" } | { mode: "detail"; id: number } | { mode: "edit"; id: number };
  const [view, setView] = useState<View>({ mode: "list" });

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
    timer.current = setTimeout(() => { setDebouncedSearch(search); setDebouncedCompany(companySearch); setDebouncedLocation(locationSearch); setPage(1); }, 400);
    return () => clearTimeout(timer.current);
  }, [search, companySearch, locationSearch]);

  const { data, isLoading } = trpc.admin.jobs.useQuery({
    search: debouncedSearch || undefined,
    companySearch: debouncedCompany || undefined,
    locationSearch: debouncedLocation || undefined,
    status: status || undefined,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  }, { enabled: view.mode === "list" });

  const utils = trpc.useUtils();
  const updateJob = trpc.admin.updateJob.useMutation({
    onSuccess: (updated) => {
      utils.admin.getJob.invalidate({ id: (view as any).id });
      utils.admin.jobs.invalidate();
      if (updated) setView({ mode: "detail", id: updated.id });
    },
    onError: (e) => alert("Save failed: " + e.message),
  });

  const JOB_STATUSES = ["Active", "Completed", "Lost - No Revenue", "Confirmed", "Deleted by Client", "Submissions Paused", "Pending Payment"];

  if (view.mode === "detail") return <AdminJobDetail jobId={view.id} onBack={() => setView({ mode: "list" })} onEdit={() => setView({ mode: "edit", id: view.id })} />;
  if (view.mode === "edit") {
    const id = view.id;
    return <AdminJobEditWrapper jobId={id} onBack={() => setView({ mode: "detail", id })} onSave={(d) => updateJob.mutate({ id, ...d })} isSaving={updateJob.isPending} />;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-[#111]">All Jobs ({data?.total?.toLocaleString() ?? "…"})</h1>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
          <option value="">Status</option>
          {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Building2 size={13} className="text-gray-400 flex-shrink-0" />
          <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Search company…" className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
          <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search location…" className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client / Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Description</th>
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
                <tr key={j.id} className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer" onClick={() => setView({ mode: "detail", id: j.id })}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#111] text-xs">{j.clientName || j.clientFirstName ? displayName({ name: j.clientName, firstName: j.clientFirstName, lastName: j.clientLastName }) : "—"}</p>
                    <p className="text-[10px] text-gray-400">{j.clientCompanyName || j.clientEmail || "—"}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-xs text-gray-700 line-clamp-2">{j.description || "—"}</p>
                    {j.locationAddress && <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={9} />{j.locationAddress}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#111]">{j.openRate ? "Open Rate" : j.clientHourlyRate ? `$${j.clientHourlyRate}/hr` : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(j.requestStatus)}`}>{j.requestStatus || "—"}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(j.bubbleCreatedAt || j.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="px-5 py-3"><Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} /></div>}
      </div>
    </div>
  );
}

// ─── Shared status helpers (bookings + payments) ──────────────────────────────
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
const stripeStatusColor = (status: string | null | undefined, stripeStatus: string | null | undefined) => {
  if (status === "Success" || stripeStatus === "succeeded") return "bg-green-50 text-green-600";
  if (stripeStatus === "failed") return "bg-red-50 text-red-500";
  return "bg-gray-100 text-gray-500";
};

// ─── Booking: Payments Tab ─────────────────────────────────────────────────────
function BookingPaymentsTab({ bookingId, onViewPayment }: { bookingId: number; onViewPayment: (id: number) => void }) {
  const { data: pmts, isLoading } = trpc.admin.bookingPayments.useQuery({ bookingId });

  if (isLoading) return <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!pmts || (pmts as any[]).length === 0) return (
    <div className="text-center py-12">
      <p className="text-sm text-gray-400">No payments recorded for this booking.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {(pmts as any[]).map((p: any) => (
        <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewPayment(p.id)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stripeStatusColor(p.status, p.stripeStatus)}`}>
                  {p.status || p.stripeStatus || "Unknown"}
                </span>
                {p.stripeCardBrand && <span className="text-[10px] text-gray-400">{p.stripeCardBrand} ···· {p.stripeCardLast4}</span>}
              </div>
              <p className="text-xs text-gray-500">{fmtDate(p.paymentDate || p.createdAt)}</p>
              {p.stripeId && <p className="text-[10px] text-gray-300 font-mono mt-0.5">{p.stripeId}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-[#111]">{p.stripeAmount ? fmt$(p.stripeAmount) : "—"}</p>
              {p.stripeApplicationFeeAmount && (
                <p className="text-[10px] text-gray-400">App fee: {fmt$(p.stripeApplicationFeeAmount)}</p>
              )}
            </div>
          </div>
          {p.stripeReceiptUrl && (
            <a href={p.stripeReceiptUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
              onClick={e => e.stopPropagation()}>
              <ExternalLink size={11} /> View receipt
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Booking: Detail Page ──────────────────────────────────────────────────────
function AdminBookingDetail({ bookingId, onBack, onViewJob, onViewPayment }: {
  bookingId: number;
  onBack: () => void;
  onViewJob?: (jobId: number) => void;
  onViewPayment: (paymentId: number) => void;
}) {
  const [tab, setTab] = useState<"overview" | "payments">("overview");
  const { data: b, isLoading } = trpc.admin.getBooking.useQuery({ id: bookingId });

  if (isLoading) return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!b) return <div className="text-center py-24 text-gray-400">Booking not found.</div>;

  const clientName = b.clientName || (b.clientFirstName ? `${b.clientFirstName} ${b.clientLastName ?? ""}`.trim() : null);
  const artistName = b.artistName || (b.artistFirstName ? `${b.artistFirstName} ${b.artistLastName ?? ""}`.trim() : null);
  const clientPic = b.clientProfilePicture;
  const artistPic = b.artistProfilePicture;

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] transition-colors font-medium">Bookings</button>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-[#111] font-semibold">Booking #{bookingId}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Status row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${bookingStatusColor(b.bookingStatus)}`}>{b.bookingStatus || "Unknown"}</span>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${paymentStatusColor(b.paymentStatus)}`}>{b.paymentStatus || "Unpaid"}</span>
          {b.externalPayment && <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-50 text-purple-600">External Payment</span>}
        </div>

        {/* Financials */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Client Rate", value: b.clientRate ? fmt$(b.clientRate * 100) : "—", color: "text-[#111]" },
            { label: "Artist Rate", value: b.artistRate ? fmt$(b.artistRate * 100) : "—", color: "text-gray-600" },
            { label: "Gross Profit", value: b.grossProfit ? fmt$(b.grossProfit * 100) : "—", color: "text-green-600" },
            { label: "Hours", value: b.hours ? `${b.hours}h` : "—", color: "text-gray-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className={`text-lg font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Date + location */}
        <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-50">
          {b.startDate && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Start</p><p className="text-sm text-gray-700">{fmtDateTime(b.startDate)}</p></div>}
          {b.endDate && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">End</p><p className="text-sm text-gray-700">{fmtDateTime(b.endDate)}</p></div>}
          {b.locationAddress && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Location</p><p className="text-sm text-gray-700 flex items-center gap-1"><MapPin size={11} />{b.locationAddress}</p></div>}
          <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Created</p><p className="text-sm text-gray-600">{fmtDate(b.bubbleCreatedAt || b.createdAt)}</p></div>
        </div>

        {b.description && (
          <div className="pt-4 border-t border-gray-50">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Notes</p>
            <p className="text-sm text-gray-600 leading-relaxed">{b.description}</p>
          </div>
        )}
      </div>

      {/* People + Job links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Client */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Client</p>
          {clientName ? (
            <div className="flex items-center gap-3">
              {clientPic ? (
                <img src={clientPic.startsWith('//') ? `https:${clientPic}` : clientPic} alt={clientName} className="w-10 h-10 rounded-full object-cover border border-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">{(clientName || "?")[0]}</div>
              )}
              <div>
                <p className="text-sm font-bold text-[#111]">{clientName}</p>
                <p className="text-xs text-gray-400">{b.clientEmail || "—"}</p>
                {b.clientCompanyName && <p className="text-xs text-gray-400">{b.clientCompanyName}</p>}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">No client linked</p>}
        </div>

        {/* Artist */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Artist</p>
          {artistName ? (
            <div className="flex items-center gap-3">
              {artistPic ? (
                <img src={artistPic.startsWith('//') ? `https:${artistPic}` : artistPic} alt={artistName} className="w-10 h-10 rounded-full object-cover border border-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ec008c] to-[#ff7171] flex items-center justify-center text-white text-sm font-black flex-shrink-0">{(artistName || "?")[0]}</div>
              )}
              <div>
                <p className="text-sm font-bold text-[#111]">{artistName}</p>
                <p className="text-xs text-gray-400">{b.artistEmail || "—"}</p>
                {b.artistSlug && (
                  <a href={`https://artswrk.com/artists/${b.artistSlug}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#F25722] hover:underline flex items-center gap-0.5 mt-0.5"><ExternalLink size={9} /> View profile</a>
                )}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">No artist linked</p>}
        </div>

        {/* Job */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Linked Job</p>
          {b.jobId ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-[#111]">Job #{b.jobId}</p>
                {b.jobStatus && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(b.jobStatus)}`}>{b.jobStatus}</span>}
              </div>
              {b.jobHiringCategory && <p className="text-xs text-gray-500 mb-1">{b.jobHiringCategory}</p>}
              {b.jobLocation && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={9} />{b.jobLocation}</p>}
              {b.jobClientRate && <p className="text-xs text-gray-500 mt-1">${b.jobClientRate}/hr</p>}
              {onViewJob && (
                <button onClick={() => onViewJob(b.jobId)} className="mt-3 text-xs font-semibold text-[#F25722] hover:underline flex items-center gap-1">
                  View Job →
                </button>
              )}
            </div>
          ) : <p className="text-sm text-gray-400">No job linked</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {([{ key: "overview", label: "Overview" }, { key: "payments", label: "Payments" }] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-[#F25722] text-[#F25722]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Financial Breakdown</p>
              <div className="space-y-2">
                {[
                  ["Total Client Rate", b.totalClientRate ? fmt$(b.totalClientRate * 100) : "—"],
                  ["Total Artist Rate", b.totalArtistRate ? fmt$(b.totalArtistRate * 100) : "—"],
                  ["Stripe Fee", b.stripeFee ? fmt$(b.stripeFee * 100) : "—"],
                  ["Post-Fee Revenue", b.postFeeRevenue ? fmt$(b.postFeeRevenue * 100) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-[#111]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">IDs</p>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">DB ID: <span className="font-mono text-gray-700">{b.id}</span></p>
                {b.bubbleId && <p className="text-xs text-gray-500">Bubble ID: <span className="font-mono text-gray-700 text-[10px]">{b.bubbleId}</span></p>}
                {b.jobId && <p className="text-xs text-gray-500">Job ID: <span className="font-mono text-gray-700">{b.jobId}</span></p>}
                {b.interestedArtistId && <p className="text-xs text-gray-500">Application ID: <span className="font-mono text-gray-700">{b.interestedArtistId}</span></p>}
              </div>
              {b.stripeCheckoutUrl && (
                <a href={b.stripeCheckoutUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:underline">
                  <ExternalLink size={11} /> Stripe Checkout
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      {tab === "payments" && <BookingPaymentsTab bookingId={bookingId} onViewPayment={onViewPayment} />}
    </div>
  );
}

// ─── Bookings Section ─────────────────────────────────────────────────────────
function BookingsSection({ onViewPayment, initialDetailId }: { onViewPayment?: (paymentId: number) => void; initialDetailId?: MutableRefObject<number | null> }) {
  type View = { mode: "list" } | { mode: "detail"; id: number };
  const [view, setView] = useState<View>(() => {
    if (initialDetailId?.current != null) {
      const id = initialDetailId.current;
      initialDetailId.current = null;
      return { mode: "detail", id };
    }
    return { mode: "list" };
  });

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
  }, { enabled: view.mode === "list" });

  if (view.mode === "detail") return (
    <AdminBookingDetail
      bookingId={view.id}
      onBack={() => setView({ mode: "list" })}
      onViewPayment={(pid) => onViewPayment?.(pid)}
    />
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-[#111]">Bookings ({data?.total?.toLocaleString() ?? "…"})</h1>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {[{ label: "Upcoming", val: true as boolean | undefined }, { label: "Past", val: false as boolean | undefined }, { label: "All", val: undefined as boolean | undefined }].map(opt => (
            <button key={opt.label} onClick={() => { setUpcoming(opt.val); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition-colors ${upcoming === opt.val ? "bg-[#111] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Client / Artist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Client Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Artist Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Gross Profit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Payment</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.bookings.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-xs">No bookings found</td></tr>
              ) : data?.bookings.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer" onClick={() => setView({ mode: "detail", id: b.id })}>
                  <td className="px-5 py-3 text-xs text-gray-700 whitespace-nowrap">{fmtDateTime(b.startDate)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-[#111]">{b.clientUserId ? `Client #${b.clientUserId}` : "—"}</p>
                    <p className="text-[10px] text-gray-400">{b.artistUserId ? `Artist #${b.artistUserId}` : "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#111]">{b.clientRate ? fmt$(b.clientRate * 100) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{b.artistRate ? fmt$(b.artistRate * 100) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-green-600 font-semibold">{b.grossProfit ? fmt$(b.grossProfit * 100) : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bookingStatusColor(b.bookingStatus)}`}>{b.bookingStatus || "—"}</span></td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paymentStatusColor(b.paymentStatus)}`}>{b.paymentStatus || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="px-5 py-3"><Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} /></div>}
      </div>
    </div>
  );
}

// ─── Payment: Detail Page ──────────────────────────────────────────────────────
function AdminPaymentDetail({ paymentId, onBack, onViewBooking }: {
  paymentId: number;
  onBack: () => void;
  onViewBooking?: (bookingId: number) => void;
}) {
  const { data: p, isLoading } = trpc.admin.getPayment.useQuery({ id: paymentId });

  if (isLoading) return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!p) return <div className="text-center py-24 text-gray-400">Payment not found.</div>;

  const clientName = p.clientName || (p.clientFirstName ? `${p.clientFirstName} ${p.clientLastName ?? ""}`.trim() : null);
  const artistName = p.artistName || (p.artistFirstName ? `${p.artistFirstName} ${p.artistLastName ?? ""}`.trim() : null);

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] transition-colors font-medium">Payments</button>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-[#111] font-semibold">Payment #{paymentId}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${stripeStatusColor(p.status, p.stripeStatus)}`}>
                {p.status || p.stripeStatus || "Unknown"}
              </span>
              {p.stripeCardBrand && (
                <span className="text-sm text-gray-500">{p.stripeCardBrand} ···· {p.stripeCardLast4}</span>
              )}
            </div>
            <p className="text-3xl font-black text-[#111]">{p.stripeAmount ? fmt$(p.stripeAmount) : "—"}</p>
            <p className="text-sm text-gray-400 mt-1">{fmtDate(p.paymentDate || p.createdAt)}</p>
          </div>
          <div className="text-right">
            {p.stripeApplicationFeeAmount && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">App Fee</p>
                <p className="text-lg font-bold text-green-600">{fmt$(p.stripeApplicationFeeAmount)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stripe details */}
        <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-50">
          {p.stripeId && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Stripe ID</p><p className="text-xs font-mono text-gray-600">{p.stripeId}</p></div>}
          {p.stripeCardName && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Card Name</p><p className="text-sm text-gray-700">{p.stripeCardName}</p></div>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap pt-2">
          {p.stripeReceiptUrl && (
            <a href={p.stripeReceiptUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111] text-white text-xs font-semibold hover:bg-gray-800 transition-colors">
              <ExternalLink size={12} /> View Receipt
            </a>
          )}
          {p.stripeRefundUrl && (
            <a href={p.stripeRefundUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <ExternalLink size={12} /> Refund
            </a>
          )}
        </div>
      </div>

      {/* People + Booking links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Client */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Client</p>
          {clientName ? (
            <div className="flex items-center gap-3">
              {p.clientProfilePicture ? (
                <img src={p.clientProfilePicture.startsWith('//') ? `https:${p.clientProfilePicture}` : p.clientProfilePicture} alt={clientName}
                  className="w-10 h-10 rounded-full object-cover border border-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">{(clientName || "?")[0]}</div>
              )}
              <div>
                <p className="text-sm font-bold text-[#111]">{clientName}</p>
                <p className="text-xs text-gray-400">{p.clientEmail || "—"}</p>
                {p.clientCompanyName && <p className="text-xs text-gray-400">{p.clientCompanyName}</p>}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">No client linked</p>}
        </div>

        {/* Artist */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Artist (via booking)</p>
          {artistName ? (
            <div className="flex items-center gap-3">
              {p.artistProfilePicture ? (
                <img src={p.artistProfilePicture.startsWith('//') ? `https:${p.artistProfilePicture}` : p.artistProfilePicture} alt={artistName}
                  className="w-10 h-10 rounded-full object-cover border border-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ec008c] to-[#ff7171] flex items-center justify-center text-white text-sm font-black flex-shrink-0">{(artistName || "?")[0]}</div>
              )}
              <div>
                <p className="text-sm font-bold text-[#111]">{artistName}</p>
                <p className="text-xs text-gray-400">{p.artistEmail || "—"}</p>
                {p.artistSlug && (
                  <a href={`https://artswrk.com/artists/${p.artistSlug}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-[#F25722] hover:underline flex items-center gap-0.5 mt-0.5"><ExternalLink size={9} /> View profile</a>
                )}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">No artist linked</p>}
        </div>

        {/* Linked Booking */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Linked Booking</p>
          {p.bookingId ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-[#111]">Booking #{p.bookingId}</p>
                {p.bookingStatus && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bookingStatusColor(p.bookingStatus)}`}>{p.bookingStatus}</span>}
              </div>
              {p.bookingPaymentStatus && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paymentStatusColor(p.bookingPaymentStatus)}`}>{p.bookingPaymentStatus}</span>}
              {p.startDate && <p className="text-xs text-gray-500 mt-2">{fmtDateTime(p.startDate)}</p>}
              {p.clientRate && <p className="text-xs text-gray-400 mt-1">Rate: {fmt$(p.clientRate * 100)}/hr</p>}
              {onViewBooking && (
                <button onClick={() => onViewBooking(p.bookingId)} className="mt-3 text-xs font-semibold text-[#F25722] hover:underline flex items-center gap-1">
                  View Booking →
                </button>
              )}
            </div>
          ) : <p className="text-sm text-gray-400">No booking linked</p>}
        </div>
      </div>

      {/* Description */}
      {p.stripeDescription && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Stripe Description</p>
          <p className="text-sm text-gray-600 leading-relaxed">{p.stripeDescription}</p>
        </div>
      )}
    </div>
  );
}

// ─── Payments Section ─────────────────────────────────────────────────────────
function PaymentsSection({ onViewBooking, initialDetailId }: { onViewBooking?: (bookingId: number) => void; initialDetailId?: MutableRefObject<number | null> }) {
  type View = { mode: "list" } | { mode: "detail"; id: number };
  const [view, setView] = useState<View>(() => {
    if (initialDetailId?.current != null) {
      const id = initialDetailId.current;
      initialDetailId.current = null;
      return { mode: "detail", id };
    }
    return { mode: "list" };
  });

  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const { data, isLoading } = trpc.admin.payments.useQuery({ limit: LIMIT, offset: (page - 1) * LIMIT }, { enabled: view.mode === "list" });

  if (view.mode === "detail") return (
    <AdminPaymentDetail
      paymentId={view.id}
      onBack={() => setView({ mode: "list" })}
      onViewBooking={onViewBooking}
    />
  );

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
                <tr key={p.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer" onClick={() => setView({ mode: "detail", id: p.id })}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#111] text-xs">
                      {p.clientName || p.clientFirstName ? displayName({ name: p.clientName, firstName: p.clientFirstName, lastName: p.clientLastName }) : p.clientCompanyName || "—"}
                    </p>
                    {p.clientCompanyName && (p.clientName || p.clientFirstName) && (
                      <p className="text-[10px] text-gray-400">{p.clientCompanyName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stripeStatusColor(p.status, p.stripeStatus)}`}>
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
        {data && <div className="px-5 py-3"><Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} /></div>}
      </div>
    </div>
  );
}

// ─── PRO Job types ────────────────────────────────────────────────────────────
type ProJob = {
  id: number;
  company?: string | null;
  logo?: string | null;
  serviceType?: string | null;
  category?: string | null;
  budget?: string | null;
  status?: string | null;
  description?: string | null;
  location?: string | null;
  workFromAnywhere?: boolean | null;
  applyEmail?: string | null;
  applyLink?: string | null;
  applyDirect?: boolean | null;
  featured?: boolean | null;
  tag?: string | null;
  createdAt?: Date | string | null;
  interestedCount?: number;
};

// ─── PRO Job: Interested Artists Tab ──────────────────────────────────────────
function ProJobInterestedArtistsTab({ jobId, jobBudget }: { jobId: number; jobBudget?: string | null }) {
  const { data: artists, isLoading } = trpc.admin.premiumJobArtists.useQuery({ jobId });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" />
    </div>
  );
  if (!artists || (artists as any[]).length === 0) return (
    <div className="text-center py-16">
      <Users size={32} className="text-gray-200 mx-auto mb-2" />
      <p className="text-sm text-gray-400">No interested artists recorded yet.</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {(artists as any[]).map((a: any) => {
        const fullName = a.artistFirstName && a.artistLastName
          ? `${a.artistFirstName} ${a.artistLastName}`
          : a.artistName || 'Unknown Artist';
        const initials = (a.artistFirstName || a.artistName || '?')[0].toUpperCase();
        const profileUrl = a.artistSlug
          ? `https://artswrk.com/artists/${a.artistSlug}`
          : a.artistEmail ? `mailto:${a.artistEmail}` : null;
        return (
          <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {a.artistProfilePicture ? (
                  <img src={a.artistProfilePicture.startsWith('//') ? `https:${a.artistProfilePicture}` : a.artistProfilePicture} alt={fullName}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-gray-100"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ec008c] to-[#ff7171] flex items-center justify-center text-white text-base font-black flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#111]">{fullName}</p>
                    {a.artswrkPro && <span className="text-[9px] font-black text-[#F25722] bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">PRO</span>}
                  </div>
                  {a.artistLocation && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={10} /> {a.artistLocation}</p>}
                </div>
              </div>
              {(a.rate || jobBudget) && (
                <div className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-[#fce8e4] text-[#F25722] text-xs font-bold">{a.rate || jobBudget}</div>
              )}
            </div>
            {a.message && <p className="mt-3 text-xs text-gray-600 leading-relaxed">{a.message.length > 250 ? a.message.substring(0, 250) + '…' : a.message}</p>}
            {!a.message && a.artistBio && <p className="mt-3 text-xs text-gray-500 leading-relaxed italic">{a.artistBio.length > 200 ? a.artistBio.substring(0, 200) + '…' : a.artistBio}</p>}
            {a.artistDisciplines && (() => {
              try {
                const discs: string[] = JSON.parse(a.artistDisciplines);
                if (discs.length > 0) return (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {discs.slice(0, 4).map((d: string) => <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{d}</span>)}
                    {discs.length > 4 && <span className="text-[10px] text-gray-400">+{discs.length - 4} more</span>}
                  </div>
                );
              } catch { return null; }
              return null;
            })()}
            <div className="mt-3 flex gap-2">
              {a.resumeLink && (
                <a href={a.resumeLink} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#111] text-white text-xs font-semibold hover:bg-gray-800 transition-all">
                  View Submission →
                </a>
              )}
              {profileUrl && !a.resumeLink && (
                <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                  View Profile →
                </a>
              )}
              {profileUrl && a.resumeLink && (
                <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all">
                  Profile
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PRO Job: Detail Page ──────────────────────────────────────────────────────
function AdminProJobDetail({ jobId, onBack, onEdit }: { jobId: number; onBack: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<"overview" | "artists">("overview");
  const { data: job, isLoading } = trpc.admin.getProJob.useQuery({ id: jobId });

  if (isLoading) return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;
  if (!job) return <div className="text-center py-24 text-gray-400">PRO Job not found.</div>;

  const logoSrc = job.logo ? (job.logo.startsWith('//') ? `https:${job.logo}` : job.logo) : null;
  const proJobStatusColor = (s: string | null | undefined) => {
    if (s === 'Active') return 'bg-green-50 text-green-600';
    if (s === 'Inactive' || s === 'Closed') return 'bg-red-50 text-red-500';
    if (s === 'Draft') return 'bg-yellow-50 text-yellow-600';
    return 'bg-gray-100 text-gray-500';
  };
  const cleanDesc = job.description ? job.description.replace(/\[.*?\]/g, '').trim() : '';

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "artists", label: `Interested Artists${(job as any).interestedCount ? ` (${(job as any).interestedCount})` : ''}` },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] transition-colors font-medium">PRO Jobs</button>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-[#111] font-semibold">{job.serviceType || `PRO Job #${jobId}`}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {logoSrc ? (
              <img src={logoSrc} alt={job.company || ''} className="w-16 h-16 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
                {(job.company || 'P')[0]}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-[#111]">{job.serviceType || 'PRO Job'}</h1>
                {job.featured && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">Featured</span>}
                {job.applyDirect && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Direct Apply</span>}
              </div>
              <p className="text-sm text-gray-500 font-medium mt-0.5">{job.company || '—'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {job.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">{job.category}</span>}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${proJobStatusColor(job.status)}`}>{job.status || 'Unknown'}</span>
                {job.workFromAnywhere
                  ? <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-semibold"><Globe size={10} /> Remote</span>
                  : job.location && <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><MapPin size={10} /> {job.location}</span>}
              </div>
            </div>
          </div>
          <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <Edit2 size={13} /> Edit
          </button>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-gray-50">
          {job.budget && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Budget</p><p className="text-sm font-bold text-[#111]">{job.budget}</p></div>}
          <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Posted</p><p className="text-sm text-gray-600">{fmtDate(job.createdAt)}</p></div>
          {job.applyEmail && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Apply Email</p><a href={`mailto:${job.applyEmail}`} className="text-sm text-[#F25722] hover:underline">{job.applyEmail}</a></div>}
          {job.applyLink && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Apply Link</p>
              <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline flex items-center gap-1"><ExternalLink size={11} /> View</a>
            </div>
          )}
          {(job as any).tag && <div><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Tag</p><p className="text-sm text-gray-600">{(job as any).tag}</p></div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-[#F25722] text-[#F25722]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {cleanDesc ? (
            <>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Description</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{cleanDesc}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No description provided.</p>
          )}
        </div>
      )}
      {tab === "artists" && <ProJobInterestedArtistsTab jobId={jobId} jobBudget={job.budget} />}
    </div>
  );
}

// ─── PRO Job: Edit Wrapper ─────────────────────────────────────────────────────
function AdminProJobEditWrapper({ jobId, onBack, onSave, isSaving }: {
  jobId: number;
  onBack: () => void;
  onSave: (d: Record<string, any>) => void;
  isSaving: boolean;
}) {
  const { data: job, isLoading } = trpc.admin.getProJob.useQuery({ id: jobId });

  const [company, setCompany] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [workFromAnywhere, setWorkFromAnywhere] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [applyDirect, setApplyDirect] = useState(false);
  const [applyEmail, setApplyEmail] = useState("");
  const [applyLink, setApplyLink] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    if (!job) return;
    setCompany(job.company ?? "");
    setServiceType(job.serviceType ?? "");
    setCategory(job.category ?? "");
    setBudget(job.budget ?? "");
    setDescription(job.description ?? "");
    setLocation(job.location ?? "");
    setStatus(job.status ?? "");
    setWorkFromAnywhere(job.workFromAnywhere ?? false);
    setFeatured(job.featured ?? false);
    setApplyDirect(job.applyDirect ?? false);
    setApplyEmail(job.applyEmail ?? "");
    setApplyLink(job.applyLink ?? "");
    setTag((job as any).tag ?? "");
  }, [job]);

  if (isLoading) return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-[#F25722]/30 border-t-[#F25722] rounded-full animate-spin" /></div>;

  const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";
  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all";
  const PRO_STATUSES = ["Active", "Inactive", "Draft", "Closed"];
  const PRO_CATEGORIES = HIRING_CATEGORIES;

  const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-[#111]">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? "bg-[#F25722]" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-4" : ""}`} />
      </button>
    </label>
  );

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => onBack()} className="text-gray-400 hover:text-[#F25722] transition-colors font-medium">PRO Jobs</button>
        <ChevronRight size={14} className="text-gray-300" />
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] transition-colors font-medium">{job?.serviceType || `PRO Job #${jobId}`}</button>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-[#111] font-semibold">Edit</span>
      </div>
      <h1 className="text-2xl font-black text-[#111]">Edit PRO Job #{jobId}</h1>
      <form onSubmit={e => { e.preventDefault(); onSave({ company, serviceType, category, budget, description, location, status, workFromAnywhere, featured, applyDirect, applyEmail, applyLink, tag }); }} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-bold text-gray-700">Job Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Company</label><input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" className={inputCls} /></div>
            <div><label className={labelCls}>Role / Service Type</label><input value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="e.g. Makeup Artist" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {PRO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {PRO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Budget</label><input value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. $500–$1,000/day" className={inputCls} /></div>
            <div><label className={labelCls}>Location</label><input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} className={`${inputCls} resize-none`} /></div>
          <div><label className={labelCls}>Tag</label><input value={tag} onChange={e => setTag(e.target.value)} placeholder="Optional tag" className={inputCls} /></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Apply Settings</h3>
          <div><label className={labelCls}>Apply Email</label><input type="email" value={applyEmail} onChange={e => setApplyEmail(e.target.value)} placeholder="jobs@company.com" className={inputCls} /></div>
          <div><label className={labelCls}>Apply Link</label><input type="url" value={applyLink} onChange={e => setApplyLink(e.target.value)} placeholder="https://…" className={inputCls} /></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Flags</h3>
          <ToggleRow label="Work From Anywhere (Remote)" value={workFromAnywhere} onChange={setWorkFromAnywhere} />
          <ToggleRow label="Featured Listing" value={featured} onChange={setFeatured} />
          <ToggleRow label="Direct Apply (no middleman)" value={applyDirect} onChange={setApplyDirect} />
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" disabled={isSaving} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-50">
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── PRO Jobs Section ───────────────────────────────────────────────────────
function ProJobsSection() {
  type View = { mode: "list" } | { mode: "detail"; id: number } | { mode: "edit"; id: number };
  const [view, setView] = useState<View>({ mode: "list" });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.admin.premiumJobs.useQuery({
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  }, { enabled: view.mode === "list" });

  const utils = trpc.useUtils();
  const updateProJob = trpc.admin.updateProJob.useMutation({
    onSuccess: (updated) => {
      utils.admin.getProJob.invalidate({ id: (view as any).id });
      utils.admin.premiumJobs.invalidate();
      if (updated) setView({ mode: "detail", id: updated.id });
    },
    onError: (e) => alert("Save failed: " + e.message),
  });

  const statuses = ["Active", "Inactive", "Draft", "Closed"];

  if (view.mode === "detail") return <AdminProJobDetail jobId={view.id} onBack={() => setView({ mode: "list" })} onEdit={() => setView({ mode: "edit", id: view.id })} />;
  if (view.mode === "edit") {
    const id = view.id;
    return <AdminProJobEditWrapper jobId={id} onBack={() => setView({ mode: "detail", id })} onSave={(d) => updateProJob.mutate({ id, ...d })} isSaving={updateProJob.isPending} />;
  }

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
                <tr key={job.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer" onClick={() => setView({ mode: "detail", id: job.id })}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {job.logo ? (
                        <img src={job.logo.startsWith('//') ? `https:${job.logo}` : job.logo} alt={job.company || ''}
                          className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                          {(job.company || 'P')[0]}
                        </div>
                      )}
                      <span className="font-semibold text-[#111] text-xs">{job.company || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><p className="text-xs font-medium text-[#111] max-w-[180px] truncate">{job.serviceType || '—'}</p></td>
                  <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">{job.category || '—'}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate">{job.budget || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      job.status === 'Active' ? 'bg-green-50 text-green-600'
                      : job.status === 'Inactive' || job.status === 'Closed' ? 'bg-red-50 text-red-500'
                      : 'bg-gray-100 text-gray-500'
                    }`}>{job.status || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(job as any).interestedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722]">
                        <Users size={10} />{(job as any).interestedCount}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {job.workFromAnywhere
                      ? <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-semibold"><Globe size={10} /> Remote</span>
                      : <span className="text-xs text-gray-300">On-site</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="px-5 py-3"><Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} /></div>}
      </div>
    </div>
  );
}

// ─── Enterprise Clients Section ─────────────────────────────────────────────
type EnterprisePlan = "on_demand" | "subscriber" | null;

type EnterpriseClient = {
  id: number;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  clientCompanyName: string | null;
  location: string | null;
  profilePicture: string | null;
  enterpriseLogoUrl: string | null;
  enterpriseDescription: string | null;
  enterprisePlan?: EnterprisePlan;
  hiringCategory: string | null;
  website: string | null;
  instagram: string | null;
  bubbleId: string | null;
  createdAt: Date | null;
  jobCount: number;
  interestedArtistCount: number;
};

function EnterprisePlanBadge({ plan }: { plan: EnterprisePlan }) {
  if (!plan) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">No Plan</span>;
  if (plan === "on_demand") return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">On-Demand</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">Subscriber</span>;
}

function EnterpriseClientModal({ client, onClose }: { client: EnterpriseClient; onClose: () => void }) {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [localPlan, setLocalPlan] = useState<EnterprisePlan>(client.enterprisePlan ?? null);
  const utils = trpc.useUtils();

  const { data: jobsData, isLoading } = trpc.admin.premiumJobs.useQuery({
    clientUserId: client.id,
    limit: 100,
    offset: 0,
  });

  const { data: artistsData } = trpc.admin.premiumJobArtists.useQuery(
    { jobId: expandedJobId! },
    { enabled: expandedJobId !== null }
  );

  const setPlan = trpc.admin.setEnterprisePlan.useMutation({
    onSuccess: () => utils.admin.enterpriseClients.invalidate(),
  });

  async function handlePlanChange(plan: EnterprisePlan) {
    setLocalPlan(plan);
    await setPlan.mutateAsync({ userId: client.id, plan });
  }

  const logo = client.enterpriseLogoUrl || client.profilePicture;
  const companyName = client.clientCompanyName || displayName(client);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-100">
          {logo ? (
            <img src={logo.startsWith('//') ? 'https:' + logo : logo} alt={companyName} className="w-14 h-14 rounded-xl object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0">
              {companyName[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-[#111] truncate">{companyName}</h2>
            <p className="text-sm text-gray-500">{client.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {client.hiringCategory && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] font-semibold">{client.hiringCategory}</span>
              )}
              {client.location && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                  <MapPin size={10} /> {client.location}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">{client.jobCount} PRO Jobs</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold">{client.interestedArtistCount} Interested Artists</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        {client.enterpriseDescription && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600 leading-relaxed">{client.enterpriseDescription}</p>
          </div>
        )}

        {/* Enterprise Plan Toggle */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-0.5">Billing Plan</p>
              <p className="text-xs text-gray-500">Controls how this client pays to access candidate lists.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlanChange(null)}
                disabled={setPlan.isPending}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${localPlan === null ? "bg-gray-200 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}
              >
                None
              </button>
              <button
                onClick={() => handlePlanChange("on_demand")}
                disabled={setPlan.isPending}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${localPlan === "on_demand" ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-400 hover:bg-amber-50"}`}
              >
                On-Demand ($100/job)
              </button>
              <button
                onClick={() => handlePlanChange("subscriber")}
                disabled={setPlan.isPending}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${localPlan === "subscriber" ? "bg-purple-100 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-400 hover:bg-purple-50"}`}
              >
                Subscriber
              </button>
              {setPlan.isPending && <div className="w-4 h-4 border-2 border-gray-300 border-t-[#F25722] rounded-full animate-spin" />}
              {setPlan.isSuccess && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
            </div>
          </div>
          {localPlan === "on_demand" && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              This client pays <strong>$100 per job</strong> to unlock the candidate list. Each payment is tracked individually.
            </p>
          )}
          {localPlan === "subscriber" && (
            <p className="mt-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2">
              This client has a <strong>subscription</strong> — $250/month or $2,500/year — with unlimited candidate access.
            </p>
          )}
        </div>

        {/* Links */}
        {(client.website || client.instagram) && (
          <div className="px-6 py-3 border-b border-gray-100 flex gap-4">
            {client.website && (
              <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <Globe size={12} /> {client.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {client.instagram && (
              <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-pink-600 hover:underline">
                <ExternalLink size={12} /> @{client.instagram.replace('@', '')}
              </a>
            )}
          </div>
        )}

        {/* PRO Jobs list */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">PRO Jobs ({jobsData?.total ?? 0})</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin mr-2" />
              Loading jobs…
            </div>
          ) : !jobsData?.jobs?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No PRO jobs found for this client.</p>
          ) : (
            <div className="space-y-3">
              {jobsData.jobs.map((job: any) => {
                const isExpanded = expandedJobId === job.id;
                return (
                  <div key={job.id} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                    {/* Job row — click to expand artists */}
                    <button
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      className="w-full text-left p-4 hover:bg-white transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#111] text-sm truncate">{job.serviceType || 'Untitled Role'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{job.category}{job.location ? ` · ${job.location}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {job.budget && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#FFF0E6] text-[#F25722]">{job.budget}</span>
                          )}
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            job.status === 'Active' ? 'bg-green-50 text-green-600' :
                            job.status === 'Closed' ? 'bg-red-50 text-red-500' :
                            'bg-gray-100 text-gray-500'
                          }`}>{job.status || 'Unknown'}</span>
                          <span className="text-xs text-gray-400">{job.interestedCount ?? 0} artists</span>
                          <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded: interested artists */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-3">
                        {!artistsData ? (
                          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                            <div className="w-3 h-3 border border-gray-300 border-t-[#F25722] rounded-full animate-spin" />
                            Loading artists…
                          </div>
                        ) : artistsData.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">No interested artists yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {artistsData.map((a: any) => (
                              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                                {/* Avatar */}
                                {a.artistProfilePicture ? (
                                  <img
                                    src={a.artistProfilePicture.startsWith('//') ? 'https:' + a.artistProfilePicture : a.artistProfilePicture}
                                    alt={a.artistFirstName || ''}
                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ec008c] to-[#ff7171] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {(a.artistFirstName || 'A')[0]}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-[#111] text-sm">
                                      {a.artistFirstName} {a.artistLastName}
                                    </p>
                                    {a.rate && (
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 flex-shrink-0">{a.rate}</span>
                                    )}
                                  </div>
                                  {a.artistLocation && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                      <MapPin size={9} /> {a.artistLocation}
                                    </p>
                                  )}
                                  {(a.message || a.artistBio) && (
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">
                                      {a.message || a.artistBio}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    {a.resumeLink && (
                                      <a
                                        href={a.resumeLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-semibold text-white bg-[#111] px-3 py-1 rounded-full hover:bg-gray-800 transition-colors"
                                      >
                                        View Submission →
                                      </a>
                                    )}
                                    {a.artistSlug && (
                                      <a
                                        href={`https://artswrk.com/artists/${a.artistSlug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-500 hover:text-[#F25722] transition-colors"
                                      >
                                        Profile ↗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EnterpriseClientsSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<EnterpriseClient | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.admin.enterpriseClients.useQuery({
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
    search: debouncedSearch || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div className="space-y-5">
      {selectedClient && <EnterpriseClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">
          Enterprise Clients
          <span className="ml-2 text-sm font-normal text-gray-400">({data?.total?.toLocaleString() ?? "…"} total)</span>
        </h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
          <Building2 size={13} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-600">Enterprise / PRO Accounts</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search company, name, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#F25722] bg-white"
        />
      </div>

      {/* Client Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin mr-3" />
          Loading enterprise clients…
        </div>
      ) : !data?.clients?.length ? (
        <div className="text-center py-20 text-gray-400">No enterprise clients found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.clients.map((client: EnterpriseClient) => {
            const logo = client.enterpriseLogoUrl || client.profilePicture;
            const companyName = client.clientCompanyName || displayName(client);
            return (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#F25722]/30 transition-all group"
              >
                <div className="flex items-start gap-3 mb-4">
                  {logo ? (
                    <img src={logo.startsWith('//') ? 'https:' + logo : logo} alt={companyName} className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                      {companyName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#111] text-sm leading-tight truncate group-hover:text-[#F25722] transition-colors">{companyName}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{client.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {client.hiringCategory && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] font-semibold">{client.hiringCategory}</span>
                      )}
                      <EnterprisePlanBadge plan={client.enterprisePlan ?? null} />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111]">{client.jobCount}</p>
                    <p className="text-xs text-gray-500">PRO Jobs</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111]">{client.interestedArtistCount}</p>
                    <p className="text-xs text-gray-500">Interested Artists</p>
                  </div>
                </div>

                {client.location && (
                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                    <MapPin size={10} /> {client.location}
                  </p>
                )}

                {/* Run As button */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end" onClick={e => e.stopPropagation()}>
                  <RunAsButton
                    userId={client.id}
                    userName={client.clientCompanyName || displayName(client)}
                    userRole="Client"
                    enterprise={true}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Subscriptions Section ────────────────────────────────────────────────────
function SubscriptionsSection() {
  const [planFilter, setPlanFilter] = useState<"all" | "basic" | "pro">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "at_risk" | "canceled">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.admin.subscriptions.useQuery();

  const subs = data?.subscriptions ?? [];
  const summary = data?.summary;

  // Apply filters
  const filtered = subs.filter(s => {
    if (planFilter !== "all" && s.plan !== planFilter) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "active" && s.status !== "active" && s.status !== "trialing") return false;
      if (statusFilter === "at_risk" && s.status !== "at_risk") return false;
      if (statusFilter === "canceled" && s.status !== "canceled") return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function fmt$(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
  }
  function fmtShort(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-50 text-green-700",
      trialing: "bg-blue-50 text-blue-700",
      at_risk: "bg-amber-50 text-amber-700",
      canceled: "bg-red-50 text-red-600",
      past_due: "bg-orange-50 text-orange-700",
    };
    const labels: Record<string, string> = {
      active: "Active",
      trialing: "Trialing",
      at_risk: "At Risk",
      canceled: "Churned",
      past_due: "Past Due",
    };
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
        {status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
        {status === "at_risk" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
        {status === "canceled" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
        {labels[status] ?? status}
      </span>
    );
  };

  const planBadge = (plan: string) => (
    plan === "pro"
      ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Star size={9} className="fill-amber-600" /> PRO</span>
      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">Basic</span>
  );

  const StatCard = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#111]">Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live from Stripe · Basic &amp; PRO artist plans</p>
        </div>
        <a
          href="https://dashboard.stripe.com/subscriptions"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#F25722] transition-colors border border-gray-200 px-3 py-1.5 rounded-lg"
        >
          <ExternalLink size={12} /> Stripe Dashboard
        </a>
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-20 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="MRR" value={fmt$(summary.mrrCents)} sub="Active subs / mo" accent="text-green-700" />
          <StatCard label="ARR" value={fmt$(summary.arrCents)} sub="Annualized" accent="text-green-600" />
          <StatCard label="Active" value={summary.activeCount.toString()} sub="Total subscribers" accent="text-[#111]" />
          <StatCard label="Basic" value={summary.basicActiveCount.toString()} sub="Active Basic plan" accent="text-pink-600" />
          <StatCard label="PRO" value={summary.proActiveCount.toString()} sub="Active PRO plan" accent="text-amber-600" />
          <StatCard label="At Risk" value={summary.atRiskCount.toString()} sub="Canceling or past due" accent="text-amber-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Plan tabs */}
        <div className="flex items-center bg-gray-100 rounded-full p-1 gap-0.5">
          {(["all", "basic", "pro"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${planFilter === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {p === "all" ? "All Plans" : p === "basic" ? "Basic" : "PRO"}
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex items-center bg-gray-100 rounded-full p-1 gap-0.5">
          {(["all", "active", "at_risk", "canceled"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {s === "all" ? "All" : s === "active" ? "Active" : s === "at_risk" ? "At Risk" : "Churned"}
              {s !== "all" && summary && (
                <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                  ({s === "active" ? summary.activeCount : s === "at_risk" ? summary.atRiskCount : summary.canceledCount})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1.5 ml-auto">
          <Search size={13} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="text-xs outline-none w-44 placeholder-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Artist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Billing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Started</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Renews / Ended</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-xs">Loading subscriptions from Stripe…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-xs">No subscriptions found</td></tr>
              ) : filtered.map(s => {
                const initials = s.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
                const isChurned = s.status === "canceled";
                return (
                  <tr key={s.stripeSubId} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isChurned ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full hirer-grad-bg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111] text-xs truncate max-w-[150px]">{s.name || "—"}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{planBadge(s.plan)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{s.interval === "year" ? "Annual" : "Monthly"}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-[#111]">{fmt$(s.amountCents)}<span className="font-normal text-gray-400">/{s.interval === "year" ? "yr" : "mo"}</span></p>
                      {s.interval === "year" && (
                        <p className="text-[10px] text-gray-400">{fmt$(s.monthlyAmountCents)}/mo</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(s.status)}
                      {s.status === "at_risk" && s.cancelAtPeriodEnd && (
                        <p className="text-[10px] text-amber-600 mt-0.5">Cancels {fmtShort(s.currentPeriodEnd)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtShort(s.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {isChurned ? (
                        <span className="text-red-400">{fmtShort(s.canceledAt)}</span>
                      ) : (
                        fmtShort(s.currentPeriodEnd)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.customerId && (
                        <a
                          href={`https://dashboard.stripe.com/customers/${s.customerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-gray-400 hover:text-[#F25722] transition-colors flex items-center gap-1"
                        >
                          <ExternalLink size={10} /> View
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {filtered.length} of {subs.length} subscriptions
            </p>
            <p className="text-xs text-gray-400">
              Filtered MRR: <span className="font-semibold text-gray-700">{fmt$(filtered.reduce((acc, s) => s.status !== "canceled" ? acc + s.monthlyAmountCents : acc, 0))}/mo</span>
            </p>
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

  // Cross-section deep-link: store a pending detail ID when navigating between sections
  const pendingBookingId = useRef<number | null>(null);
  const pendingPaymentId = useRef<number | null>(null);

  function goToPayment(paymentId: number) {
    pendingPaymentId.current = paymentId;
    setSection("payments");
  }
  function goToBooking(bookingId: number) {
    pendingBookingId.current = bookingId;
    setSection("bookings");
  }

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
      <Sidebar active={section} onSelect={setSection} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {section === "dashboard" && <DashboardSection />}
          {section === "artists" && <ArtistsSection />}
          {section === "clients" && <ClientsSection />}
          {section === "jobs" && <JobsSection />}
          {section === "pro-jobs" && <ProJobsSection />}
          {section === "enterprise-clients" && <EnterpriseClientsSection />}
          {section === "bookings" && <BookingsSection onViewPayment={goToPayment} initialDetailId={pendingBookingId} />}
          {section === "payments" && <PaymentsSection onViewBooking={goToBooking} initialDetailId={pendingPaymentId} />}
          {section === "subscriptions" && <SubscriptionsSection />}
          {section === "acquisition" && <AcquisitionSection />}
          {section === "settings" && <SettingsSection user={user} />}
        </div>
      </main>
    </div>
  );
}
