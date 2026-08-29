/**
 * Legacy Bubble → new-site redirects.
 *
 * Source of truth: the "Redirect Map (old to new)" tab of the Aug 28 client
 * pull. Everything here exists because a real old URL is still live in Google's
 * index, in a historical marketing blast, or in a transactional email that
 * already went out — so these have to be permanent (301) redirects, resolved on
 * the server before the SPA ever boots. A client-side redirect is invisible to
 * a crawler and loses the link equity, which is the whole point of the exercise.
 *
 * NOTE ON DNS: url3751.artswrk.com is SendGrid's click-tracking CNAME. Nothing
 * in this file touches it and nothing here can replace it — it has to survive
 * the DNS migration on its own or every link in every historical email dies.
 *
 * The module is split in two on purpose:
 *   - `resolveLegacyRoute` is pure (path + query in, intent out) so the whole
 *     map is unit-testable with no database.
 *   - `registerLegacyRedirects` does the Express wiring and the ID→slug
 *     database lookups that a handful of the patterns need.
 */

// ─── Known routes ─────────────────────────────────────────────────────────────

/**
 * First path segment of every route the SPA actually serves (see the <Switch>
 * in client/src/App.tsx), plus the server-owned prefixes.
 *
 * Two things depend on this list being complete: the bare-vanity-URL lookup
 * (`/ramitaravi` → an artist profile) must not swallow a real route, and the
 * soft-404 fix must not return 404 for a page that exists. `redirects.test.ts`
 * cross-checks it against App.tsx and fails if a route is added there without
 * being added here, so the two can't quietly drift apart.
 */
export const KNOWN_TOP_LEVEL_SEGMENTS = new Set([
  // Public marketing + auth
  "", "about", "acrobatic-arts", "browse", "cancellation-policy",
  "client-onboarding", "artist-onboarding", "dance-competitions",
  "dance-judges", "dance-studios", "dance-teachers", "forgot-password",
  "join", "login", "music-schools", "music-teachers", "post-job",
  "privacy-policy", "production", "reset-password", "signup", "terms",
  // Jobs + profiles
  "book", "jobs", "pro", "studio", "invoice",
  // Logged-in app
  "app", "dashboard", "artist-dashboard", "enterprise", "subscribe",
  // Admin
  "admin", "admin-dashboard", "leads",
  // Server-owned / build output
  "api", "assets", "stripe-connect", "404",
]);

/** Old Bubble record ID, e.g. "1659533883431x527826980339748400". */
const BUBBLE_ID = /^\d{8,}x\d+$/;

// ─── Static map ───────────────────────────────────────────────────────────────

/**
 * Exact old path → new path. Lower-cased keys; lookup lower-cases the incoming
 * path's first segment, which is also what fixes the `/PRO` casing row.
 */
const STATIC_REDIRECTS: Record<string, string> = {
  // P1 — old Bubble password reset
  "/reset_pw": "/forgot-password",

  // P2 — live links in the artist payout + "Welcome to Artswrk PRO" emails
  "/benefits": "/app/benefits",

  // P2 — old nav items with no equivalent; closest parent rather than a 404
  "/blog": "/",
  "/partners": "/",
  "/map": "/",
  "/contact": "/",
  "/pricing": "/join",

  // P2 — old landing pages folded into one
  "/dance-schools": "/dance-studios",
  "/dance-educators": "/dance-studios",

  // P2 — 2022 "New connection request" email CTA
  "/network": "/app/community",

  // Sheet rows that already redirect client-side — promoted to real 301s so a
  // crawler sees them (the client-side versions in App.tsx stay as a backstop)
  "/signup": "/join",
  "/dashboard": "/app",
  "/artist-dashboard": "/app",

  // P3 — stray external typos
  "/prro": "/pro",
};

/**
 * Old `/app?tab=` values → the new `/app/*` section. These are still going out
 * in live transactional email, so both the singular and plural spellings of the
 * payment tab have to work — "payment" is the one that appears in the wild.
 */
const APP_TAB_ROUTES: Record<string, string> = {
  jobs: "/app/jobs",
  requests: "/app/jobs",
  bookings: "/app/bookings",
  payment: "/app/payments",
  payments: "/app/payments",
  messages: "/app/messages",
  profile: "/app/profile",
  benefits: "/app/benefits",
  // Not named in the sheet, but they're the remaining real sections and
  // cost nothing to cover.
  overview: "/app",
  home: "/app",
  settings: "/app/settings",
  artists: "/app/artists",
  company: "/app/company",
  lists: "/app/lists",
  community: "/app/community",
  companies: "/app/companies",
};

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * What a matched legacy URL resolves to. Anything other than `static` needs a
 * database lookup to finish, and carries the destination to use when that
 * lookup finds nothing — so a dead ID still lands on a real page.
 */
export type Resolution =
  | { kind: "static"; to: string }
  | { kind: "artist-by-bubble-id"; bubbleId: string; fallback: string }
  | { kind: "artist-by-slug"; slug: string; fallback: string }
  | { kind: "job-by-bubble-id"; bubbleId: string; prefer: "pro" | "standard"; fallback: string };

type Query = Record<string, string | undefined>;

/**
 * Map one old URL onto its new destination, or `null` to leave it alone.
 *
 * `pathname` must be the path only (no query string). Returning `null` means
 * "this is a current route, or nothing we recognise" — the caller passes it
 * through to the SPA untouched.
 */
export function resolveLegacyRoute(pathname: string, query: Query = {}): Resolution | null {
  // Normalise: strip a trailing slash (but keep the root), and lower-case only
  // the FIRST segment. Lower-casing the whole path would corrupt any
  // case-sensitive slug that follows it.
  const raw = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const segments = raw.split("/").slice(1);
  const head = (segments[0] ?? "").toLowerCase();
  const rest = segments.slice(1);
  const path = "/" + [head, ...rest].join("/");

  // ── Old Bubble system URLs: /version-test/* is the Bubble staging prefix ──
  if (head === "version-test") {
    const inner = "/" + rest.join("/");
    const innerResolution = rest.length ? resolveLegacyRoute(inner, query) : null;
    if (innerResolution) {
      // Every /version-test link is a dead Bubble staging URL, so give even the
      // lookup-based results somewhere to land instead of a raw 404.
      return innerResolution.kind === "static" || innerResolution.fallback
        ? innerResolution
        : { ...innerResolution, fallback: "/" };
    }
    return { kind: "static", to: rest.length && isKnownRoute(inner) ? inner : "/" };
  }

  // ── Malformed external links that glued the domain into the path ──
  if (head === "artswrk.com") {
    const inner = "/" + rest.join("/");
    return { kind: "static", to: rest.length && isKnownRoute(inner) ? inner : "/" };
  }

  // ── P2 — "/null/<slug>" (38 recent hits: a JS template literal that
  //        interpolated an undefined value into the URL) ──
  if (head === "null" && rest.length) {
    const inner = "/" + rest.join("/");
    if (isKnownRoute(inner)) return { kind: "static", to: inner };
    return { kind: "artist-by-slug", slug: rest[0], fallback: "/browse" };
  }

  // ── P0 — /book/<bubbleId>. Slug-based /book/<slug> is a real route and is
  //        left alone; only the ~2,762 indexed ID-based ones need a lookup. ──
  if (head === "book" && rest.length === 1 && BUBBLE_ID.test(rest[0])) {
    return { kind: "artist-by-bubble-id", bubbleId: rest[0], fallback: "/browse" };
  }

  // ── P0 — /pro?uid=<bubble job id> (every marketing "Apply Here" CTA) and
  //        /jobs?uid=<bubble job id> (Jobs Drop campaigns).
  //        The uid identifies one specific job; without this it's dropped and
  //        the recipient lands on an undifferentiated list. ──
  if ((head === "pro" || head === "jobs") && rest.length === 0 && query.uid) {
    return {
      kind: "job-by-bubble-id",
      bubbleId: query.uid,
      // A uid filed under the wrong path still resolves — we just try the
      // table matching the path it arrived on first.
      prefer: head === "pro" ? "pro" : "standard",
      fallback: head === "pro" ? "/pro" : "/jobs",
    };
  }

  // ── P0 — /app?tab=X&subtab=Y. Live payout email still links to
  //        /app?tab=payment; today the param is ignored and the user is
  //        dumped on Overview. ──
  if (head === "app" && rest.length === 0 && query.tab) {
    const to = APP_TAB_ROUTES[query.tab.toLowerCase()];
    if (to && to !== "/app") return { kind: "static", to };
    return null;
  }

  // ── P2 — old homepage query links ──
  if (path === "/") {
    if (query.action?.toLowerCase() === "join") return { kind: "static", to: "/join" };
    if (query.section?.toLowerCase() === "artist") return { kind: "static", to: "/browse" };
    return null;
  }

  // ── P1 — /universities + its 66 slugs. None rebuilt on the new site yet, so
  //        they go to the homepage for now; rebuild is a post-launch call. ──
  if (head === "universities") return { kind: "static", to: "/" };

  // ── P3 — /artists/<slug> was never a route here; it's /book/<slug> ──
  if (head === "artists" && rest.length === 1) {
    return { kind: "artist-by-slug", slug: rest[0], fallback: "/browse" };
  }

  // ── Exact static map ──
  const staticTarget = STATIC_REDIRECTS[path];
  if (staticTarget) return { kind: "static", to: staticTarget };

  // ── /dashboard/* → /app/* (old app links) ──
  if (head === "dashboard" && rest.length) {
    return { kind: "static", to: "/app/" + rest.join("/") };
  }

  // ── Casing: /PRO → /pro, /Jobs/foo-12 → /jobs/foo-12 ──
  if (path !== raw && isKnownRoute(path)) return { kind: "static", to: path };

  // ── P1 — root vanity URLs (/ramitaravi), the top current 404s. Last resort:
  //        a single unknown segment that could be an artist's handle. ──
  if (
    segments.length === 1 &&
    head &&
    !KNOWN_TOP_LEVEL_SEGMENTS.has(head) &&
    !head.includes(".") &&
    /^[a-z0-9][a-z0-9._-]*$/.test(head)
  ) {
    // No fallback destination: an unrecognised handle is genuinely not a page,
    // so it falls through to a real 404 rather than a misleading redirect.
    return { kind: "artist-by-slug", slug: head, fallback: "" };
  }

  return null;
}

/** True when the path's first segment belongs to a route the site actually serves. */
export function isKnownRoute(pathname: string): boolean {
  const head = pathname.split("/")[1]?.toLowerCase() ?? "";
  return KNOWN_TOP_LEVEL_SEGMENTS.has(head);
}

/**
 * Pathname out of a raw request URL.
 *
 * Needed because the SPA fallback is mounted as `app.use("*", ...)`, and
 * Express rewrites `req.url` to "/" for a mounted handler — so `req.path`
 * there is always "/" and only `req.originalUrl` still carries the real path.
 */
export function pathnameFromUrl(originalUrl: string): string {
  const queryStart = originalUrl.search(/[?#]/);
  const pathname = queryStart === -1 ? originalUrl : originalUrl.slice(0, queryStart);
  return pathname || "/";
}

/**
 * HTTP status the SPA shell should be served with.
 *
 * P3 row of the sheet: today every unknown route returns 200 with the NotFound
 * component, which tells Google the junk URL is a real page and makes any
 * crawl audit meaningless. A real 404 status still renders the same HTML — it
 * just stops claiming the page exists.
 */
export function statusForPath(pathname: string): 200 | 404 {
  return isKnownRoute(pathname) ? 200 : 404;
}

// ─── Database-backed lookups ──────────────────────────────────────────────────

/**
 * Mirror of `slugify` in client/src/pages/JobDetail.tsx. Duplicated rather than
 * imported because that module pulls in React; the two must stay in step or a
 * redirect will land on a non-canonical URL for the same job.
 */
function slugify(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Resolved destinations, memoised.
 *
 * The /book/<bubbleId> pattern alone covers ~2,762 indexed URLs, and a crawler
 * works through them in bursts. `users.bubbleId` has no index (see the handoff
 * note), so without this each hit is a table scan. Values are stable — a
 * Bubble ID's artist never changes — so a plain bounded map is enough; `null`
 * is cached too, since a dead ID is exactly what gets retried most.
 */
const lookupCache = new Map<string, string | null>();
const LOOKUP_CACHE_MAX = 5000;

function cacheGet(key: string): string | null | undefined {
  return lookupCache.get(key);
}

function cacheSet(key: string, value: string | null): void {
  if (lookupCache.size >= LOOKUP_CACHE_MAX) {
    // Cheapest possible eviction: drop the oldest insert. Map preserves
    // insertion order, so this is FIFO, not LRU — fine for a lookup table
    // whose entries are all equally cheap to recompute.
    const oldest = lookupCache.keys().next().value;
    if (oldest !== undefined) lookupCache.delete(oldest);
  }
  lookupCache.set(key, value);
}

/** Look up the new destination for a resolution that needs the database. */
async function lookupDestination(resolution: Resolution): Promise<string | null> {
  if (resolution.kind === "static") return resolution.to;

  const cacheKey = `${resolution.kind}:${
    resolution.kind === "artist-by-slug" ? resolution.slug : resolution.bubbleId
  }${resolution.kind === "job-by-bubble-id" ? `:${resolution.prefer}` : ""}`;

  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  let destination: string | null = null;
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    // No database configured (or it's down) — fall through to the static
    // fallback rather than erroring out on what is only ever a redirect.
    if (!db) return null;

    const { eq } = await import("drizzle-orm");
    const { users, jobs, premiumJobs } = await import("../drizzle/schema");

    if (resolution.kind === "artist-by-bubble-id") {
      const [row] = await db
        .select({ slug: users.slug })
        .from(users)
        .where(eq(users.bubbleId, resolution.bubbleId))
        .limit(1);
      destination = row?.slug ? `/book/${row.slug}` : null;
    }

    if (resolution.kind === "artist-by-slug") {
      const [row] = await db
        .select({ slug: users.slug })
        .from(users)
        .where(eq(users.slug, resolution.slug))
        .limit(1);
      destination = row?.slug ? `/book/${row.slug}` : null;
    }

    if (resolution.kind === "job-by-bubble-id") {
      const findPro = async () => {
        const [row] = await db
          .select({ id: premiumJobs.id, serviceType: premiumJobs.serviceType })
          .from(premiumJobs)
          .where(eq(premiumJobs.bubbleId, resolution.bubbleId))
          .limit(1);
        // Matches toProJobUrl() in client/src/pages/ProJobDetail.tsx.
        return row ? `/pro/${slugify(row.serviceType ?? "open-position")}-${row.id}` : null;
      };
      const findStandard = async () => {
        const [row] = await db
          .select({ id: jobs.id, slug: jobs.slug })
          .from(jobs)
          .where(eq(jobs.bubbleId, resolution.bubbleId))
          .limit(1);
        if (!row) return null;
        // toJobUrl() prefers the stored slug, so that IS the canonical URL.
        // With no slug, any trailing "-<id>" resolves — extractIdFromSlug only
        // reads the number — so the job still loads correctly.
        return row.slug ? `/jobs/${row.slug}` : `/jobs/job-${row.id}`;
      };

      destination = resolution.prefer === "pro"
        ? (await findPro()) ?? (await findStandard())
        : (await findStandard()) ?? (await findPro());
    }
  } catch (err: any) {
    // A redirect must never take the page down with it.
    console.error("[Redirects] Lookup failed:", err?.message);
    return null;
  }

  cacheSet(cacheKey, destination);
  return destination;
}

// ─── Express middleware ───────────────────────────────────────────────────────

/** First value for a query key, ignoring repeats and array forms. */
function firstValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/**
 * Mount the legacy redirect layer.
 *
 * Must be registered AFTER the API routes (so /api and the webhooks are never
 * inspected) and BEFORE the Vite / static SPA handler, which is a catch-all
 * that would otherwise answer every one of these with the app shell.
 */
export function registerLegacyRedirects(app: import("express").Express): void {
  app.use((req, res, next) => {
    // Redirecting a POST would drop its body, and none of these patterns are
    // ever anything but a followed link.
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const pathname = req.path;

    // Never touch the API surface or anything the dev server owns (Vite serves
    // /src, /@vite, /@fs and /node_modules in development).
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/assets/") ||
      pathname.startsWith("/src/") ||
      pathname.startsWith("/@") ||
      pathname.startsWith("/node_modules/") ||
      pathname.startsWith("/stripe-connect/")
    ) {
      return next();
    }

    const query: Query = {
      uid: firstValue(req.query.uid),
      tab: firstValue(req.query.tab),
      action: firstValue(req.query.action),
      section: firstValue(req.query.section),
    };

    const resolution = resolveLegacyRoute(pathname, query);
    if (!resolution) return next();

    const send = (to: string) => {
      // Guard against a rule that resolves to where we already are.
      if (to === pathname) return next();
      res.redirect(301, to);
    };

    if (resolution.kind === "static") return send(resolution.to);

    lookupDestination(resolution)
      .then(destination => {
        if (destination) return send(destination);
        // Nothing matched. Fall back to the closest real parent page when the
        // rule names one; otherwise pass through to a genuine 404.
        if (resolution.fallback) return send(resolution.fallback);
        return next();
      })
      .catch(next);
  });
}
