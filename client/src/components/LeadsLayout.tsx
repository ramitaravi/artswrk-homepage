/**
 * Leads Dashboard — standalone layout with sidebar.
 * Admin-only. Redirects non-admins back to home.
 */
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  List,
  Mail,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

const NAV = [
  { label: "Overview", href: "/leads", icon: LayoutDashboard },
  { label: "Contacts", href: "/leads/contacts", icon: Users },
  { label: "Lists", href: "/leads/lists", icon: List },
  { label: "Campaigns", href: "/leads/campaigns", icon: Mail },
];

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
        <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen flex bg-[#F7F7F8]">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo / brand */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-black text-lg tracking-tight text-[#111]">
              ARTS<span className="bg-[#111] text-white px-1 rounded ml-0.5">WRK</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-[#0B5FFF]" />
            <span className="text-xs font-semibold text-[#0B5FFF] tracking-wide uppercase">
              Leads
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/leads"
                ? location === "/leads" || location === "/leads/"
                : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[#EEF3FF] text-[#0B5FFF]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-[#111]"
                }`}
              >
                <Icon size={15} />
                {label}
                {active && (
                  <ChevronRight size={12} className="ml-auto text-[#0B5FFF]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Back to Admin */}
        <div className="px-3 py-4 border-t border-gray-100">
          <Link
            href="/admin-dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            <ArrowLeft size={13} />
            Back to Admin
          </Link>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
