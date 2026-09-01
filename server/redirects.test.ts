/**
 * Tests for the legacy Bubble → new-site redirect map (server/redirects.ts).
 *
 * These cover the pure resolution layer only — no database. The rows that need
 * a lookup are asserted down to their intent (which ID, in which table, with
 * which fallback), which is the part that can actually be got wrong.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  resolveLegacyRoute,
  isKnownRoute,
  statusForPath,
  pathnameFromUrl,
  KNOWN_TOP_LEVEL_SEGMENTS,
} from "./redirects";

/** A real Bubble record ID, in the format the old site minted. */
const BUBBLE_ID = "1659533883431x527826980339748400";

describe("P0 — /book/<bubbleId> (~2,762 indexed profiles)", () => {
  it("routes an ID-based profile URL through an artist lookup", () => {
    expect(resolveLegacyRoute(`/book/${BUBBLE_ID}`)).toEqual({
      kind: "artist-by-bubble-id",
      bubbleId: BUBBLE_ID,
      fallback: "/browse",
    });
  });

  it("leaves slug-based profile URLs alone — /book/:slug is a real route", () => {
    expect(resolveLegacyRoute("/book/ramita-ravi")).toBeNull();
  });

  it("falls back to /browse rather than 404ing on a dead ID", () => {
    const resolution = resolveLegacyRoute(`/book/${BUBBLE_ID}`);
    expect(resolution).toMatchObject({ fallback: "/browse" });
  });
});

describe("P0 — /app?tab=X", () => {
  it.each([
    ["jobs", "/app/jobs"],
    ["bookings", "/app/bookings"],
    ["messages", "/app/messages"],
    ["profile", "/app/profile"],
    ["benefits", "/app/benefits"],
    ["requests", "/app/jobs"],
  ])("maps tab=%s to %s", (tab, to) => {
    expect(resolveLegacyRoute("/app", { tab })).toEqual({ kind: "static", to });
  });

  // The live payout email ("Artswrk Wallet") uses the singular spelling.
  it("accepts both the singular and plural payment tab", () => {
    expect(resolveLegacyRoute("/app", { tab: "payment" })).toEqual({ kind: "static", to: "/app/payments" });
    expect(resolveLegacyRoute("/app", { tab: "payments" })).toEqual({ kind: "static", to: "/app/payments" });
  });

  it("leaves a bare /app alone so the role dispatcher runs", () => {
    expect(resolveLegacyRoute("/app")).toBeNull();
  });

  it("does not redirect a tab that already lands on /app", () => {
    expect(resolveLegacyRoute("/app", { tab: "overview" })).toBeNull();
  });

  it("ignores an unrecognised tab instead of bouncing the user somewhere wrong", () => {
    expect(resolveLegacyRoute("/app", { tab: "nonsense" })).toBeNull();
  });
});

describe("P0 — /pro?uid= and /jobs?uid= (marketing 'Apply Here' CTAs)", () => {
  it("looks a /pro uid up in the premium jobs table first", () => {
    expect(resolveLegacyRoute("/pro", { uid: BUBBLE_ID })).toEqual({
      kind: "job-by-bubble-id",
      bubbleId: BUBBLE_ID,
      prefer: "pro",
      fallback: "/pro",
    });
  });

  it("looks a /jobs uid up in the standard jobs table first", () => {
    expect(resolveLegacyRoute("/jobs", { uid: BUBBLE_ID })).toEqual({
      kind: "job-by-bubble-id",
      bubbleId: BUBBLE_ID,
      prefer: "standard",
      fallback: "/jobs",
    });
  });

  it("leaves the plain list pages alone when there is no uid", () => {
    expect(resolveLegacyRoute("/pro")).toBeNull();
    expect(resolveLegacyRoute("/jobs")).toBeNull();
  });

  it("does not hijack a job detail page that already has a slug", () => {
    expect(resolveLegacyRoute("/pro/choreographer-412")).toBeNull();
    expect(resolveLegacyRoute("/jobs/dance-teacher-nyc-88")).toBeNull();
  });
});

describe("P1/P2 — static rows", () => {
  it.each([
    ["/reset_pw", "/forgot-password"],
    ["/benefits", "/app/benefits"],
    ["/pricing", "/join"],
    ["/contact", "/"],
    ["/blog", "/"],
    ["/partners", "/"],
    ["/map", "/"],
    ["/network", "/app/community"],
    ["/dance-schools", "/dance-studios"],
    ["/dance-educators", "/dance-studios"],
    ["/universities", "/"],
    ["/universities/nyu", "/"],
    ["/signup", "/join"],
    ["/dashboard", "/app"],
    ["/artist-dashboard", "/app"],
    ["/dashboard/messages", "/app/messages"],
    ["/prro", "/pro"],
    ["/artswrk.com/terms", "/terms"],
  ])("redirects %s to %s", (from, to) => {
    expect(resolveLegacyRoute(from)).toEqual({ kind: "static", to });
  });

  it("tolerates a trailing slash", () => {
    expect(resolveLegacyRoute("/pricing/")).toEqual({ kind: "static", to: "/join" });
  });

  it("fixes casing on a real route (/PRO seen in marketing)", () => {
    expect(resolveLegacyRoute("/PRO")).toEqual({ kind: "static", to: "/pro" });
  });

  it("fixes the route segment without touching the slug after it", () => {
    expect(resolveLegacyRoute("/Book/Ramita-Ravi")).toEqual({ kind: "static", to: "/book/Ramita-Ravi" });
  });
});

describe("P2 — homepage query links", () => {
  it("maps ?action=join to /join", () => {
    expect(resolveLegacyRoute("/", { action: "join" })).toEqual({ kind: "static", to: "/join" });
  });

  it("maps ?section=artist to /browse", () => {
    expect(resolveLegacyRoute("/", { section: "artist" })).toEqual({ kind: "static", to: "/browse" });
  });

  it("leaves a plain homepage hit alone", () => {
    expect(resolveLegacyRoute("/")).toBeNull();
    expect(resolveLegacyRoute("/", { action: "something-else" })).toBeNull();
  });
});

describe("P2/P3 — malformed and stray URLs", () => {
  it("unwraps /null/<slug> into an artist lookup", () => {
    expect(resolveLegacyRoute("/null/ramitaravi")).toEqual({
      kind: "artist-by-slug",
      slug: "ramitaravi",
      fallback: "/browse",
    });
  });

  it("unwraps /null/ in front of a real route", () => {
    expect(resolveLegacyRoute("/null/jobs")).toEqual({ kind: "static", to: "/jobs" });
  });

  it("maps /artists/<slug> onto the real profile route", () => {
    expect(resolveLegacyRoute("/artists/ramitaravi")).toEqual({
      kind: "artist-by-slug",
      slug: "ramitaravi",
      fallback: "/browse",
    });
  });

  it("sends old Bubble /version-test/* links somewhere real", () => {
    expect(resolveLegacyRoute("/version-test/reset_pw")).toEqual({ kind: "static", to: "/forgot-password" });
    expect(resolveLegacyRoute("/version-test/jobs")).toEqual({ kind: "static", to: "/jobs" });
    // A handle under the staging prefix still gets a lookup, but unlike a bare
    // vanity URL it falls back to the homepage rather than 404ing.
    expect(resolveLegacyRoute("/version-test/whatever")).toEqual({
      kind: "artist-by-slug",
      slug: "whatever",
      fallback: "/",
    });
    expect(resolveLegacyRoute("/version-test")).toEqual({ kind: "static", to: "/" });
  });

  it("sends old Bubble /version-live/* links somewhere real", () => {
    // This is the prefix real, already-sent Brevo campaigns carry — a recipient
    // clicking one got a hard 404 while only /version-test was handled.
    expect(resolveLegacyRoute("/version-live/app", { tab: "jobs" }))
      .toEqual({ kind: "static", to: "/app/jobs" });
    expect(resolveLegacyRoute("/version-live/jobs")).toEqual({ kind: "static", to: "/jobs" });
    expect(resolveLegacyRoute("/version-live/reset_pw")).toEqual({ kind: "static", to: "/forgot-password" });
    // Unknown tail lands on the homepage rather than 404ing.
    expect(resolveLegacyRoute("/version-live/whatever")).toEqual({
      kind: "artist-by-slug",
      slug: "whatever",
      fallback: "/",
    });
    expect(resolveLegacyRoute("/version-live")).toEqual({ kind: "static", to: "/" });
  });
});

describe("P1 — root vanity URLs", () => {
  it("treats a bare unknown segment as a possible artist handle", () => {
    expect(resolveLegacyRoute("/ramitaravi")).toEqual({
      kind: "artist-by-slug",
      slug: "ramitaravi",
      fallback: "",
    });
  });

  it("has no fallback — an unknown handle is a real 404, not a fake redirect", () => {
    expect(resolveLegacyRoute("/definitely-not-an-artist")).toMatchObject({ fallback: "" });
  });

  it("never swallows a real top-level route", () => {
    for (const segment of KNOWN_TOP_LEVEL_SEGMENTS) {
      if (!segment) continue;
      const resolution = resolveLegacyRoute(`/${segment}`);
      expect(resolution === null || resolution.kind === "static").toBe(true);
    }
  });

  it("ignores anything that looks like a static file", () => {
    expect(resolveLegacyRoute("/favicon.ico")).toBeNull();
    expect(resolveLegacyRoute("/robots.txt")).toBeNull();
    expect(resolveLegacyRoute("/sitemap.xml")).toBeNull();
  });
});

describe("P3 — soft 404s", () => {
  it("returns 404 for a route that does not exist", () => {
    expect(statusForPath("/definitely-not-a-page")).toBe(404);
  });

  it("returns 200 for real routes", () => {
    for (const p of ["/", "/jobs", "/book/ramita-ravi", "/app/payments", "/leads/crm", "/enterprise/12"]) {
      expect(statusForPath(p)).toBe(200);
    }
  });

  it("pulls the pathname off a URL that still has its query string", () => {
    expect(pathnameFromUrl("/book/x?y=1")).toBe("/book/x");
    expect(pathnameFromUrl("/jobs")).toBe("/jobs");
    expect(pathnameFromUrl("/")).toBe("/");
  });
});

/**
 * Drift guard. KNOWN_TOP_LEVEL_SEGMENTS decides both which vanity URLs get an
 * artist lookup and which paths return a real 404 — so a route added to
 * App.tsx without being added here would start 404ing a live page. This reads
 * the router and fails if that happens.
 */
describe("route list stays in sync with App.tsx", () => {
  it("covers every top-level route declared in the client router", () => {
    const appTsx = fs.readFileSync(
      path.resolve(import.meta.dirname, "..", "client", "src", "App.tsx"),
      "utf-8"
    );

    const declared = new Set<string>();
    for (const match of appTsx.matchAll(/<Route\s+path="\/([^"/]*)/g)) {
      declared.add(match[1].toLowerCase());
    }

    const missing = [...declared].filter(s => !KNOWN_TOP_LEVEL_SEGMENTS.has(s));
    expect(missing, `Add these to KNOWN_TOP_LEVEL_SEGMENTS in server/redirects.ts: ${missing.join(", ")}`).toEqual([]);
  });
});
