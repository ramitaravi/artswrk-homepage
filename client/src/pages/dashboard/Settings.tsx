/**
 * Client Settings Page — /app/settings
 * Tabs: Profile · Account · Subscription · Help
 */
import { useState, useRef, useEffect } from "react";
import {
  User, CreditCard, HelpCircle, ChevronRight,
  Camera, Loader2, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import CompanyManager from "@/components/CompanyManager";
import LocationAutocompleteInput from "@/components/LocationAutocompleteInput";
import { useLocationField } from "@/hooks/useLocationField";

type Tab = "profile" | "account" | "subscription" | "help";

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <User size={18} /> },
  { id: "account", label: "Account", icon: <User size={18} /> },
  { id: "subscription", label: "My Plan", icon: <CreditCard size={18} /> },
  { id: "help", label: "Help", icon: <HelpCircle size={18} /> },
];

function Sidebar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="w-full md:w-64 flex-shrink-0">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left mb-0.5 ${
                isActive ? "bg-orange-50 text-[#F25722]" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isActive ? "bg-orange-100" : "bg-gray-100"
              }`}>
                <span className={isActive ? "text-[#F25722]" : "text-gray-500"}>{item.icon}</span>
              </div>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth();
  const { data: artswrkUser, refetch } = trpc.artswrkUsers.getByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [phone, setPhone] = useState("");
  const location = useLocationField();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (artswrkUser) {
      setFirstName(artswrkUser.firstName ?? "");
      setLastName(artswrkUser.lastName ?? "");
      setPronouns((artswrkUser as any).pronouns ?? "");
      setPhone((artswrkUser as any).phoneNumber ?? "");
      location.reset((artswrkUser as any).location);
    }
  }, [artswrkUser]);

  const saveProfile = trpc.signup.saveProfile.useMutation({
    onSuccess: () => { toast.success("Profile saved!"); refetch(); },
    onError: (e) => toast.error(e.message || "Failed to save profile"),
  });

  const uploadPic = trpc.signup.uploadProfilePicture.useMutation({
    onSuccess: (data) => { setAvatarPreview(data.url); refetch(); toast.success("Profile picture updated!"); },
    onError: (e) => toast.error(e.message || "Failed to upload picture"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = (ev.target?.result as string).split(",")[1];
      uploadPic.mutate({ base64: b64, contentType: file.type });
    };
    reader.readAsDataURL(file);
  }

  const rawPic = artswrkUser?.profilePicture;
  const avatarSrc = avatarPreview || (rawPic ? (rawPic.startsWith("//") ? `https:${rawPic}` : rawPic) : null);
  const initials = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "?";

  const { data: companiesData } = trpc.companies.list.useQuery();
  const companies = companiesData?.companies ?? [];

  const fieldCls = "w-full border-0 border-b border-gray-200 bg-transparent py-2 text-sm text-[#111] focus:outline-none focus:border-[#F25722] transition-colors placeholder-gray-300";
  const labelCls = "text-xs text-gray-400 block mb-0.5";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-8">
      <h2 className="text-2xl font-black text-[#111]">Profile</h2>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-2xl">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
            ) : initials}
          </div>
          {uploadPic.isPending && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-white" />
            </div>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadPic.isPending}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors"
        >
          <Camera size={12} /> Change Picture
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Fields */}
      <div className="space-y-5">
        <div>
          <label className={labelCls}>First name</label>
          <input className={fieldCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
        </div>
        <div>
          <label className={labelCls}>Last name</label>
          <input className={fieldCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
        </div>
        <div>
          <label className={labelCls}>Pronouns</label>
          <input className={fieldCls} value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="e.g. she/her" />
        </div>
        <div>
          <label className={labelCls}>Phone number</label>
          <input className={fieldCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" type="tel" />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <LocationAutocompleteInput
            value={location.value}
            onChange={location.onChange}
            placeholder="City, State"
            icon={false}
            inputClassName={fieldCls}
          />
        </div>
      </div>

      {/* My Companies */}
      {companies.length > 0 && (
        <div>
          <h3 className="text-xl font-black text-[#111] mb-5">My Companies</h3>
          <CompanyManager />
        </div>
      )}

      {/* Save */}
      <button
        onClick={() => saveProfile.mutate({ firstName, lastName, pronouns, phoneNumber: phone, location: location.value, locationData: location.locationData })}
        disabled={saveProfile.isPending}
        className="w-full py-3.5 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saveProfile.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
        Save
      </button>
    </div>
  );
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

function AccountTab() {
  const { user } = useAuth();
  // auth.me already returns the full DB row — a secondary getByEmail lookup
  // here silently failed for accounts with a null/blank email (duplicate
  // migrated rows), which broke isArtist and misrouted the sidebar. Same
  // fix as App.tsx's route dispatcher (4abfa1f).
  const artswrkUser = user as any;
  const [resetSent, setResetSent] = useState(false);

  const forgotPw = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => { setResetSent(true); toast.success("Password reset email sent!"); },
    onError: (e) => toast.error(e.message || "Failed to send reset email"),
  });

  const isArtist = (artswrkUser?.planTier as string | undefined)?.startsWith("artist_") ?? false;
  const email = user?.email || artswrkUser?.email || "";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111]">Account</h2>
        <p className="text-sm text-gray-400 mt-1">Manage your Artswrk account information below</p>
      </div>

      <div className="border-t border-gray-100 pt-6">
        {/* Email */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-base font-bold text-[#111] mb-1">Email</p>
            <p className="text-sm text-gray-500">{email}</p>
            <span className={`inline-flex items-center mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${
              isArtist ? "bg-pink-50 text-[#ec008c]" : "bg-orange-50 text-[#F25722]"
            }`}>
              {isArtist ? "Artist Account" : "Client Account"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        {/* Password */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-base font-bold text-[#111] mb-1">Password</p>
            <p className="text-sm text-gray-400 tracking-widest">••••••••••••••</p>
          </div>
          <button
            onClick={() => email && forgotPw.mutate({ email, origin: window.location.origin })}
            disabled={forgotPw.isPending || resetSent}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {resetSent ? (
              <><CheckCircle2 size={14} className="text-green-500" /> Sent!</>
            ) : forgotPw.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : "Reset Password"}
            {!resetSent && !forgotPw.isPending && <ChevronRight size={14} className="text-gray-400" />}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        {/* Delete Account */}
        <p className="text-base font-bold text-[#111] mb-1">Delete Account</p>
        <p className="text-sm text-gray-400 mb-4">Do you want to delete your account?</p>
        <a
          href={`mailto:contact@artswrk.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20account%20associated%20with%20${encodeURIComponent(email)}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
        >
          Email Artswrk to Delete Account <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
}

// ─── Subscription Tab ─────────────────────────────────────────────────────────

const CHECK = "✓";

function PlanFeature({ text }: { text: string }) {
  return (
    <p className="text-sm text-gray-600 flex items-start gap-2">
      <span className="text-[#F25722] font-bold flex-shrink-0">{CHECK}</span> {text}
    </p>
  );
}

function SubscriptionTab() {
  const { user } = useAuth();
  // auth.me already returns the full DB row — see AccountTab above.
  const artswrkUser = user as any;

  const isPremium = artswrkUser?.planTier === "client_premium";

  const subMutation = trpc.clientJobs.createSubscriptionCheckout.useMutation();
  const portalMutation = trpc.clientJobs.createPortalSession.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error("Couldn't open billing portal", { description: err.message }),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111]">My Plan</h2>
        <p className="text-sm text-gray-400 mt-1">Manage your Artswrk subscription and billing information</p>
      </div>

      <div className="border-t border-gray-100 pt-6">
        {/* On-Demand */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-xl font-black text-[#111]">Artswrk On-Demand</h3>
        </div>
        <div className="inline-flex items-center gap-1 mb-4">
          <span className="px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-sm font-bold text-[#F25722]">
            $30 Unlock
          </span>
        </div>
        <div className="space-y-1.5 mb-5">
          <PlanFeature text="Post a single job and view all applicants" />
          <PlanFeature text="Hire directly from your applicant pool" />
          <PlanFeature text="Access to Artswrk artist network" />
        </div>
        <a
          href="/join"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          Get Started →
        </a>
      </div>

      <div className="border-t border-gray-100 pt-6">
        {/* Subscription */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-xl font-black text-[#111]">Artswrk Subscription</h3>
          {isPremium && (
            <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 border border-gray-200 rounded-full text-gray-500 flex-shrink-0">
              Current Plan
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-1 mb-4">
          <span className="px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-sm font-bold text-[#F25722]">
            $50/month or $500/yr
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">Unlock the entire Artswrk platform.</p>
        <div className="space-y-1.5 mb-5">
          <PlanFeature text="Unlimited job posts and applicant access" />
          <PlanFeature text="Pay with Artswrk automated payroll" />
          <PlanFeature text="Access a global network of artists" />
          <PlanFeature text="1:1 with Artswrk Team" />
        </div>
        {isPremium ? (
          <button
            onClick={() => portalMutation.mutate({ origin: window.location.origin })}
            disabled={portalMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {portalMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            Manage Subscription →
          </button>
        ) : (
          <a
            href="/join"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            Subscribe →
          </a>
        )}
      </div>

      <div className="border-t border-gray-100 pt-6">
        {/* Business */}
        <h3 className="text-xl font-black text-[#111] mb-3">Artswrk Business</h3>
        <div className="inline-flex items-center gap-1 mb-4">
          <span className="px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-sm font-bold text-[#F25722]">
            Custom Pricing
          </span>
        </div>
        <div className="space-y-1.5 mb-5">
          <PlanFeature text="View submissions and hire artists" />
          <PlanFeature text="Compatible with your payroll" />
          <PlanFeature text="Access a global network of artists" />
          <PlanFeature text="1:1 with Artswrk Team" />
        </div>
        <a
          href="mailto:contact@artswrk.com?subject=Artswrk%20Business%20Inquiry"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          Schedule a call →
        </a>
      </div>
    </div>
  );
}

// ─── Help Tab ─────────────────────────────────────────────────────────────────

function HelpRow({ label, href, external = false }: { label: string | React.ReactNode; href: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors group"
    >
      <span className="text-sm font-medium text-gray-700 group-hover:text-[#F25722] transition-colors">{label}</span>
      <ChevronRight size={16} className="text-gray-400 group-hover:text-[#F25722] transition-colors flex-shrink-0" />
    </a>
  );
}

function HelpTab() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-black text-[#111]">Help</h2>
        <p className="text-sm text-gray-400 mt-1">Have questions about using Artswrk? We're here to help!</p>
      </div>

      <div className="border-t border-gray-100 pt-6 space-y-3">
        <h3 className="text-base font-bold text-[#111] mb-3">About</h3>
        <HelpRow label="Terms & Conditions" href="/terms" />
        <HelpRow label="Privacy Policy" href="/privacy-policy" />
        <HelpRow label="Cancellation Policy" href="/cancellation-policy" />
      </div>

      <div className="border-t border-gray-100 pt-6 space-y-3">
        <h3 className="text-base font-bold text-[#111] mb-3">Frequently Asked Questions</h3>
        <HelpRow label="Read our FAQs" href="/#faq" />
      </div>

      <div className="border-t border-gray-100 pt-6 space-y-3">
        <h3 className="text-base font-bold text-[#111] mb-3">Contact Us</h3>
        <HelpRow
          label={<>Need further assistance? Email us at <strong>contact@artswrk.com</strong></>}
          href="mailto:contact@artswrk.com"
          external
        />
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-black text-[#111] mb-6">Settings</h1>
      <div className="border-t border-gray-200 pt-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Sidebar active={tab} onChange={setTab} />
          <div className="flex-1 min-w-0">
            {tab === "profile" && <ProfileTab />}
            {tab === "account" && <AccountTab />}
            {tab === "subscription" && <SubscriptionTab />}
            {tab === "help" && <HelpTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
