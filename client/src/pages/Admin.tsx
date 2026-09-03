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
  DollarSign, Calendar, CalendarDays, Star, UserCheck, Building2, Key,
  AlertCircle, CheckCircle2, Eye, EyeOff, LogOut, Filter,
  MapPin, Clock, ArrowUpRight, UserCog, ArrowLeft, Sparkles, Globe, ExternalLink, Megaphone,
  Plus, Edit2, Mail, ChevronDown, ToggleLeft, ToggleRight, Instagram, Link as LinkIcon, Send, Copy, Loader2,
  Gift, Trash2, LayoutGrid, List as ListIcon, Tag, SlidersHorizontal,
  Upload, Image as ImageIcon, Check,
} from "lucide-react";
import { ADMIN_SESSION_COOKIE_NAME, IMPERSONATION_MARKER_COOKIE } from "@shared/const";
import { Link } from "wouter";
import RichTextEditor from "@/components/RichTextEditor";
import LocationAutocompleteInput from "@/components/LocationAutocompleteInput";
import { useLocationField } from "@/hooks/useLocationField";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminSection = "dashboard" | "artists" | "clients" | "jobs" | "pro-jobs" | "enterprise-clients" | "bookings" | "admin-bookings" | "payments" | "subscriptions" | "benefits" | "emails" | "settings";

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
// Grouped nav: a group with no `items` is a single leaf link; a group with
// `items` renders as a small-caps section label above its own leaf links —
// mirrors the "DATABASE" section pattern from the reference design.
type NavLeaf = { id: AdminSection; label: string; icon: React.ReactNode };
type NavGroup = { label?: string; icon?: React.ReactNode; leaf?: NavLeaf; items?: NavLeaf[] };

const NAV_GROUPS: NavGroup[] = [
  { leaf: { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> } },
  {
    label: "Users",
    items: [
      { id: "artists", label: "Artists", icon: <Users size={16} /> },
      { id: "clients", label: "Clients", icon: <Building2 size={16} /> },
      { id: "enterprise-clients", label: "Enterprise", icon: <Building2 size={16} /> },
    ],
  },
  {
    label: "Jobs",
    items: [
      { id: "jobs", label: "Basic", icon: <Briefcase size={16} /> },
      { id: "pro-jobs", label: "PRO", icon: <Sparkles size={16} /> },
    ],
  },
  {
    label: "Bookings",
    items: [
      { id: "bookings", label: "All Bookings", icon: <BookOpen size={16} /> },
      { id: "admin-bookings", label: "Admin Bookings", icon: <CalendarDays size={16} /> },
    ],
  },
  {
    label: "Payments",
    items: [
      { id: "payments", label: "All Payments", icon: <CreditCard size={16} /> },
      { id: "subscriptions", label: "Subscriptions", icon: <TrendingUp size={16} /> },
    ],
  },
  { leaf: { id: "benefits", label: "Benefits", icon: <Gift size={16} /> } },
  {
    label: "Settings",
    items: [
      { id: "settings", label: "General", icon: <Settings size={16} /> },
      { id: "emails", label: "Emails", icon: <Mail size={16} /> },
    ],
  },
];

function Sidebar({ active, onSelect, collapsed, onToggle }: {
  active: AdminSection;
  onSelect: (s: AdminSection) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={`flex flex-col bg-white border-r border-gray-100 transition-all duration-200 ${collapsed ? "w-14" : "w-60"} min-h-screen flex-shrink-0`}>
      {/* Logo + toggle */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <span className="font-black text-lg tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-lg tracking-tight bg-[#111] text-white px-1 py-0.5 rounded text-xs">WRK</span>
            <span className="text-[10px] text-gray-400 ml-1 font-semibold uppercase tracking-wider border border-gray-200 rounded-full px-1.5 py-0.5">Admin</span>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-lg text-gray-400 hover:text-[#111] hover:bg-gray-50 transition-colors ml-auto">
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label ?? group.leaf!.id}>
            {!collapsed && group.label && (
              <p className="px-2.5 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {(group.leaf ? [group.leaf] : group.items!).map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active === item.id
                      ? "bg-orange-50 text-[#F25722]"
                      : "text-gray-500 hover:text-[#111] hover:bg-gray-50"
                  }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: links to other dashboards */}
      {!collapsed && (
        <div className="p-3 border-t border-gray-100 space-y-0.5">
          <Link href="/leads" className="block">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-[#111] hover:bg-gray-50 transition-colors">
              <ArrowUpRight size={13} />
              Leads Dashboard
            </button>
          </Link>
          <Link href="/app" className="block">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-[#111] hover:bg-gray-50 transition-colors">
              <ArrowUpRight size={13} />
              App Dashboard
            </button>
          </Link>
          <SidebarLogout />
        </div>
      )}
      {/* Collapsed rail still needs a way out — icon only. */}
      {collapsed && (
        <div className="p-2 border-t border-gray-100">
          <SidebarLogout iconOnly />
        </div>
      )}
    </aside>
  );
}

/**
 * Sign out of the admin dashboard.
 *
 * Clears the session cookie server-side, then hard-navigates to "/" rather than
 * doing a client-side route change — a soft navigation would leave the admin
 * page's cached tRPC data sitting in memory, so the next person at the keyboard
 * could still read it until something forced a refetch.
 */
function SidebarLogout({ iconOnly = false }: { iconOnly?: boolean }) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch {
      // Even a failed call should get them off this screen; the cookie is
      // cleared server-side and the reload settles whatever state is left.
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={signOut}
      disabled={busy}
      title="Log out"
      aria-label="Log out"
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 ${iconOnly ? "justify-center px-0" : ""}`}
    >
      <LogOut size={13} />
      {!iconOnly && (busy ? "Logging out…" : "Log out")}
    </button>
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
        <StatCard label="Revenue" value={fmt$(stats?.totalRevenueCents ?? 0)} sub="Completed, non-deleted bookings" icon={<DollarSign size={18} />} />
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
              { label: "Priority", value: stats?.priorityArtists ?? 0 },
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
  isSaving,
}: {
  initial?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isCreate?: boolean;
  isSaving?: boolean;
}) {
  // masterArtistTypeNames/masterServiceTypeNames/masterStyleNames are resolved
  // server-side by admin.getArtist (ids -> names) — the raw masterArtistTypes/
  // masterServiceType/masterStyles columns hold Bubble-matching ids, never names.
  const { data: masterArtistTypeOptions = [] } = trpc.artists.getMasterArtistTypes.useQuery();
  const { data: masterServiceTypeOptions = [] } = trpc.artists.getMasterServiceTypes.useQuery();
  const { data: masterStyleOptions = [] } = trpc.artists.getMasterStyleTypes.useQuery();

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [pronouns, setPronouns] = useState(initial?.pronouns ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [tiktok, setTiktok] = useState(initial?.tiktok ?? "");
  const [youtube, setYoutube] = useState(initial?.youtube ?? "");
  const [portfolio, setPortfolio] = useState(initial?.portfolio ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [profilePicture, setProfilePicture] = useState(initial?.profilePicture ?? "");
  const [types, setTypes] = useState<string[]>(initial?.masterArtistTypeNames ?? []);
  const [services, setServices] = useState<string[]>(initial?.masterServiceTypeNames ?? []);
  const [styles, setStyles] = useState<string[]>(initial?.masterStyleNames ?? []);
  const [artswrkPro, setArtswrkPro] = useState<boolean>(!!initial?.artswrkPro);
  const [artswrkBasic, setArtswrkBasic] = useState<boolean>(!!initial?.artswrkBasic);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [welcomeSubject, setWelcomeSubject] = useState("Welcome to Artswrk! 🎉");
  const [welcomeHtml, setWelcomeHtml] = useState(
    `<p>Hey ${firstName || "there"},</p><p>The Artswrk Team here — so glad we connected!</p><p>Artswrk is the platform connecting artists to work. So excited to get you on our roster!</p><p>We've added you to our email list, so you'll get regular job updates from us. Below are your next steps:</p><ol><li><strong>Create your password:</strong> Using your email address, click here to set a password and login.</li><li><strong>Complete your profile:</strong> We added key details for you, but we want to know more! Add your resume, bio, and anything else that will help you get booked.</li><li><strong>Submit to open jobs:</strong> Check out the jobs board and send in a submission if you are interested and available. Not seeing any for you just yet? No worries — we are adding new clients every single day and will email you new opportunities.</li><li><strong>Once you're booked:</strong> Artswrk handles all payments &amp; 1099s on behalf of you and the client, so you can focus on WRK.</li><li><strong>Join Artswrk PRO:</strong> To get first dibs on higher-paying jobs, plus access to our health insurance and sick pay partners, upgrade your account for $110/year — annual only, and it starts with a 7-day free trial.</li></ol><p>If you have any questions, feel free to reply back to this email anytime. Artswrk is committed to innovating how you make money as an artist, and we are so thrilled to have you on the platform.</p><p>Talk soon,<br/>Nick Silverio &amp; Ramita Ravi<br/>Co-Founders, Artswrk</p>`
  );

  // Picking an artist type auto-selects its associated service types as a
  // convenience default — the admin can still freely deselect any of them
  // afterward, since this only ever adds, never removes.
  function handleTypesChange(nextTypes: string[]) {
    const added = nextTypes.filter(t => !types.includes(t));
    if (added.length) {
      const impliedServices = masterServiceTypeOptions
        .filter((s: any) => added.includes(s.artistTypeName))
        .map((s: any) => s.name);
      if (impliedServices.length) {
        setServices(prev => Array.from(new Set([...prev, ...impliedServices])));
      }
    }
    setTypes(nextTypes);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    onSave({
      firstName, lastName, email, pronouns, phoneNumber, location, bio, website,
      instagram, tiktok, youtube, portfolio, tagline, profilePicture, masterArtistTypes: types,
      masterServiceType: services, masterStyles: styles, artswrkPro, artswrkBasic,
      ...(isCreate ? {
        password: password || undefined,
        sendWelcomeEmail: sendWelcome,
        ...(sendWelcome ? { welcomeEmailSubject: welcomeSubject, welcomeEmailHtml: welcomeHtml } : {}),
        origin: window.location.origin,
      } : {}),
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
            <div className="rounded-xl border border-gray-200 focus-within:border-[#F25722] transition-colors bg-white">
              <LocationAutocompleteInput value={location} onChange={r => setLocation(r.formatted)} placeholder="New York, NY" icon={false} />
            </div>
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
        <ChipPicker label="Artist Types" options={masterArtistTypeOptions.map(t => t.name)} selected={types} onChange={handleTypesChange} />
        <ChipPicker label="Services" options={masterServiceTypeOptions.map(t => t.name)} selected={services} onChange={setServices} />
        <ChipPicker label="Styles" options={masterStyleOptions.map(t => t.name)} selected={styles} onChange={setStyles} />
      </div>

      {/* Social & Web */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Social & Web</h3>
        <div>
          <label className={labelCls}>Phone Number</label>
          <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="(555) 123-4567" className={inputCls} />
        </div>
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
        <div>
          <label className={labelCls}>TikTok</label>
          <input value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="@janedoe or full URL" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>YouTube</label>
          <input value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="Channel URL" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Portfolio</label>
          <input value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="https://portfolio.com" className={inputCls} />
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-[#111]">Send welcome email</p>
              <p className="text-xs text-gray-400 mt-0.5">A "Create Your Password" button is always appended, so the artist can log in no matter what you edit below.</p>
            </div>
            <button type="button" onClick={() => setSendWelcome(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${sendWelcome ? "bg-[#F25722]" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sendWelcome ? "translate-x-4" : ""}`} />
            </button>
          </label>
          {sendWelcome && (
            <div className="space-y-3 pt-1">
              <div>
                <label className={labelCls}>Subject</label>
                <input value={welcomeSubject} onChange={e => setWelcomeSubject(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Message</label>
                <RichTextEditor value={welcomeHtml} onChange={setWelcomeHtml} minHeight={200} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {isSaving ? (isCreate ? "Creating…" : "Saving…") : (isCreate ? "Create Artist" : "Save Changes")}
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
  const types = artist.masterArtistTypeNames ?? [];
  const services = artist.masterServiceTypeNames ?? [];
  const styles = artist.masterStyleNames ?? [];

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
                {artist.artistStripeAccountId ? (
                  <span title={artist.artistStripeAccountId} className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-[#635bff]/10 text-[#635bff]">
                    💳 Stripe Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                    Not connected to Stripe
                  </span>
                )}
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
const ONBOARDING_STAGES = [
  { value: 0, label: "Not started" },
  { value: 1, label: "Step 1" },
  { value: 2, label: "Step 2" },
  { value: 3, label: "Step 3" },
  { value: 4, label: "Complete" },
];

function ArtistsSection() {
  type View = { mode: "list" } | { mode: "detail"; id: number } | { mode: "edit"; id: number } | { mode: "create" };
  const [view, setView] = useState<View>({ mode: "list" });
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const { data: filterArtistTypeOptions = [] } = trpc.artists.getMasterArtistTypes.useQuery();
  const { data: filterServiceTypeOptions = [] } = trpc.artists.getMasterServiceTypes.useQuery();

  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [artistType, setArtistType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [state, setState] = useState("");
  const [plan, setPlan] = useState("");
  const [affiliationId, setAffiliationId] = useState<number | undefined>(undefined);
  const [onboardingStep, setOnboardingStepFilter] = useState<number | undefined>(undefined);
  const [missingProfilePicture, setMissingProfilePicture] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [modifiedFrom, setModifiedFrom] = useState("");
  const [modifiedTo, setModifiedTo] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "name">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);

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
    serviceType: serviceType || undefined,
    state: state || undefined,
    plan: plan || undefined,
    affiliationId,
    onboardingStep,
    missingProfilePicture: missingProfilePicture || undefined,
    stripeConnected: stripeConnected || undefined,
    createdFrom: createdFrom ? new Date(createdFrom) : undefined,
    createdTo: createdTo ? new Date(createdTo) : undefined,
    modifiedFrom: modifiedFrom ? new Date(modifiedFrom) : undefined,
    modifiedTo: modifiedTo ? new Date(modifiedTo) : undefined,
    sortBy,
    sortDir,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  }, { enabled: view.mode === "list" });

  const { data: affiliationsData } = trpc.artists.getAffiliations.useQuery();

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
    onSuccess: (created: any) => {
      utils.admin.artists.invalidate();
      if (created?.emailSent === false) {
        toast.warning("Artist created, but the welcome email failed to send — check server logs or resend it from their profile.");
      }
      if (created) setView({ mode: "detail", id: created.id });
    },
    onError: (e) => alert("Create failed: " + e.message),
  });

  const bulkEmail = trpc.admin.bulkEmailUsers.useMutation({
    onSuccess: (res) => {
      alert(`Sending to ${res.queued} of ${res.total} artist${res.total !== 1 ? "s" : ""}${res.skipped ? ` (${res.skipped} skipped — no email on file)` : ""}. Sends happen in the background.`);
      setBulkEmailOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e) => alert("Bulk email failed: " + e.message),
  });

  const bulkTag = trpc.admin.bulkAddAffiliation.useMutation({
    onSuccess: () => {
      utils.admin.artists.invalidate();
      setBulkTagOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e) => alert("Bulk tag failed: " + e.message),
  });

  const bulkPlan = trpc.admin.bulkSetArtistPlan.useMutation({
    onSuccess: () => {
      utils.admin.artists.invalidate();
      setSelectedIds(new Set());
    },
    onError: (e) => alert("Bulk plan update failed: " + e.message),
  });

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (!data?.artists.length) return;
    const allSelected = data.artists.every(a => selectedIds.has(a.id));
    setSelectedIds(allSelected ? new Set() : new Set(data.artists.map(a => a.id)));
  }
  function resetFilters() {
    setSearch(""); setLocationSearch(""); setArtistType(""); setServiceType("");
    setState(""); setPlan(""); setAffiliationId(undefined); setOnboardingStepFilter(undefined);
    setMissingProfilePicture(false); setStripeConnected(false); setCreatedFrom(""); setCreatedTo("");
    setModifiedFrom(""); setModifiedTo(""); setPage(1);
  }
  const hasActiveFilters = !!(search || locationSearch || artistType || serviceType || state || plan || affiliationId || onboardingStep !== undefined || missingProfilePicture || stripeConnected || createdFrom || createdTo || modifiedFrom || modifiedTo);

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
          isSaving={createArtist.isPending}
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
  const allOnPageSelected = !!data?.artists.length && data.artists.every(a => selectedIds.has(a.id));

  return (
    <div className="space-y-5">
      {bulkEmailOpen && (
        <BulkEmailModal
          count={selectedIds.size}
          isSending={bulkEmail.isPending}
          onClose={() => setBulkEmailOpen(false)}
          onSend={(subject, html) => bulkEmail.mutate({ userIds: [...selectedIds], subject, html })}
        />
      )}
      {bulkTagOpen && (
        <BulkTagModal
          affiliations={affiliationsData ?? []}
          isSaving={bulkTag.isPending}
          onClose={() => setBulkTagOpen(false)}
          onSave={(affiliationId) => bulkTag.mutate({ artistIds: [...selectedIds], affiliationId })}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">All Artists ({data?.total?.toLocaleString() ?? "…"})</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"}`} title="List view">
              <ListIcon size={15} />
            </button>
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-[#111]" : "text-gray-400 hover:text-gray-600"}`} title="Grid view">
              <LayoutGrid size={15} />
            </button>
          </div>
          <button
            onClick={() => setView({ mode: "create" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Create Artist
          </button>
        </div>
      </div>

      {/* Bulk action toolbar — sits above the filters, doesn't replace them */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
          <p className="text-sm font-semibold text-[#111]">{selectedIds.size} selected</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setBulkEmailOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors">
              <Mail size={12} /> Email Selected
            </button>
            <button onClick={() => setBulkTagOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors">
              <Tag size={12} /> Add Affiliation
            </button>
            <select
              onChange={e => { if (e.target.value) { bulkPlan.mutate({ artistIds: [...selectedIds], plan: e.target.value as any }); e.target.value = ""; } }}
              defaultValue=""
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <option value="" disabled>Set Plan…</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">PRO</option>
            </select>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold text-gray-500 hover:text-[#111] px-2">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Primary filters */}
          <div className="flex flex-wrap gap-3">
            <select value={artistType} onChange={e => { setArtistType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
              <option value="">Artist Type</option>
              {filterArtistTypeOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <select value={serviceType} onChange={e => { setServiceType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]">
              <option value="">Service Type</option>
              {filterServiceTypeOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
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
            <select
              value={affiliationId ?? ""}
              onChange={e => { setAffiliationId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]"
            >
              <option value="">Affiliation</option>
              {(affiliationsData ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.display}</option>)}
            </select>
            <button
              onClick={() => setMoreFiltersOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${moreFiltersOpen ? "bg-orange-50 border-orange-200 text-[#F25722]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
            >
              <SlidersHorizontal size={12} /> More Filters
            </button>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1 text-xs font-semibold text-[#F25722] hover:opacity-70 px-2">
                <X size={12} /> Reset
              </button>
            )}
          </div>

          {/* Search + location + sort */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, or credits (e.g. Wicked)…" className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
            </div>
            <div className="flex-1 min-w-[180px] bg-gray-50 rounded-xl border border-gray-200">
              <LocationAutocompleteInput value={locationSearch} onChange={r => setLocationSearch(r.formatted)} placeholder="Search location…" className="text-xs" />
            </div>
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={e => { const [by, dir] = e.target.value.split(":"); setSortBy(by as any); setSortDir(dir as any); }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]"
            >
              <option value="createdAt:desc">Newest Created</option>
              <option value="createdAt:asc">Oldest Created</option>
              <option value="updatedAt:desc">Recently Modified</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
            </select>
          </div>

          {/* More filters (collapsible) */}
          {moreFiltersOpen && (
            <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Onboarding Stage</label>
                <select
                  value={onboardingStep ?? ""}
                  onChange={e => { setOnboardingStepFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]"
                >
                  <option value="">Any</option>
                  {ONBOARDING_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Created</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={createdFrom} onChange={e => { setCreatedFrom(e.target.value); setPage(1); }} className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]" />
                  <span className="text-xs text-gray-400">to</span>
                  <input type="date" value={createdTo} onChange={e => { setCreatedTo(e.target.value); setPage(1); }} className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Modified</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={modifiedFrom} onChange={e => { setModifiedFrom(e.target.value); setPage(1); }} className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]" />
                  <span className="text-xs text-gray-400">to</span>
                  <input type="date" value={modifiedTo} onChange={e => { setModifiedTo(e.target.value); setPage(1); }} className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#F25722]" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer pb-2">
                <input type="checkbox" checked={missingProfilePicture} onChange={e => { setMissingProfilePicture(e.target.checked); setPage(1); }} className="rounded border-gray-300 text-[#F25722] focus:ring-[#F25722]" />
                Missing profile picture
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer pb-2">
                <input type="checkbox" checked={stripeConnected} onChange={e => { setStripeConnected(e.target.checked); setPage(1); }} className="rounded border-gray-300 text-[#F25722] focus:ring-[#F25722]" />
                Stripe Connect linked
              </label>
            </div>
          )}
      </div>

      {/* Select all */}
      {!!data?.artists.length && (
        <div className="flex items-center gap-4 px-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="rounded border-gray-300 text-[#F25722] focus:ring-[#F25722]" />
            Select all on page ({data.artists.length})
          </label>
          {data.total > data.artists.length && (
            <button
              onClick={async () => {
                const ids = await utils.admin.artistIds.fetch({
                  search: debouncedSearch || undefined,
                  locationSearch: debouncedLocation || undefined,
                  artistType: artistType || undefined,
                  serviceType: serviceType || undefined,
                  state: state || undefined,
                  plan: plan || undefined,
                  affiliationId,
                  onboardingStep,
                  missingProfilePicture: missingProfilePicture || undefined,
                  stripeConnected: stripeConnected || undefined,
                  createdFrom: createdFrom ? new Date(createdFrom) : undefined,
                  createdTo: createdTo ? new Date(createdTo) : undefined,
                  modifiedFrom: modifiedFrom ? new Date(modifiedFrom) : undefined,
                  modifiedTo: modifiedTo ? new Date(modifiedTo) : undefined,
                });
                setSelectedIds(new Set(ids));
              }}
              className="text-xs font-semibold text-[#F25722] hover:opacity-70"
            >
              Select all {data.total.toLocaleString()} matching filters
            </button>
          )}
        </div>
      )}

      {viewMode === "list" ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500">Artist</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Types</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Onboarding</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
                ) : data?.artists.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-xs">No artists found</td></tr>
                ) : data?.artists.map(a => {
                  const types = a.typeNames ?? [];
                  const stage = ONBOARDING_STAGES.find(s => s.value === (a.onboardingStep ?? 0));
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer ${selectedIds.has(a.id) ? "bg-orange-50/60" : ""}`}
                      onClick={() => setView({ mode: "detail", id: a.id })}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="rounded border-gray-300 text-[#F25722] focus:ring-[#F25722]" />
                      </td>
                      <td className="px-2 py-3">
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {a.artswrkPro ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">PRO</span>
                          ) : a.artswrkBasic ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Basic</span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Free</span>
                          )}
                          {a.artistStripeAccountId && (
                            <span title="Stripe Connect linked" className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#635bff]/10 text-[#635bff]">
                              💳 Connected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage?.value === 4 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                          {stage?.label ?? "—"}
                        </span>
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
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
          ) : data?.artists.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No artists found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {data?.artists.map(a => {
                const types = a.typeNames ?? [];
                const stage = ONBOARDING_STAGES.find(s => s.value === (a.onboardingStep ?? 0));
                return (
                  <div
                    key={a.id}
                    onClick={() => setView({ mode: "detail", id: a.id })}
                    className={`relative bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all ${selectedIds.has(a.id) ? "border-[#F25722]" : "border-gray-100"}`}
                  >
                    <div className="absolute top-2.5 left-2.5 z-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="rounded border-gray-300 text-[#F25722] focus:ring-[#F25722] w-4 h-4" />
                    </div>
                    <div className="aspect-square relative bg-gray-100">
                      {a.profilePicture ? (
                        <img src={a.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-2xl font-black">
                          {(displayName(a)[0] || "?").toUpperCase()}
                        </div>
                      )}
                      {a.artswrkPro && <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-white">PRO</span>}
                      {a.artistStripeAccountId && (
                        <span title="Stripe Connect linked" className="absolute bottom-2.5 right-2.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#635bff] text-white">💳</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-[#111] text-sm truncate">{displayName(a)}</p>
                      {a.location && <p className="text-xs text-gray-400 truncate mt-0.5">{a.location}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-wrap gap-1">
                          {types.slice(0, 1).map((t: string) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">{t}</span>
                          ))}
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stage?.value === 4 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                          {stage?.label ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {data && <Pagination page={page} total={data.total} limit={LIMIT} onPage={setPage} />}
        </div>
      )}
    </div>
  );
}

// ─── Bulk Email Modal ─────────────────────────────────────────────────────────
function BulkEmailModal({ count, isSending, onClose, onSend }: {
  count: number;
  isSending: boolean;
  onClose: () => void;
  onSend: (subject: string, html: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-black text-[#111]">Send a bulk email</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sending to {count} selected artist{count !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject…" className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722]" />
          <RichTextEditor value={html} onChange={setHtml} placeholder="Start typing your email…" minHeight={220} />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              onClick={() => onSend(subject, html)}
              disabled={isSending || !subject.trim() || !html.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Tag (Affiliation) Modal ─────────────────────────────────────────────
function BulkTagModal({ affiliations, isSaving, onClose, onSave }: {
  affiliations: { id: number; display: string }[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (affiliationId: number) => void;
}) {
  const [affiliationId, setAffiliationId] = useState<number | "">("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-[#111] mb-1">Add affiliation</h2>
        <p className="text-xs text-gray-400 mb-4">Tags every selected artist with this affiliation.</p>
        <select
          value={affiliationId}
          onChange={e => setAffiliationId(e.target.value ? Number(e.target.value) : "")}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] mb-5"
        >
          <option value="">Select affiliation…</option>
          {affiliations.map(a => <option key={a.id} value={a.id}>{a.display}</option>)}
        </select>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            onClick={() => affiliationId && onSave(affiliationId)}
            disabled={isSaving || !affiliationId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            Add Tag
          </button>
        </div>
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
      <AdminArtistForm initial={artist} onCancel={onBack} onSave={onSave} isSaving={isSaving} />
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

// Business-type classification for CLIENT accounts (studio/competition/school/etc.) —
// distinct from HIRING_CATEGORIES above, which is the artist-role list used when
// editing what a JOB is hiring for. Mixing these up was a real bug: the client
// edit form and filter dropdown were both reusing HIRING_CATEGORIES.
// Matches BUSINESS_TYPES in ClientOnboarding.tsx (the public signup picker) — keep
// both in sync if this list ever changes.
export const CLIENT_BUSINESS_TYPES = ["Dance Studio", "Dance Competition", "Music School", "Event Company", "Other"] as const;

/**
 * Dropdown multi-select for the benefit taxonomy fields.
 *
 * These were comma-separated free text, and the data drifted exactly as you'd
 * expect: "Dance Studio" and "Dance Studios" both exist as business types, and
 * the artist types on benefits ("Dance Teachers / Judges / Choreographer")
 * match nothing in master_artist_types. Picking from a list stops new rows
 * adding to that.
 *
 * Values already on a row that aren't in the canonical list are still shown and
 * still selected — dropping them silently on save would quietly delete real
 * data. They render amber so the legacy ones are obvious.
 */
function BenefitTagPicker({
  label, options, selected, onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on an outside click or Escape. Without this the panel stays open
  // behind whatever you click next, inside a modal that already scrolls.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const legacy = selected.filter((v) => !options.includes(v));
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  // Artist types run to a few dozen; a filter box beats scrolling for those.
  const searchable = options.length > 8;
  const visible = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>

      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm transition-colors hover:border-gray-300 focus:border-[#F25722] focus:outline-none"
      >
        <span className={selected.length ? "text-[#111]" : "text-gray-400"}>
          {selected.length ? selected.join(", ") : `Select ${label.toLowerCase()}…`}
        </span>
        <ChevronDown size={15} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full border-b border-gray-100 px-3.5 py-2.5 text-sm text-[#111] placeholder-gray-400 focus:outline-none"
            />
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-gray-400">No matches.</p>
            ) : visible.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[#111] transition-colors hover:bg-gray-50"
                >
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? "border-[#111] bg-[#111]" : "border-gray-300 bg-white"}`}>
                    {on && <Check size={11} className="text-white" strokeWidth={3} />}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(selected.length > 0 || legacy.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.filter((v) => options.includes(v)).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300"
            >
              {o} <X size={11} />
            </button>
          ))}
          {legacy.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              title="Not in the current list — kept from the existing data. Click to remove."
              className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
            >
              {o} <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const BENEFIT_AUDIENCES = ["Artist", "Client"] as const;
const BENEFIT_CATEGORIES = [
  "Apparel", "Business Coaching", "Classes", "Community", "Competition",
  "Convention", "Curriculum", "Live Event", "Services", "Software",
] as const;

/**
 * Logo picker for the benefit form: upload a file, or paste a URL.
 *
 * Was a bare URL text box, which meant every logo had to already be hosted
 * somewhere — so partners' logos ended up as hotlinks to their own sites, which
 * break when they redesign. Uploading puts a copy on our storage.
 */
function BenefitLogoInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = trpc.benefits.adminUploadLogo.useMutation();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) { setError("That file is over 5MB — please shrink it first."); return; }
    setBusy(true);
    try {
      const base64: string = await new Promise((res, rej) => {
        const r = new FileReader();
        // readAsDataURL gives "data:image/png;base64,XXXX" — the endpoint wants
        // just the payload.
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = () => rej(new Error("Could not read that file"));
        r.readAsDataURL(file);
      });
      const { url } = await upload.mutateAsync({ base64, contentType: file.type || "image/png", filename: file.name });
      onChange(url);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {value
            ? <img src={value} alt="" className="h-full w-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            : <ImageIcon size={18} className="text-gray-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => { void pick(e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
          </label>
          {value && (
            <button type="button" onClick={() => onChange("")} className="ml-2 text-xs font-semibold text-gray-400 hover:text-red-500">
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#F25722]"
        placeholder="…or paste an image URL"
      />
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

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
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? "");
  const [clientCompanyName, setClientCompanyName] = useState(initial?.clientCompanyName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [tiktok, setTiktok] = useState(initial?.tiktok ?? "");
  const [youtube, setYoutube] = useState(initial?.youtube ?? "");
  const [portfolio, setPortfolio] = useState(initial?.portfolio ?? "");
  const [profilePicture, setProfilePicture] = useState(initial?.profilePicture ?? "");
  const [businessOrIndividual, setBusinessOrIndividual] = useState(initial?.businessOrIndividual ?? "");
  // businessType is the real, Bubble-sourced business category (974 populated
  // clients) — drives Enterprise auto-detection. hiringCategory is a
  // separate, much sparser field kept for backward compat, still saved but
  // no longer the primary signal.
  const [businessType, setBusinessType] = useState(initial?.businessType ?? "");
  const [clientPremium, setClientPremium] = useState<boolean>(!!initial?.clientPremium);
  const [enterprise, setEnterprise] = useState<boolean>(!!initial?.enterprise);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      firstName, lastName, email, phoneNumber, clientCompanyName, location, website,
      instagram, tiktok, youtube, portfolio, profilePicture, businessOrIndividual, businessType,
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
            <div className="rounded-xl border border-gray-200 focus-within:border-[#F25722] transition-colors bg-white">
              <LocationAutocompleteInput value={location} onChange={r => setLocation(r.formatted)} placeholder="New York, NY" icon={false} />
            </div>
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
          <label className={labelCls}>Business Type</label>
          <select value={businessType} onChange={e => setBusinessType(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {CLIENT_BUSINESS_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Everything except Dance Studio and Music School is automatically Enterprise.</p>
        </div>
      </div>

      {/* Social & Web */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-[#111] uppercase tracking-wider">Social & Web</h3>
        <div>
          <label className={labelCls}>Phone Number</label>
          <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="(555) 123-4567" className={inputCls} />
        </div>
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
        <div>
          <label className={labelCls}>TikTok</label>
          <input value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="@company or full URL" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>YouTube</label>
          <input value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="Channel URL" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Portfolio</label>
          <input value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="https://portfolio.com" className={inputCls} />
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
    hiringCategory: (hiringCategory || undefined) as any,
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
          <option value="">Business Type</option>
          {CLIENT_BUSINESS_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
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
          <LocationAutocompleteInput value={locationSearch} onChange={r => setLocationSearch(r.formatted)} placeholder="Search Location..." icon={false} className="w-full" inputClassName="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
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
        <span className="text-[#111] font-semibold line-clamp-1 max-w-xs">{job.title || job.description?.slice(0, 50) || `Job #${job.id}`}</span>
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
              {job.title ? (
                <h2 className="text-xl font-black text-[#111]">{job.title}</h2>
              ) : (
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600 mb-1">No title set</span>
              )}
              <p className="text-xs text-gray-400 font-medium mb-0.5">Posted by {clientName}</p>
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const location = useLocationField();
  const [hiringCategory, setHiringCategory] = useState("");
  const [clientHourlyRate, setClientHourlyRate] = useState("");
  const [artistHourlyRate, setArtistHourlyRate] = useState("");
  const [openRate, setOpenRate] = useState(false);

  useEffect(() => {
    if (job) {
      setTitle(job.title || "");
      setDescription(job.description || "");
      setRequestStatus(job.requestStatus || "");
      location.reset(job.locationAddress);
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
      <form onSubmit={e => { e.preventDefault(); onSave({ title, description, requestStatus, locationAddress: location.value, locationData: location.locationData, hiringCategory, clientHourlyRate: clientHourlyRate ? Number(clientHourlyRate) : null, artistHourlyRate: artistHourlyRate ? Number(artistHourlyRate) : null, openRate }); }} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div><label className={labelCls}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Ballet Substitute Teacher" className={inputCls} /></div>
          <div><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className={`${inputCls} resize-none`} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Status</label>
              <select value={requestStatus} onChange={e => setRequestStatus(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Location</label><LocationAutocompleteInput value={location.value} onChange={location.onChange} kind="any" placeholder="City, State" icon={false} inputClassName={inputCls} /></div>
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
/**
 * Job-alert queue state, in words an admin can act on. The column values are
 * terse (`pending`, `sent_digest`, `suppressed`), and the difference between
 * "will be emailed" and "will never be emailed" is the thing worth seeing at a
 * glance — a job stuck in the wrong state either spams people or reaches
 * nobody, and neither is visible anywhere else.
 */
const NETWORK_STATUS_META: Record<string, { label: string; cls: string; hint: string }> = {
  pending:         { label: "Queued",    cls: "bg-amber-50 text-amber-700 border-amber-200",   hint: "Will be emailed at the next 1pm ET digest" },
  sent_digest:     { label: "Sent",      cls: "bg-green-50 text-green-700 border-green-200",   hint: "Went out in a daily digest" },
  sent_lastminute: { label: "Sent · urgent", cls: "bg-green-50 text-green-700 border-green-200", hint: "Went out immediately as a last-minute alert" },
  expired:         { label: "Expired",   cls: "bg-gray-100 text-gray-500 border-gray-200",     hint: "Start date passed before it was ever sent" },
  suppressed:      { label: "Held back", cls: "bg-gray-100 text-gray-500 border-gray-200",     hint: "Excluded from job alerts — never emailed" },
};

function NetworkStatusBadge({ status, sentAt }: { status?: string | null; sentAt?: string | Date | null }) {
  // Null predates the job-alert system and is treated as suppressed everywhere,
  // so it reads the same here rather than as a mystery blank.
  const meta = NETWORK_STATUS_META[status ?? "suppressed"] ?? NETWORK_STATUS_META.suppressed;
  return (
    <span
      title={sentAt ? `${meta.hint} — ${fmtDate(sentAt as any)}` : meta.hint}
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

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
          <LocationAutocompleteInput value={locationSearch} onChange={r => setLocationSearch(r.formatted)} placeholder="Search location…" icon={false} className="w-full" inputClassName="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client / Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Title / Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Job alerts</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Posted</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : data?.jobs.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">No jobs found</td></tr>
              ) : data?.jobs.map(j => (
                <tr key={j.id} className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer" onClick={() => setView({ mode: "detail", id: j.id })}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#111] text-xs">{j.clientName || j.clientFirstName ? displayName({ name: j.clientName, firstName: j.clientFirstName, lastName: j.clientLastName }) : "—"}</p>
                    <p className="text-[10px] text-gray-400">{j.clientCompanyName || j.clientEmail || "—"}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    {(j as any).title ? (
                      <p className="text-xs font-semibold text-[#111] line-clamp-1">{(j as any).title}</p>
                    ) : (
                      <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 mb-0.5">No title</span>
                    )}
                    <p className="text-[10px] text-gray-400 line-clamp-1">{j.description || "—"}</p>
                    {j.locationAddress && <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={9} />{j.locationAddress}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#111]">{j.openRate ? "Open Rate" : j.clientHourlyRate ? `$${j.clientHourlyRate}/hr` : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(j.requestStatus)}`}>{j.requestStatus || "—"}</span></td>
                  <td className="px-4 py-3"><NetworkStatusBadge status={(j as any).networkStatus} sentAt={(j as any).networkSentAt} /></td>
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
                <div className="mt-4">
                  <a href={b.stripeCheckoutUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:underline">
                    <ExternalLink size={11} /> Legacy Bubble payment link
                  </a>
                  {/* Kept for support lookups only. These are Bubble Payment
                      Links whose product is unrelated to this booking — never
                      send a client here to pay. */}
                  <p className="mt-1 text-[11px] text-gray-400">
                    Imported from Bubble — bills for an unrelated product. Do not send to clients.
                  </p>
                </div>
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
  const proLocation = useLocationField();
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
    proLocation.reset(job.location);
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
      <form onSubmit={e => { e.preventDefault(); onSave({ company, serviceType, category, budget, description, location: proLocation.value, locationData: proLocation.locationData, status, workFromAnywhere, featured, applyDirect, applyEmail, applyLink, tag }); }} className="space-y-5">
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
            <div><label className={labelCls}>Location</label><LocationAutocompleteInput value={proLocation.value} onChange={proLocation.onChange} kind="any" placeholder="City, State" icon={false} inputClassName={inputCls} /></div>
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

// ─── Benefits Section ────────────────────────────────────────────────────────
type AdminBenefit = {
  id: number;
  companyName: string | null;
  logoUrl: string | null;
  url: string | null;
  businessDescription: string | null;
  discountOffering: string | null;
  howToRedeem: string | null;
  contactName: string | null;
  contactEmail: string | null;
  audienceTypes: string | null;
  businessTypes: string | null;
  artistTypes: string | null;
  categories: string | null;
  createdAt: Date | string | null;
};

function parseJsonArr(v?: string | null): string[] {
  try { return JSON.parse(v || "[]") as string[]; } catch { return []; }
}

function csvToArr(v: string): string[] {
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

function BenefitFormModal({ benefit, onClose, onSaved }: { benefit?: AdminBenefit; onClose: () => void; onSaved: () => void }) {
  const isCreate = !benefit;
  const [companyName, setCompanyName] = useState(benefit?.companyName ?? "");
  const [logoUrl, setLogoUrl] = useState(benefit?.logoUrl ?? "");
  const [url, setUrl] = useState(benefit?.url ?? "");
  const [businessDescription, setBusinessDescription] = useState(benefit?.businessDescription ?? "");
  const [discountOffering, setDiscountOffering] = useState(benefit?.discountOffering ?? "");
  const [howToRedeem, setHowToRedeem] = useState(benefit?.howToRedeem ?? "");
  const [contactName, setContactName] = useState(benefit?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(benefit?.contactEmail ?? "");
  const [audienceTypes, setAudienceTypes] = useState<string[]>(parseJsonArr(benefit?.audienceTypes));
  const [businessTypes, setBusinessTypes] = useState<string[]>(parseJsonArr(benefit?.businessTypes));
  const [artistTypes, setArtistTypes] = useState<string[]>(parseJsonArr(benefit?.artistTypes));
  const { data: artistTypeOptions = [] } = trpc.artists.getMasterArtistTypes.useQuery();
  const [categories, setCategories] = useState<string[]>(parseJsonArr(benefit?.categories));

  const utils = trpc.useUtils();
  const createMutation = trpc.benefits.adminCreate.useMutation({
    onSuccess: () => { utils.benefits.adminList.invalidate(); onSaved(); },
  });
  const updateMutation = trpc.benefits.adminUpdate.useMutation({
    onSuccess: () => { utils.benefits.adminList.invalidate(); onSaved(); },
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      companyName,
      logoUrl: logoUrl || null,
      url: url || null,
      businessDescription: businessDescription || null,
      discountOffering: discountOffering || null,
      howToRedeem: howToRedeem || null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      audienceTypes,
      businessTypes,
      artistTypes,
      categories,
    };
    if (isCreate) createMutation.mutate(data);
    else updateMutation.mutate({ id: benefit.id, ...data });
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#F25722] transition-colors bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-black text-[#111]">{isCreate ? "Add Benefit" : "Edit Benefit"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} required className={inputCls} placeholder="e.g. RecitalReady" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Logo</label>
              <BenefitLogoInput value={logoUrl} onChange={setLogoUrl} />
            </div>
            <div>
              <label className={labelCls}>Website URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} className={inputCls} placeholder="https://…" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Business Description</label>
            <textarea value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} className={inputCls + " min-h-[70px]"} placeholder="What this company does…" />
          </div>
          <div>
            <label className={labelCls}>Discount Offering</label>
            <input value={discountOffering} onChange={e => setDiscountOffering(e.target.value)} className={inputCls} placeholder="e.g. 15% off annual subscription" />
          </div>
          <div>
            <label className={labelCls}>How to Redeem</label>
            <textarea value={howToRedeem} onChange={e => setHowToRedeem(e.target.value)} className={inputCls + " min-h-[60px]"} placeholder="Instructions for redeeming the offer…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact Email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100" />
          <div>
            <BenefitTagPicker label="Audience" options={BENEFIT_AUDIENCES} selected={audienceTypes} onChange={setAudienceTypes} />
          </div>
          <div>
            <BenefitTagPicker label="Categories" options={BENEFIT_CATEGORIES} selected={categories} onChange={setCategories} />
          </div>
          <BenefitTagPicker label="Business Types" options={CLIENT_BUSINESS_TYPES} selected={businessTypes} onChange={setBusinessTypes} />
          <BenefitTagPicker
            label="Artist Types"
            options={artistTypeOptions.map((t: any) => t.name)}
            selected={artistTypes}
            onChange={setArtistTypes}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !companyName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              {isCreate ? "Add Benefit" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BenefitsSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminBenefit | null | undefined>(undefined); // undefined = closed, null = create
  const [deleteTarget, setDeleteTarget] = useState<AdminBenefit | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.benefits.adminList.useQuery({
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
    search: debouncedSearch || undefined,
  });

  const deleteMutation = trpc.benefits.adminDelete.useMutation({
    onSuccess: () => { utils.benefits.adminList.invalidate(); setDeleteTarget(null); },
  });

  return (
    <div className="space-y-5">
      {editing !== undefined && (
        <BenefitFormModal
          benefit={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSaved={() => setEditing(undefined)}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-[#111] mb-2">Delete this benefit?</h3>
            <p className="text-sm text-gray-500 mb-5">
              "{deleteTarget.companyName}" will be permanently removed and will no longer show in any member's Benefits Hub. This can't be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#111]">
            Benefits
            <span className="ml-2 text-sm font-normal text-gray-400">({data?.total?.toLocaleString() ?? "…"} total)</span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage the partner discounts shown in members' Benefits Hub</p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          <Plus size={15} /> Add Benefit
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search benefits…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#F25722] bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Benefit</th>
                <th className="px-5 py-3">Categories</th>
                <th className="px-5 py-3">Audience</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading benefits…</td></tr>
              ) : !data?.benefits?.length ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No benefits found.</td></tr>
              ) : (
                data.benefits.map((b: AdminBenefit) => {
                  const logo = b.logoUrl?.startsWith("//") ? `https:${b.logoUrl}` : b.logoUrl;
                  const cats = parseJsonArr(b.categories);
                  const audience = parseJsonArr(b.audienceTypes);
                  return (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {logo ? (
                            <img src={logo} alt={b.companyName ?? ""} className="w-9 h-9 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                              {(b.companyName ?? "?")[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-[#111] truncate">{b.companyName}</p>
                            {b.discountOffering && <p className="text-xs text-gray-400 truncate max-w-[220px]">{b.discountOffering}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {cats.length ? cats.join(", ") : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {audience.length ? audience.map(a => (
                            <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] font-semibold">{a}</span>
                          )) : <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">{fmtDate(b.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditing(b)}
                            className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-[#111] hover:border-gray-300 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(b)}
                            className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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
  enterpriseSubInterval?: "month" | "year" | null;
  hiringCategory: string | null;
  businessType: string | null;
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
  const [localInterval, setLocalInterval] = useState<"month" | "year" | null>(client.enterpriseSubInterval ?? null);
  const [localBusinessType, setLocalBusinessType] = useState(client.businessType ?? "");
  const utils = trpc.useUtils();

  const updateClient = trpc.admin.updateClient.useMutation({
    onSuccess: () => utils.admin.enterpriseClients.invalidate(),
  });
  function handleBusinessTypeChange(value: string) {
    setLocalBusinessType(value);
    updateClient.mutate({ id: client.id, businessType: (value || undefined) as any });
  }

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
  const adminUnlock = trpc.admin.adminUnlockEnterpriseJob.useMutation();
  const [unlockingJobId, setUnlockingJobId] = useState<number | null>(null);
  const [manuallyUnlockedJobIds, setManuallyUnlockedJobIds] = useState<Set<number>>(new Set());
  async function handleAdminUnlock(e: React.MouseEvent, jobId: number) {
    e.stopPropagation();
    if (!confirm('Unlock this job for the client at no charge?')) return;
    setUnlockingJobId(jobId);
    try {
      const result = await adminUnlock.mutateAsync({ clientUserId: client.id, jobId });
      if (result.success) {
        setManuallyUnlockedJobIds(prev => new Set([...prev, jobId]));
      }
    } catch (err: any) {
      alert('Failed to unlock: ' + err.message);
    } finally {
      setUnlockingJobId(null);
    }
  }

  async function handlePlanChange(plan: EnterprisePlan, interval?: "month" | "year" | null) {
    setLocalPlan(plan);
    if (plan !== "subscriber") setLocalInterval(null);
    await setPlan.mutateAsync({ userId: client.id, plan, interval: plan === "subscriber" ? (interval ?? localInterval) : null });
  }
  async function handleIntervalChange(interval: "month" | "year") {
    setLocalInterval(interval);
    await setPlan.mutateAsync({ userId: client.id, plan: "subscriber", interval });
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
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <select
                value={localBusinessType}
                onChange={e => handleBusinessTypeChange(e.target.value)}
                className="text-xs px-2 py-1 rounded-full bg-orange-50 text-[#F25722] font-semibold border-none focus:outline-none focus:ring-1 focus:ring-[#F25722] cursor-pointer"
              >
                <option value="">Set business type…</option>
                {CLIENT_BUSINESS_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
            <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2">
              <p className="text-xs text-purple-600 mb-2">
                This client has a <strong>subscription</strong> — unlimited candidate access.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-700 font-semibold">Billing interval:</span>
                <button
                  onClick={() => handleIntervalChange("month")}
                  disabled={setPlan.isPending}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${localInterval === "month" ? "bg-purple-200 border-purple-400 text-purple-800" : "bg-white border-purple-200 text-purple-400 hover:bg-purple-100"}`}
                >
                  Monthly — $500/mo
                </button>
                <button
                  onClick={() => handleIntervalChange("year")}
                  disabled={setPlan.isPending}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${localInterval === "year" ? "bg-purple-200 border-purple-400 text-purple-800" : "bg-white border-purple-200 text-purple-400 hover:bg-purple-100"}`}
                >
                  Annual — $5,000/yr
                </button>
                {!localInterval && <span className="text-xs text-purple-400 italic">No interval set</span>}
              </div>
            </div>
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
                    <div className="flex items-stretch">
                      <button
                        onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                        className="flex-1 text-left p-4 hover:bg-white transition-colors"
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
                      {/* Admin Unlock button — only show for on-demand clients */}
                      {localPlan === 'on_demand' && (
                        <div className="flex items-center px-3 border-l border-gray-100">
                          {manuallyUnlockedJobIds.has(job.id) ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg">
                              <CheckCircle2 size={11} /> Unlocked
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleAdminUnlock(e, job.id)}
                              disabled={unlockingJobId === job.id}
                              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                              title="Unlock this job for the client at no charge"
                            >
                              {unlockingJobId === job.id ? (
                                <div className="w-3 h-3 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
                              ) : (
                                <Key size={11} />
                              )}
                              Unlock
                            </button>
                          )}
                        </div>
                      )}
                    </div>

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

// ─── Create Enterprise Account Modal ─────────────────────────────────────────

function CreateEnterpriseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    email: "",
    companyName: "",
    firstName: "",
    lastName: "",
    plan: "" as "" | "on_demand" | "subscriber",
    businessType: "",
    businessOrIndividual: "Business" as "Business" | "Individual",
  });
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [result, setResult] = useState<{ email: string; setupUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = trpc.artistProfile.uploadFile.useMutation();
  const create = trpc.admin.createEnterpriseAccount.useMutation({
    onSuccess: (data) => {
      setResult({ email: data.email, setupUrl: data.setupUrl });
      onCreated();
    },
    onError: (e) => setError(e.message),
  });

  const fullSetupUrl = result ? `${window.location.origin}${result.setupUrl}` : "";

  function handleCopy() {
    navigator.clipboard.writeText(fullSetupUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await uploadFile.mutateAsync({ base64, mimeType: file.type, fileName: file.name, folder: "enterprise-logos" });
      setLogoUrl(url);
    } catch {
      setError("Logo upload failed — try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    create.mutate({
      email: form.email.trim(),
      companyName: form.companyName.trim(),
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      plan: form.plan || undefined,
      businessType: (form.businessType || undefined) as any,
      businessOrIndividual: form.businessOrIndividual,
      logoUrl: logoUrl || undefined,
    });
  }

  const field = "w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#F25722] transition-colors bg-white";
  const label = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-[#111]">Create Enterprise Account</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Account is created without a password — the organization receives a setup link.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Logo upload */}
            <div>
              <label className={label}>Organization logo</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-[#F25722] transition-colors overflow-hidden flex-shrink-0 bg-gray-50"
                >
                  {logoUploading ? (
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={20} className="text-gray-300" />
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs font-semibold text-[#F25722] hover:underline"
                  >
                    {logoUrl ? "Change logo" : "Upload logo"}
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5MB</p>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            {/* Company name */}
            <div>
              <label className={label}>Company / Organization name *</label>
              <input required value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} className={field} placeholder="e.g. Stars of Tomorrow Dance Competition" />
            </div>

            {/* Email */}
            <div>
              <label className={label}>Contact email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={field} placeholder="director@competition.com" />
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>First name</label>
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className={field} placeholder="Jane" />
              </div>
              <div>
                <label className={label}>Last name</label>
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className={field} placeholder="Smith" />
              </div>
            </div>

            {/* Business type + Hiring category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Account type</label>
                <select value={form.businessOrIndividual} onChange={e => setForm(f => ({ ...f, businessOrIndividual: e.target.value as any }))} className={field}>
                  <option value="Business">Business</option>
                  <option value="Individual">Individual</option>
                </select>
              </div>
              <div>
                <label className={label}>Business Type</label>
                <select value={form.businessType} onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))} className={field}>
                  <option value="">None (set later)</option>
                  {CLIENT_BUSINESS_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Plan */}
            <div>
              <label className={label}>Plan</label>
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value as any }))} className={field}>
                <option value="">None (set later)</option>
                <option value="on_demand">On Demand</option>
                <option value="subscriber">Subscriber</option>
              </select>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending || logoUploading}
                className="px-5 py-2.5 text-sm font-bold text-white bg-[#111] rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {create.isPending ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : "Create account"}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-6 space-y-5">
            {/* Success */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111]">Account created for {result.email}</p>
                <p className="text-xs text-gray-500">Share the setup link so they can set their password and access the enterprise dashboard.</p>
              </div>
            </div>

            {/* Setup link */}
            <div>
              <label className={label}>Setup link (send this to the client)</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={fullSetupUrl}
                  className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-600 select-all"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 ${copied ? "bg-green-500 text-white" : "bg-[#111] text-white hover:bg-gray-800"}`}
                >
                  {copied ? <><CheckCircle2 size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">This link lets them set their password and access their enterprise dashboard.</p>
            </div>

            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-white bg-[#111] rounded-xl hover:bg-gray-800 transition-colors">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Enterprise Clients Section ───────────────────────────────────────────────

function EnterpriseClientsSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<EnterpriseClient | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const LIMIT = 50;

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, refetch } = trpc.admin.enterpriseClients.useQuery({
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
    search: debouncedSearch || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div className="space-y-5">
      {selectedClient && <EnterpriseClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
      {createOpen && (
        <CreateEnterpriseModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => refetch()}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">
          Enterprise Clients
          <span className="ml-2 text-sm font-normal text-gray-400">({data?.total?.toLocaleString() ?? "…"} total)</span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            <Plus size={15} /> Create Enterprise Account
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
            <Building2 size={13} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-600">Enterprise / PRO Accounts</span>
          </div>
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

// ─── Emails Section ───────────────────────────────────────────────────────────

type EmailCategory = "artist" | "client" | "both";

interface EmailEntry {
  name: string;
  trigger: string;
  to: string;
  cc?: string;
  subject: string;
  contentSummary: string;
  category: EmailCategory;
  implemented: boolean;
}

const EMAIL_CATALOG: EmailEntry[] = [
  {
    name: "Artist Welcome",
    trigger: "Artist creates an account",
    to: "Artist",
    subject: "Welcome to Artswrk! 🎉",
    contentSummary: "Welcomes the artist, explains how to get started: create profile, browse jobs, choose a plan. Links to dashboard.",
    category: "artist",
    implemented: true,
  },
  {
    name: "Password Reset",
    trigger: "User requests password reset",
    to: "User (artist or client)",
    subject: "Reset your Artswrk password",
    contentSummary: "Contains a secure reset link valid for a limited time.",
    category: "both",
    implemented: true,
  },
  {
    name: "Regular Job Posted",
    trigger: "Client posts a regular job and it goes live",
    to: "Client",
    subject: "Your job is live on Artswrk! 🎉",
    contentSummary: "Confirms job is live. Shows job card: service type, date, location, rate, description. Button to view the job posting.",
    category: "client",
    implemented: true,
  },
  {
    name: "PRO / Enterprise Job Posted",
    trigger: "Enterprise client posts a PRO job",
    to: "Enterprise client",
    cc: "support@artswrk.com",
    subject: "Your job has been posted!",
    contentSummary: "Branded confirmation. Shows job card: job title, company, location, description. Inline link to view the specific job at /enterprise/{jobId}.",
    category: "client",
    implemented: true,
  },
  {
    name: "Regular Job — New Applicant Alert",
    trigger: "Artist applies to a regular job",
    to: "Client (job poster)",
    subject: "Artist applied to your job (via SendGrid template)",
    contentSummary: "Alerts client that an artist expressed interest. Uses SendGrid dynamic template. Links to client dashboard.",
    category: "client",
    implemented: true,
  },
  {
    name: "Regular Job — Application Confirmation",
    trigger: "Artist applies to a regular job",
    to: "Artist",
    subject: "Your application was received (via SendGrid template)",
    contentSummary: "Confirms the artist's submission. Uses SendGrid dynamic template. Shows job details and links to artist dashboard.",
    category: "artist",
    implemented: true,
  },
  {
    name: "PRO Job — Artist Applied Alert",
    trigger: "Artist applies to a PRO job",
    to: "Client (job poster)",
    cc: "support@artswrk.com",
    subject: "[FirstName] [L]. is available for your job!",
    contentSummary: "Shows artist's cover message in a gray box. Shows job details (title, location, description) with a pink left border. 'View Submission →' black CTA button linking to /enterprise/{jobId}.",
    category: "client",
    implemented: true,
  },
  {
    name: "PRO Job — Submission Confirmation",
    trigger: "Artist applies to a PRO job",
    to: "Artist",
    cc: "support@artswrk.com",
    subject: "Your submission has been received!",
    contentSummary: "Confirms submission sent to client. Shows job details (service, location, description). Links to artist dashboard. Notes they'll be notified when client responds.",
    category: "artist",
    implemented: true,
  },
  {
    name: "New Message",
    trigger: "User sends a message to another user",
    to: "Message recipient",
    subject: "New message from [Sender] on Artswrk",
    contentSummary: "Shows a preview of the message (up to 200 chars). 'Reply on Artswrk →' gradient CTA button.",
    category: "both",
    implemented: true,
  },
];

const CATEGORY_LABELS: Record<EmailCategory, { label: string; color: string }> = {
  artist: { label: "Artist", color: "bg-purple-100 text-purple-700" },
  client: { label: "Client", color: "bg-blue-100 text-blue-700" },
  both: { label: "Both", color: "bg-gray-100 text-gray-600" },
};

/**
 * Job alert master switch. The one control that decides whether automated job
 * emails reach real artists. Deliberately loud and deliberately awkward to turn
 * on — a mis-click here mails thousands of people.
 */
/**
 * The queue itself, plus a real render of the email — both behind a toggle so
 * the switch panel stays uncluttered.
 *
 * The switch already showed a queue COUNT, which can't answer "did MY job go
 * out?" — the question anyone actually asks when a post seems to have gone
 * quiet. This lists the jobs and their send state, and previews the exact HTML
 * an artist would receive without sending anything.
 */
function JobAlertQueuePanel() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ mode: "last-minute" | "digest"; jobId?: number } | null>(null);

  const { data: queue, isLoading } = trpc.admin.listJobAlertQueue.useQuery(
    { limit: 50 },
    { enabled: open },
  );

  const STATUS_STYLE: Record<string, string> = {
    pending: "text-amber-700 bg-amber-50 border-amber-200",
    sent_digest: "text-green-700 bg-green-50 border-green-200",
    sent_lastminute: "text-green-700 bg-green-50 border-green-200",
    expired: "text-gray-500 bg-gray-100 border-gray-200",
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: "In queue",
    sent_digest: "Sent (digest)",
    sent_lastminute: "Sent (last minute)",
    expired: "Expired",
  };

  const fmt = (d: string | Date | null) =>
    d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const pending = (queue ?? []).filter((j) => j.networkStatus === "pending");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="text-sm font-black text-[#111]">Queue &amp; email preview</p>
          <p className="text-xs text-gray-400 mt-0.5">
            See which jobs are waiting, and exactly what the email looks like — nothing is sent.
          </p>
        </div>
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreview({ mode: "digest" })}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Preview digest ({pending.length} job{pending.length === 1 ? "" : "s"})
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-400">Loading queue…</p>
          ) : !queue?.length ? (
            <p className="text-sm text-gray-400">No active jobs in the alert queue.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 text-left">
                    <th className="py-2 pr-3">Job</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 whitespace-nowrap">Posted</th>
                    <th className="py-2 pr-3 whitespace-nowrap">Sent</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queue.map((j) => (
                    <tr key={j.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-[#111]">{j.title || `Job #${j.id}`}</p>
                        <p className="text-xs text-gray-400">
                          {[j.client, j.locationAddress].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLE[j.networkStatus] ?? STATUS_STYLE.expired}`}>
                          {STATUS_LABEL[j.networkStatus] ?? j.networkStatus}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500 whitespace-nowrap">{fmt(j.createdAt)}</td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500 whitespace-nowrap">{fmt(j.networkSentAt)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setPreview({ mode: "last-minute", jobId: j.id })}
                          className="text-xs font-bold text-[#F25722] hover:underline whitespace-nowrap"
                        >
                          Preview email
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {preview && <JobAlertPreviewModal {...preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/** Renders the real email HTML in a sandboxed iframe. */
function JobAlertPreviewModal({
  mode, jobId, onClose,
}: { mode: "last-minute" | "digest"; jobId?: number; onClose: () => void }) {
  const { data, isLoading, error } = trpc.admin.previewJobAlert.useQuery({ mode, jobId, isProMember: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Job alert email preview"
           className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#F25722]">
              {mode === "digest" ? "Daily digest" : "Last-minute blast"} · preview only, nothing sent
            </p>
            <p className="truncate text-sm font-black text-[#111]">{data?.subject ?? "Loading…"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100">
          {isLoading ? (
            <p className="p-6 text-sm text-gray-400">Rendering…</p>
          ) : error ? (
            <p className="p-6 text-sm text-red-500">{error.message}</p>
          ) : (
            // sandbox with no allow-scripts: it's email HTML, and it should not
            // be able to run anything inside the admin page.
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={data?.html ?? ""}
              className="h-[70vh] w-full border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function JobAlertsSwitch() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getJobAlertStatus.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const [confirming, setConfirming] = useState(false);
  const setEnabled = trpc.admin.setJobAlertEnabled.useMutation({
    onSuccess: () => { setConfirming(false); utils.admin.getJobAlertStatus.invalidate(); },
  });

  if (isLoading || !data) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-400">Loading job alert status…</div>;
  }

  const on = data.enabled && !data.killSwitch;
  const limited = on && data.allowlist.length > 0;

  return (
    <div className={`rounded-2xl border-2 bg-white overflow-hidden ${on && !limited ? "border-[#ec008c]" : "border-gray-200"}`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${on ? (limited ? "bg-amber-500" : "bg-[#ec008c]") : "bg-gray-300"}`} />
              <h2 className="text-lg font-black text-[#111]">
                Automated job alerts are {on ? (limited ? "ON — test mode" : "ON") : "OFF"}
              </h2>
            </div>
            <p className="text-sm text-gray-500 max-w-xl leading-relaxed">
              {on && !limited
                ? "Matched artists will receive the daily 1pm digest and last-minute alerts. This is live."
                : limited
                ? `Sending is on, but only these addresses can receive anything: ${data.allowlist.join(", ")}.`
                : "Everything runs — matching, assembling, logging — but no email is sent to anyone."}
            </p>
            {data.killSwitch && (
              <p className="text-sm text-red-600 font-semibold mt-2">
                JOB_ALERTS_KILL is set in the environment. Nothing sends regardless of this switch.
              </p>
            )}
            {data.lastChangedBy && (
              <p className="text-xs text-gray-400 mt-2">
                Last changed by {data.lastChangedBy}{data.lastChangedAt ? ` · ${fmtDate(data.lastChangedAt as any)}` : ""}
              </p>
            )}
          </div>

          <div className="flex-shrink-0">
            {on ? (
              <button
                onClick={() => setEnabled.mutate({ enabled: false })}
                disabled={setEnabled.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
              >
                {setEnabled.isPending ? "Turning off…" : "Turn OFF"}
              </button>
            ) : confirming ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEnabled.mutate({ enabled: true })}
                  disabled={setEnabled.isPending || data.killSwitch}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(90deg,#ec008c,#ff7171)" }}
                >
                  {setEnabled.isPending ? "Turning on…" : "Yes, start emailing artists"}
                </button>
                <button onClick={() => setConfirming(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={data.killSwitch}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(90deg,#ec008c,#ff7171)" }}
              >
                Turn ON
              </button>
            )}
          </div>
        </div>

        {confirming && !on && (
          <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 leading-relaxed">
            <b>{data.queuedJobs + data.queuedProJobs} job{data.queuedJobs + data.queuedProJobs === 1 ? "" : "s"} are waiting in the queue.</b>{" "}
            Turning this on means the next 1pm run emails every artist who matches them, and any
            job posted within 48 hours of its start goes out immediately.
            {data.allowlist.length === 0 && " No allowlist is set, so these go to real artists."}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-100 divide-x divide-gray-100 bg-gray-50/60">
        {[
          ["In the queue", data.queuedJobs + data.queuedProJobs],
          ["Emails last 24h", data.emailsLast24h],
          ["Emails all time", data.emailsAllTime],
          ["Suppressed", data.suppressedAddresses],
        ].map(([label, value]) => (
          <div key={label as string} className="px-4 py-3">
            <p className="text-lg font-black text-[#111] tabular-nums">{Number(value).toLocaleString()}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailsSection() {
  const [filter, setFilter] = useState<"all" | EmailCategory>("all");

  const filtered = filter === "all" ? EMAIL_CATALOG : EMAIL_CATALOG.filter(e => e.category === filter || e.category === "both");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#111] mb-1">Transactional Emails</h1>
        <p className="text-sm text-gray-400">All automated emails that go out from Artswrk — triggers, recipients, and content.</p>
      </div>

      <JobAlertsSwitch />
      <JobAlertQueuePanel />

      {/* Filter pills */}
      <div className="flex gap-2">
        {(["all", "artist", "client", "both"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
              filter === f ? "bg-[#111] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All emails" : f === "both" ? "Both audiences" : `To ${f}`}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total templates", value: EMAIL_CATALOG.length },
          { label: "Implemented", value: EMAIL_CATALOG.filter(e => e.implemented).length },
          { label: "With CC", value: EMAIL_CATALOG.filter(e => e.cc).length },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-black text-[#111]">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Email cards */}
      <div className="space-y-3">
        {filtered.map(email => (
          <div key={email.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-[#111]">{email.name}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_LABELS[email.category].color}`}>
                  {CATEGORY_LABELS[email.category].label}
                </span>
                {email.implemented && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Live</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex gap-2">
                <span className="font-semibold text-gray-400 w-16 flex-shrink-0">Trigger</span>
                <span className="text-gray-700">{email.trigger}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-gray-400 w-16 flex-shrink-0">To</span>
                <span className="text-gray-700">{email.to}</span>
              </div>
              {email.cc && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-400 w-16 flex-shrink-0">CC</span>
                  <span className="text-gray-700">{email.cc}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="font-semibold text-gray-400 w-16 flex-shrink-0">Subject</span>
                <span className="text-gray-700 font-mono bg-gray-50 px-2 py-0.5 rounded">{email.subject}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-gray-400 w-16 flex-shrink-0">Content</span>
                <span className="text-gray-600 leading-relaxed">{email.contentSummary}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Bookings Section ───────────────────────────────────────────────────
function AdminBookingsSection() {
  type View = { mode: "list" } | { mode: "create" } | { mode: "detail"; id: number };
  const [view, setView] = useState<View>({ mode: "list" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer.current);
  }, [search]);

  const { data, isLoading, refetch } = trpc.adminBookings.list.useQuery(
    { search: debouncedSearch || undefined, limit: 50, offset: 0 },
    { enabled: view.mode === "list" }
  );
  const utils = trpc.useUtils();

  const notifyMutation = trpc.adminBookings.triggerNotifications.useMutation({
    onSuccess: (r) => {
      alert(`Sent ${r.sent} notification${r.sent !== 1 ? "s" : ""} (${r.total} due).`);
      utils.adminBookings.list.invalidate();
    },
  });

  if (view.mode === "create") {
    return <AdminBookingCreateForm onBack={() => setView({ mode: "list" })} onCreated={(id) => setView({ mode: "detail", id })} />;
  }

  if (view.mode === "detail") {
    return <AdminRecurringBookingDetail bookingId={view.id} onBack={() => { setView({ mode: "list" }); refetch(); }} />;
  }

  const bookings = (data as any)?.bookings ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#111]">Admin Bookings ({total.toLocaleString()})</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => notifyMutation.mutate()}
            disabled={notifyMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Send size={13} /> {notifyMutation.isPending ? "Notifying…" : "Send Notifications"}
          </button>
          <button
            onClick={() => setView({ mode: "create" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Create Booking
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <Search size={13} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by artist, client, description…" className="bg-transparent text-xs text-[#111] placeholder-gray-400 focus:outline-none w-full" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Artist</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Rates</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Schedule</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Periods</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">No admin bookings yet</td></tr>
            ) : bookings.map((b: any) => (
              <tr key={b.id} onClick={() => setView({ mode: "detail", id: b.id })} className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer">
                <td className="px-5 py-3">
                  <p className="font-semibold text-xs text-[#111]">{b.artistFirstName ? `${b.artistFirstName} ${b.artistLastName ?? ""}`.trim() : b.artistName ?? "—"}</p>
                  <p className="text-[10px] text-gray-400">{b.artistEmail}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-xs text-[#111]">{b.clientCompanyName || (b.clientFirstName ? `${b.clientFirstName} ${b.clientLastName ?? ""}`.trim() : "—")}</p>
                  <p className="text-[10px] text-gray-400">{b.clientEmail}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  <p>${b.clientRate}/hr <span className="text-gray-400">(client)</span></p>
                  <p>${b.artistRate}/hr <span className="text-gray-400">(artist)</span></p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <p>{fmtDate(b.startDate)} → {fmtDate(b.endDate)}</p>
                  {b.isRecurring && <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full capitalize">{b.recurringCadence}</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="font-semibold text-[#111]">{b.paidPeriods ?? 0}</span>
                  <span className="text-gray-400">/{b.totalPeriods ?? 0} paid</span>
                  {(b.openPeriods ?? 0) > 0 && <span className="ml-1 text-amber-600 font-semibold">{b.openPeriods} pending</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminBookingCreateForm({ onBack, onCreated }: { onBack: () => void; onCreated: (id: number) => void }) {
  const [artistSearch, setArtistSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [artistRate, setArtistRate] = useState("");
  const [clientRate, setClientRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [cadence, setCadence] = useState<"weekly" | "biweekly" | "monthly" | "quarterly">("monthly");
  const bookingLocation = useLocationField();
  const [description, setDescription] = useState("");

  const [debouncedArtist, setDebouncedArtist] = useState("");
  const [debouncedClient, setDebouncedClient] = useState("");
  const artistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clientTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { clearTimeout(artistTimer.current); artistTimer.current = setTimeout(() => setDebouncedArtist(artistSearch), 350); return () => clearTimeout(artistTimer.current); }, [artistSearch]);
  useEffect(() => { clearTimeout(clientTimer.current); clientTimer.current = setTimeout(() => setDebouncedClient(clientSearch), 350); return () => clearTimeout(clientTimer.current); }, [clientSearch]);

  const { data: artistResults } = trpc.admin.artists.useQuery({ search: debouncedArtist, limit: 8, offset: 0 }, { enabled: debouncedArtist.length > 1 && !selectedArtist });
  const { data: clientResults } = trpc.admin.clients.useQuery({ search: debouncedClient, limit: 8, offset: 0 }, { enabled: debouncedClient.length > 1 && !selectedClient });

  const createMutation = trpc.adminBookings.create.useMutation({
    onSuccess: (r) => onCreated(r.bookingId),
    onError: (e) => alert("Error: " + e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedArtist || !selectedClient) return alert("Select an artist and client.");
    if (!startDate || !endDate) return alert("Set start and end dates.");
    if (new Date(endDate) <= new Date(startDate)) return alert("End date must be after start date.");
    createMutation.mutate({
      artistUserId: selectedArtist.id,
      clientUserId: selectedClient.id,
      artistRateDollars: Number(artistRate),
      clientRateDollars: Number(clientRate),
      startDate,
      endDate,
      isRecurring,
      recurringCadence: isRecurring ? cadence : undefined,
      locationAddress: bookingLocation.value || undefined,
      locationData: bookingLocation.locationData,
      description: description || undefined,
    });
  }

  const inputCls = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#F25722]";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
          <ChevronLeft size={14} /> Admin Bookings
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">Create Admin Booking</span>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 max-w-2xl">
        <h2 className="text-lg font-black text-[#111]">New Admin Booking</h2>

        {/* Artist picker */}
        <div>
          <label className={labelCls}>Artist *</label>
          {selectedArtist ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-green-200 bg-green-50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#111]">{selectedArtist.firstName} {selectedArtist.lastName ?? ""}</p>
                <p className="text-xs text-gray-500">{selectedArtist.email}</p>
              </div>
              <button type="button" onClick={() => { setSelectedArtist(null); setArtistSearch(""); }} className="text-xs text-red-500 hover:text-red-700">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input value={artistSearch} onChange={e => setArtistSearch(e.target.value)} placeholder="Search artist by name or email…" className={inputCls} />
              {(artistResults as any)?.artists?.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {(artistResults as any).artists.map((a: any) => (
                    <button key={a.id} type="button" onClick={() => { setSelectedArtist(a); setArtistSearch(""); }} className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors">
                      <p className="text-sm font-semibold text-[#111]">{a.firstName} {a.lastName ?? ""}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Client picker */}
        <div>
          <label className={labelCls}>Client *</label>
          {selectedClient ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-green-200 bg-green-50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#111]">{selectedClient.clientCompanyName || displayName(selectedClient)}</p>
                <p className="text-xs text-gray-500">{selectedClient.email}</p>
              </div>
              <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(""); }} className="text-xs text-red-500 hover:text-red-700">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search client by name, company, or email…" className={inputCls} />
              {(clientResults as any)?.clients?.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {(clientResults as any).clients.map((c: any) => (
                    <button key={c.id} type="button" onClick={() => { setSelectedClient(c); setClientSearch(""); }} className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors">
                      <p className="text-sm font-semibold text-[#111]">{c.clientCompanyName || displayName(c)}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Client Rate ($/hr) *</label>
            <input type="number" min="0" step="0.01" value={clientRate} onChange={e => setClientRate(e.target.value)} placeholder="e.g. 85" className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Artist Rate ($/hr) *</label>
            <input type="number" min="0" step="0.01" value={artistRate} onChange={e => setArtistRate(e.target.value)} placeholder="e.g. 70" className={inputCls} required />
            {clientRate && artistRate && Number(clientRate) > Number(artistRate) && (
              <p className="text-[10px] text-green-600 mt-1 font-semibold">Artswrk margin: ${(Number(clientRate) - Number(artistRate)).toFixed(2)}/hr</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start Date *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>End Date *</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} required />
          </div>
        </div>

        {/* Recurring toggle */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsRecurring(r => !r)} className="flex-shrink-0">
                {isRecurring ? <ToggleRight size={26} className="text-[#F25722]" /> : <ToggleLeft size={26} className="text-gray-300" />}
              </button>
              <div>
                <p className="text-sm font-semibold text-[#111]">Recurring Booking</p>
                <p className="text-xs text-gray-500">Artist submits hours each billing period</p>
              </div>
            </div>
            {isRecurring && (
              <div className="mt-3 ml-9">
                <label className={labelCls}>Billing Cadence</label>
                <select value={cadence} onChange={e => setCadence(e.target.value as any)} className={inputCls}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Period preview */}
        {isRecurring && startDate && endDate && new Date(endDate) > new Date(startDate) && (
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1">Billing Period Preview</p>
            <p className="text-xs text-blue-600">
              {cadence === "weekly" && `≈${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (7 * 86400000))} weekly periods`}
              {cadence === "biweekly" && `≈${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (14 * 86400000))} bi-weekly periods`}
              {cadence === "monthly" && `≈${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (30 * 86400000))} monthly periods`}
              {cadence === "quarterly" && `≈${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (90 * 86400000))} quarterly periods`}
              {" "}— artist will be notified at the end of each period to submit hours.
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>Location (optional)</label>
          <LocationAutocompleteInput value={bookingLocation.value} onChange={bookingLocation.onChange} kind="any" placeholder="Studio address or city" icon={false} inputClassName={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Description / Notes (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Scope of work, service type, etc." className={`${inputCls} resize-none`} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" disabled={createMutation.isPending} className="flex-1 px-5 py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60">
            {createMutation.isPending ? "Creating…" : "Create Admin Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminRecurringBookingDetail({ bookingId, onBack }: { bookingId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.adminBookings.detail.useQuery({ bookingId });
  const booking = data as any;

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin" /></div>;
  if (!booking) return <div className="py-20 text-center text-gray-400 text-sm">Booking not found.</div>;

  const periods: any[] = booking.periods ?? [];
  const statusColor = (s: string) => ({
    upcoming: "bg-gray-100 text-gray-500",
    open: "bg-amber-50 text-amber-600",
    artist_submitted: "bg-blue-50 text-blue-600",
    client_paid: "bg-green-50 text-green-600",
  }[s] ?? "bg-gray-100 text-gray-500");

  const statusLabel = (s: string) => ({
    upcoming: "Upcoming",
    open: "Open — Awaiting Artist",
    artist_submitted: "Submitted — Awaiting Payment",
    client_paid: "Paid",
  }[s] ?? s);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1">
          <ChevronLeft size={14} /> Admin Bookings
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold">Booking #{booking.id}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Booking info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-black text-[#111] uppercase tracking-wider">Booking Details</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-semibold capitalize">{booking.bookingStatus}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Client Rate</span><span className="font-semibold">${booking.clientRate}/hr</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Artist Rate</span><span className="font-semibold">${booking.artistRate}/hr</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Margin</span><span className="font-semibold text-green-600">${(booking.clientRate - booking.artistRate).toFixed(2)}/hr</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Start</span><span>{fmtDate(booking.startDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">End</span><span>{fmtDate(booking.endDate)}</span></div>
              {booking.isRecurring && <div className="flex justify-between"><span className="text-gray-500">Cadence</span><span className="capitalize font-semibold text-purple-600">{booking.recurringCadence}</span></div>}
              {booking.locationAddress && <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="text-right max-w-[60%]">{booking.locationAddress}</span></div>}
              {booking.description && <div><span className="text-gray-500 block mb-1">Notes</span><span className="text-gray-700">{booking.description}</span></div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-black text-[#111] uppercase tracking-wider">People</h2>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Artist</p>
              <p className="text-sm font-semibold text-[#111]">{booking.artistFirstName} {booking.artistLastName ?? ""}</p>
              <p className="text-xs text-gray-500">{booking.artistEmail}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Client</p>
              <p className="text-sm font-semibold text-[#111]">{booking.clientCompanyName || `${booking.clientFirstName ?? ""} ${booking.clientLastName ?? ""}`.trim()}</p>
              <p className="text-xs text-gray-500">{booking.clientEmail}</p>
            </div>
          </div>
        </div>

        {/* Periods */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-black text-[#111] uppercase tracking-wider">Billing Periods ({periods.length})</h2>
          {periods.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No periods generated.</p>}
          {periods.map((p: any, i: number) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400">Period {i + 1}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#111]">{fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}</p>
                  <p className="text-xs text-gray-500">Artist notified: {p.notifyArtistAt ? fmtDate(p.notifyArtistAt) : "—"}</p>
                </div>
                <div className="text-right text-xs">
                  {p.actualHours != null && <p className="font-semibold text-[#111]">{p.actualHours}h logged</p>}
                  {p.invoiceTotalCents != null && <p className="text-gray-600">{fmt$(p.invoiceTotalCents)}</p>}
                  {p.invoicePaidAt && <p className="text-green-600 font-semibold">Paid {fmtDate(p.invoicePaidAt)}</p>}
                  {p.invoiceStripeCheckoutUrl && p.status === "artist_submitted" && (
                    <a href={p.invoiceStripeCheckoutUrl} target="_blank" rel="noopener noreferrer" className="text-[#F25722] font-semibold hover:underline">Pay →</a>
                  )}
                </div>
              </div>
              {p.artistNotes && <p className="mt-2 text-xs text-gray-500 italic border-t border-gray-50 pt-2">{p.artistNotes}</p>}
            </div>
          ))}
        </div>
      </div>
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
          {section === "admin-bookings" && <AdminBookingsSection />}
          {section === "payments" && <PaymentsSection onViewBooking={goToBooking} initialDetailId={pendingPaymentId} />}
          {section === "subscriptions" && <SubscriptionsSection />}
          {section === "benefits" && <BenefitsSection />}
          {section === "emails" && <EmailsSection />}
          {section === "settings" && <SettingsSection user={user} />}
        </div>
      </main>
    </div>
  );
}
