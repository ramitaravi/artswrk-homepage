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
import { useState, useCallback } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, DollarSign,
  Calendar, Lock, Unlock, ExternalLink, MessageCircle,
  CheckCircle2, Users, Loader2, Star, X, Send,
  Building2, Clock, FileText, Globe, Instagram,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const full = [a.artistFirstName, a.artistLastName].filter(Boolean).join(" ");
  return full || a.artistName || "Artist";
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
  onBack,
}: {
  applicantId: number;
  allApplicantIds: number[];
  onBack: () => void;
}) {
  const [currentId, setCurrentId] = useState(applicantId);
  const [msgOpen, setMsgOpen] = useState(false);
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
  const disciplines = parseList(applicant.artistDisciplines).slice(0, 5);
  const services = parseList(applicant.artistServices).slice(0, 4);
  const workTypes = parseList(applicant.workTypes).slice(0, 4);
  const rate = applicant.artistHourlyRate
    ? `$${applicant.artistHourlyRate}/hr`
    : applicant.clientHourlyRate
    ? `$${applicant.clientHourlyRate}/hr`
    : null;
  const profileUrl = applicant.artistSlug ? `/book/${applicant.artistSlug}` : null;

  return (
    <div className="space-y-5">
      {/* Nav bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#F25722] font-medium transition-colors"
        >
          <ChevronLeft size={15} /> Back to Applicants
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentId(allApplicantIds[idx - 1])}
            disabled={!hasPrev}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#111] hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs text-gray-400 font-medium">{idx + 1} / {allApplicantIds.length}</span>
          <button
            onClick={() => setCurrentId(allApplicantIds[idx + 1])}
            disabled={!hasNext}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#111] hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {applicant.artistProfilePicture ? (
              <img
                src={applicant.artistProfilePicture}
                alt={name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
                {(name[0] || "?").toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-[#111]">{name}</h2>
                {applicant.artswrkPro && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                    <Star size={9} fill="currentColor" /> PRO
                  </span>
                )}
                {applicant.artswrkBasic && !applicant.artswrkPro && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">BASIC</span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appStatusColor(applicant.status)}`}>
                  {applicant.status || "Interested"}
                </span>
              </div>
              {applicant.artistTagline && <p className="text-sm text-gray-500 mt-0.5">{applicant.artistTagline}</p>}
              {applicant.artistLocation && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin size={11} /> {applicant.artistLocation}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {rate && (
                  <span className="text-xs text-gray-500">{rate}</span>
                )}
              {applicant.bookingCount > 0 && (
                <span className="text-xs text-gray-400">{applicant.bookingCount} booking{applicant.bookingCount !== 1 ? "s" : ""}</span>
              )}
                {applicant.optionAvailability && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">{applicant.optionAvailability}</span>
                )}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setMsgOpen(true)}
              className="bg-[#111] hover:bg-gray-800 text-white gap-2"
              size="sm"
            >
              <MessageCircle size={14} /> Message
            </Button>
            {applicant.resumeLink && (
              <a
                href={applicant.resumeLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText size={14} /> Resume
                </Button>
              </a>
            )}
            {profileUrl && (
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink size={14} /> Profile
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Application message */}
      {applicant.message && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Application Message</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic">{applicant.message}</p>
          <p className="text-xs text-gray-400 mt-3">{fmtDate(applicant.bubbleCreatedAt || applicant.createdAt)}</p>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bio */}
        {applicant.artistBio && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bio</p>
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-6">{applicant.artistBio}</p>
          </div>
        )}

        {/* Skills & disciplines */}
        {(disciplines.length > 0 || services.length > 0 || workTypes.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            {disciplines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Disciplines</p>
                <div className="flex flex-wrap gap-1.5">
                  {disciplines.map((d) => (
                    <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 font-medium">{d}</span>
                  ))}
                </div>
              </div>
            )}
            {services.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s) => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {workTypes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Work Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {workTypes.map((w) => (
                    <span key={w} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Links */}
        {(applicant.artistWebsite || applicant.artistInstagram || applicant.artistPortfolio) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Links</p>
            <div className="space-y-2">
              {applicant.artistWebsite && (
                <a href={applicant.artistWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#F25722] hover:underline">
                  <Globe size={13} /> {applicant.artistWebsite.replace(/^https?:\/\//, "")}
                </a>
              )}
              {applicant.artistInstagram && (
                <a href={`https://instagram.com/${applicant.artistInstagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-pink-500 hover:underline">
                  <Instagram size={13} /> @{applicant.artistInstagram.replace("@", "")}
                </a>
              )}
              {applicant.artistPortfolio && (
                <a href={applicant.artistPortfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                  <ExternalLink size={13} /> Portfolio
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Message modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message {name}</DialogTitle>
          </DialogHeader>
          <MessageModal applicant={applicant} onClose={() => setMsgOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Applicants Tab ────────────────────────────────────────────────────────────

function ApplicantsTab({
  jobId,
  isEnterprise,
  onSelectApplicant,
}: {
  jobId: number;
  isEnterprise: boolean;
  onSelectApplicant: (id: number, allIds: number[]) => void;
}) {
  const [msgOpen, setMsgOpen] = useState<number | null>(null);
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

  // Locked state
  if (data.locked) {
    return (
      <div className="space-y-5">
        <p className="text-xs text-gray-400 font-medium">{data.applicantCount} applicant{data.applicantCount !== 1 ? "s" : ""}</p>
        {/* Blurred preview */}
        {data.applicantCount > 0 && (
          <div className="relative rounded-2xl overflow-hidden border border-gray-100">
            <div className="blur-sm pointer-events-none select-none">
              {(data.preview ?? []).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 last:border-0 bg-white">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-32" />
                    <div className="h-2.5 bg-gray-100 rounded w-48" />
                  </div>
                  <div className="h-7 w-20 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
                <Lock size={14} className="text-[#F25722]" />
                <span className="text-xs font-bold text-[#111]">
                  {data.applicantCount} candidate{data.applicantCount !== 1 ? "s" : ""} hidden
                </span>
              </div>
            </div>
          </div>
        )}
        {/* Unlock options */}
        <div className={`grid gap-4 ${isEnterprise ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
          {/* Per-job unlock */}
          <div className="border-2 border-gray-100 rounded-2xl p-5 flex flex-col hover:border-[#F25722]/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Unlock size={15} className="text-[#F25722]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111]">Unlock This Job</p>
                <p className="text-xs text-gray-400">One-time · permanent access</p>
              </div>
            </div>
            <p className="text-2xl font-black text-[#111] mb-1">{isEnterprise ? "Included" : "$30"}</p>
            <p className="text-xs text-gray-400 mb-4 flex-1">
              {isEnterprise
                ? "Included in your enterprise plan"
                : `Unlock all ${data.applicantCount} applicant${data.applicantCount !== 1 ? "s" : ""} for this job permanently`}
            </p>
            <Button
              onClick={() => unlockMutation.mutate({ jobId, origin: window.location.origin })}
              disabled={unlockMutation.isPending}
              className="w-full bg-[#F25722] hover:opacity-90 text-white gap-2"
              size="sm"
            >
              {unlockMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
              {isEnterprise ? "Unlock Now" : "Unlock for $30"}
            </Button>
          </div>
          {/* Subscription */}
          <div className="border-2 border-[#111]/10 rounded-2xl p-5 flex flex-col bg-gray-50/50 hover:border-[#111]/20 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Star size={15} className="text-[#111]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111]">Subscribe</p>
                <p className="text-xs text-gray-400">Unlimited jobs · cancel anytime</p>
              </div>
            </div>
            <p className="text-2xl font-black text-[#111] mb-1">{isEnterprise ? "$250/mo" : "$50/mo"}</p>
            <p className="text-xs text-gray-400 mb-4 flex-1">
              Unlock all current and future jobs. Break-even at {isEnterprise ? "3" : "2"} jobs/month.
            </p>
            <Button
              onClick={() => subMutation.mutate({ jobId, origin: window.location.origin })}
              disabled={subMutation.isPending}
              variant="outline"
              className="w-full gap-2 bg-white"
              size="sm"
            >
              {subMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
              {isEnterprise ? "Subscribe — $250/mo" : "Subscribe — $50/mo"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const applicants = data.applicants ?? [];
  const allIds = applicants.map((a: any) => a.id);

  if (applicants.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Users size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No applicants yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 font-medium">{applicants.length} applicant{applicants.length !== 1 ? "s" : ""}</p>
      {applicants.map((a: any) => {
        const name = displayName(a);
        const disciplines = parseList(a.artistDisciplines).slice(0, 3);
        const rate = a.artistHourlyRate ? `$${a.artistHourlyRate}/hr` : a.clientHourlyRate ? `$${a.clientHourlyRate}/hr` : null;
        const profileUrl = a.artistSlug ? `/book/${a.artistSlug}` : null;
        return (
          <div
            key={a.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-gray-200 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onSelectApplicant(a.id, allIds)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {a.artistProfilePicture ? (
                  <img
                    src={a.artistProfilePicture}
                    alt={name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                    {(name[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#111]">{name}</p>
                    {a.artswrkPro && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">PRO</span>
                    )}
                  </div>
                  {a.artistLocation && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={9} /> {a.artistLocation}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appStatusColor(a.status)}`}>
                  {a.status || "Interested"}
                </span>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-[#F25722] transition-colors" />
              </div>
            </div>
            {disciplines.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {disciplines.map((d: string) => (
                  <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">{d}</span>
                ))}
              </div>
            )}
            {a.message && (
              <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">{a.message}</p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-400" onClick={(e) => e.stopPropagation()}>
              {rate && <span>{rate}</span>}
              {a.converted && (
                <span className="flex items-center gap-1 text-green-500 font-medium">
                  <CheckCircle2 size={10} /> Converted
                </span>
              )}
              <span className="ml-auto">{fmtDate(a.bubbleCreatedAt || a.createdAt)}</span>
              {a.resumeLink && (
                <a
                  href={a.resumeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F25722] font-semibold hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={10} /> Resume
                </a>
              )}
              {profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 font-semibold hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={10} /> Profile
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setMsgOpen(a.id); }}
                className="flex items-center gap-1 text-[#111] font-semibold hover:text-[#F25722] transition-colors"
              >
                <MessageCircle size={10} /> Message
              </button>
            </div>
            {/* Inline message modal */}
            {msgOpen === a.id && (
              <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                <MessageModal applicant={a} onClose={() => setMsgOpen(null)} />
              </div>
            )}
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
              <span className="text-gray-400 text-xs">Job ID</span>
              <span className="font-mono text-xs text-gray-600">{job.id}</span>
            </div>
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
        const name = [b.artistFirstName, b.artistLastName].filter(Boolean).join(" ") || b.artistName || "Artist";
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
  type Tab = "applicants" | "overview" | "bookings";
  const [tab, setTab] = useState<Tab>("applicants");
  const [selectedApplicant, setSelectedApplicant] = useState<{ id: number; allIds: number[] } | null>(null);

  const { data: job, isLoading } = trpc.clientJobs.getDetail.useQuery({ jobId });

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

  // If drill-down is open, show applicant detail
  if (selectedApplicant) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <button
            onClick={() => navigate(backPath)}
            className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1"
          >
            <ChevronLeft size={14} /> {backLabel}
          </button>
          <span className="text-gray-300">/</span>
          <button
            onClick={() => setSelectedApplicant(null)}
            className="text-gray-400 hover:text-[#F25722] font-medium transition-colors truncate max-w-[200px]"
          >
            {job.description?.slice(0, 40) || `Job #${job.id}`}
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-[#111] font-semibold">Applicant</span>
        </div>
        <ApplicantDetailView
          applicantId={selectedApplicant.id}
          allApplicantIds={selectedApplicant.allIds}
          onBack={() => setSelectedApplicant(null)}
        />
      </div>
    );
  }

  const clientName =
    job.clientCompanyName ||
    (job.clientFirstName ? [job.clientFirstName, job.clientLastName].filter(Boolean).join(" ") : null) ||
    job.clientEmail ||
    "Client";

  const showBookings = (job.bookingCount ?? 0) > 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: "applicants", label: "Applicants" },
    { id: "overview", label: "Overview" },
    ...(showBookings ? [{ id: "bookings" as Tab, label: `Bookings (${job.bookingCount})` }] : []),
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate(backPath)}
          className="text-gray-400 hover:text-[#F25722] font-medium transition-colors flex items-center gap-1"
        >
          <ChevronLeft size={14} /> {backLabel}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[#111] font-semibold line-clamp-1 max-w-xs">
          {job.description?.slice(0, 50) || `Job #${job.id}`}
        </span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {job.clientProfilePicture ? (
              <img
                src={job.clientProfilePicture}
                alt={clientName}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                {(clientName[0] || "?").toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Posted by</p>
              <h2 className="text-xl font-black text-[#111]">{clientName}</h2>
              {job.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2 max-w-lg">{job.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(job.requestStatus)}`}>
                  {job.requestStatus || "Active"}
                </span>
                {job.locationAddress && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={10} /> {job.locationAddress}
                  </span>
                )}
                {job.startDate && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={10} /> {fmtDate(job.startDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map((t) => (
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
      {tab === "applicants" && (
        <ApplicantsTab
          jobId={jobId}
          isEnterprise={isEnterprise}
          onSelectApplicant={handleSelectApplicant}
        />
      )}
      {tab === "overview" && <OverviewTab job={job} />}
      {tab === "bookings" && <BookingsTab jobId={jobId} />}
    </div>
  );
}
