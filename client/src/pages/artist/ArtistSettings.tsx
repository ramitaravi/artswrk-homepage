/**
 * ARTIST SETTINGS — hub page
 * Left nav (Account / Subscription / Notification Preferences / Help) +
 * right content pane. Matches the reference design's two-column layout.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  User, CreditCard, Heart, Settings as SettingsIcon, ChevronRight, Loader2, X, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import ArtistSettingsPlan from "./ArtistSettingsPlan";

const DELETION_REASONS = [
  "I found work another way",
  "Not enough job opportunities",
  "Too many emails or notifications",
  "I have a different account",
  "Privacy or data concerns",
  "Other",
];

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestDeletion = trpc.account.requestDeletion.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error("Couldn't send your request", { description: err.message }),
  });

  function toggleReason(reason: string) {
    setReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={26} className="text-green-500" />
            </div>
            <h2 className="text-xl font-black text-[#111] mb-2">Request sent</h2>
            <p className="text-sm text-gray-500 mb-6">
              Our team will follow up by email to confirm your account deletion.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#111] hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-7">
            <h2 className="text-xl font-black text-[#111] mb-1.5">Delete your account</h2>
            <p className="text-sm text-gray-500 mb-5">
              We're sorry to see you go. This sends a request to our team — it doesn't delete your account
              immediately. Let us know why so we can improve, or reach out if something's fixable.
            </p>

            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">What's the reason? (optional)</p>
            <div className="space-y-1.5 mb-5">
              {DELETION_REASONS.map((reason) => {
                const checked = reasons.includes(reason);
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => toggleReason(reason)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                      checked ? "border-[#ec008c] bg-pink-50 text-[#ec008c]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                        checked ? "bg-[#ec008c] border-[#ec008c]" : "border-gray-300"
                      }`}
                    >
                      {checked && <CheckCircle2 size={12} className="text-white" />}
                    </span>
                    {reason}
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Anything else? (optional)</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Tell us more…"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#ec008c] transition-colors resize-none mb-5"
            />

            <button
              onClick={() => requestDeletion.mutate({ reasons, message: message.trim() || undefined })}
              disabled={requestDeletion.isPending}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {requestDeletion.isPending && <Loader2 size={15} className="animate-spin" />}
              Send deletion request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type Section = "account" | "subscription" | "notifications" | "help";

const NAV: { id: Section; label: string; icon: React.ReactNode; iconBg: string; iconColor: string }[] = [
  { id: "account", label: "Account", icon: <User size={18} />, iconBg: "bg-pink-50", iconColor: "text-pink-500" },
  { id: "subscription", label: "Subscription", icon: <CreditCard size={18} />, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { id: "notifications", label: "Notification Preferences", icon: <Heart size={18} />, iconBg: "bg-amber-50", iconColor: "text-amber-500" },
  { id: "help", label: "Help", icon: <SettingsIcon size={18} />, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
];

function StripeIcon({ size = 22 }: { size?: number }) {
  return (
    <div
      className="rounded-md flex items-center justify-center flex-shrink-0 font-black text-white"
      style={{ width: size, height: size, background: "#635bff", fontSize: size * 0.6 }}
    >
      S
    </div>
  );
}

function SettingsRow({
  label,
  value,
  extra,
  action,
}: {
  label: string;
  value?: React.ReactNode;
  extra?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-5 border-b border-gray-100 last:border-b-0 flex items-center justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <p className="text-base font-bold text-[#111]">{label}</p>
        {value && <p className="text-sm text-gray-500 mt-0.5">{value}</p>}
        {extra && <div className="mt-2">{extra}</div>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function ActionButton({
  children,
  icon,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-gray-200 text-[#111] hover:bg-gray-50"
      }`}
    >
      {icon}
      {children}
      {!danger && <ChevronRight size={14} className="text-gray-400" />}
    </button>
  );
}

function AccountSection() {
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: connectStatus, isLoading: connectStatusLoading } = trpc.artistDashboard.stripeConnectStatus.useQuery();

  const stripeLink = trpc.artistDashboard.stripeLoginLink.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: () => window.open("https://dashboard.stripe.com/", "_blank"),
  });

  const connectStripe = trpc.artistDashboard.createStripeConnectUrl.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err) => toast.error("Couldn't start Stripe connect", { description: err.message }),
  });

  // Show a result toast once, after the OAuth callback redirects back here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("stripe_connect");
    if (result === "success") toast.success("Stripe account connected!");
    else if (result === "error") toast.error("Couldn't connect your Stripe account", { description: "Please try again." });
    if (result) {
      params.delete("stripe_connect");
      const newSearch = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-black text-[#111]">Account</h2>
      <p className="text-sm text-gray-500 mt-1">Manage your Artswrk account information below</p>
      <hr className="border-gray-100 my-5" />

      <SettingsRow
        label="Email"
        value={(user as any)?.email}
        extra={
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white artist-grad-bg">
            Artist Account
          </span>
        }
      />

      <SettingsRow
        label="Password"
        value="••••••••••••"
        action={
          <ActionButton onClick={() => { window.location.href = "/forgot-password"; }}>
            Reset Password
          </ActionButton>
        }
      />

      <SettingsRow
        label="Manage Payouts"
        value={
          connectStatusLoading ? "Checking connection…"
          : connectStatus?.connected ? "You're connected to Stripe 🎉"
          : "Connect Stripe to get paid for your bookings"
        }
        action={
          connectStatusLoading ? undefined : connectStatus?.connected ? (
            <ActionButton
              icon={stripeLink.isPending ? <Loader2 size={14} className="animate-spin" /> : <StripeIcon size={18} />}
              onClick={() => stripeLink.mutate()}
            >
              View Stripe Dashboard
            </ActionButton>
          ) : (
            <ActionButton
              icon={connectStripe.isPending ? <Loader2 size={14} className="animate-spin" /> : <StripeIcon size={18} />}
              onClick={() => connectStripe.mutate({ origin: window.location.origin })}
            >
              Connect to Stripe
            </ActionButton>
          )
        }
      />

      <SettingsRow
        label="Delete Account"
        value="Do you want to delete your account?"
        action={<ActionButton danger onClick={() => setDeleteOpen(true)}>Delete Account</ActionButton>}
      />

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
    </div>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    jobAlerts: true,
    applicationUpdates: true,
    messages: true,
    marketing: false,
  });

  const toggle = (key: keyof typeof prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const rows: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: "jobAlerts", label: "New job alerts", desc: "Get notified when new jobs match your profile" },
    { key: "applicationUpdates", label: "Application updates", desc: "Status changes on jobs you've applied to" },
    { key: "messages", label: "Messages", desc: "New messages from hirers" },
    { key: "marketing", label: "Artswrk news & tips", desc: "Occasional product updates and tips" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-black text-[#111]">Notification Preferences</h2>
      <p className="text-sm text-gray-500 mt-1">Choose what Artswrk emails you about</p>
      <hr className="border-gray-100 my-5" />

      {rows.map((row) => (
        <div key={row.key} className="py-5 border-b border-gray-100 last:border-b-0 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-base font-bold text-[#111]">{row.label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{row.desc}</p>
          </div>
          <button
            onClick={() => toggle(row.key)}
            className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${
              prefs[row.key] ? "bg-[#ec008c]" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                prefs[row.key] ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function HelpRow({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <span className="text-sm font-medium text-[#111]">{children}</span>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </a>
  );
}

function HelpSection() {
  return (
    <div>
      <h2 className="text-2xl font-black text-[#111]">Help</h2>
      <p className="text-sm text-gray-500 mt-1">Have questions about using Artswrk? We're here to help!</p>
      <hr className="border-gray-100 my-5" />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">About</h3>
          <div className="space-y-2">
            <HelpRow href="/terms">Terms &amp; Conditions</HelpRow>
            <HelpRow href="/privacy-policy">Privacy Policy</HelpRow>
            <HelpRow href="/cancellation-policy">Cancellation Policy</HelpRow>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            <HelpRow href="/about#faq">Read our FAQs</HelpRow>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Contact Us</h3>
          <div className="space-y-2">
            <HelpRow href="mailto:contact@artswrk.com">
              Need further assistance? Email us at <strong>contact@artswrk.com</strong>
            </HelpRow>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArtistSettings() {
  // Default to Subscription — every existing "subscribe"/"upgrade" CTA in the
  // app links straight to /app/settings expecting to land on the plan picker.
  const [section, setSection] = useState<Section>("subscription");

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-black text-[#111] mb-6">Settings</h1>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left nav */}
        <div className="w-full md:w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 p-3">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  section === item.id ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center flex-shrink-0`}>
                  {item.icon}
                </div>
                <span className="text-sm font-semibold text-[#111]">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right pane */}
        <div className="flex-1 w-full min-w-0 bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
          {section === "account" && <AccountSection />}
          {section === "subscription" && <ArtistSettingsPlan />}
          {section === "notifications" && <NotificationsSection />}
          {section === "help" && <HelpSection />}
        </div>
      </div>
    </div>
  );
}
