/*
 * ARTSWRK ENTERPRISE DASHBOARD
 * Layout: Left sidebar (Dashboard, Browse Artists) + main content area
 * Master view: Jobs / Companies / Artists tabs
 * Job detail view: breadcrumb → Applicants + Details tabs
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  MapPin,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  MessageCircle,
  Star,
  X,
  Plus,
  CheckCircle2,
  Home,
  Archive,
  Lock,
  Unlock,
  Settings,
  Zap,
  AlertCircle,
  UserCheck,
  Banknote,
  Loader2,
  ArrowLeft,
  Globe,
  Link2,
  Building2,
  Truck,
  Pencil,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

/** Format artist name as "First L." (first name + last initial with period) */
function formatArtistName(firstName?: string | null, lastName?: string | null, fallback = "Artist"): string {
  if (!firstName) return fallback;
  if (lastName && lastName.length > 0) {
    return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  }
  return firstName;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function appStatusColor(status: string | null | undefined) {
  switch (status) {
    case "Booked": return "text-green-600 bg-green-50";
    case "Confirmed": return "text-blue-600 bg-blue-50";
    case "Rejected": return "text-red-500 bg-red-50";
    default: return "text-[#F25722] bg-orange-50";
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
  }[size];

  const url = fixUrl(src);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {initials(name)}
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "open") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        Active
      </span>
    );
  }
  if (s === "completed" || s === "closed") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
        Completed
      </span>
    );
  }
  if (s === "archived") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400 border border-gray-200">
        Archived
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
      {status || "Active"}
    </span>
  );
}

// ── Applicant Avatar Stack ────────────────────────────────────────────────────

function AvatarStack({ artists }: { artists: any[] }) {
  const visible = artists.slice(0, 3);
  const extra = artists.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((a, i) => (
        <div
          key={a.id || i}
          className="w-8 h-8 rounded-full border-2 border-white -ml-2 first:ml-0 overflow-hidden flex-shrink-0"
        >
          {fixUrl(a.profilePicture) ? (
            <img
              src={fixUrl(a.profilePicture)!}
              alt={a.name || "Artist"}
              className="w-full h-full object-cover"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                el.parentElement!.style.background =
                  "linear-gradient(135deg, #FFBC5D, #F25722)";
                el.parentElement!.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:white;font-size:10px;font-weight:700">${initials(a.name || "A")}</span>`;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-xs font-bold">
              {initials(a.name || a.firstName || "A")}
            </div>
          )}
        </div>
      ))}
      {extra > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-gray-500">
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

type SidebarItem = {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
};

function Sidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate: (section: string) => void;
}) {
  const [, navigate] = useLocation();

  const items: SidebarItem[] = [
    {
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
      onClick: () => onNavigate("dashboard"),
      active: activeSection === "dashboard",
    },
    {
      icon: <MessageCircle size={18} />,
      label: "Messages",
      onClick: () => navigate("/app/messages"),
      active: false,
    },
    {
      icon: <Users size={18} />,
      label: "Browse Artists",
      onClick: () => navigate("/app/artists"),
      active: false,
    },
    {
      icon: <Settings size={18} />,
      label: "Settings",
      onClick: () => onNavigate("settings"),
      active: activeSection === "settings",
    },
  ];

  return (
    <aside className="w-56 flex-shrink-0 bg-[#111] min-h-screen pt-6 px-3 flex flex-col">
      <div className="mb-8 px-3">
        <Link href="/">
          <span className="font-black text-xl tracking-tight">
            <span style={{color: '#FFBC5D'}}>ARTS</span>
            <span className="bg-white text-[#111] px-1.5 py-0.5 rounded ml-0.5">
              WRK
            </span>
          </span>
        </Link>
      </div>

      <nav className="space-y-0.5 flex-1">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              item.active
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

// ── Job Card (Jobs Tab) ───────────────────────────────────────────────────────

function JobCard({
  job,
  applicants,
  onViewDetail,
}: {
  job: any;
  applicants: any[];
  onViewDetail: () => void;
}) {
  const rawLogo = job.logo || job.enterpriseLogoUrl;
  const logoUrl = fixUrl(rawLogo);
  const companyName = job.company || job.clientCompanyName || "Company";
  const jobTitle = job.serviceType || job.title || "Job";
  // Guard against stringified [object Object] from Bubble import
  const rawLocation = job.location || job.clientLocation;
  const wfa = !!job.workFromAnywhere;
  const location =
    rawLocation && !rawLocation.includes("[object") && rawLocation !== "[object Object]"
      ? rawLocation
      : wfa
        ? "Open to Traveling Applicants"
        : null;
  const rate = job.rate || job.clientRate;
  const status = job.status || job.requestStatus;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={onViewDetail}
    >
      <div className="flex items-center gap-4 p-5">
        {/* Company logo */}
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 shadow-sm">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-base">
              {initials(companyName)}
            </div>
          )}
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <h3 className="font-bold text-[#111] text-sm leading-snug truncate group-hover:text-[#F25722] transition-colors">
                {jobTitle}
              </h3>
              <p className="text-xs text-gray-400 truncate">{companyName}</p>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {location && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin size={10} className="flex-shrink-0" />{location}
              </span>
            )}
            {rate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-[#F25722] text-xs font-semibold">
                <CreditCard size={10} />{rate}
              </span>
            )}
          </div>
        </div>

        {/* Right: applicants + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {applicants.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              <AvatarStack artists={applicants} />
              <span className="text-[10px] text-gray-400">{applicants.length} applicant{applicants.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          <ChevronRight size={16} className="text-gray-300 group-hover:text-[#F25722] transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ── Company Card (Companies Tab) ──────────────────────────────────────────────
function CompanyCard({ company, onClick }: { company: any; onClick?: () => void }) {
  const logoUrl = fixUrl(company.logoUrl);
  const location = company.locationAddress || company.location || null;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden group"
      onClick={onClick}
    >
      {/* Full-bleed circle logo */}
      <div className="bg-gray-50 flex items-center justify-center p-6 pt-8 pb-6">
        {logoUrl ? (
          <div className="w-full aspect-square rounded-full overflow-hidden shadow-md border-4 border-white ring-1 ring-gray-100">
            <img
              src={logoUrl}
              alt={company.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-5xl shadow-md border-4 border-white">
            {initials(company.name)}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="px-4 pb-5 space-y-2 border-t border-gray-50">
        <h3 className="font-black text-[#111] text-base mt-3 group-hover:text-[#F25722] transition-colors">{company.name}</h3>
        {location && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={10} className="flex-shrink-0" />{location}
          </p>
        )}
        {company.website && (
          <a
            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#F25722] flex items-center gap-1 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            <Globe size={10} className="flex-shrink-0" />
            {company.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        {company.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{company.description}</p>
        )}
        {company.transportReimbursed && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <Truck size={10} className="flex-shrink-0" /> Transport reimbursed
          </p>
        )}
        {company.transportDetails && (
          <p className="text-xs text-gray-400 line-clamp-1">{company.transportDetails}</p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
          <span className="text-xs font-semibold text-[#F25722]">
            {company.openRoles} open role{company.openRoles !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-gray-400 group-hover:text-[#F25722] transition-colors">View jobs →</span>
        </div>
      </div>
    </div>
  );
}

// ── Artist Row (Artists Tab) ──────────────────────────────────────────────────

function ArtistRow({ artist }: { artist: any }) {
  const name = formatArtistName(artist.firstName, artist.lastName, artist.name || "Artist");
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
      <Avatar src={artist.profilePicture} name={name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[#111] truncate">{name}</p>
        {artist.location && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={10} />
            {artist.location}
          </p>
        )}
      </div>
      {artist.artswrkPro && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 text-xs font-semibold border border-yellow-200">
          <Star size={10} fill="currentColor" />
          PRO
        </span>
      )}
    </div>
  );
}

// ── Applications Panel ────────────────────────────────────────────────────────

function ApplicationsPanel({ applications }: { applications: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-6">
      <h3 className="font-bold text-[#111] text-base mb-4">Applications</h3>
      {applications.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No applications yet
        </p>
      ) : (
        <div className="space-y-3">
          {applications.slice(0, 10).map((app) => {
            const name = app.artistName || "Artist";
            return (
              <div key={app.id} className="flex items-center gap-3">
                <Avatar src={app.profilePicture} name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#111] truncate">
                    {name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {app.jobTitle}
                  </p>
                </div>
              </div>
            );
          })}
          {applications.length > 10 && (
            <p className="text-xs text-gray-400 text-center pt-1">
              +{applications.length - 10} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Plan Status Card ────────────────────────────────────────────────────────

function PlanStatusCard() {
  const { data: billing, isLoading } = trpc.enterprise.getBillingInfo.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-6 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!billing) return null;

  const plan = billing.enterprisePlan;
  const status = billing.subscriptionStatus;
  const interval = billing.subscriptionInterval;
  const renewsAt = billing.currentPeriodEnd;
  const cancelAtEnd = billing.cancelAtPeriodEnd;

  const planLabel =
    plan === "subscriber" && interval === "year" ? "Annual Subscription"
    : plan === "subscriber" && interval === "month" ? "Monthly Subscription"
    : plan === "subscriber" ? "Enterprise Subscriber"
    : plan === "on_demand" ? "On-Demand"
    : "Free";

  const planColor =
    plan === "subscriber" ? "from-purple-500 to-indigo-600"
    : plan === "on_demand" ? "from-[#FFBC5D] to-[#F25722]"
    : "from-gray-400 to-gray-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
      <h3 className="font-bold text-[#111] text-base mb-3">Your Plan</h3>

      <div className={`bg-gradient-to-br ${planColor} rounded-xl p-4 text-white mb-3`}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Current Plan</p>
        <p className="text-lg font-black">{planLabel}</p>
        {interval && (
          <p className="text-xs opacity-80 mt-0.5 capitalize">{interval === "month" ? "Monthly" : "Annual"} billing</p>
        )}
      </div>

      {status && (
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            status === "active" ? "bg-green-400" :
            status === "past_due" ? "bg-amber-400" :
            "bg-red-400"
          }`} />
          <span className="text-xs text-gray-600 capitalize">
            {status === "active" ? "Active" :
             status === "past_due" ? "Payment past due" :
             status}
          </span>
        </div>
      )}

      {renewsAt && (
        <p className="text-xs text-gray-400">
          {cancelAtEnd ? "Cancels" : "Renews"} {new Date(renewsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}

      {!plan && (
        <p className="text-xs text-gray-400">Contact us to upgrade your plan.</p>
      )}
    </div>
  );
}

// ── Post Job Modal ───────────────────────────────────────────────────────────────────────────────────

const JOB_CATEGORIES = [
  "Dance Competition",
  "Dance Convention",
];

// ── Minimal rich text editor (no library needed) ──────────────────────────────
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value only on first mount
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const btnClass = "px-2.5 py-1 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200";

  return (
    <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-[#F25722] transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white flex-wrap">
        <button type="button" className={btnClass} onClick={() => exec("bold")} title="Bold"><strong>B</strong></button>
        <button type="button" className={`${btnClass} italic`} onClick={() => exec("italic")} title="Italic">I</button>
        <button type="button" className={`${btnClass} underline`} onClick={() => exec("underline")} title="Underline">U</button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" className={btnClass} onClick={() => exec("insertUnorderedList")} title="Bullet list">• List</button>
        <button type="button" className={btnClass} onClick={() => exec("insertOrderedList")} title="Numbered list">1. List</button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" className={btnClass} onClick={() => exec("removeFormat")} title="Clear formatting">Clear</button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder="Describe the role, requirements, and any other details..."
        className="min-h-[120px] px-4 py-3 text-sm text-[#111] leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  );
}

function PostJobModal({
  user,
  companies,
  onClose,
  onSuccess,
}: {
  user: any;
  companies: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>(
    companies.length > 0 ? companies[0].name : "__new__"
  );
  const [form, setForm] = useState({
    serviceType: "",
    company: companies.length > 0 ? companies[0].name : "",
    logo: companies.length > 0 ? (companies[0].logoUrl || "") : "",
    bubbleClientCompanyId: companies.length > 0 ? (companies[0].bubbleId || "") : "",
    category: "",
    location: "",
    budget: "",
    askArtistRate: false,
    workFromAnywhere: false,
    description: "",
    applyEmail: user?.email || "",
  });

  const postJob = trpc.enterprise.postJob.useMutation({
    onSuccess: () => {
      setStep("success");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to post job. Please try again.");
    },
  });

  const isNewCompany = selectedCompanyKey === "__new__";
  const effectiveCompanyName = isNewCompany ? newCompanyName : form.company;
  // Header logo: selected company logo → user's enterprise/profile logo → gradient fallback
  const userFallbackLogo = fixUrl(user?.enterpriseLogoUrl || user?.profilePicture);
  const headerLogo = form.logo ? fixUrl(form.logo) : userFallbackLogo;

  function handleCompanySelect(value: string) {
    setSelectedCompanyKey(value);
    if (value === "__new__") {
      setForm(f => ({ ...f, company: "", logo: "", bubbleClientCompanyId: "" }));
    } else {
      const found = companies.find((c) => c.name === value);
      setForm(f => ({
        ...f,
        company: value,
        logo: found?.logoUrl || "",
        bubbleClientCompanyId: found?.bubbleId || "",
      }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const companyName = isNewCompany ? newCompanyName.trim() : form.company.trim();
    if (!form.serviceType.trim()) {
      toast.error("Job title is required");
      return;
    }
    if (!companyName) {
      toast.error("Company name is required");
      return;
    }
    postJob.mutate({
      serviceType: form.serviceType,
      company: companyName,
      logo: form.logo || undefined,
      category: form.category || undefined,
      location: form.location || undefined,
      budget: form.askArtistRate ? undefined : (form.budget || undefined),
      workFromAnywhere: form.workFromAnywhere,
      description: form.description || undefined,
      applyEmail: form.applyEmail || undefined,
      bubbleClientCompanyId: form.bubbleClientCompanyId || undefined,
      appUrl: window.location.origin,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="bg-[#111] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            {headerLogo ? (
              <img
                src={headerLogo}
                alt={effectiveCompanyName || "Company"}
                className="w-12 h-12 rounded-xl object-contain bg-white p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
                {initials(effectiveCompanyName || "C")}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {step === "success" ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-[#111] mb-2">Job Posted!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Your job has been posted successfully and is now visible to artists.
            </p>
            <button
              onClick={onSuccess}
              className="px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-0">
            {/* Job Title */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Job Title
              </label>
              <input
                type="text"
                placeholder="Job Title"
                value={form.serviceType}
                onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                required
              />
            </div>

            {/* Company */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Company
              </label>
              <div className="flex-1 space-y-2">
                <select
                  value={selectedCompanyKey}
                  onChange={(e) => handleCompanySelect(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="__new__">＋ Create new company</option>
                </select>
                {isNewCompany && (
                  <input
                    type="text"
                    placeholder="New company name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                    required={isNewCompany}
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* Category */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
              >
                <option value="">Choose an option...</option>
                {JOB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Location + Work from anywhere (mutually exclusive) */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Location
              </label>
              <div className="flex-1 space-y-2">
                {/* Toggle pills */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, workFromAnywhere: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      !form.workFromAnywhere
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Specific location
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, workFromAnywhere: true, location: "" }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      form.workFromAnywhere
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Open to traveling applicants
                  </button>
                </div>
                {!form.workFromAnywhere && (
                  <input
                    type="text"
                    placeholder="City, State"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                  />
                )}
              </div>
            </div>

            {/* Rate */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Rate
              </label>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, askArtistRate: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      !form.askArtistRate
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Set a rate
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, askArtistRate: true, budget: "" }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      form.askArtistRate
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Ask artist for their rate
                  </button>
                </div>
                {!form.askArtistRate && (
                  <input
                    type="text"
                    placeholder="e.g. $350/day, $500 flat, $50/hr"
                    value={form.budget}
                    onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
                  />
                )}
                {form.askArtistRate && (
                  <p className="text-xs text-gray-400">Artists will be prompted to enter their rate when applying.</p>
                )}
              </div>
            </div>

            {/* Apply Email */}
            <div className="flex items-start gap-4 py-4 border-b border-gray-100">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Apply Email
              </label>
              <input
                type="email"
                placeholder="email@company.com"
                value={form.applyEmail}
                onChange={(e) => setForm((f) => ({ ...f, applyEmail: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#F25722] transition-all"
              />
            </div>

            {/* Description */}
            <div className="flex items-start gap-4 py-4">
              <label className="w-36 text-sm font-bold text-[#111] pt-2 flex-shrink-0">
                Description
              </label>
              <RichTextEditor
                value={form.description}
                onChange={(html) => setForm((f) => ({ ...f, description: html }))}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2 pb-2">
              <button
                type="submit"
                disabled={postJob.isPending}
                className="px-8 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {postJob.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Post Job"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Master View (Jobs / Companies / Artists tabs) ─────────────────────────────

type MasterTab = "jobs" | "companies" | "artists";

function MasterView({
  user,
  onSelectJob,
  initialJobId,
}: {
  user: any;
  onSelectJob: (job: any) => void;
  initialJobId?: number;
}) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<MasterTab>("jobs");
  const [showPostJob, setShowPostJob] = useState(false);
  const userId = user?.id;

  const utils = trpc.useUtils();

  const { data: jobsData, isLoading: jobsLoading } =
    trpc.enterprise.getJobs.useQuery(
      { clientUserId: userId },
      { enabled: !!userId }
    );

  const { data: appsData } = trpc.enterprise.getApplications.useQuery(
    { clientUserId: userId },
    { enabled: !!userId }
  );

  // Use real client companies from DB (seeded from premium_jobs)
  const { data: clientCompaniesData, isLoading: companiesLoading } =
    trpc.enterprise.getClientCompanies.useQuery();

  const { data: artistsData, isLoading: artistsLoading } =
    trpc.enterprise.getInterestedArtists.useQuery(
      { clientUserId: userId },
      { enabled: !!userId }
    );

  const jobs = jobsData?.jobs || [];
  const applications = appsData?.applications || [];
  const companies = clientCompaniesData?.companies || [];
  const artists = artistsData?.artists || [];

  // Auto-select job when arriving via /enterprise/:jobId deep link
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (initialJobId && jobs.length > 0 && !autoSelected) {
      const match = jobs.find((j: any) => j.id === initialJobId);
      if (match) {
        setAutoSelected(true);
        onSelectJob(match);
      }
    }
  }, [initialJobId, jobs, autoSelected, onSelectJob]);

  // Use job logo as fallback since the logged-in user may be a different account
  const firstJobLogo = jobs.length > 0 ? fixUrl(jobs[0].logo) : null;
  const rawLogo = user?.enterpriseLogoUrl || user?.profilePicture;
  const logoUrl = fixUrl(rawLogo) || firstJobLogo;
  const displayName = user?.name || user?.firstName || "Enterprise";

  const tabs: { id: MasterTab; label: string }[] = [
    { id: "jobs", label: "Jobs" },
    { id: "companies", label: "Companies" },
    { id: "artists", label: "Artists" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Post Job Modal */}
      {showPostJob && (
        <PostJobModal
          user={user}
          companies={companies}
          onClose={() => setShowPostJob(false)}
          onSuccess={() => {
            setShowPostJob(false);
            utils.enterprise.getJobs.invalidate();
            utils.enterprise.getClientCompanies.invalidate();
          }}
        />
      )}

      {/* Premium hero header */}
      <div className="bg-[#111] rounded-2xl overflow-hidden mb-6 shadow-xl">
        {/* Top: logo + name + CTA */}
        <div className="px-8 py-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            {logoUrl ? (
              <div className="w-20 h-20 rounded-full bg-white flex-shrink-0 overflow-hidden ring-4 ring-white/20 shadow-lg">
                <img
                  src={logoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex-shrink-0 flex items-center justify-center text-white font-black text-2xl ring-4 ring-white/20 shadow-lg">
                {initials(displayName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-1">Enterprise Dashboard</p>
              <h1 className="text-2xl font-black text-white truncate">{displayName}</h1>
            </div>
          </div>
          <button
            onClick={() => setShowPostJob(true)}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[#FFBC5D] to-[#F25722] hover:opacity-90 transition-opacity shadow-lg"
          >
            <Plus size={15} /> Post Job
          </button>
        </div>

        {/* Companies strip */}
        {!companiesLoading && companies.length > 0 && (
          <div className="border-t border-white/10 px-8 py-4">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3">Your Companies</p>
            <div className="flex flex-wrap gap-2">
              {companies.map((c: any) => {
                const cLogo = fixUrl(c.logoUrl);
                return (
                  <button
                    key={c.id}
                    onClick={() => setTab("companies")}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {cLogo ? (
                      <img src={cLogo} alt={c.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">
                        {initials(c.name)}
                      </div>
                    )}
                    <span className="text-white font-semibold text-sm">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3">
          {/* Jobs Tab */}
          {tab === "jobs" && (
            <div className="space-y-3">
              {jobsLoading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-[#F25722] rounded-full animate-spin mx-auto" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                    <Zap size={24} className="text-[#F25722]" />
                  </div>
                  <p className="text-base font-bold text-[#111] mb-1">No jobs yet</p>
                  <p className="text-sm text-gray-400 mb-5">Post your first job to start receiving applications from top artists.</p>
                  <button
                    onClick={() => setShowPostJob(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[#FFBC5D] to-[#F25722] hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Plus size={14} /> Post your first job
                  </button>
                </div>
              ) : (
                jobs.map((job: any) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    applicants={applications.filter(
                      (a: any) => a.jobTitle === (job.serviceType || job.title)
                    )}
                    onViewDetail={() => onSelectJob(job)}
                  />
                ))
              )}
            </div>
          )}

          {/* Companies Tab */}
          {tab === "companies" && (
            <div>
              {companiesLoading ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Loading companies…
                </div>
              ) : companies.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-700 mb-1">No companies yet</p>
                  <p className="text-sm text-gray-400">Companies are created when you post a job.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {companies.map((company: any) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      onClick={() => setTab("jobs")}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Artists Tab */}
          {tab === "artists" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-[#111] text-base mb-4">
                Interested Artists ({artists.length})
              </h3>
              {artistsLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Loading artists…
                </div>
              ) : artists.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No interested artists yet.
                </div>
              ) : (
                <div>
                  {artists.map((artist: any) => (
                    <ArtistRow key={artist.id} artist={artist} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Applications panel + Plan Status (right column) */}
        <div className="lg:col-span-1">
          <ApplicationsPanel applications={applications} />
          <PlanStatusCard />
        </div>
      </div>
    </div>
  );
}

// ── Enterprise Message Panel ──────────────────────────────────────────────────

function EnterpriseMessagePanel({
  applicant,
  name,
  onClose,
}: {
  applicant: any;
  name: string;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const sendMsg = trpc.enterprise.messageArtist.useMutation({
    onSuccess: () => {
      setSent(true);
      setTimeout(() => {
        onClose();
        navigate("/app/messages");
      }, 1800);
    },
    onError: (e: any) => toast.error(e.message || "Failed to send message"),
  });

  if (sent) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col items-center py-6 gap-3">
        <CheckCircle2 size={24} className="text-green-500" />
        <p className="font-bold text-sm text-[#111]">Message sent!</p>
        <p className="text-xs text-gray-400">Opening your messages thread with {name}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <textarea
        placeholder={`Hi ${name}, I saw your application and…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full min-h-[120px] resize-none text-sm border border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => sendMsg.mutate({ artistUserId: applicant.artistUserId, message: text })}
          disabled={!text.trim() || sendMsg.isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#111] rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {sendMsg.isPending ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
          Send Message
        </button>
      </div>
    </div>
  );
}

// ── Confirm Artist Dialog ────────────────────────────────────────────────────
function EnterpriseConfirmDialog({
  applicant,
  job,
  name,
  onClose,
  onConfirmed,
}: {
  applicant: any;
  job: any;
  name: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"artswrk" | "direct" | null>(null);
  const [rateType, setRateType] = useState<"flat" | "hourly">("flat");
  const [rateInput, setRateInput] = useState(""); // dollars
  const [hours, setHours] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationAddress, setLocationAddress] = useState(
    job.workFromAnywhere ? "" : (job.location || "")
  );
  const [notes, setNotes] = useState("");

  const confirm = trpc.enterprise.confirmApplicant.useMutation({
    onSuccess: () => {
      toast.success(`${name} confirmed! A confirmation email has been sent.`);
      onConfirmed();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to confirm artist"),
  });

  const picUrl = fixUrl(applicant.profilePicture);

  const rateDollars = parseFloat(rateInput) || 0;
  const clientTotal = rateDollars && paymentMethod === "artswrk" ? Math.round(rateDollars * 1.05) : rateDollars;

  const fieldCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition";
  const labelCls = "text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            {picUrl ? (
              <img src={picUrl} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">{(name[0] || "?").toUpperCase()}</div>
            )}
            <div>
              <h2 className="text-base font-black text-[#111]">Confirm {name}</h2>
              <p className="text-xs text-gray-400">{job.serviceType} · {job.company}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Booking summary (read-only) */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Job Details</p>
            <div className="space-y-2">
              {[["Role", job.serviceType || "—"], ["Company", job.company || "—"]].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">{l}</span>
                  <span className="text-sm font-semibold text-[#111] text-right">{v}</span>
                </div>
              ))}
              {applicant.rate && (
                <div className="flex justify-between gap-4">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">Quoted</span>
                  <span className="text-sm font-semibold text-[#F25722] text-right">{applicant.rate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rate */}
          <div>
            <label className={labelCls}>Rate</label>
            <div className="flex gap-2 mb-2">
              {(["flat", "hourly"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setRateType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${rateType === t ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                  {t === "flat" ? "Flat Rate" : "Hourly Rate"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" value={rateInput} onChange={(e) => setRateInput(e.target.value)}
                  placeholder={rateType === "flat" ? "500" : "35"}
                  className="w-full border border-gray-200 rounded-xl pl-7 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition" />
              </div>
              {rateType === "hourly" && (
                <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
                  placeholder="hrs"
                  className="w-24 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition" />
              )}
            </div>
            {rateType === "hourly" && rateDollars > 0 && hours && (
              <p className="text-xs text-gray-400 mt-1">Total: ${Math.round(rateDollars * parseFloat(hours)).toLocaleString()}</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>End Date <span className="font-normal text-gray-400">(opt)</span></label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldCls} />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            <input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)}
              placeholder={job.workFromAnywhere ? "Open to Traveling" : "City, State or address"}
              className={fieldCls} />
          </div>

          {/* Payment method */}
          <div>
            <p className={labelCls}>Payment Method</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setPaymentMethod("artswrk")}
                className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${paymentMethod === "artswrk" ? "border-[#F25722] bg-orange-50/60" : "border-gray-100 hover:border-gray-200 bg-white"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${paymentMethod === "artswrk" ? "bg-[#F25722]" : "bg-gray-100"}`}>
                  <CreditCard size={14} className={paymentMethod === "artswrk" ? "text-white" : "text-gray-500"} />
                </div>
                <p className="text-sm font-bold text-[#111]">Invoice via Artswrk</p>
                <p className="text-xs text-gray-400 mt-0.5">Artswrk handles invoicing</p>
              </button>
              <button onClick={() => setPaymentMethod("direct")}
                className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${paymentMethod === "direct" ? "border-[#111] bg-gray-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${paymentMethod === "direct" ? "bg-[#111]" : "bg-gray-100"}`}>
                  <Banknote size={14} className={paymentMethod === "direct" ? "text-white" : "text-gray-500"} />
                </div>
                <p className="text-sm font-bold text-[#111]">Pay Directly</p>
                <p className="text-xs text-gray-400 mt-0.5">Handle payment yourself</p>
              </button>
            </div>
            {paymentMethod === "artswrk" && (
              <div className="mt-2.5 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                <p className="text-xs text-amber-700 leading-relaxed">
                  A <strong>5% processing fee</strong> will be added.
                  {clientTotal > 0 && <span className="ml-1">Total billed: <strong>${clientTotal.toLocaleString()}</strong></span>}
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes for Artist <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Any details, next steps, or instructions…"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-[#111] hover:bg-gray-800 text-white"
            disabled={!paymentMethod || confirm.isPending}
            onClick={() => {
              if (!paymentMethod) return;
              confirm.mutate({
                applicantId: applicant.id,
                paymentMethod,
                rateType,
                artistRateCents: rateDollars ? Math.round(rateDollars * 100) : undefined,
                hours: hours ? parseFloat(hours) : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                locationAddress: locationAddress || undefined,
                notes: notes || undefined,
              });
            }}
          >
            {confirm.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <UserCheck size={14} className="mr-1.5" />}
            Confirm {name.split(" ")[0]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Applicant Detail View ─────────────────────────────────────────────────────
function ApplicantDetailView({
  applicant,
  allApplicants,
  job,
  jobTitle,
  onBack,
  onNavigate,
  onConfirmed,
}: {
  applicant: any;
  allApplicants: any[];
  job: any;
  jobTitle: string;
  onBack: () => void;
  onNavigate: (idx: number) => void;
  onConfirmed: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const currentIdx = allApplicants.findIndex((a) => a.id === applicant.id);
  const name = formatArtistName(applicant.firstName, applicant.lastName, applicant.name || "Artist");
  const picUrl = fixUrl(applicant.profilePicture);
  const profileUrl = applicant.slug ? `/book/${applicant.slug}` : null;
  const disciplines = parseList(applicant.disciplines);
  const rate = applicant.artistFlatRate
    ? `Flat Rate: $${applicant.artistFlatRate}`
    : applicant.artistHourlyRate
    ? `$${applicant.artistHourlyRate}/hr`
    : applicant.rate || null;

  const resumeFileName = applicant.resumeLink
    ? decodeURIComponent(applicant.resumeLink.split("/").pop() || "resume").replace(/%20/g, " ")
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb nav */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#F25722] transition-colors font-medium">
          <ArrowLeft size={14} /> Back to applicants
        </button>
        <div className="flex items-center gap-2">
          <button disabled={currentIdx <= 0} onClick={() => onNavigate(currentIdx - 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-500">
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs text-gray-400 tabular-nums">{currentIdx + 1} / {allApplicants.length}</span>
          <button disabled={currentIdx >= allApplicants.length - 1} onClick={() => onNavigate(currentIdx + 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-500">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">

        {/* ── Left sidebar: identity + actions ── */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">
          {/* Photo card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {picUrl ? (
              <img src={picUrl} alt={name} className="w-full aspect-square object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-4xl font-black">
                {(name[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <h2 className="text-base font-black text-[#111]">{name}</h2>
                {applicant.artswrkPro && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{backgroundColor: '#f9ecf3', color: '#ec008c'}}>PRO</span>
                )}
              </div>
              {applicant.location && (
                <p className="text-xs text-gray-400 flex items-center gap-1">{applicant.location}</p>
              )}
              {rate && (
                <p className="text-sm font-black text-[#F25722] mt-2">{rate}</p>
              )}
              {disciplines.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {disciplines.slice(0, 4).map((d: string) => (
                    <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{d}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
            style={{background: 'linear-gradient(135deg, #FFBC5D, #F25722)'}}
          >
            <UserCheck size={15} /> Confirm Artist
          </button>
          <button
            onClick={() => setMsgOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            <MessageCircle size={15} /> Message {applicant.firstName || name.split(" ")[0]}
          </button>

          {msgOpen && (
            <Dialog open onOpenChange={() => setMsgOpen(false)}>
              <DialogContent className="max-w-md p-0 overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {picUrl && <img src={picUrl} alt={name} className="w-9 h-9 rounded-full object-cover border border-gray-100" />}
                    <div>
                      <h3 className="text-sm font-black text-[#111]">Message {name}</h3>
                      <p className="text-xs text-gray-400">Creates a thread in Messages</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <EnterpriseMessagePanel applicant={applicant} name={name} onClose={() => setMsgOpen(false)} />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* ── Right main: submission details ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Application message */}
          {applicant.message && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                {picUrl && <img src={picUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100" />}
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Message from {applicant.firstName || name}</p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{applicant.message}</p>
            </div>
          )}

          {/* Profile preview card */}
          {profileUrl && (
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-gray-300 hover:shadow-md transition-all group">
              <div className="flex items-start gap-4">
                {picUrl ? (
                  <img src={picUrl} alt={name} className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                    {(name[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-bold text-[#111]">{name}'s Profile</p>
                    <span className="text-xs font-semibold text-[#F25722] flex items-center gap-1 group-hover:underline">
                      View Profile <ExternalLink size={11} />
                    </span>
                  </div>
                  {applicant.bio ? (
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{applicant.bio}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Click to view full artist profile →</p>
                  )}
                </div>
              </div>
            </a>
          )}

          {/* Resume */}
          {applicant.resumeLink && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Resume</p>
              <a
                href={applicant.resumeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#F25722] hover:bg-orange-50/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#fff3ee'}}>
                  <span className="text-[10px] font-black text-[#F25722]">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111] truncate">{resumeFileName}</p>
                  <p className="text-xs text-gray-400">Click to open</p>
                </div>
                <ExternalLink size={14} className="text-gray-400 group-hover:text-[#F25722] transition-colors flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Bio (if no profile link to show it) */}
          {applicant.bio && !profileUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">{applicant.bio}</p>
            </div>
          )}

          {/* Status badge */}
          {applicant.status && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${appStatusColor(applicant.status)}`}>{applicant.status}</span>
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <EnterpriseConfirmDialog applicant={applicant} job={job} name={name} onClose={() => setShowConfirm(false)} onConfirmed={onConfirmed} />
      )}
    </div>
  );
}

// ── Job Detail View ───────────────────────────────────────────────────────────
type DetailTab = "applicants" | "details";

function JobDetailView({
  job,
  user,
  onBack,
  onJobUpdate,
}: {
  job: any;
  user: any;
  onBack: () => void;
  onJobUpdate: (updated: any) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("applicants");
  const [checkingOut, setCheckingOut] = useState(false);
  const [msgOpen, setMsgOpen] = useState<number | null>(null);
  const [selectedApplicantIdx, setSelectedApplicantIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    serviceType: job.serviceType || "",
    company: job.company || "",
    category: job.category || "",
    location: job.location && !job.location.includes("[object") ? job.location : "",
    workFromAnywhere: !!job.workFromAnywhere,
    budget: job.budget || job.rate || "",
    askArtistRate: !job.budget && !job.rate,
    description: job.description || "",
    applyEmail: job.applyEmail || "",
  });
  const utils = trpc.useUtils();

  const updateJob = trpc.enterprise.updateOwnJob.useMutation({
    onSuccess: () => {
      toast.success("Job updated successfully");
      setEditing(false);
      // Merge editForm into the job so the detail view reflects changes immediately
      onJobUpdate({
        ...job,
        serviceType: editForm.serviceType || job.serviceType,
        company: editForm.company || job.company,
        category: editForm.category || job.category,
        location: editForm.workFromAnywhere ? "" : (editForm.location || job.location),
        workFromAnywhere: editForm.workFromAnywhere,
        budget: editForm.askArtistRate ? null : (editForm.budget || null),
        rate: editForm.askArtistRate ? null : (editForm.budget || job.rate),
        description: editForm.description ?? job.description,
        applyEmail: editForm.applyEmail || job.applyEmail,
      });
      utils.enterprise.getJobs.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to save changes"),
  });

  const archiveJob = trpc.enterprise.archiveOwnJob.useMutation({
    onSuccess: () => {
      toast.success("Job archived");
      onBack();
      utils.enterprise.getJobs.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to archive job"),
  });

  function handleSave() {
    updateJob.mutate({
      id: job.id,
      serviceType: editForm.serviceType || undefined,
      company: editForm.company || undefined,
      category: editForm.category || undefined,
      location: editForm.workFromAnywhere ? "" : (editForm.location || undefined),
      workFromAnywhere: editForm.workFromAnywhere,
      budget: editForm.askArtistRate ? "" : editForm.budget,
      description: editForm.description || undefined,
      applyEmail: editForm.applyEmail || undefined,
    });
  }

  const { data: applicantsData, isLoading } =
    trpc.enterprise.getJobApplicants.useQuery(
      { jobId: job.id },
      { enabled: !!job.id }
    );

  const checkoutJobUnlock = trpc.enterprise.checkoutJobUnlock.useMutation();
  const checkoutSubscription = trpc.enterprise.checkoutSubscription.useMutation();
  const [subInterval, setSubInterval] = useState<"month" | "year">("month");
  const [subscribing, setSubscribing] = useState(false);

  const applicants = applicantsData?.applicants || [];
  const preview = (applicantsData as any)?.preview || [];
  const isLocked = applicantsData?.locked ?? false;
  const applicantCount = applicantsData?.applicantCount ?? applicants.length;

  async function handleUnlockCheckout() {
    setCheckingOut(true);
    try {
      const result = await checkoutJobUnlock.mutateAsync({
        jobId: job.id,
        jobTitle: job.serviceType || job.title,
        origin: window.location.origin,
      });
      if (result.alreadyUnlocked) {
        utils.enterprise.getJobApplicants.invalidate({ jobId: job.id });
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setCheckingOut(false);
    }
  }

  async function handleSubscribeCheckout(interval: "month" | "year") {
    setSubscribing(true);
    try {
      const result = await checkoutSubscription.mutateAsync({
        interval,
        origin: window.location.origin,
      });
      if (result.url) window.location.href = result.url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setSubscribing(false);
    }
  }

  const rawLogo = job.logo || job.enterpriseLogoUrl || user?.enterpriseLogoUrl;
  const logoUrl = fixUrl(rawLogo);
  const jobTitle = job.serviceType || job.title || "Job";
  const postedBy = user?.name || "Enterprise";
  const postedDate = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const status = job.status || job.requestStatus;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button
          onClick={() => {}}
          className="hover:text-gray-600 transition-colors"
        >
          <Home size={14} />
        </button>
        <ChevronRight size={14} />
        <button
          onClick={onBack}
          className="hover:text-[#F25722] transition-colors font-medium"
        >
          {postedBy}
        </button>
        <ChevronRight size={14} />
        <span className="text-[#111] font-semibold truncate max-w-xs">
          {jobTitle}
        </span>
      </nav>

      {/* Job header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={postedBy}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-lg">
                  {initials(postedBy)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-[#111] mb-1">
                {jobTitle}
              </h2>
              <p className="text-sm text-gray-500">
                {postedBy}
                {postedDate ? ` | Posted ${postedDate}` : ""}
              </p>
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(true); setTab("details"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} />
              Edit Job
            </button>
            <button
              onClick={() => { if (confirm("Archive this job? It will no longer be visible to artists.")) archiveJob.mutate({ id: job.id }); }}
              disabled={archiveJob.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Archive size={14} />
              {archiveJob.isPending ? "Archiving…" : "Archive"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
        {(["applicants", "details"] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {t === "applicants" ? "Applicants" : "Details"}
          </button>
        ))}
      </div>

      {/* Applicants Tab */}
      {tab === "applicants" && selectedApplicantIdx !== null && applicants[selectedApplicantIdx] && (
        <ApplicantDetailView
          applicant={applicants[selectedApplicantIdx]}
          allApplicants={applicants}
          job={job}
          jobTitle={jobTitle}
          onBack={() => setSelectedApplicantIdx(null)}
          onNavigate={(idx) => setSelectedApplicantIdx(idx)}
          onConfirmed={() => { setSelectedApplicantIdx(null); utils.enterprise.getJobApplicants.invalidate({ jobId: job.id }); }}
        />
      )}
      {tab === "applicants" && selectedApplicantIdx === null && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Loading applicants…
            </div>
          ) : isLocked ? (
            /* On-demand paywall — redesigned */
            <div className="p-6">
              {/* Green availability banner */}
              {applicantCount > 0 && (
                <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={22} className="text-green-500" />
                  </div>
                  <p className="text-base font-semibold text-[#111]">
                    You have {applicantCount} artist{applicantCount !== 1 ? "s" : ""} available for your job!
                  </p>
                </div>
              )}

              {/* Artist preview grid */}
              {applicantCount > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#111] mb-5 flex items-center gap-2">
                    Select your membership to connect with {applicantCount} artist{applicantCount !== 1 ? "s" : ""}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mt-0.5 rotate-45">
                      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                    </svg>
                  </h3>
                  <div className="flex flex-wrap gap-6">
                    {(preview.length > 0 ? preview.slice(0, 8) : Array.from({ length: Math.min(applicantCount, 4) })).map((p: any, i: number) => {
                      const firstName = p?.firstName || null;
                      const lastName = p?.lastName || null;
                      const rawPic = p?.profilePicture || null;
                      const pic = rawPic ? (rawPic.startsWith("//") ? "https:" + rawPic : rawPic) : null;
                      const displayName = formatArtistName(firstName, lastName, `Artist ${i + 1}`);
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 w-20">
                          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-md flex-shrink-0">
                            {pic ? (
                              <img src={pic} alt={displayName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 font-bold text-lg">
                                {firstName ? firstName.charAt(0).toUpperCase() : "?"}
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[#111] text-center leading-tight">{displayName}</span>
                        </div>
                      );
                    })}
                    {applicantCount > 8 && (
                      <div className="flex flex-col items-center gap-2 w-20">
                        <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-white shadow-md flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-500">+{applicantCount - 8}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-400 text-center">more</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-gray-100 mb-6" />

              {/* Two options side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: One-time unlock */}
                <div className="border-2 border-gray-100 rounded-2xl p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Unlock size={15} className="text-[#F25722]" />
                    </div>
                    <span className="text-sm font-bold text-[#111]">Unlock This Job</span>
                  </div>
                  <p className="text-3xl font-black text-[#111] mb-1">$100</p>
                  <p className="text-xs text-gray-400 mb-4">One-time · this job only</p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {[
                      "Full candidate list for this job",
                      "View profiles & contact info",
                      "Message applicants directly",
                      "No recurring commitment",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle2 size={12} className="text-[#F25722] mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleUnlockCheckout}
                    disabled={checkingOut || subscribing}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {checkingOut ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Redirecting…</>
                    ) : (
                      <><Unlock size={15} /> Unlock — $100</>
                    )}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-2">Secure checkout via Stripe</p>
                </div>
                {/* Option 2: Subscribe */}
                <div className="border-2 border-[#F25722] rounded-2xl p-5 flex flex-col relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F25722] text-white text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap">
                    BEST VALUE
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Star size={15} className="text-[#F25722]" />
                    </div>
                    <span className="text-sm font-bold text-[#111]">Enterprise Plan</span>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mb-3 w-fit">
                    <button
                      onClick={() => setSubInterval("month")}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${subInterval === "month" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setSubInterval("year")}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${subInterval === "year" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
                    >
                      Annual <span className="text-[#F25722]">–17%</span>
                    </button>
                  </div>
                  <div className="mb-0.5">
                    <span className="text-sm text-gray-400 line-through mr-1">
                      {subInterval === "month" ? "$500" : "$417"}
                    </span>
                    <span className="text-3xl font-black text-[#111]">
                      {subInterval === "month" ? "$250" : "$208"}
                    </span>
                    <span className="text-sm font-normal text-gray-400">/mo</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">
                    {subInterval === "year" ? "Billed $2,500/yr (list $5,000) · save 50%" : "Billed monthly · cancel anytime"}
                  </p>
                  <p className="text-[11px] text-[#F25722] font-semibold mb-4">
                    Introductory pricing — locked in for life of subscription
                  </p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {[
                      "Unlimited candidate access",
                      "All current & future jobs",
                      "Priority artist matching",
                      "Dedicated account support",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle2 size={12} className="text-[#F25722] mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscribeCheckout(subInterval)}
                    disabled={subscribing || checkingOut}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-[#F25722] border-2 border-[#F25722] hover:bg-orange-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {subscribing ? (
                      <><div className="w-4 h-4 border-2 border-[#F25722]/40 border-t-[#F25722] rounded-full animate-spin" /> Redirecting…</>
                    ) : (
                      <>Subscribe — {subInterval === "month" ? "$250/mo" : "$2,500/yr"}</>
                    )}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-2">
                    {applicantCount >= 3 ? `Break-even at 3 jobs · you have ${applicantCount}+ waiting` : "Unlimited jobs · cancel anytime"}
                  </p>
                </div>
              </div>
            </div>
          ) : applicants.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No applicants yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <p className="text-xs text-gray-400 font-medium px-5 pt-4 pb-3">{applicants.length} applicant{applicants.length !== 1 ? "s" : ""}</p>
              {applicants.map((a: any) => {
                const name = a.firstName ? formatArtistName(a.firstName, a.lastName) : a.name || "Artist";
                const picUrl = fixUrl(a.profilePicture);
                const cardRate = a.rate || null;
                const cardIdx = applicants.findIndex((ap: any) => ap.id === a.id);
                const msgPreview = a.message
                  ? a.message.length > 160 ? a.message.slice(0, 160).trimEnd() + " …" : a.message
                  : null;
                return (
                  <div key={a.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      {picUrl ? (
                        <img src={picUrl} alt={name} className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 flex-shrink-0 mt-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm flex-shrink-0 mt-0.5">
                          {(name[0] || "?").toUpperCase()}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="font-bold text-[#111] text-sm">{name}</span>
                              {a.artswrkPro && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{backgroundColor: '#f9ecf3', color: '#ec008c'}}>PRO</span>
                              )}
                              {a.status && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${appStatusColor(a.status)}`}>{a.status}</span>
                              )}
                            </div>
                            {a.location && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 mb-1.5">
                                <MapPin size={10} /> {a.location}
                              </p>
                            )}
                            {msgPreview && (
                              <p className="text-sm text-gray-500 leading-relaxed">{msgPreview}</p>
                            )}
                          </div>

                          {/* Right: rate + CTA */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[140px]">
                            {cardRate && (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{background:'#fff3ee', color:'#F25722', border:'1px solid #ffd5c0'}}>
                                {cardRate}
                              </span>
                            )}
                            <button
                              onClick={() => setSelectedApplicantIdx(cardIdx)}
                              className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#111] text-white text-xs font-bold hover:bg-gray-800 transition-colors whitespace-nowrap"
                            >
                              View Submission <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Details Tab */}
      {tab === "details" && !editing && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          {job.description && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
              <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: job.description }} />
            </div>
          )}
          {job.category && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category</h4>
              <p className="text-sm text-gray-700">{job.category}</p>
            </div>
          )}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Location</h4>
            <p className="text-sm text-gray-700 flex items-center gap-1">
              <MapPin size={13} className="text-gray-400" />
              {job.location && !job.location.includes("[object") ? job.location : !!job.workFromAnywhere ? "Open to Traveling Applicants" : "TBD"}
            </p>
          </div>
          {job.applyEmail && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Apply Email</h4>
              <a href={`mailto:${job.applyEmail}`} className="text-sm text-[#F25722] hover:underline">{job.applyEmail}</a>
            </div>
          )}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rate</h4>
            {(job.budget || job.rate)
              ? <p className="text-sm text-gray-700">{job.budget || job.rate}</p>
              : <p className="text-sm text-gray-500 italic">Open — artists pitch their rate</p>
            }
          </div>
        </div>
      )}

      {/* Edit form */}
      {tab === "details" && editing && (() => {
        const fieldCls = "w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#F25722] transition-colors bg-white";
        const labelCls = "block text-xs font-semibold text-gray-500 mb-1";
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-[#111]">Edit Job</h3>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
            </div>

            {/* Job Title */}
            <div>
              <label className={labelCls}>Job Title *</label>
              <input value={editForm.serviceType} onChange={e => setEditForm(f => ({ ...f, serviceType: e.target.value }))} className={fieldCls} placeholder="e.g. Judge, Emcee, General Staff" />
            </div>

            {/* Company */}
            <div>
              <label className={labelCls}>Company</label>
              <input value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} className={fieldCls} placeholder="Company name" />
            </div>

            {/* Category */}
            <div>
              <label className={labelCls}>Category</label>
              <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className={fieldCls}>
                <option value="">None</option>
                <option value="Dance Competition">Dance Competition</option>
                <option value="Dance Convention">Dance Convention</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location</label>
              <div className="flex gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, workFromAnywhere: false }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${!editForm.workFromAnywhere ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                >
                  Specific location
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, workFromAnywhere: true, location: "" }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${editForm.workFromAnywhere ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                >
                  Open to traveling
                </button>
              </div>
              {!editForm.workFromAnywhere && (
                <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className={fieldCls} placeholder="City, State" />
              )}
            </div>

            {/* Rate */}
            <div>
              <label className={labelCls}>Rate</label>
              <div className="flex gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, askArtistRate: false }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${!editForm.askArtistRate ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                >
                  Set a rate
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, askArtistRate: true, budget: "" }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${editForm.askArtistRate ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                >
                  Ask artist for rate
                </button>
              </div>
              {!editForm.askArtistRate && (
                <input value={editForm.budget} onChange={e => setEditForm(f => ({ ...f, budget: e.target.value }))} className={fieldCls} placeholder="e.g. $350/day, $500 flat, $50/hr" />
              )}
            </div>

            {/* Apply Email */}
            <div>
              <label className={labelCls}>Apply Email</label>
              <input type="email" value={editForm.applyEmail} onChange={e => setEditForm(f => ({ ...f, applyEmail: e.target.value }))} className={fieldCls} placeholder="applications@yourcompany.com" />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <RichTextEditor value={editForm.description} onChange={html => setEditForm(f => ({ ...f, description: html }))} />
            </div>

            {/* Save */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateJob.isPending || !editForm.serviceType.trim()}
                className="px-5 py-2 text-sm font-bold text-white bg-[#111] rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {updateJob.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Enterprise Billing Settings ──────────────────────────────────────────────

function EnterpriseBillingSettings({ onBack }: { onBack: () => void }) {
  const { data: billing, isLoading } = trpc.enterprise.getBillingInfo.useQuery(undefined, { retry: false });
  const createPortal = trpc.enterprise.billingPortal.useMutation();
  const checkoutSubscription = trpc.enterprise.checkoutSubscription.useMutation();
  const [subInterval, setSubInterval] = useState<"month" | "year">("month");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  async function handleManageBilling() {
    setLoadingPortal(true);
    try {
      const result = await createPortal.mutateAsync({ returnUrl: `${window.location.origin}/enterprise?settings=1` });
      if (result.url) window.location.href = result.url;
    } catch (err: any) {
      toast.error(err.message || "Could not open billing portal");
      setLoadingPortal(false);
    }
  }

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const result = await checkoutSubscription.mutateAsync({
        interval: subInterval,
        origin: window.location.origin,
      });
      if (result.url) window.location.href = result.url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setSubscribing(false);
    }
  }

  const plan = billing?.enterprisePlan;
  const status = billing?.subscriptionStatus;
  const interval = billing?.subscriptionInterval;
  const renewsAt = billing?.currentPeriodEnd;
  const cancelAtEnd = billing?.cancelAtPeriodEnd;

  const isSubscriber = plan === "subscriber";

  return (
    <div className="flex-1 overflow-y-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors mb-3 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-black text-[#111]">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your Enterprise plan and billing</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Current Plan Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Current Plan</h2>

            {isSubscriber ? (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-black text-[#111]">Enterprise Subscriber</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        status === "active" ? "bg-green-100 text-green-700" :
                        status === "past_due" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-600"
                      }`}>
                        {status === "active" ? "Active" : status === "past_due" ? "Past Due" : status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {interval === "year" ? "Annual billing — $2,500/yr" : "Monthly billing — $250/mo"}
                    </p>
                    {renewsAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        {cancelAtEnd ? "Cancels" : "Renews"} {new Date(renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Zap size={22} className="text-white" />
                  </div>
                </div>

                <ul className="space-y-1.5 mb-5">
                  {[
                    "Unlimited candidate access across all jobs",
                    "Post unlimited PRO jobs",
                    "Priority artist matching",
                    "Dedicated account support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={14} className="text-purple-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleManageBilling}
                  disabled={loadingPortal}
                  className="w-full py-2.5 rounded-xl text-sm font-bold border-2 border-[#111] text-[#111] hover:bg-[#111] hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingPortal ? (
                    <><div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" /> Opening portal…</>
                  ) : (
                    <><CreditCard size={15} /> Manage Billing &amp; Invoices</>
                  )}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Update payment method, download invoices, or cancel
                </p>
              </div>
            ) : plan === "on_demand" ? (
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xl font-black text-[#111] mb-1">On-Demand</p>
                    <p className="text-sm text-gray-500">$100 per job to unlock candidate lists</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center flex-shrink-0">
                    <Unlock size={20} className="text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-4">
                  <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Subscribe to get unlimited access at a lower per-job cost.</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm mb-2">No active plan</p>
                <p className="text-xs text-gray-400">Subscribe below to unlock all features</p>
              </div>
            )}
          </div>

          {/* Upgrade / Switch Plan (shown when not subscriber, or when subscriber to let them switch interval) */}
          {(!isSubscriber) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Upgrade to Enterprise Subscription</h2>

              {/* Interval toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
                <button
                  onClick={() => setSubInterval("month")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subInterval === "month" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSubInterval("year")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subInterval === "year" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
                >
                  Annual <span className="text-[#F25722] text-xs">–50%</span>
                </button>
              </div>

              <div className="border-2 border-[#F25722] rounded-2xl p-5 mb-4">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-sm text-gray-400 line-through">
                    {subInterval === "month" ? "$500" : "$417"}/mo
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-[#111]">
                    {subInterval === "month" ? "$250" : "$208"}
                  </span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
                <p className="text-xs text-gray-400 mb-0.5">
                  {subInterval === "year" ? "Billed $2,500/yr (list price $5,000)" : "Billed monthly · cancel anytime"}
                </p>
                <p className="text-xs text-[#F25722] font-semibold mb-4">
                  Introductory pricing — locked in for life of subscription
                </p>

                <ul className="space-y-2 mb-5">
                  {[
                    "Unlimited candidate access across all jobs",
                    "Post unlimited PRO jobs",
                    "Priority artist matching",
                    "Dedicated account support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={14} className="text-[#F25722] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {subscribing ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Redirecting…</>
                  ) : (
                    <>Subscribe — {subInterval === "month" ? "$250/mo" : "$2,500/yr"}</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Manage billing for subscribers — switch interval */}
          {isSubscriber && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Switch Billing Interval</h2>
              <p className="text-xs text-gray-400 mb-4">Changes take effect at next renewal.</p>
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
                <button
                  onClick={() => setSubInterval("month")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subInterval === "month" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
                >
                  Monthly — $250/mo
                </button>
                <button
                  onClick={() => setSubInterval("year")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subInterval === "year" ? "bg-white shadow text-[#111]" : "text-gray-500"}`}
                >
                  Annual — $2,500/yr <span className="text-[#F25722] text-xs">–17%</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                To switch intervals, use the billing portal to update your subscription.
              </p>
              <button
                onClick={handleManageBilling}
                disabled={loadingPortal}
                className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingPortal ? (
                  <><div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" /> Opening…</>
                ) : (
                  <><CreditCard size={15} /> Open Billing Portal</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Enterprise Page ──────────────────────────────────────────────────────

export default function Enterprise({ initialJobId }: { initialJobId?: number } = {}) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const utils = trpc.useUtils();

  function selectJob(job: any) {
    setSelectedJob(job);
    navigate(`/enterprise/${job.id}`);
  }

  function clearJob() {
    setSelectedJob(null);
    navigate("/enterprise");
  }

  // Fetch the enterprise user data from DB (by ID to get full profile)
  const { data: userById } = trpc.artswrkUsers.getById.useQuery(
    { id: (user as any)?.id || 0 },
    { enabled: !!(user as any)?.id }
  );

  // userById returns { user: {...} }, auth user already has full fields
  const enterpriseUser = (userById as any)?.user || user;

  const verifyJobUnlock = trpc.enterprise.verifyJobUnlock.useMutation();
  const didVerify = useRef(false);

  // Handle post-checkout redirects — verify Stripe session and record unlock in DB
  useEffect(() => {
    if (didVerify.current) return;
    const params = new URLSearchParams(window.location.search);
    const unlockJobId = params.get("unlock_job");
    const sessionId = params.get("session_id");
    const subscribed = params.get("subscribed");
    if (unlockJobId && sessionId) {
      didVerify.current = true;
      window.history.replaceState({}, "", "/enterprise");
      verifyJobUnlock.mutate(
        { sessionId, jobId: parseInt(unlockJobId) },
        {
          onSuccess: () => {
            utils.enterprise.getJobApplicants.invalidate({ jobId: parseInt(unlockJobId) });
            utils.enterprise.getUnlockedJobs.invalidate();
            toast.success("Job unlocked! You can now view all candidates.");
          },
          onError: (err) => toast.error(err.message || "Failed to verify unlock — contact support"),
        }
      );
    } else if (unlockJobId) {
      // Fallback: session_id missing but job param present — just refresh
      utils.enterprise.getJobApplicants.invalidate({ jobId: parseInt(unlockJobId) });
      utils.enterprise.getUnlockedJobs.invalidate();
      window.history.replaceState({}, "", "/enterprise");
    }
    if (subscribed) {
      utils.enterprise.getBillingInfo.invalidate();
      toast.success("Subscription activated! You now have unlimited candidate access.");
      window.history.replaceState({}, "", "/enterprise");
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={(section) => {
          setActiveSection(section);
          clearJob();
        }}
      />

      {/* Main content */}
      <main className="flex-1 p-6 overflow-hidden">
        {activeSection === "settings" ? (
          <EnterpriseBillingSettings onBack={() => setActiveSection("dashboard")} />
        ) : selectedJob ? (
          <JobDetailView
            job={selectedJob}
            user={enterpriseUser}
            onBack={clearJob}
            onJobUpdate={(updated) => setSelectedJob(updated)}
          />
        ) : (
          <MasterView
            user={enterpriseUser}
            onSelectJob={selectJob}
            initialJobId={initialJobId}
          />
        )}
      </main>
    </div>
  );
}
