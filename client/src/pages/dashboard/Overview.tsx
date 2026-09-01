import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Users, ChevronRight, Sparkles, MapPin,
  Loader2, ArrowRight, Briefcase, Plus, Wand2,
  CalendarCheck, MessageSquare, Building2,
  Heart, UserCheck, Gift,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useUpgrade } from "@/lib/useUpgrade";
import { JobCard } from "@/components/ClientJobCard";
import { toSimpleJobStatus } from "@shared/jobStatus";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
  "bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-lime-500",
];

function getArtistColor(seed: string | null | undefined) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATE_ABBR: Record<string, string> = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
  "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS",
  "kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA",
  "michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT",
  "nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM",
  "new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
  "oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
  "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
  "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};

function formatCity(location?: string | null): string | null {
  if (!location) return null;
  const parts = location.split(",").map(p => p.trim()).filter(Boolean);
  const city = parts[0];
  if (!city) return null;
  if (parts.length < 2) return city;
  const raw = parts[1].trim();
  const abbr = raw.length <= 3
    ? raw.toUpperCase()
    : STATE_ABBR[raw.toLowerCase()] ?? raw.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return `${city}, ${abbr}`;
}

function getInitials(str: string | null | undefined, fallback = "?"): string {
  if (!str) return fallback;
  return str.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Post Job Box ───────────────────────────────────────────────────────────────

const BLANK_PARSED_JOB = {
  title: null, description: "", locationAddress: null, dateType: "Single Date",
  startDate: null, endDate: null, isHourly: false, openRate: true,
  clientHourlyRate: null, clientFlatRate: null, transportation: false, serviceType: null,
};

function navigateToPostJob(navigate: (path: string) => void, rawText = "", parsed = BLANK_PARSED_JOB) {
  sessionStorage.setItem("postJobParsed", JSON.stringify({ rawText, parsed }));
  navigate("/post-job");
}

function PostJobBox() {
  const [text, setText] = useState("");
  const [, navigate] = useLocation();

  const parse = trpc.postJob.parseText.useMutation({
    onSuccess: (parsed) => {
      navigateToPostJob(navigate, text, parsed as typeof BLANK_PARSED_JOB);
    },
    onError: () => navigateToPostJob(navigate),
  });

  function handlePost() {
    if (text.trim().length < 5) { navigateToPostJob(navigate); return; }
    parse.mutate({ text: text.trim() });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={15} className="text-[#F25722]" />
        <h2 className="text-sm font-black text-[#111]">Type your job below…</h2>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={`Ex: I'm hiring a ballet teacher for weekly classes starting in September, $60/hr, twice a month…`}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all resize-none leading-relaxed"
      />
      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <Sparkles size={10} className="text-amber-400" />
          We'll fill in the form from your description
        </p>
        <div className="flex items-center gap-2">
          <Link href="/app/artists">
            <button className="flex items-center gap-1.5 text-xs font-bold text-[#F25722] px-4 py-2 rounded-xl border-2 border-[#F25722] hover:bg-[#fff3ee] transition-colors">
              <Users size={12} /> Browse Artists
            </button>
          </Link>
          <button
            onClick={handlePost}
            disabled={parse.isPending}
            className="flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-xl hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {parse.isPending
              ? <><Loader2 size={12} className="animate-spin" /> Parsing…</>
              : <><Plus size={12} /> Post Job</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tasks Card ─────────────────────────────────────────────────────────────────
// Mirrors the artist dashboard's "Your Tasks" pattern — same collapsible card,
// same idea: only show what's actually actionable, nothing else.

/** `onClick` wins over `href` — the upgrade row goes straight to Stripe rather
 *  than navigating to a page that would only show another upgrade button. */
type TaskItem = { key: string; icon: React.ReactNode; label: string; sublabel?: string; href?: string; onClick?: () => void; upsell?: boolean };

function TaskRow({ task }: { task: TaskItem }) {
  const body = (
      <div className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        task.upsell
          ? "bg-gradient-to-r from-pink-50 to-orange-50 border border-orange-100 hover:border-orange-200"
          : "bg-gray-50 hover:bg-gray-100"
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${task.upsell ? "bg-white" : "bg-white"}`}>
          {task.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#111]">{task.label}</p>
          {task.sublabel && <p className="text-xs text-gray-500 mt-0.5">{task.sublabel}</p>}
        </div>
        <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
      </div>
  );
  if (task.onClick) {
    return <button type="button" onClick={task.onClick} className="block w-full text-left">{body}</button>;
  }
  return <Link href={task.href ?? "#"}>{body}</Link>;
}

function TasksCard({ tasks }: { tasks: TaskItem[] }) {
  const [open, setOpen] = useState(true);
  if (!tasks.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#111]">Your Tasks</span>
          <span className="w-5 h-5 rounded-full bg-[#F25722] text-white text-[10px] font-semibold flex items-center justify-center">
            {tasks.length}
          </span>
        </div>
        <ChevronRight size={16} className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2">
          {tasks.map(t => <TaskRow key={t.key} task={t} />)}
        </div>
      )}
    </div>
  );
}

// ── My Applicants Sidebar ──────────────────────────────────────────────────────

function ApplicantsSidebar({ applicants, loading }: { applicants: any[]; loading: boolean }) {
  // Group by artist, count unique jobs they've applied to
  const byArtist = applicants.reduce<Record<string, { data: any; count: number }>>((acc, a) => {
    const key = String(a.artistUserId ?? a.bubbleArtistId ?? a.id);
    if (!acc[key]) acc[key] = { data: a, count: 0 };
    acc[key].count++;
    return acc;
  }, {});
  const artists = Object.values(byArtist).sort((a, b) => b.count - a.count);

  return (
    <div className="w-full lg:w-60 flex-shrink-0">
      <h2 className="text-base font-bold text-[#111] mb-4">My Applicants</h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      ) : !artists.length ? (
        <p className="text-xs text-gray-400 leading-relaxed">
          Artists who apply to your jobs will appear here.
        </p>
      ) : (
        <div className="space-y-5">
          {artists.slice(0, 15).map(({ data: a, count }) => {
            const url = fixUrl(a.artistProfilePicture);
            const name = a.artistFirstName && a.artistLastName
              ? `${a.artistFirstName} ${a.artistLastName}`
              : a.artistName ?? "Artist";
            const lastName = a.artistLastName ? `${a.artistFirstName ?? ""} ${a.artistLastName[0]}.`.trim() : name;
            return (
              <Link href={a.artistUserId ? `/app/artists/${a.artistUserId}?tab=history` : "/app/artists"} key={a.artistUserId ?? a.bubbleArtistId ?? a.id} className="block">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                    {url
                      ? <img src={url} alt={name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">{getInitials(name)}</div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111] truncate group-hover:text-[#F25722] transition-colors">{lastName}</p>
                    <p className="text-xs text-gray-400">Applied to you {count} time{count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </Link>
            );
          })}
          {artists.length > 15 && (
            <Link href="/app/artists" className="block">
              <p className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity flex items-center gap-1">
                See all {artists.length} <ArrowRight size={11} />
              </p>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Artist Card ────────────────────────────────────────────────────────────────

function ArtistCard({
  artistUserId, name, profilePicture, location, bio,
  countLabel, isSaved, onToggleSave,
}: {
  artistUserId: number | null | undefined;
  name: string;
  profilePicture?: string | null;
  location?: string | null;
  bio?: string | null;
  countLabel?: string;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const url = fixUrl(profilePicture);
  const cityLine = formatCity(location);
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const color = getArtistColor(name);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-5 hover:shadow-md transition-shadow">
      {/* Avatar */}
      <div className={`w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 ${!url ? color : "bg-gray-100"} flex items-center justify-center`}>
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-black text-2xl">{initials}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-[#111]">{name}</p>
        {cityLine && (
          <p className="text-sm text-gray-500 mt-0.5">{cityLine}</p>
        )}
        {bio && (
          <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{bio}</p>
        )}

        {/* Action pills */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {artistUserId && (
            <Link href={`/app/artists/${artistUserId}`}>
              <button className="text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:border-gray-400 transition-colors">
                Details
              </button>
            </Link>
          )}
          {countLabel && artistUserId && (
            <Link href={`/app/artists/${artistUserId}`}>
              <button className="text-xs text-[#F25722] border border-[#F25722] rounded-full px-3 py-1 hover:bg-[#fff3ee] transition-colors flex items-center gap-1">
                {countLabel} <ArrowRight size={11} />
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Right: heart + chevron */}
      <div className="flex flex-col items-center gap-4 flex-shrink-0 pt-1">
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
          className="hover:scale-110 transition-transform"
          title={isSaved ? "Remove from favorites" : "Save to favorites"}
        >
          <Heart
            size={16}
            className={isSaved ? "text-[#F25722] fill-[#F25722]" : "text-gray-300 hover:text-[#F25722] transition-colors"}
          />
        </button>
        {artistUserId && (
          <Link href={`/app/artists/${artistUserId}`}>
            <ChevronRight size={16} className="text-gray-300 hover:text-[#F25722] transition-colors" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Artists Tab ────────────────────────────────────────────────────────────────

type ArtistFilter = "applied" | "hired" | "favorites";

function ArtistsTab({ applicants, appsLoading }: { applicants: any[]; appsLoading: boolean }) {
  const [filter, setFilter] = useState<ArtistFilter>("applied");

  const { data: myBookings, isLoading: bookingsLoading } = trpc.bookings.myBookings.useQuery({ limit: 200 });
  const { data: savedData, isLoading: savedLoading } = trpc.savedArtists.mySaved.useQuery();
  const utils = trpc.useUtils();
  const toggleSave = trpc.savedArtists.toggle.useMutation({
    onSuccess: () => utils.savedArtists.mySaved.invalidate(),
  });

  const savedSet = new Set((savedData ?? []).map((s: any) => s.artistUserId as number));

  function handleToggle(artistUserId: number) {
    toggleSave.mutate({ artistUserId });
  }

  // Applied: dedupe applicants by artistUserId, count applications
  const appliedMap = (applicants ?? []).reduce<Record<number, { data: any; count: number }>>((acc, a) => {
    const key = a.artistUserId as number;
    if (!key) return acc;
    if (!acc[key]) acc[key] = { data: a, count: 0 };
    acc[key].count++;
    return acc;
  }, {});
  const appliedList = Object.values(appliedMap).sort((a, b) => b.count - a.count);

  // Hired: dedupe bookings by artistUserId, exclude Cancelled
  const hiredMap = ((myBookings ?? []) as any[])
    .filter(b => b.bookingStatus !== "Cancelled")
    .reduce<Record<number, { data: any; count: number }>>((acc, b) => {
      const key = b.artistUserId as number;
      if (!key) return acc;
      if (!acc[key]) acc[key] = { data: b, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
  const hiredList = Object.values(hiredMap).sort((a, b) => b.count - a.count);

  const isLoading =
    (filter === "applied" && appsLoading) ||
    (filter === "hired" && bookingsLoading) ||
    (filter === "favorites" && savedLoading);

  const filters: { id: ArtistFilter; label: string; count: number }[] = [
    { id: "applied", label: "Applied", count: appliedList.length },
    { id: "hired", label: "Hired", count: hiredList.length },
    { id: "favorites", label: "Favorites", count: savedSet.size },
  ];

  function renderList() {
    if (isLoading) return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );

    if (filter === "applied") {
      if (!appliedList.length) return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No applicants yet</p>
          <p className="text-xs">Artists who apply to your jobs will appear here.</p>
        </div>
      );
      return (
        <div className="space-y-5">
          {appliedList.map(({ data: a, count }) => {
            const name = a.artistFirstName && a.artistLastName
              ? `${a.artistFirstName} ${a.artistLastName}` : a.artistName ?? "Artist";
            const lastName = a.artistLastName
              ? `${a.artistFirstName ?? ""} ${a.artistLastName[0]}.`.trim() : name;
            return (
              <ArtistCard
                key={a.artistUserId ?? a.bubbleArtistId ?? a.id}
                artistUserId={a.artistUserId}
                name={lastName}
                profilePicture={a.artistProfilePicture}
                location={a.artistLocation}
                bio={a.artistBio}
                countLabel={`Applied to you ${count} time${count !== 1 ? "s" : ""}`}
                isSaved={savedSet.has(a.artistUserId)}
                onToggleSave={() => a.artistUserId && handleToggle(a.artistUserId)}
              />
            );
          })}
        </div>
      );
    }

    if (filter === "hired") {
      if (!hiredList.length) return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <CalendarCheck size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No hired artists yet</p>
          <p className="text-xs">Artists you've booked will appear here.</p>
        </div>
      );
      return (
        <div className="space-y-5">
          {hiredList.map(({ data: b, count }) => {
            const name = b.artistFirstName && b.artistLastName
              ? `${b.artistFirstName} ${b.artistLastName}` : b.artistName ?? "Artist";
            const lastName = b.artistLastName
              ? `${b.artistFirstName ?? ""} ${b.artistLastName[0]}.`.trim() : name;
            return (
              <ArtistCard
                key={b.artistUserId ?? b.id}
                artistUserId={b.artistUserId}
                name={lastName}
                profilePicture={b.artistProfilePicture}
                location={b.artistLocation}
                bio={b.artistBio}
                countLabel={`Hired ${count} time${count !== 1 ? "s" : ""}`}
                isSaved={savedSet.has(b.artistUserId)}
                onToggleSave={() => b.artistUserId && handleToggle(b.artistUserId)}
              />
            );
          })}
        </div>
      );
    }

    // Favorites
    if (!savedData?.length) return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Heart size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-semibold text-gray-600 mb-1">No favorites yet</p>
        <p className="text-xs">Click the heart icon on any artist card to save them here.</p>
      </div>
    );
    return (
      <div className="space-y-5">
        {(savedData as any[]).map((s: any) => {
          const name = s.artistFirstName && s.artistLastName
            ? `${s.artistFirstName} ${s.artistLastName}` : s.artistName ?? "Artist";
          const lastName = s.artistLastName
            ? `${s.artistFirstName ?? ""} ${s.artistLastName[0]}.`.trim() : name;
          return (
            <ArtistCard
              key={s.artistUserId}
              artistUserId={s.artistUserId}
              name={lastName}
              profilePicture={s.artistProfilePicture}
              location={s.artistLocation}
              bio={s.artistBio}
              isSaved={true}
              onToggleSave={() => handleToggle(s.artistUserId)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex-shrink-0 ${
              filter === f.id
                ? "bg-[#111] text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`ml-1.5 text-xs ${filter === f.id ? "text-gray-300" : "text-gray-400"}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {renderList()}
    </div>
  );
}

// ── Companies Tab ──────────────────────────────────────────────────────────────

function CompaniesTab({ jobs }: { jobs: any[]; companyName?: string | null }) {
  const [, navigate] = useLocation();
  const companies = Array.from(
    new Map(jobs.filter(j => j.clientCompanyName).map(j => [j.clientCompanyName, j])).values()
  );

  if (!companies.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Building2 size={36} className="mb-3 opacity-30" />
      <p className="text-sm font-semibold text-gray-600 mb-1">No companies yet</p>
      <p className="text-xs mb-4">Post a job to associate it with your company.</p>
      <button
        onClick={() => navigateToPostJob(navigate)}
        className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
        Post a Job →
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {companies.map(j => (
        <div key={j.clientCompanyName} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl hirer-grad-bg flex items-center justify-center text-white font-black flex-shrink-0">
            {getInitials(j.clientCompanyName)}
          </div>
          <div>
            <p className="text-sm font-bold text-[#111]">{j.clientCompanyName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {jobs.filter(jj => jj.clientCompanyName === j.clientCompanyName).length} job(s)
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Jobs Tab ───────────────────────────────────────────────────────────────────

function JobsTab({
  jobs, applicants, companyName, profilePicture, jobsLoading, appsLoading,
}: {
  jobs: any[]; applicants: any[]; companyName?: string | null; profilePicture?: string | null;
  jobsLoading: boolean; appsLoading: boolean;
}) {
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [, navigate] = useLocation();

  const applicantsByJob = applicants.reduce<Record<number, any[]>>((acc, a) => {
    if (a.jobId != null) { acc[a.jobId] = acc[a.jobId] ?? []; acc[a.jobId].push(a); }
    return acc;
  }, {});

  // Active tab includes Paused too — a paused job is still "yours to manage,"
  // just flagged on its card (see ClientJobCard); Archived is its own bucket.
  const filtered = jobs.filter(j => {
    const simple = toSimpleJobStatus(j.requestStatus);
    return filter === "active" ? simple !== "Archived" : simple === "Archived";
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Left: filter + job list */}
      <div className="flex-1 min-w-0">
        {/* Active / Archived pills */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              filter === "active" ? "bg-[#111] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("archived")}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              filter === "archived" ? "bg-[#111] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            Archived
          </button>
        </div>

        {jobsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Briefcase size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-semibold text-gray-600 mb-1">
              {filter === "active" ? "No active jobs" : "No archived jobs"}
            </p>
            {filter === "active" && (
              <>
                <p className="text-xs mb-4">Use the box above to post your first job.</p>
                <button
                  onClick={() => navigateToPostJob(navigate)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                  Post a Job →
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map(job => (
              <JobCard
                key={job.id}
                job={job}
                applicants={applicantsByJob[job.id] ?? []}
                companyName={companyName}
                profilePicture={profilePicture}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: My Applicants sidebar */}
      <ApplicantsSidebar applicants={applicants} loading={appsLoading} />
    </div>
  );
}

// ── Main Overview ──────────────────────────────────────────────────────────────

type Tab = "jobs" | "artists" | "companies";

export default function Overview() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("jobs");

  const firstName = (user as any)?.firstName ?? user?.name?.split(" ")[0] ?? "there";
  const companyName = (user as any)?.clientCompanyName as string | null | undefined;
  const profilePic = fixUrl((user as any)?.profilePicture as string | null | undefined);

  const { data: jobs, isLoading: jobsLoading } = trpc.jobs.myJobs.useQuery({ limit: 100 });
  const { data: applicants, isLoading: appsLoading } = trpc.applicants.myApplicants.useQuery({ limit: 500 });
  const { data: bookingStats } = trpc.bookings.myStats.useQuery();
  const { data: messageStats } = trpc.messages.myStats.useQuery();

  // "Confirm Artists" = applicants still sitting unactioned on a job that's
  // actually live right now — a job you archived or paused doesn't need a
  // nudge, its leftover applicants aren't waiting on anything anymore.
  const activeJobIds = new Set(
    (jobs ?? []).filter((j: any) => toSimpleJobStatus(j.requestStatus) === "Active").map((j: any) => j.id)
  );
  const waitingToConfirm = (applicants ?? []).filter(
    (a: any) => (!a.status || a.status === "Interested") && activeJobIds.has(a.jobId)
  ).length;

  // Deliberately `awaitingPayment`, not `unpaid` — `unpaid` also counts
  // bookings the artist hasn't invoiced yet (nothing for the client to do)
  // and `direct`-pay bookings that never go through Artswrk checkout at all.
  // The client can't pay until the artist invoices, so this task should only
  // fire once that's actually happened.
  const unpaidBookings = (bookingStats as any)?.awaitingPayment ?? 0;
  const unreadMessages = (messageStats as any)?.unreadMessages ?? 0;
  const isPremium = (user as any)?.planTier === "client_premium";

  const { data: benefitsData } = trpc.benefits.list.useQuery({ audienceType: "Client" });
  const benefitsCount = benefitsData?.benefits?.length ?? 0;

  const { start: startUpgrade, pending: upgradePending } = useUpgrade();

  const tasks: TaskItem[] = [
    waitingToConfirm > 0 && {
      key: "confirm",
      icon: <UserCheck size={16} className="text-[#F25722]" />,
      label: `Confirm ${waitingToConfirm} artist${waitingToConfirm !== 1 ? "s" : ""}`,
      sublabel: "Available for your active jobs — not booked yet",
      // My Jobs, not /app/artists: confirming happens against a specific job's
      // applicants, so the job list is where the task can actually be finished.
      href: "/app/jobs",
    },
    unpaidBookings > 0 && {
      key: "pay",
      icon: <CalendarCheck size={16} className="text-[#F25722]" />,
      label: `Pay ${unpaidBookings} artist${unpaidBookings !== 1 ? "s" : ""}`,
      sublabel: "Invoice" + (unpaidBookings !== 1 ? "s" : "") + " ready for payment",
      href: "/app/bookings",
    },
    unreadMessages > 0 && {
      key: "messages",
      icon: <MessageSquare size={16} className="text-[#F25722]" />,
      label: `${unreadMessages} new message${unreadMessages !== 1 ? "s" : ""}`,
      href: "/app/messages",
    },
    !isPremium && {
      key: "upgrade",
      icon: <Sparkles size={16} className="text-[#F25722]" />,
      label: "Upgrade to Artswrk Premium",
      sublabel: "Unlimited jobs unlocked for one flat rate",
      onClick: () => startUpgrade({ audience: "client" }),
      upsell: true,
    },
  ].filter(Boolean) as TaskItem[];

  const tabs: { id: Tab; label: string }[] = [
    { id: "jobs", label: "My Jobs" },
    { id: "artists", label: "My Artists" },
    { id: "companies", label: "My Companies" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 md:space-y-8">

      {/* ── Welcome header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {profilePic ? (
          <img
            src={profilePic}
            alt={firstName}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-14 h-14 rounded-full hirer-grad-bg flex items-center justify-center text-white font-black text-xl flex-shrink-0">
            {getInitials(companyName ?? firstName)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-black text-[#111]">Welcome Back, {firstName}!</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here is your hiring dashboard!</p>
        </div>
      </div>

      {/* ── Post job box ─────────────────────────────────────────────────── */}
      <PostJobBox />

      {/* ── Tasks (only what's actually applicable) ──────────────────────── */}
      <TasksCard tasks={tasks} />

      {/* ── Benefits teaser — only promoted once there's something real to show.
          Enterprise gets benefits:[] from the server, so this naturally never
          renders for them without any extra check here. ── */}
      {benefitsCount > 0 && (
        <a
          href="/app/benefits"
          className="block bg-gradient-to-br from-orange-50 to-pink-50 border border-orange-100 rounded-2xl p-5 hover:border-orange-200 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Gift size={16} className="text-[#F25722]" />
            <span className="text-sm font-semibold text-[#111]">Partner Benefits</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            {benefitsData?.locked
              ? `$1000+ in savings waiting — unlock ${benefitsCount} partner discount${benefitsCount !== 1 ? "s" : ""} with Artswrk Premium.`
              : `${benefitsCount} exclusive discount${benefitsCount !== 1 ? "s" : ""} for your studio — from booking tools to event partners.`}
          </p>
          <span className="text-xs font-semibold text-[#F25722]">{benefitsData?.locked ? "Unlock with Premium →" : "See what's included →"}</span>
        </a>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <div className="flex items-center gap-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-[#111] text-[#111]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {tab === "jobs" && (
        <JobsTab
          jobs={jobs ?? []}
          applicants={applicants ?? []}
          companyName={companyName}
          profilePicture={profilePic}
          jobsLoading={jobsLoading}
          appsLoading={appsLoading}
        />
      )}
      {tab === "artists" && (
        <ArtistsTab applicants={applicants ?? []} appsLoading={appsLoading} />
      )}
      {tab === "companies" && (
        <CompaniesTab jobs={jobs ?? []} />
      )}
    </div>
  );
}
