/*
 * ARTSWRK DASHBOARD LAYOUT
 * White sidebar + light content area — visually matches the Enterprise dashboard.
 * Works for both Artist and Client roles.
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  CreditCard,
  Users,
  MessageSquare,
  Building2,
  List,
  Gift,
  Users2,
  Settings,
  LogOut,
  Menu,
  Bell,
  Crown,
  ChevronRight,
  Loader2,
  Star,
  User,
  X,
  Sparkles,
  CheckCircle2,
  LayoutGrid,
  ContactRound,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  premium?: boolean;
  badge?: number;
}

// Client (hirer) nav
const CLIENT_CORE_NAV: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/app" },
  { label: "Dashboard Simple", icon: <LayoutGrid size={18} />, href: "/app/simple" },
  { label: "My Jobs", icon: <Briefcase size={18} />, href: "/app/jobs" },
  { label: "Bookings", icon: <Calendar size={18} />, href: "/app/bookings" },
  { label: "Payments", icon: <CreditCard size={18} />, href: "/app/payments" },
  { label: "Artists", icon: <Users size={18} />, href: "/app/artists" },
  { label: "Messages", icon: <MessageSquare size={18} />, href: "/app/messages" },
  { label: "CRM", icon: <ContactRound size={18} />, href: "/leads" },
];

const CLIENT_PREMIUM_NAV: NavItem[] = [
  { label: "Company Page", icon: <Building2 size={18} />, href: "/app/company", premium: true },
  { label: "Sub Lists", icon: <List size={18} />, href: "/app/lists", premium: true },
  { label: "Community", icon: <Users2 size={18} />, href: "/app/community", premium: true },
  { label: "Benefits", icon: <Gift size={18} />, href: "/app/benefits", premium: true },
];

// Artist nav
const ARTIST_CORE_NAV: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/app" },
  { label: "Jobs", icon: <Briefcase size={18} />, href: "/app/jobs" },
  { label: "Bookings", icon: <Calendar size={18} />, href: "/app/bookings" },
  { label: "Payments", icon: <CreditCard size={18} />, href: "/app/payments" },
  { label: "Messages", icon: <MessageSquare size={18} />, href: "/app/messages" },
  { label: "Profile", icon: <User size={18} />, href: "/app/profile" },
];

const ARTIST_PREMIUM_NAV: NavItem[] = [
  { label: "PRO Jobs", icon: <Star size={18} />, href: "/app/pro-jobs", premium: true },
  { label: "Benefits", icon: <Gift size={18} />, href: "/app/benefits", premium: true },
  { label: "Community", icon: <Users2 size={18} />, href: "/app/community", premium: true },
];

function NavLink({ item }: { item: NavItem }) {
  const [location] = useLocation();
  const isActive = location === item.href || (item.href !== "/app" && location.startsWith(item.href));

  return (
    <Link href={item.href}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
          isActive
            ? "bg-orange-50 text-[#F25722]"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
        {item.premium && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            <Crown size={9} /> PRO
          </span>
        )}
        {item.badge && !item.premium && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F25722] text-white min-w-[18px] text-center">
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<"basic" | "pro" | null>(null);

  // Detect post-Stripe-checkout redirect via ?plan= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (plan === "basic" || plan === "pro") {
      setCheckoutBanner(plan);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch the full artswrk user record from DB
  const { data: artswrkUser } = trpc.artswrkUsers.getByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const displayName = artswrkUser
    ? `${artswrkUser.firstName || ""} ${artswrkUser.lastName || ""}`.trim() || artswrkUser.name || user?.name || "User"
    : user?.name || "User";

  const displayStudio = artswrkUser?.clientCompanyName || artswrkUser?.firstName || "Artswrk";
  const isPremium = artswrkUser?.clientPremium ?? false;
  const isArtist = artswrkUser?.userRole === "Artist";
  const coreNav = isArtist ? ARTIST_CORE_NAV : CLIENT_CORE_NAV;
  const premiumNav = isArtist ? ARTIST_PREMIUM_NAV : CLIENT_PREMIUM_NAV;

  const avatarInitials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const rawPic = artswrkUser?.profilePicture || (user as any)?.profilePicture;
  const avatarSrc = rawPic ? (rawPic.startsWith("//") ? `https:${rawPic}` : rawPic) : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#F25722]" size={32} />
      </div>
    );
  }

  if (!user) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/">
          <span className="font-black text-xl tracking-tight">
            <span className="hirer-grad-text">ARTS</span>
            <span className="bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
          </span>
        </Link>
      </div>

      {/* User info card */}
      <div className="mx-3 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-3">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full hirer-grad-bg flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {avatarInitials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#111] truncate">{displayName}</p>
          <p className="text-xs text-gray-400 truncate">{displayStudio}</p>
          {isPremium && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 mt-0.5">
              <Crown size={8} /> PREMIUM
            </span>
          )}
          {isArtist && (artswrkUser as any)?.artswrkPro && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-[#F25722] border border-orange-200 mt-0.5">
              <Star size={8} /> PRO
            </span>
          )}
        </div>
      </div>

      {/* Core nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {coreNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* Premium section divider */}
        <div className="pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-1">
            {isArtist ? "PRO Features" : "Premium Features"}
          </p>
        </div>

        {premiumNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link href="/app/settings">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer">
            <Settings size={18} className="flex-shrink-0" />
            <span className="text-sm font-medium">Settings</span>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
        <p className="text-[10px] text-gray-300 text-center pt-2">© 2026 Artswrk</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-gray-100">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 bg-white border-r border-gray-100 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <Link href="/">
                <span className="font-black text-xl tracking-tight">
                  <span className="hirer-grad-text">ARTS</span>
                  <span className="bg-[#111] text-white px-1.5 py-0.5 rounded ml-0.5">WRK</span>
                </span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {sidebarContent}
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm font-bold text-[#111]">{displayStudio}</p>
              {isArtist && (
                <p className="text-xs text-gray-400">Artist Dashboard</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Post a Job CTA — clients only */}
            {!isArtist && (
              <Link href="/post-job">
                <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
                  + Post a Job
                </button>
              </Link>
            )}

            {/* Notifications */}
            <button className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Bell size={18} />
            </button>

            {/* Avatar */}
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover cursor-pointer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full hirer-grad-bg flex items-center justify-center text-white text-xs font-semibold cursor-pointer">
                {avatarInitials}
              </div>
            )}

            {/* Mobile nav toggle (shown right of avatar on very small screens) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="sm:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* Post-checkout success banner */}
        {checkoutBanner && (
          <div
            className="flex items-center gap-3 px-5 py-3 text-sm font-semibold text-white flex-shrink-0"
            style={{ background: checkoutBanner === "pro" ? "linear-gradient(90deg,#FFBC5D,#F25722)" : "linear-gradient(90deg,#ec008c,#ff7171)" }}
          >
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <div className="flex-1">
              {checkoutBanner === "pro" ? (
                <span>
                  <Sparkles size={14} className="inline mr-1" />
                  Welcome to <strong>Artswrk PRO</strong>! Your subscription is now active.
                </span>
              ) : (
                <span>
                  <Star size={14} className="inline mr-1 fill-white" />
                  Welcome to <strong>Artswrk Basic</strong>! Your subscription is now active.
                </span>
              )}
            </div>
            <button
              onClick={() => setCheckoutBanner(null)}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
