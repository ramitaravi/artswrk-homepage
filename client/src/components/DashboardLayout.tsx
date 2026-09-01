/*
 * ARTSWRK DASHBOARD LAYOUT
 * White sidebar + light content area — visually matches the Enterprise dashboard.
 * Works for both Artist and Client roles.
 */

import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  CreditCard,
  Users,
  MessageSquare,
  List,
  Gift,
  Users2,
  Settings,
  LogOut,
  Menu,
  Crown,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Loader2,
  Star,
  User,
  X,
  Sparkles,
  CheckCircle2,
  LayoutGrid,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { isNavItemActive } from "@shared/nav";
import RefreshAnnouncementBanner from "./RefreshAnnouncementBanner";

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
  { label: "Payments", icon: <CreditCard size={18} />, href: "/app/payments" },
  { label: "Messages", icon: <MessageSquare size={18} />, href: "/app/messages" },
];

const CLIENT_PREMIUM_NAV: NavItem[] = [
  // Browse Artists and My Artists live here rather than in the core nav: both
  // are gated, and a free account should be able to see that from the sidebar
  // instead of discovering it after clicking.
  { label: "Browse Artists", icon: <Users size={18} />, href: "/app/artists", premium: true },
  { label: "My Artists", icon: <Star size={18} />, href: "/app/artists?tab=my", premium: true },
  // Sub Lists and Community are hidden for launch — neither is finished, and
  // we don't want anyone reaching them. Removing them from the nav is not
  // enough on its own: /app/lists and /app/community had no gate of any kind,
  // so both routes now redirect too (see App.tsx). Restore both here and there
  // together when the features are ready.
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
  // Browse Companies hidden 2026-08-31 per Ramita — content needs an update
  // pass this week. Route/page still exist, just not linked from the nav.
  { label: "Benefits", icon: <Gift size={18} />, href: "/app/benefits", premium: true },
];

interface CollapsibleChild {
  label: string;
  href: string;
  external?: boolean;
  icon?: React.ReactNode;
}

interface CollapsibleNavItemProps {
  label: string;
  icon: React.ReactNode;
  children: CollapsibleChild[];
  isArtist: boolean;
  defaultOpen?: boolean;
}

function CollapsibleNavItem({ label, icon, children, isArtist, defaultOpen = false }: CollapsibleNavItemProps) {
  const [location] = useLocation();
  const [open, setOpen] = useState(defaultOpen || children.some((c) => !c.external && location.startsWith(c.href)));
  const isChildActive = children.some((c) => !c.external && (location === c.href || location.startsWith(c.href)));
  const activeColor = isArtist ? "text-[#ec008c]" : "text-[#F25722]";
  const subActiveColor = isArtist ? "bg-pink-50 text-[#ec008c]" : "bg-orange-50 text-[#F25722]";

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
          isChildActive ? activeColor : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm font-medium flex-1 text-left truncate">{label}</span>
        {open ? <ChevronDown size={14} className="flex-shrink-0 text-gray-400" /> : <ChevronRight size={14} className="flex-shrink-0 text-gray-400" />}
      </button>
      {open && (
        <div className="ml-4 pl-3 border-l border-gray-100 mt-0.5 space-y-0.5">
          {children.map((child) => {
            const isActive = !child.external && (location === child.href || location.startsWith(child.href));
            if (child.external) {
              return (
                <a key={child.href} href={child.href} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors text-gray-500 hover:bg-orange-50 hover:text-[#F25722]">
                    {child.icon && <span className="flex-shrink-0">{child.icon}</span>}
                    {child.label}
                    <ExternalLink size={10} className="ml-auto flex-shrink-0 opacity-50" />
                  </div>
                </a>
              );
            }
            return (
              <Link key={child.href} href={child.href} className="block">
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  isActive ? subActiveColor : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}>
                  {child.icon && <span className="flex-shrink-0">{child.icon}</span>}
                  {child.label}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Is this nav item the page we're on?
 *
 * wouter's useLocation() returns the pathname only — no query string — so the
 * old `location.startsWith(item.href)` could never match "My Artists"
 * (/app/artists?tab=my) and it stayed unhighlighted no matter where you were.
 * Worse, Browse Artists (/app/artists) matched BOTH tabs, so the wrong row lit
 * up. Compare the path and the query separately, and only treat a query as
 * significant when the item actually carries one.
 */
function useIsNavActive(href: string): boolean {
  const [location] = useLocation();
  // useSearch, not window.location.search: the query is the only thing that
  // changes when you move between /app/artists and /app/artists?tab=my, and
  // reading it off window wouldn't re-render the sidebar when it did.
  const search = useSearch();
  return isNavItemActive(href, location, search);
}

function NavLink({ item, isArtist }: { item: NavItem; isArtist: boolean }) {
  const isActive = useIsNavActive(item.href);
  const activeColor = isArtist ? "bg-pink-50 text-[#ec008c]" : "bg-orange-50 text-[#F25722]";
  const badgeColor = isArtist ? "bg-[#ec008c]" : "bg-[#F25722]";

  return (
    <Link href={item.href} className="block">
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
          isActive ? activeColor : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
        {item.premium && (
          isArtist ? (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-50 text-[#ec008c] border border-pink-200">
              <Star size={9} /> PRO
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              <Crown size={9} /> PREMIUM
            </span>
          )
        )}
        {item.badge && !item.premium && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor} text-white min-w-[18px] text-center`}>
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function DashboardLayout({ children, fullHeight = false }: { children: React.ReactNode; fullHeight?: boolean }) {
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

  // auth.me already returns the full DB User row (userRole, plan flags,
  // profile fields all included) — a secondary artswrkUsers.getByEmail
  // lookup here was redundant, and silently broke for any account whose
  // email is null/blank (duplicate migrated rows), since the query is
  // `enabled: !!user?.email` — it never fired, isArtist fell back to
  // false, and the sidebar rendered the client nav for a real artist.
  // Same fix already applied to App.tsx's route dispatcher (4abfa1f).
  const artswrkUser = user as any;

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
  const isPremium = artswrkUser?.planTier === "client_premium";
  const isArtist = (artswrkUser?.planTier as string | undefined)?.startsWith("artist_") ?? false;
  const coreNav = isArtist ? ARTIST_CORE_NAV : CLIENT_CORE_NAV;
  const premiumNav = isArtist ? ARTIST_PREMIUM_NAV : CLIENT_PREMIUM_NAV;
  // Sidebar card subtitle: artists see their plan (more useful than their own
  // first name repeated); clients keep seeing their studio/company name.
  const sidebarSubtitle = isArtist
    ? ((artswrkUser as any)?.artswrkPro ? "Artswrk PRO" : (artswrkUser as any)?.artswrkBasic ? "Artswrk Basic" : "")
    : displayStudio;

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
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!user) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/app">
          <img
            src={`https://app.artswrk.com/logos/artswrk-${isArtist ? "pink" : "orange"}.png`}
            alt="Artswrk"
            className="h-8 w-auto"
          />
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
          <div className={`w-9 h-9 rounded-full ${isArtist ? "artist-grad-bg" : "hirer-grad-bg"} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
            {avatarInitials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#111] truncate">{displayName}</p>
          {sidebarSubtitle && <p className="text-xs text-gray-400 truncate">{sidebarSubtitle}</p>}
          {isPremium && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 mt-0.5">
              <Crown size={8} /> PREMIUM
            </span>
          )}
          {isArtist && (artswrkUser as any)?.artswrkPro && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-50 text-[#ec008c] border border-pink-200 mt-0.5">
              <Star size={8} /> PRO
            </span>
          )}
        </div>
      </div>

      {/* Core nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {/* Dashboard always first */}
        <NavLink key="/app" item={{ label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/app" }} isArtist={isArtist} />

        {/* Clients get a collapsible "My Jobs" group */}
        {!isArtist && (
          <>
            <CollapsibleNavItem
              label="My Jobs"
              icon={<Briefcase size={18} />}
              isArtist={false}
              defaultOpen={true}
              children={[
                { label: "My Jobs", href: "/app/jobs" },
                ...(artswrkUser?.id ? [{
                  label: "My Hiring Page",
                  href: `${window.location.origin}/studio/${artswrkUser.id}`,
                  external: true,
                  icon: <ExternalLink size={11} />,
                }] : []),
              ]}
            />
            <NavLink key="/app/bookings" item={{ label: "Bookings", icon: <Calendar size={18} />, href: "/app/bookings" }} isArtist={false} />
          </>
        )}

        {/* Remaining nav items (skip Dashboard since we already rendered it above).
            Artists get Bookings from ARTIST_CORE_NAV in its correct position —
            it's only rendered manually above for clients (inside the My Jobs group). */}
        {coreNav.filter((item) => item.href !== "/app").map((item) => (
          <NavLink key={item.href} item={item} isArtist={isArtist} />
        ))}

        {/* Premium section divider */}
        <div className="pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-1">
            {isArtist ? "PRO Features" : "Premium Features"}
          </p>
        </div>

        {premiumNav.map((item) => (
          <NavLink key={item.href} item={item} isArtist={isArtist} />
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
            {/* Close button — sits above sidebarContent which already has the logo */}
            <div className="flex justify-end px-3 pt-3">
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

            {/* Avatar — links to settings */}
            <Link href="/app/settings">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className={`w-8 h-8 rounded-full object-cover cursor-pointer hover:ring-2 transition-all ${isArtist ? "hover:ring-[#ec008c]" : "hover:ring-[#F25722]"}`}
                />
              ) : (
                <div className={`w-8 h-8 rounded-full ${isArtist ? "artist-grad-bg" : "hirer-grad-bg"} flex items-center justify-center text-white text-xs font-semibold cursor-pointer hover:ring-2 ${isArtist ? "hover:ring-[#ec008c]" : "hover:ring-[#F25722]"} transition-all`}>
                  {avatarInitials}
                </div>
              )}
            </Link>

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

        {isArtist && <RefreshAnnouncementBanner variant="artist" />}

        {/* Page content */}
        <main className={`flex-1 ${fullHeight ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
