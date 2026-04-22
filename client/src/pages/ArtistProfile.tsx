/**
 * Public artist profile page — /book/:slug
 * Shows full artist details: photo, bio, disciplines, services, rates, links, portfolio
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  MapPin, Globe, Instagram, Youtube, ExternalLink, Star,
  DollarSign, Loader2, Calendar, FileText, MessageCircle,
  ChevronLeft, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

// ─── Contact Modal ─────────────────────────────────────────────────────────────

function ContactModal({
  artistId,
  artistName,
  onClose,
}: {
  artistId: number;
  artistName: string;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const sendMsg = trpc.clientJobs.messageApplicant.useMutation({
    onSuccess: () => {
      setSent(true);
      setTimeout(() => {
        onClose();
        navigate("/app/messages");
      }, 1800);
    },
    onError: (e) => {
      toast.error(e.message || "Failed to send message");
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="text-center py-6 space-y-4">
        <p className="text-sm text-gray-600">Sign in to message {artistName}</p>
        <Button
          onClick={() => window.location.href = getLoginUrl()}
          className="bg-[#111] hover:bg-gray-800 text-white"
        >
          Sign In to Message
        </Button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 gap-4">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <p className="font-bold text-[#111] text-lg">Message sent!</p>
        <p className="text-sm text-gray-500 text-center">Opening your messages thread…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Textarea
        placeholder={`Hi ${artistName}, I'd love to connect about…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[120px] resize-none text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
        <Button
          onClick={() => {
            // Note: this sends a direct message; the artistId here is used as a placeholder
            // In production, this would use a direct message procedure
            toast.info("Message feature requires an active job application. Browse jobs to connect!");
            onClose();
          }}
          disabled={!text.trim()}
          className="bg-[#111] hover:bg-gray-800 text-white gap-2"
          size="sm"
        >
          Send Message
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ArtistProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [contactOpen, setContactOpen] = useState(false);

  const { data: artist, isLoading } = trpc.artistProfile.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-32">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-32 text-center">
          <p className="text-2xl font-black text-[#111] mb-2">Artist not found</p>
          <p className="text-gray-400 text-sm mb-6">The profile you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/jobs")} variant="outline">Browse Jobs</Button>
        </div>
      </div>
    );
  }

  const name = [artist.firstName, artist.lastName].filter(Boolean).join(" ") || artist.name || "Artist";
  const disciplines = parseList(artist.masterArtistTypes).slice(0, 8);
  const services = parseList(artist.artistServices).slice(0, 6);
  const workTypes = parseList(artist.workTypes).slice(0, 6);
  const experiences = parseList(artist.artistExperiences).slice(0, 4);
  const mediaPhotos = parseList(artist.mediaPhotos).slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 pt-24 space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Cover gradient */}
          <div className="h-24 bg-gradient-to-r from-[#FFBC5D] to-[#F25722]" />
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between gap-4 -mt-10 flex-wrap">
              <div className="flex items-end gap-4">
                {artist.profilePicture ? (
                  <img
                    src={artist.profilePicture}
                    alt={name}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-2xl border-4 border-white shadow-md flex-shrink-0">
                    {(name[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-[#111]">{name}</h1>
                    {artist.artswrkPro && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                        <Star size={9} fill="currentColor" /> PRO
                      </span>
                    )}
                    {artist.artswrkBasic && !artist.artswrkPro && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">BASIC</span>
                    )}
                  </div>
                  {artist.tagline && <p className="text-sm text-gray-500 mt-0.5">{artist.tagline}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
                    {artist.location && (
                      <span className="flex items-center gap-1"><MapPin size={10} /> {artist.location}</span>
                    )}
                    {artist.pronouns && <span>{artist.pronouns}</span>}
                    {artist.optionAvailability && (
                      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">{artist.optionAvailability}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {artist.artistHourlyRate && (
                  <span className="flex items-center gap-1 text-sm font-bold text-[#111]">
                    <DollarSign size={13} /> ${artist.artistHourlyRate}/hr
                  </span>
                )}
                <Button
                  onClick={() => setContactOpen(true)}
                  className="bg-[#111] hover:bg-gray-800 text-white gap-2"
                  size="sm"
                >
                  <MessageCircle size={14} /> Contact
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Bio */}
            {artist.bio && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">About</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{artist.bio}</p>
              </div>
            )}

            {/* Disciplines */}
            {disciplines.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Disciplines</p>
                <div className="flex flex-wrap gap-2">
                  {disciplines.map((d) => (
                    <span key={d} className="text-xs px-3 py-1.5 rounded-full bg-pink-50 text-pink-600 font-medium">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            {services.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Services</p>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span key={s} className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Work Types */}
            {workTypes.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Work Types</p>
                <div className="flex flex-wrap gap-2">
                  {workTypes.map((w) => (
                    <span key={w} className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 font-medium">{w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Media photos */}
            {mediaPhotos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Portfolio</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaPhotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Portfolio ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-xl hover:opacity-90 transition-opacity"
                        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Stats</p>
              <div className="space-y-3">
                {artist.bookingCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Bookings</span>
                    <span className="text-xs font-bold text-[#111]">{artist.bookingCount}</span>
                  </div>
                )}
                {artist.ratingScore > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Rating</span>
                    <span className="text-xs font-bold text-[#111] flex items-center gap-1">
                      <Star size={10} fill="currentColor" className="text-amber-400" />
                      {Number(artist.ratingScore).toFixed(1)} ({artist.reviewCount})
                    </span>
                  </div>
                )}
                {artist.artistHourlyRate && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Hourly Rate</span>
                    <span className="text-xs font-bold text-[#111]">${artist.artistHourlyRate}/hr</span>
                  </div>
                )}
              </div>
            </div>

            {/* Links */}
            {(artist.website || artist.instagram || artist.youtube || artist.portfolio) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Links</p>
                <div className="space-y-2">
                  {artist.website && (
                    <a href={artist.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#F25722] hover:underline">
                      <Globe size={13} /> {artist.website.replace(/^https?:\/\//, "").slice(0, 30)}
                    </a>
                  )}
                  {artist.instagram && (
                    <a href={`https://instagram.com/${artist.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-pink-500 hover:underline">
                      <Instagram size={13} /> @{artist.instagram.replace("@", "")}
                    </a>
                  )}
                  {artist.youtube && (
                    <a href={artist.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-red-500 hover:underline">
                      <Youtube size={13} /> YouTube
                    </a>
                  )}
                  {artist.portfolio && (
                    <a href={artist.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                      <ExternalLink size={13} /> Portfolio
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Resumes */}
            {artist.resumes && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resume</p>
                <a
                  href={artist.resumes}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <FileText size={13} /> View Resume
                  </Button>
                </a>
              </div>
            )}

            {/* Experience */}
            {experiences.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Experience</p>
                <div className="space-y-2">
                  {experiences.map((exp, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-gray-600">{exp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact modal */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact {name}</DialogTitle>
          </DialogHeader>
          <ContactModal
            artistId={artist.id}
            artistName={artist.firstName ?? name}
            onClose={() => setContactOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
