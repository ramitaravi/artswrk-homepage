/**
 * sitemap.xml + robots.txt
 *
 * The platform-generated sitemap listed 49 hand-written URLs: none of the job
 * detail pages (the only large, genuinely indexable content class), and it DID
 * list /admin, /admin-dashboard, /leads/*, /app/* and the auth pages — private
 * routes that should never be submitted to a search engine. This replaces it
 * with one generated from the database, so job pages are covered and nothing
 * behind a login is advertised.
 */
import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const SITE = "https://artswrk.com";

/** Public marketing/content routes. Nothing here may require a session. */
const STATIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/jobs", priority: "0.9", changefreq: "daily" },
  { path: "/browse", priority: "0.8", changefreq: "daily" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
  { path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  { path: "/cancellation-policy", priority: "0.3", changefreq: "yearly" },
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod: string | null, changefreq: string, priority: string): string {
  return (
    "  <url>\n" +
    `    <loc>${xmlEscape(loc)}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    "  </url>\n"
  );
}

export async function buildSitemap(): Promise<string> {
  const entries: string[] = STATIC_PATHS.map((s) =>
    urlEntry(`${SITE}${s.path}`, null, s.changefreq, s.priority)
  );

  const db = await getDb();
  if (db) {
    // Only jobs that are actually reachable — the same Active/Confirmed pair
    // the public board and jobs.getDetail allow. Listing an archived job would
    // hand Google a URL that now correctly 404s.
    const rows: any = await db.execute(sql`
      SELECT id, slug, GREATEST(COALESCE(updatedAt, createdAt), createdAt) AS lastmod
      FROM jobs
      WHERE requestStatus IN ('Active', 'Confirmed')
      ORDER BY id DESC
      LIMIT 5000
    `);
    for (const job of (rows[0] as any[]) ?? []) {
      const loc = `${SITE}/jobs/${job.slug || job.id}`;
      const lastmod = job.lastmod ? new Date(job.lastmod).toISOString().slice(0, 10) : null;
      entries.push(urlEntry(loc, lastmod, "weekly", "0.7"));
    }
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join("") +
    "</urlset>\n"
  );
}

export function registerSitemap(app: Express): void {
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const xml = await buildSitemap();
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      console.error("[sitemap] Failed to build:", err);
      res.status(500).send("sitemap unavailable");
    }
  });

  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(
      [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /admin-dashboard",
        "Disallow: /app/",
        "Disallow: /dashboard",
        "Disallow: /leads",
        "Disallow: /login",
        "Disallow: /join",
        "Disallow: /reset-password",
        "Disallow: /api/",
        "",
        `Sitemap: ${SITE}/sitemap.xml`,
        "",
      ].join("\n")
    );
  });
}
