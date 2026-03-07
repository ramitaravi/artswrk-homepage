/*
 * ARTSWRK DASHBOARD LAYOUT
 * Persistent left sidebar + top header + scrollable content area
 * Uses real tRPC auth session — user data comes from the database
 * Hirer gradient: #FFBC5D → #F25722
 */

import { useEffect } from "react";
import { useState } from "react";
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

const CORE_NAV: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/dashboard" },
  { label: "My Jobs", icon: <Briefcase size={18} />, href: "/dashboard/jobs" },
  { label: "Bookings", icon: <Calendar size={18} />, href: "/dashboard/bookings" },
  { label: "Payments", icon: <CreditCard size={18} />, href: "/dashboard/payments" },
  { label: "Artists", icon: <Users size={18} />, href: "/dashboard/artists" },
  { label: "Messages", icon: <MessageSquare size={18} />, href: "/dashboard/messages", badge: 3 },
];

const PREMIUM_NAV: NavItem[] = [
  { label: "Company Page", icon: <Building2 size={18} />, href: "/dashboard/company", premium: true },
  { label: "Sub Lists", icon: <List size={18} />, href: "/dashboard/sublists", premium: true },
  { label: "Community", icon: <Users2 size={18} />, href: "/dashboard/community", premium: true },
  { label: "Benefits", icon: <Gift size={18} />, href: "/dashboard/benefits", premium: true },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [location] = useLocation();
  const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));

  return (
    <Link href={item.href}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group relative ${
          isActive
            ? "hirer-grad-bg text-white shadow-sm"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
            {item.premium && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                <Crown size={9} /> PRO
              </span>
            )}
            {item.badge && !item.premium && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500 text-white min-w-[18px] text-center">
                {item.badge}
              </span>
            )}
          </>
        )}
        {collapsed && item.badge && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-500" />
        )}
      </div>
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch the full artswrk user record from DB using the authenticated user's email
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

  // Derive display values — prefer real DB data, fall back to session data
  const displayName = artswrkUser
    ? `${artswrkUser.firstName || ""} ${artswrkUser.lastName || ""}`.trim() || artswrkUser.name || user?.name || "User"
    : user?.name || "User";

  const displayStudio = artswrkUser?.clientCompanyName || "Artswrk";
  const displayLocation = ""; // location fields not yet in schema
  const isPremium = artswrkUser?.clientPremium ?? false;

  const avatarInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="animate-spin text-[#F25722]" size={32} />
      </div>
    );
  }

  if (!user) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <a href="/" className="flex items-center select-none">
            <span className="font-black text-xl tracking-tight hirer-grad-text">ARTS</span>
            <span className="font-black text-xl tracking-tight bg-white text-[#111] px-1.5 py-0.5 rounded ml-0.5 text-sm">WRK</span>
          </a>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors hidden lg:flex"
        >
          {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {artswrkUser?.profilePicture ? (
              <img
                src={artswrkUser.profilePicture}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full hirer-grad-bg flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                {avatarInitials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{displayName}</p>
              <p className="text-gray-500 text-xs truncate">{displayStudio}</p>
              {isPremium && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 mt-0.5">
                  <Crown size={8} /> PREMIUM
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Core nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {CORE_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {/* Premium section */}
        {!collapsed && (
          <div className="pt-4 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-3 mb-2">
              Premium Features
            </p>
          </div>
        )}
        {collapsed && <div className="pt-3 border-t border-white/10 my-2" />}
        {PREMIUM_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <Link href="/dashboard/settings">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
            <Settings size={18} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-gray-700 text-center pt-2">
            © 2026 Artswrk
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f5f5f5] overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#111] transition-all duration-200 flex-shrink-0 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-60 bg-[#111] flex flex-col">{sidebarContent}</div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm font-bold text-[#111]">{displayStudio}</p>
              {displayLocation && <p className="text-xs text-gray-400">{displayLocation}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Post a Job CTA */}
            <Link href="/dashboard/jobs">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
                + Post a Job
              </button>
            </Link>

            {/* Notifications */}
            <button className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F25722]" />
            </button>

            {/* Avatar */}
            {artswrkUser?.profilePicture ? (
              <img
                src={artswrkUser.profilePicture}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover cursor-pointer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full hirer-grad-bg flex items-center justify-center text-white text-xs font-black cursor-pointer">
                {avatarInitials}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
