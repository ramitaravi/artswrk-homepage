/**
 * Dump the live redirect map to CSV.
 *
 * Every "New destination" below is produced by running the representative URL
 * through the real `resolveLegacyRoute`, so this file can't drift from the
 * implementation the way a hand-written list would. Regenerate with:
 *
 *   npx tsx scripts/dump-redirect-map.ts > redirect-map.csv
 */
import { resolveLegacyRoute, type Resolution } from "../server/redirects";

type Row = {
  priority: string;
  pattern: string;
  /** Concrete URL used to drive the resolver. */
  example: string;
  query?: Record<string, string>;
  notes: string;
};

const BID = "1659533883431x527826980339748400";

const ROWS: Row[] = [
  // ── P0 ──
  { priority: "P0", pattern: "/book/<bubbleId>", example: `/book/${BID}`,
    notes: "~2,762 indexed artist profiles. Looks up users.bubbleId, 301s to the artist's slug." },
  { priority: "P0", pattern: "/app?tab=jobs", example: "/app", query: { tab: "jobs" }, notes: "" },
  { priority: "P0", pattern: "/app?tab=requests", example: "/app", query: { tab: "requests" }, notes: "Old Bubble job requests." },
  { priority: "P0", pattern: "/app?tab=bookings", example: "/app", query: { tab: "bookings" }, notes: "" },
  { priority: "P0", pattern: "/app?tab=payment", example: "/app", query: { tab: "payment" },
    notes: "Singular spelling — this is the one in the live 'Artswrk Wallet' payout email." },
  { priority: "P0", pattern: "/app?tab=payments", example: "/app", query: { tab: "payments" }, notes: "Plural spelling, also covered." },
  { priority: "P0", pattern: "/app?tab=messages", example: "/app", query: { tab: "messages" }, notes: "" },
  { priority: "P0", pattern: "/app?tab=profile", example: "/app", query: { tab: "profile" }, notes: "" },
  { priority: "P0", pattern: "/app?tab=benefits", example: "/app", query: { tab: "benefits" }, notes: "" },
  { priority: "P0", pattern: "/app?tab=settings", example: "/app", query: { tab: "settings" }, notes: "Not in the sheet; covered anyway." },
  { priority: "P0", pattern: "/app?tab=artists", example: "/app", query: { tab: "artists" }, notes: "Not in the sheet; covered anyway." },
  { priority: "P0", pattern: "/app?tab=company", example: "/app", query: { tab: "company" }, notes: "Not in the sheet; covered anyway." },
  { priority: "P0", pattern: "/app?tab=lists", example: "/app", query: { tab: "lists" }, notes: "Not in the sheet; covered anyway." },
  { priority: "P0", pattern: "/app?tab=community", example: "/app", query: { tab: "community" }, notes: "Not in the sheet; covered anyway." },
  { priority: "P0", pattern: "/app?tab=companies", example: "/app", query: { tab: "companies" }, notes: "Not in the sheet; covered anyway." },
  { priority: "P0", pattern: "/pro?uid=<bubble job id>", example: "/pro", query: { uid: BID },
    notes: "Every marketing 'Apply Here' CTA. Tries premium_jobs first, then jobs." },
  { priority: "P0", pattern: "/jobs?uid=<bubble job id>", example: "/jobs", query: { uid: BID },
    notes: "Jobs Drop campaign CTAs. Tries jobs first, then premium_jobs." },

  // ── P1 ──
  { priority: "P1", pattern: "/universities", example: "/universities",
    notes: "DECISION: redirect to homepage for now, rebuild the pages later." },
  { priority: "P1", pattern: "/universities/<slug>", example: "/universities/nyu",
    notes: "All 66 slugs (70 sitemap URLs)." },
  { priority: "P1", pattern: "/<artist-handle>", example: "/ramitaravi",
    notes: "Root vanity URLs — the top current 404s. Only fires on a segment that isn't a real route." },
  { priority: "P1", pattern: "/reset_pw", example: "/reset_pw", notes: "Old Bubble password-reset links." },

  // ── P2 ──
  { priority: "P2", pattern: "/benefits", example: "/benefits",
    notes: "Live links in the artist payout + 'Welcome to Artswrk PRO' emails." },
  { priority: "P2", pattern: "/blog", example: "/blog", notes: "No equivalent — closest parent." },
  { priority: "P2", pattern: "/partners", example: "/partners", notes: "No equivalent — closest parent." },
  { priority: "P2", pattern: "/map", example: "/map", notes: "No equivalent — closest parent." },
  { priority: "P2", pattern: "/contact", example: "/contact", notes: "No equivalent — closest parent." },
  { priority: "P2", pattern: "/pricing", example: "/pricing", notes: "" },
  { priority: "P2", pattern: "/dance-schools", example: "/dance-schools", notes: "Folded into the dance-studios page." },
  { priority: "P2", pattern: "/dance-educators", example: "/dance-educators", notes: "Folded into the dance-studios page." },
  { priority: "P2", pattern: "/network", example: "/network", notes: "2022 'New connection request' email CTA." },
  { priority: "P2", pattern: "/PRO (any casing)", example: "/PRO", notes: "Seen in marketing. First path segment is lower-cased." },
  { priority: "P2", pattern: "/null/<slug>", example: "/null/ramitaravi",
    notes: "38 recent hits — an undefined value interpolated into a URL." },
  { priority: "P2", pattern: "/null/<real route>", example: "/null/jobs", notes: "Same bug in front of a route that does exist." },
  { priority: "P2", pattern: "/?action=join", example: "/", query: { action: "join" }, notes: "Old homepage query link." },
  { priority: "P2", pattern: "/?section=artist", example: "/", query: { section: "artist" }, notes: "Old homepage query link." },

  // ── Already redirected client-side; now real 301s for crawlers ──
  { priority: "OK", pattern: "/signup", example: "/signup", notes: "Was client-side only; now a server 301 for SEO." },
  { priority: "OK", pattern: "/dashboard", example: "/dashboard", notes: "Was client-side only; now a server 301 for SEO." },
  { priority: "OK", pattern: "/dashboard/<rest>", example: "/dashboard/messages", notes: "Path is preserved through the move to /app." },
  { priority: "OK", pattern: "/artist-dashboard", example: "/artist-dashboard", notes: "Was client-side only; now a server 301 for SEO." },

  // ── P3 ──
  { priority: "P3", pattern: "/artists/<slug>", example: "/artists/ramitaravi", notes: "Stray external typo — the real route is /book/<slug>." },
  { priority: "P3", pattern: "/prro", example: "/prro", notes: "Stray external typo." },
  { priority: "P3", pattern: "/artswrk.com/<path>", example: "/artswrk.com/terms", notes: "External link that glued the domain into the path." },
  { priority: "P3", pattern: "/version-test/<real route>", example: "/version-test/jobs", notes: "Old Bubble staging prefix, stripped." },
  { priority: "P3", pattern: "/version-test/reset_pw", example: "/version-test/reset_pw", notes: "2022 email-confirmation / reset links." },
  { priority: "P3", pattern: "/version-test/<anything else>", example: "/version-test/whatever", notes: "Falls back to the homepage rather than 404ing." },
];

/** Human-readable destination + fallback for one resolution. */
function describe(r: Resolution | null): { to: string; how: string; fallback: string } {
  if (!r) return { to: "(no redirect — served as-is)", how: "—", fallback: "—" };
  switch (r.kind) {
    case "static":
      return { to: r.to, how: "301 (static)", fallback: "—" };
    case "artist-by-bubble-id":
      return { to: "/book/<slug>", how: "301 after lookup: users.bubbleId -> users.slug", fallback: r.fallback || "(real 404)" };
    case "artist-by-slug":
      return { to: "/book/<slug>", how: "301 after lookup: users.slug", fallback: r.fallback || "(real 404)" };
    case "job-by-bubble-id":
      return {
        to: r.prefer === "pro" ? "/pro/<serviceType>-<id>" : "/jobs/<slug>",
        how: `301 after lookup: ${r.prefer === "pro" ? "premium_jobs" : "jobs"}.bubbleId (falls back to the other table)`,
        fallback: r.fallback || "(real 404)",
      };
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const HEADER = ["Priority", "Old URL pattern", "Example old URL", "Redirects to", "How it resolves", "If the lookup finds nothing", "Notes"];
const lines = [HEADER.map(csvCell).join(",")];

for (const row of ROWS) {
  const { to, how, fallback } = describe(resolveLegacyRoute(row.example, row.query ?? {}));
  const example = row.query
    ? `${row.example}?${Object.entries(row.query).map(([k, v]) => `${k}=${v}`).join("&")}`
    : row.example;
  lines.push([row.priority, row.pattern, example, to, how, fallback, row.notes].map(csvCell).join(","));
}

// Things that deliberately are NOT redirected, recorded so they don't read as omissions.
const UNCHANGED: string[][] = [
  ["—", "url3751.artswrk.com", "url3751.artswrk.com", "(untouched)", "SendGrid click-tracking CNAME — DNS, not code",
   "—", "MUST keep resolving through the DNS migration or every link in every historical email dies."],
  ["—", "/book/<slug>", "/book/ramita-ravi", "(no redirect)", "Already a real route", "—",
   "Slug-based profiles work as-is; only ID-based ones needed a fallback."],
  ["—", "Existing routes", "/jobs, /pro, /browse, /join, /login, /terms, /privacy-policy, /about, /admin-dashboard, /enterprise, /",
   "(no redirect)", "Already real routes", "—", "Unchanged from the old site."],
  ["P3", "Any unknown route", "/some-junk-url", "(no redirect)", "Now returns a real HTTP 404 instead of 200",
   "—", "Was a soft 404: every unknown URL returned 200 + the NotFound page, which told crawlers junk URLs were real pages."],
  ["P3", "Legacy subdomains", "api.artswrk.com, shop.artswrk.com", "(unreviewed)", "DNS decision, not code", "—",
   "Still needs a fate decision."],
];
for (const row of UNCHANGED) lines.push(row.map(csvCell).join(","));

console.log(lines.join("\n"));
