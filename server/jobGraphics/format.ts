/**
 * Pure rules for what a job graphic says, and which jobs get one.
 * No database or Canva here, so all of it can be tested directly.
 */
export type GraphicJob = {
  id: number;
  title: string | null;
  dateType: string | null;
  startDate: unknown;
  isHourly: unknown;
  openRate: unknown;
  artistHourlyRate: number | null;
  clientHourlyRate: number | null;
  artistFlatRate?: number | null;
  clientFlatRate?: number | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationAddress: string | null;
};

export type GraphicFields = { title: string; date: string; location: string; rate: string };
export type GraphicDecision =
  | { ok: true; fields: GraphicFields; dedupeKey: string }
  | { ok: false; reason: string };

const EASTERN = "America/New_York";
/** Above this an hourly rate is almost certainly a flat fee or a typo. */
export const MAX_PLAUSIBLE_HOURLY_RATE = 150;
const MAX_TITLE_LENGTH = 34;
const SMALL_WORDS = new Set(["and", "or", "of", "for", "the", "a", "in", "at", "to", "with"]);
const STATES = /^[A-Z]{2}$/;

const validDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hhmm = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);

/** Same rule as client/src/lib/jobDates: a date with no time keeps its picked day. */
const zoneFor = (d: Date) => (hhmm(d, "UTC") === "00:00" ? "UTC" : EASTERN);

/** "Hip Hop instructor - Mondays" -> "Hip Hop Instructor". */
export function graphicTitle(raw: string | null): string {
  let title = (raw ?? "").replace(/\s+/g, " ").trim();
  const beforeDash = title.split(/\s+[-–—|]\s+/)[0];
  if (title.length > MAX_TITLE_LENGTH || /[,]\s*[A-Z]{2}$/.test(title)) title = beforeDash;
  return title
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function graphicDate(job: Pick<GraphicJob, "dateType" | "startDate">): string {
  const start = validDate(job.startDate);
  switch (job.dateType) {
    case "Dates Flexible":
      return "FLEXIBLE DATES";
    case "Ongoing":
      return "ONGOING";
    case "Weekly":
    case "Recurring":
      if (!start) return "WEEKLY";
      return `${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: zoneFor(start) }).format(start).toUpperCase()}S`;
    default:
      if (!start) return "";
      return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: zoneFor(start) })
        .format(start)
        .toUpperCase();
  }
}

/** City and state only. A studio's street address never goes on a graphic. */
export function graphicLocation(job: Pick<GraphicJob, "locationCity" | "locationState" | "locationAddress">): string {
  const state = (job.locationState ?? "").trim();
  if (job.locationCity?.trim() && STATES.test(state)) return `${job.locationCity.trim()}, ${state}`;

  const parts = (job.locationAddress ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length && /^(USA|United States)$/i.test(parts[parts.length - 1])) parts.pop();
  if (parts.length < 2) return "";
  const stateCode = parts[parts.length - 1].split(" ")[0];
  if (!STATES.test(stateCode)) return "";
  return `${parts[parts.length - 2]}, ${stateCode}`;
}

/** Mirrors formatRate in client/src/pages/JobDetail.tsx, so it matches the listing. */
export function graphicRate(job: GraphicJob): string | null {
  if (job.openRate) return "OPEN RATE";
  const hourly = job.clientHourlyRate ?? job.artistHourlyRate;
  if (job.isHourly) {
    if (!hourly || hourly > MAX_PLAUSIBLE_HOURLY_RATE) return null;
    return `$${hourly}/HR`;
  }
  const flat = job.clientFlatRate ?? job.artistFlatRate ?? hourly;
  return flat ? `$${flat} FLAT` : null;
}

export function decideGraphic(job: GraphicJob, now: Date = new Date()): GraphicDecision {
  const title = graphicTitle(job.title);
  if (!title) return { ok: false, reason: "no title" };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, reason: "title too long" };

  const start = validDate(job.startDate);
  const recurring = ["Weekly", "Recurring", "Ongoing", "Dates Flexible"].includes(job.dateType ?? "");
  if (!recurring) {
    if (!start) return { ok: false, reason: "no date" };
    if (start.getTime() < now.getTime()) return { ok: false, reason: "date has passed" };
  }

  const location = graphicLocation(job);
  if (!location) return { ok: false, reason: "no city and state" };
  const rate = graphicRate(job);
  if (!rate) return { ok: false, reason: "no usable rate" };
  const date = graphicDate(job);
  if (!date) return { ok: false, reason: "no date" };

  return {
    ok: true,
    fields: { title, date, location, rate },
    dedupeKey: `${title}|${location}|${date}`.toLowerCase().slice(0, 191),
  };
}
