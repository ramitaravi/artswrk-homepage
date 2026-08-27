/**
 * ClientJobDetailPage — shared between client (/app/jobs/:jobId) and enterprise (/app/enterprise/jobs/:jobId)
 *
 * Tab order: Applicants (first) | Overview | Bookings (hidden unless bookings exist)
 *
 * Features:
 *  - Applicant cards matching admin design (photo, name, PRO badge, disciplines, message, rate, resume/profile links)
 *  - Locking: blurred preview + unlock paywall (per-job $30 or subscription $50/mo)
 *  - Applicant drill-down with prev/next navigation
 *  - Message modal → sends message + opens Messages thread
 *  - Enterprise: also sends email to artist on message
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, DollarSign,
  Calendar, Lock, Unlock, ExternalLink, MessageCircle,
  CheckCircle2, Users, Loader2, Star, X, Send,
  Building2, Instagram,
  UserCheck, CreditCard, Banknote, Zap, Share2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useParams, Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BoostJobModal from "@/components/BoostJobModal";

// ─── Boost Performance Bar ────────────────────────────────────────────────────

function BoostPerformanceBar({ applicantCount }: { applicantCount: number }) {
  const tiers = [
    { label: "Starting", min: 0, max: 1,  pct: 18, color: "bg-gray-300",   text: "text-gray-400" },
    { label: "Good",     min: 1, max: 3,  pct: 42, color: "bg-yellow-400", text: "text-yellow-600" },
    { label: "Great",    min: 3, max: 6,  pct: 68, color: "bg-[#F25722]",  text: "text-[#F25722]" },
    { label: "Excellent",min: 6, max: Infinity, pct: 92, color: "bg-green-500", text: "text-green-600" },
  ];
  const tier = tiers.find(t => applicantCount >= t.min && applicantCount < t.max) ?? tiers[0];

  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Boost Performance</span>
        <span className={`text-[10px] font-black ${tier.text}`}>{tier.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${tier.color}`}
          style={{ width: `${tier.pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        {tiers.map((t) => (
          <span key={t.label} className={`text-[9px] font-semibold ${t.label === tier.label ? tier.text : "text-gray-300"}`}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function jobStatusColor(status: string | null | undefined) {
  switch (status) {
    case "Active": return "text-green-600 bg-green-50";
    case "Confirmed": return "text-blue-600 bg-blue-50";
    case "Completed": return "text-gray-600 bg-gray-100";
    case "Submissions Paused": return "text-yellow-700 bg-yellow-50";
    case "Deleted by Client": return "text-red-500 bg-red-50";
    default: return "text-[#F25722] bg-orange-50";
  }
}

function appStatusColor(status: string | null | undefined) {
  switch (status) {
    case "Booked": return "text-green-600 bg-green-50";
    case "Confirmed": return "text-blue-600 bg-blue-50";
    case "Rejected": return "text-red-500 bg-red-50";
    default: return "text-[#F25722] bg-orange-50";
  }
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function displayName(a: { artistFirstName?: string | null; artistLastName?: string | null; artistName?: string | null }): string {
  if (a.artistFirstName) return `${a.artistFirstName}${a.artistLastName ? " " + a.artistLastName[0] + "." : ""}`;
  return a.artistName || "Artist";
}

// ─── Message Modal ─────────────────────────────────────────────────────────────

function MessageModal({
  applicant,
  onClose,
}: {
  applicant: any;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const utils = trpc.useUtils();
  const sendMsg = trpc.clientJobs.messageApplicant.useMutation({
    onSuccess: (data) => {
      setSent(true);
      utils.messages?.invalidate?.();
      setTimeout(() => {
        onClose();
        navigate("/app/messages");
      }, 1800);
    },
    onError: (e) => {
      toast.error(e.message || "Failed to send message");
    },
  });

  const name = displayName(applicant);

  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 gap-4">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <p className="font-bold text-[#111] text-lg">Message sent!</p>
        <p className="text-sm text-gray-500 text-center">Opening your messages thread with {name}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        {applicant.artistProfilePicture ? (
          <img src={applicant.artistProfilePicture} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
            {(name[0] || "?").toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-bold text-sm text-[#111]">{name}</p>
          {applicant.artistLocation && <p className="text-xs text-gray-400">{applicant.artistLocation}</p>}
        </div>
      </div>
      <Textarea
        placeholder={`Hi ${applicant.artistFirstName ?? name}, I saw your application and…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[120px] resize-none text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
        <Button
          onClick={() => sendMsg.mutate({ applicantId: applicant.id, message: text })}
          disabled={!text.trim() || sendMsg.isPending}
          className="bg-[#111] hover:bg-gray-800 text-white gap-2"
          size="sm"
        >
          {sendMsg.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send Message
        </Button>
      </div>
    </div>
  );
}

// ─── Applicant Detail Drill-down ───────────────────────────────────────────────

function ApplicantDetailView({
  applicantId,
  allApplicantIds,
  jobId,
  job,
  onBack,
}: {
  applicantId: number;
  allApplicantIds: number[];
  jobId: number;
  job: any;
  onBack: () => void;
}) {
  const [currentId, setCurrentId] = useState(applicantId);
  const [msgOpen, setMsgOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: applicant, isLoading } = trpc.clientJobs.getApplicantDetail.useQuery({ applicantId: currentId });

  const idx = allApplicantIds.indexOf(currentId);
  const hasPrev = idx > 0;
  const hasNext = idx < allApplicantIds.length - 1;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }
  if (!applicant) {
    return <div className="text-center py-16 text-gray-400 text-sm">Applicant not found</div>;
  }

  const name = displayName(applicant);
  const picUrl = applicant.artistProfilePicture
    ? (applicant.artistProfilePicture.startsWith("//") ? "https:" + applicant.artistProfilePicture : applicant.artistProfilePicture)
    : null;
  const profileUrl = applicant.artistSlug ? `/book/${applicant.artistSlug}` : null;
  const disciplines = parseList(applicant.artistDisciplines).slice(0, 6);
  const rate = applicant.artistHourlyRate
    ? `$${applicant.artistHourlyRate}/hr`
    : applicant.clientHourlyRate
    ? `$${applicant.clientHourlyRate}/hr`
    : null;
  const resumeFileName = applicant.resumeLink
    ? decodeURIComponent(applicant.resumeLink.split("/").pop() || "resume").replace(/%20/g, " ")
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb + prev/next nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#F25722] transition-colors font-medium"
        >
          <ChevronLeft size={14} /> Back to applicants
        </button>
        <div className="flex items-center gap-2">
          <button
            disabled={!hasPrev}
            onClick={() => setCurrentId(allApplicantIds[idx - 1])}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-500"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs text-gray-400 tabular-nums">{idx + 1} / {allApplicantIds.length}</span>
          <button
            disabled={!hasNext}
            onClick={() => setCurrentId(allApplicantIds[idx + 1])}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-500"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Detail layout — stacks on mobile */}
      <div className="flex flex-col md:flex-row gap-4 items-start">

        {/* ── Left sidebar: identity + actions ── */}
        <div className="w-full md:w-56 flex-shrink-0 flex flex-col gap-3">
          {/* Photo card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {picUrl ? (
              <img
                src={picUrl}
                alt={name}
                className="w-full aspect-square max-h-64 md:max-h-none object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
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
              {applicant.artistLocation && (
                <p className="text-xs text-gray-400 flex items-center gap-1">{applicant.artistLocation}</p>
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
            onClick={() => setConfirmOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
            style={{background: 'linear-gradient(135deg, #FFBC5D, #F25722)'}}
          >
            <UserCheck size={15} /> Confirm Artist
          </button>
          <button
            onClick={() => setMsgOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111] text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            <MessageCircle size={15} /> Message {applicant.artistFirstName || name.split(" ")[0]}
          </button>
        </div>

        {/* ── Right main: submission details ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Application message */}
          {applicant.message && (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                {picUrl && <img src={picUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100" />}
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Message from {applicant.artistFirstName || name.split(" ")[0]}
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{applicant.message}</p>
            </div>
          )}

          {/* Profile preview card */}
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-gray-300 hover:shadow-md transition-all group"
            >
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
                  {applicant.artistBio ? (
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{applicant.artistBio}</p>
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

          {/* Bio (only if no profile link) */}
          {applicant.artistBio && !profileUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">{applicant.artistBio}</p>
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

      {/* Message modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
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
            <MessageModal applicant={applicant} onClose={() => setMsgOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm modal */}
      {confirmOpen && (
        <ConfirmModal
          applicant={applicant}
          job={job}
          jobId={jobId}
          onClose={() => setConfirmOpen(false)}
          onConfirmed={() => {
            setConfirmOpen(false);
            utils.clientJobs.getConfirmedArtists.invalidate({ jobId });
            utils.clientJobs.getApplicants.invalidate({ jobId });
          }}
        />
      )}
    </div>
  );
}

// ─── Applicants Tab ────────────────────────────────────────────────────────────

function ApplicantsTab({
  jobId,
  isEnterprise,
  isPremium,
  onSelectApplicant,
}: {
  jobId: number;
  isEnterprise: boolean;
  isPremium: boolean;
  onSelectApplicant: (id: number, allIds: number[]) => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clientJobs.getApplicants.useQuery({ jobId });

  const unlockMutation = trpc.clientJobs.createUnlockCheckout.useMutation({
    onSuccess: (res) => {
      if (res.alreadyUnlocked) {
        utils.clientJobs.getApplicants.invalidate({ jobId });
        return;
      }
      if (res.url) window.open(res.url, "_blank");
    },
    onError: (e) => toast.error(e.message || "Failed to start checkout"),
  });

  const subMutation = trpc.clientJobs.createSubscriptionCheckout.useMutation({
    onSuccess: (res) => {
      if (res.url) window.open(res.url, "_blank");
    },
    onError: (e) => toast.error(e.message || "Failed to start checkout"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!data) return null;

  // Premium clients bypass the paywall entirely
  const effectiveLocked = data.locked && !isPremium;

  // Locked state — enterprise-style paywall
  if (effectiveLocked) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Green availability banner */}
        {data.applicantCount > 0 && (
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={22} className="text-green-500" />
            </div>
            <p className="text-base font-semibold text-[#111]">
              You have {data.applicantCount} artist{data.applicantCount !== 1 ? "s" : ""} available for your job!
            </p>
          </div>
        )}

        {/* Artist preview grid */}
        {data.applicantCount > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#111] mb-5">
              Unlock to connect with {data.applicantCount} artist{data.applicantCount !== 1 ? "s" : ""}
            </h3>
            <div className="flex flex-wrap gap-6">
              {(data.preview ?? []).slice(0, 8).map((p: any, i: number) => {
                const firstName = p?.firstName || p?.artistFirstName || null;
                const lastName = p?.lastName || p?.artistLastName || null;
                const rawPic = p?.profilePicture || p?.artistProfilePicture || null;
                const pic = rawPic ? (rawPic.startsWith("//") ? "https:" + rawPic : rawPic) : null;
                const dName = firstName
                  ? `${firstName}${lastName ? " " + lastName[0] + "." : ""}`
                  : `Artist ${i + 1}`;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 w-20">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-md flex-shrink-0">
                      {pic ? (
                        <img src={pic} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 font-bold text-lg">
                          {firstName ? firstName.charAt(0).toUpperCase() : "?"}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 text-center leading-tight">•••••</span>
                  </div>
                );
              })}
              {data.applicantCount > 8 && (
                <div className="flex flex-col items-center gap-2 w-20">
                  <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-white shadow-md flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-500">+{data.applicantCount - 8}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-400 text-center">more</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 mb-6" />

        {/* Two unlock options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: One-time unlock */}
          <div className="border-2 border-gray-100 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Unlock size={15} className="text-[#F25722]" />
              </div>
              <span className="text-sm font-bold text-[#111]">Unlock This Job</span>
            </div>
            <p className="text-3xl font-black text-[#111] mb-1">$30</p>
            <p className="text-xs text-gray-400 mb-4">One-time · this job only</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {["Full candidate list for this job", "View profiles & contact info", "Message applicants directly", "No recurring commitment"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                  <CheckCircle2 size={12} className="text-[#F25722] mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => unlockMutation.mutate({ jobId, origin: window.location.origin })}
              disabled={unlockMutation.isPending}
              className="w-full bg-[#F25722] hover:opacity-90 text-white gap-2"
              size="sm"
            >
              {unlockMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
              Unlock — $30
            </Button>
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
              <span className="text-sm font-bold text-[#111]">Artswrk Plan</span>
            </div>
            <p className="text-3xl font-black text-[#111] mb-1">$50<span className="text-sm font-normal text-gray-400">/mo</span></p>
            <p className="text-xs text-gray-400 mb-4">Unlimited jobs · cancel anytime</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {["Unlimited candidate access", "All current & future jobs", "Priority artist matching", "Dedicated account support"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                  <CheckCircle2 size={12} className="text-[#F25722] mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => subMutation.mutate({ jobId, origin: window.location.origin })}
              disabled={subMutation.isPending}
              variant="outline"
              className="w-full gap-2 text-[#F25722] border-[#F25722] hover:bg-orange-50"
              size="sm"
            >
              {subMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
              Subscribe — $50/mo
            </Button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              {data.applicantCount >= 2 ? `Break-even at 2 jobs · you have ${data.applicantCount}+ waiting` : "Unlimited jobs · cancel anytime"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allApplicants = data.applicants ?? [];
  const allIds = allApplicants.map((a: any) => a.id);

  if (allApplicants.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Users size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No applicants yet</p>
      </div>
    );
  }

  return <ApplicantsList applicants={allApplicants} allIds={allIds} onSelectApplicant={onSelectApplicant} />;
}

type ApplicantFilter = "all" | "new" | "Confirmed" | "Booked" | "Rejected";

function ApplicantsList({ applicants, allIds, onSelectApplicant }: {
  applicants: any[];
  allIds: number[];
  onSelectApplicant: (id: number, allIds: number[]) => void;
}) {
  const [filter, setFilter] = useState<ApplicantFilter>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const isNew = (a: any) => !a.status || a.status === "Interested" || a.status === "New";
  const counts = {
    all: applicants.length,
    new: applicants.filter(isNew).length,
    Confirmed: applicants.filter((a) => a.status === "Confirmed").length,
    Booked: applicants.filter((a) => a.status === "Booked").length,
    Rejected: applicants.filter((a) => a.status === "Rejected").length,
  };

  const filtered = applicants.filter((a) => {
    if (filter === "all") return true;
    if (filter === "new") return isNew(a);
    return a.status === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.bubbleCreatedAt ?? a.createdAt ?? 0).getTime();
    const db = new Date(b.bubbleCreatedAt ?? b.createdAt ?? 0).getTime();
    return sort === "newest" ? db - da : da - db;
  });

  const allTabs: { key: ApplicantFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "new", label: "New", count: counts.new },
    { key: "Confirmed", label: "Confirmed", count: counts.Confirmed },
    { key: "Booked", label: "Booked", count: counts.Booked },
    { key: "Rejected", label: "Rejected", count: counts.Rejected },
  ];
  const tabs = allTabs.filter((t) => t.key === "all" || t.count > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Filter + sort bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filter === t.key ? "bg-[#111] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`text-[10px] rounded-full px-1.5 ${filter === t.key ? "bg-white/20" : "bg-gray-100"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
          className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No applicants match this filter</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map((a: any) => {
            const name = displayName(a);
            const rate = a.artistHourlyRate ? `$${a.artistHourlyRate}/hr` : a.clientHourlyRate ? `$${a.clientHourlyRate}/hr` : null;
            const msgPreview = a.message
              ? a.message.length > 160 ? a.message.slice(0, 160).trimEnd() + " …" : a.message
              : null;
            return (
              <div key={a.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  {a.artistProfilePicture ? (
                    <img
                      src={a.artistProfilePicture}
                      alt={name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 flex-shrink-0 mt-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
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
                        {a.artistLocation && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1.5">
                            <MapPin size={10} /> {a.artistLocation}
                          </p>
                        )}
                        {msgPreview && (
                          <p className="text-sm text-gray-500 leading-relaxed">{msgPreview}</p>
                        )}
                      </div>
                      {/* Right: rate + CTA */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[140px]">
                        {rate && (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{background:'#fff3ee', color:'#F25722', border:'1px solid #ffd5c0'}}>
                            {rate}
                          </span>
                        )}
                        <button
                          onClick={() => onSelectApplicant(a.id, allIds)}
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
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  applicant,
  job,
  jobId,
  onClose,
  onConfirmed,
}: {
  applicant: any;
  job: any;
  jobId: number;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const quotedRateValue = applicant.artistHourlyRate ?? applicant.artistFlatRate ?? applicant.clientHourlyRate ?? applicant.clientFlatRate ?? null;
  const jobHasFixedRate = !job?.openRate && quotedRateValue != null;
  const toDateInput = (d: string | null | undefined) => d ? String(d).slice(0, 10) : "";

  const [paymentMethod, setPaymentMethod] = useState<"artswrk" | "direct">("artswrk");
  const [rateType, setRateType] = useState<"flat" | "hourly">(
    Number(applicant.isHourlyRate) === 0 ? "flat" : "hourly"
  );
  const [rateInput, setRateInput] = useState(quotedRateValue != null ? String(quotedRateValue) : "");
  const [rateEditing, setRateEditing] = useState(!jobHasFixedRate);
  const [hours, setHours] = useState(applicant.totalHours != null ? String(applicant.totalHours) : "");
  const [startDate, setStartDate] = useState(toDateInput(applicant.startDate ?? job?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(applicant.endDate ?? job?.endDate));
  const [locationAddress, setLocationAddress] = useState(job?.locationAddress || job?.location || "");
  const [notes, setNotes] = useState(job?.description || "");

  const confirmMutation = trpc.clientJobs.confirmArtist.useMutation({
    onSuccess: (res) => {
      if (res.alreadyConfirmed) {
        toast.info("Artist was already confirmed.");
      } else {
        toast.success("Artist confirmed! A confirmation email has been sent.");
      }
      onConfirmed();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to confirm artist"),
  });

  const name = displayName(applicant);
  const picUrl = applicant.artistProfilePicture
    ? (applicant.artistProfilePicture.startsWith("//") ? "https:" + applicant.artistProfilePicture : applicant.artistProfilePicture)
    : null;

  const rateDollars = parseFloat(rateInput) || 0;
  const clientTotal = rateDollars && paymentMethod === "artswrk" ? Math.round(rateDollars * 1.05) : rateDollars;

  const fieldCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition";
  const labelCls = "text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5";

  const quotedRate = applicant.artistHourlyRate
    ? `$${applicant.artistHourlyRate}/hr`
    : applicant.artistFlatRate
    ? `$${applicant.artistFlatRate} flat`
    : applicant.clientHourlyRate
    ? `$${applicant.clientHourlyRate}/hr`
    : null;

  const jobTitle = (job as any)?.title || job?.description?.slice(0, 60) || `Job #${jobId}`;
  const company = job?.clientCompanyName || job?.clientFirstName || "Your Studio";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            {picUrl ? (
              <img src={picUrl} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
                {(name[0] || "?").toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-base font-black text-[#111]">Confirm {name}</h2>
              <p className="text-xs text-gray-400">{jobTitle} · {company}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Job details summary */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Job Details</p>
            <div className="space-y-2">
              {[["Role", jobTitle], ["Company", company]].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">{l}</span>
                  <span className="text-sm font-semibold text-[#111] text-right">{v}</span>
                </div>
              ))}
              {quotedRate && (
                <div className="flex justify-between gap-4">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">Quoted</span>
                  <span className="text-sm font-semibold text-[#F25722] text-right">{quotedRate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rate — locked to the job's listed rate when it's a fixed rate; only
              an open-rate job (or an explicit Edit) shows the flat/hourly toggle. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + " mb-0"}>Rate</label>
              {jobHasFixedRate && !rateEditing && (
                <button type="button" onClick={() => setRateEditing(true)} className="text-xs font-semibold text-[#F25722] hover:underline">
                  Edit
                </button>
              )}
            </div>
            {jobHasFixedRate && !rateEditing ? (
              <div className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#111] bg-gray-50">
                ${rateInput}{rateType === "hourly" ? "/hr" : " flat"}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  {(["flat", "hourly"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setRateType(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${rateType === t ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                      {t === "flat" ? "Flat Rate" : "Hourly Rate"}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={rateInput} onChange={(e) => setRateInput(e.target.value)}
                    placeholder={rateType === "flat" ? "500" : "35"}
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition" />
                </div>
              </>
            )}
          </div>

          {/* Hours — always required so pay is calculated correctly regardless of rate type */}
          <div>
            <label className={labelCls}>Hours</label>
            <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 2.5"
              className={fieldCls} />
            {rateDollars > 0 && hours && (
              <p className="text-xs text-gray-400 mt-1">
                {rateType === "hourly"
                  ? `Total: $${Math.round(rateDollars * parseFloat(hours)).toLocaleString()}`
                  : `Flat rate · ${hours} hr${parseFloat(hours) === 1 ? "" : "s"} booked`}
              </p>
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
              placeholder="City, State or address"
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
                <p className="text-sm font-bold text-[#111]">Pay via Artswrk</p>
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
            {paymentMethod === "direct" && (
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Paying outside Artswrk? You'll need to onboard this artist to your own payroll. Subscribe to Artswrk for payroll access.
              </p>
            )}
          </div>

          {/* Description — pulled from the job by default */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              placeholder="Any details, next steps, or instructions…"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#F25722]/30 focus:border-[#F25722] transition" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-[#111] hover:bg-gray-800 text-white"
            disabled={!paymentMethod || rateDollars <= 0 || !hours || !startDate || !notes.trim() || confirmMutation.isPending}
            onClick={() => {
              if (!paymentMethod || rateDollars <= 0 || !hours || !startDate || !notes.trim()) return;
              confirmMutation.mutate({
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
            {confirmMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <UserCheck size={14} className="mr-1.5" />}
            Confirm {name.split(" ")[0]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirmed Artists Tab ─────────────────────────────────────────────────────

function ConfirmedArtistsTab({ jobId }: { jobId: number }) {
  const { data, isLoading } = trpc.clientJobs.getConfirmedArtists.useQuery({ jobId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const confirmed = data ?? [];

  if (confirmed.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <UserCheck size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No confirmed artists yet</p>
        <p className="text-xs mt-1 text-gray-300">Confirm artists from the Applicants tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 font-medium">{confirmed.length} confirmed artist{confirmed.length !== 1 ? "s" : ""}</p>
      {confirmed.map((b: any) => {
        const name = b.artistFirstName
          ? `${b.artistFirstName}${b.artistLastName ? " " + b.artistLastName[0] + "." : ""}`
          : b.artistName ?? `Artist #${b.artistUserId}`;
        const payBadge = b.paymentMethod === "artswrk"
          ? { label: "Pay via Artswrk", cls: "bg-orange-50 text-[#F25722]" }
          : { label: "Direct Payment", cls: "bg-gray-100 text-gray-600" };
        return (
          <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {b.artistPhoto ? (
                  <img src={b.artistPhoto} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                    {(name[0] || "?").toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-[#111]">{name}</p>
                  {b.artistEmail && (
                    <p className="text-xs text-gray-400">{b.artistEmail}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                  <CheckCircle2 size={10} /> Confirmed
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${payBadge.cls}`}>
                  {payBadge.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
              {b.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={10} /> {fmtDate(b.startDate)}
                </span>
              )}
              {b.artistRate && (
                <span className="flex items-center gap-1">
                  <DollarSign size={10} /> Artist rate: ${b.artistRate}
                </span>
              )}
              <span className="ml-auto text-gray-300">Confirmed {fmtDate(b.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ job }: { job: any }) {
  const rate = job.openRate
    ? "Open rate"
    : job.clientHourlyRate
    ? `$${job.clientHourlyRate}/hr`
    : job.artistHourlyRate
    ? `$${job.artistHourlyRate}/hr`
    : "—";

  return (
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
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs">Posted</span>
              <span className="text-xs text-gray-600">{fmtDate(job.bubbleCreatedAt || job.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs">Rate</span>
              <span className="text-xs font-semibold text-[#111]">{rate}</span>
            </div>
            {job.artistHourlyRate && job.clientHourlyRate && (
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Artist Rate</span>
                <span className="text-xs text-gray-600">${job.artistHourlyRate}/hr</span>
              </div>
            )}
            {job.dateType && (
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Date Type</span>
                <span className="text-xs text-gray-600">{job.dateType}</span>
              </div>
            )}
            {job.startDate && (
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Start Date</span>
                <span className="text-xs text-gray-600">{fmtDate(job.startDate)}</span>
              </div>
            )}
            {job.locationAddress && (
              <div className="flex justify-between gap-3">
                <span className="text-gray-400 text-xs flex-shrink-0">Location</span>
                <span className="text-xs text-gray-600 text-right">{job.locationAddress}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bookings Tab ──────────────────────────────────────────────────────────────

function BookingsTab({ jobId }: { jobId: number }) {
  const { data: bookings, isLoading } = trpc.clientJobs.getBookings.useQuery({ jobId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Calendar size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No bookings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 font-medium">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
      {bookings.map((b: any) => {
        const name = b.artistFirstName
          ? `${b.artistFirstName}${b.artistLastName ? " " + b.artistLastName[0] + "." : ""}`
          : b.artistName || "Artist";
        return (
          <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              {b.artistProfilePicture ? (
                <img src={b.artistProfilePicture} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-sm">
                  {(name[0] || "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#111]">{name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
                  {b.startDate && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(b.startDate)}</span>}
                  {b.clientRate && <span className="flex items-center gap-1"><DollarSign size={10} />${b.clientRate}/hr</span>}
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                b.bookingStatus === "Confirmed" ? "text-green-600 bg-green-50" :
                b.bookingStatus === "Completed" ? "text-gray-600 bg-gray-100" :
                "text-[#F25722] bg-orange-50"
              }`}>
                {b.bookingStatus || "Pending"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/// ─── Main Component ────────────────────────────────────────────────────────────
export default function ClientJobDetail() {
  // Read jobId from URL — works for both /app/jobs/:jobId and /app/enterprise/jobs/:jobId
  const params = useParams<{ jobId: string }>();
  const jobId = parseInt(params.jobId ?? "0", 10);
  // Detect enterprise context from URL
  const isEnterprise = window.location.pathname.includes("/enterprise/");
  const backLabel = isEnterprise ? "Dashboard" : "Jobs";
  const backPath = isEnterprise ? "/enterprise" : "/app/jobs";
  const [, navigate] = useLocation();
  type Tab = "applicants" | "confirmed" | "overview" | "bookings";
  const [tab, setTab] = useState<Tab>("applicants");
  const [selectedApplicant, setSelectedApplicant] = useState<{ id: number; allIds: number[] } | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);

  const { user } = useAuth();
  const isPremium = !!(user as any)?.clientPremium;
  const { data: job, isLoading } = trpc.clientJobs.getDetail.useQuery({ jobId });
  const utils = trpc.useUtils();
  const didVerify = useRef(false);

  const verifyUnlock = trpc.clientJobs.verifyUnlock.useMutation({
    onSuccess: () => {
      utils.clientJobs.getApplicants.invalidate({ jobId });
      utils.clientJobs.getDetail.invalidate({ jobId });
      toast.success("Job unlocked! You can now view all candidates.");
    },
    onError: (err) => toast.error(err.message || "Failed to verify unlock — contact support"),
  });

  useEffect(() => {
    if (didVerify.current) return;
    const params = new URLSearchParams(window.location.search);
    const unlockSuccess = params.get("unlock_success");
    const sessionId = params.get("session_id");
    const subscribed = params.get("subscribed");

    if (unlockSuccess && sessionId) {
      didVerify.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      verifyUnlock.mutate({ sessionId, jobId });
    } else if (unlockSuccess) {
      didVerify.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      utils.clientJobs.getApplicants.invalidate({ jobId });
      utils.clientJobs.getDetail.invalidate({ jobId });
      toast.success("Job unlocked! You can now view all candidates.");
    } else if (subscribed) {
      didVerify.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      utils.clientJobs.getApplicants.invalidate({ jobId });
      utils.clientJobs.getDetail.invalidate({ jobId });
      toast.success("Subscription activated! You now have unlimited candidate access.");
    }
  }, [jobId]);

  const handleSelectApplicant = useCallback((id: number, allIds: number[]) => {
    setSelectedApplicant({ id, allIds });
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        Job not found
      </div>
    );
  }

  const clientName =
    job.clientCompanyName ||
    (job.clientFirstName ? [job.clientFirstName, job.clientLastName].filter(Boolean).join(" ") : null) ||
    job.clientEmail ||
    "Client";

  const jobTitle = (job as any).title || job.description?.slice(0, 60) || `Job #${job.id}`;
  const showBookings = (job.bookingCount ?? 0) > 0;
  // Coerce explicitly — this comes from a raw SQL `SELECT j.*`, where a
  // TINYINT(1) can come back as a non-boolean (e.g. a truthy "0" string or
  // Buffer) instead of real false, which was rendering a stray boost bar.
  const jobIsBoosted = Number((job as any).isBoosted) === 1;

  const TABS: { id: Tab; label: string }[] = [
    { id: "applicants", label: "Applicants" },
    { id: "confirmed", label: "Confirmed" },
    { id: "overview", label: "Overview" },
    ...(showBookings ? [{ id: "bookings" as Tab, label: `Bookings (${job.bookingCount})` }] : []),
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 md:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <button
          onClick={() => navigate(backPath)}
          className="hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <ChevronRight size={14} />
        <button
          onClick={() => navigate(backPath)}
          className="hover:text-[#F25722] transition-colors font-medium"
        >
          {backLabel}
        </button>
        <ChevronRight size={14} />
        <span className="text-[#111] font-semibold truncate max-w-xs">{jobTitle}</span>
      </nav>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {job.clientProfilePicture ? (
            <img
              src={job.clientProfilePicture}
              alt={clientName}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-100"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0">
              {(clientName[0] || "?").toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-black text-[#111] mb-1">{jobTitle}</h2>
            <p className="text-sm text-gray-500">
              {clientName}
              {job.startDate ? ` | Posted ${fmtDate(job.startDate)}` : ""}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(job.requestStatus)}`}>
                {job.requestStatus || "Active"}
              </span>
              {job.locationAddress && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={10} /> {job.locationAddress}
                </span>
              )}
              {jobIsBoosted ? (
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                  ⚡ Boosted
                </span>
              ) : (
                <button
                  onClick={() => setBoostOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-orange-50 text-[#F25722] hover:bg-orange-100 transition-colors whitespace-nowrap"
                >
                  <Zap size={12} className="fill-[#F25722]" /> Boost this job
                </button>
              )}
            </div>
            {jobIsBoosted && (
              <BoostPerformanceBar applicantCount={(job as any).applicantCount ?? 0} />
            )}
          </div>
        </div>
        <button
          onClick={() => {
            const url = job.slug ? `${window.location.origin}/jobs/${job.slug}` : window.location.href;
            navigator.clipboard.writeText(url);
            toast.success("Job link copied!");
            if (navigator.share) {
              navigator.share({ title: jobTitle, url }).catch(() => {});
            }
          }}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <Share2 size={13} /> Share
        </button>
        </div>
        {(job.description || job.clientHourlyRate || job.artistHourlyRate || !job.openRate) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {(job.clientHourlyRate || job.artistHourlyRate || job.openRate) && (
              <p className="text-sm font-bold text-[#111] mb-1.5">
                {job.openRate ? "Open rate" : `$${job.clientHourlyRate ?? job.artistHourlyRate}/hr`}
              </p>
            )}
            {job.description && (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">{job.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedApplicant(null); }}
            className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
              tab === t.id
                ? "border-[#111] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "applicants" && selectedApplicant && (
        <ApplicantDetailView
          applicantId={selectedApplicant.id}
          allApplicantIds={selectedApplicant.allIds}
          jobId={jobId}
          job={job}
          onBack={() => setSelectedApplicant(null)}
        />
      )}
      {tab === "applicants" && !selectedApplicant && (
        <ApplicantsTab
          jobId={jobId}
          isEnterprise={isEnterprise}
          isPremium={isPremium}
          onSelectApplicant={handleSelectApplicant}
        />
      )}
      {tab === "confirmed" && <ConfirmedArtistsTab jobId={jobId} />}
      {tab === "overview" && <OverviewTab job={job} />}
      {tab === "bookings" && <BookingsTab jobId={jobId} />}

      {boostOpen && (
        <BoostJobModal
          jobId={jobId}
          jobTitle={jobTitle}
          open={boostOpen}
          onClose={() => setBoostOpen(false)}
        />
      )}
    </div>
  );
}
