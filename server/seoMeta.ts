/**
 * Per-route SEO / Open Graph tags.
 *
 * The app is a SPA: one index.html is served for every route, and any title or
 * og:image set from React lands too late — crawlers, iMessage, Slack and
 * Facebook read the raw HTML and never run the JS. So the tags are rewritten
 * here, server-side, before the document goes out.
 *
 * Only marketing/landing routes are listed. Everything else keeps the defaults
 * baked into client/index.html (the homepage tile).
 */

const SITE = "https://artswrk.com";

export type RouteMeta = {
  title: string;
  description: string;
  /** File in client/public/og. 1200x630. */
  image: string;
  imageAlt: string;
};

export const DEFAULT_META: RouteMeta = {
  title: "Artswrk | Hire Artists, Find WRK",
  description:
    "Jobs for dance teachers, competition staff, musicians, photographers and more. Post a job free, or find work that pays what you're worth.",
  image: "og/home.png",
  imageAlt: "Artswrk — Hire Artists. Find WRK.",
};

/** Exact pathname → meta. Keys are matched case-insensitively, trailing slash ignored. */
export const ROUTE_META: Record<string, RouteMeta> = {
  "/": DEFAULT_META,

  "/dance-studios": {
    title: "Hire Dance Teachers | Artswrk",
    description:
      "Weekly classes, subs, guest artists and choreographers — hire vetted dance teachers for your studio. Post a job free.",
    image: "og/dance-studios.png",
    imageAlt: "Artswrk — Hire Dance Teachers.",
  },

  "/dance-competitions": {
    title: "Hire Competition Staff | Artswrk",
    description:
      "Judges, emcees, tabulators and crew for your dance competition — vetted professionals, booked in minutes.",
    image: "og/dance-competitions.png",
    imageAlt: "Artswrk — Hire Competition Staff.",
  },

  "/music-schools": {
    title: "Hire Music Teachers | Artswrk",
    description:
      "Voice, piano, strings, percussion and more — hire experienced music teachers for your school. Post a job free.",
    image: "og/music-schools.png",
    imageAlt: "Artswrk — Hire Music Teachers.",
  },

  // Artist-facing pages share the pink "Find WRK. Get Paid." tile.
  "/dance-teachers": {
    title: "Dance Teacher Jobs | Artswrk",
    description:
      "Your rate, your schedule — free to join. Find weekly classes, subbing, guest artist and choreography work near you.",
    image: "og/artists.png",
    imageAlt: "Artswrk — Find WRK. Get Paid.",
  },
  "/dance-judges": {
    title: "Dance Judge & Competition Jobs | Artswrk",
    description:
      "Your rate, your schedule — free to join. Find judging, emcee and competition staff work across the country.",
    image: "og/artists.png",
    imageAlt: "Artswrk — Find WRK. Get Paid.",
  },
  "/jobs": {
    title: "Arts Jobs — Teaching, Performing & More | Artswrk",
    description:
      "Browse open jobs for dance teachers, competition staff, musicians, photographers and more. Free to join.",
    image: "og/artists.png",
    imageAlt: "Artswrk — Find WRK. Get Paid.",
  },
  "/browse": {
    title: "Browse Artists | Artswrk",
    description:
      "Thousands of vetted performing arts professionals — dance teachers, judges, emcees, musicians, photographers and more.",
    image: "og/home.png",
    imageAlt: "Artswrk — Hire Artists. Find WRK.",
  },
};

export function getRouteMeta(pathname: string): RouteMeta | null {
  const key = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return ROUTE_META[key] ?? null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rewrite the title/description/OG/Twitter tags in an already-built index.html.
 * Replaces the existing tags rather than appending, so a crawler never sees two
 * competing og:title values.
 */
export function injectRouteMeta(html: string, pathname: string): string {
  const meta = getRouteMeta(pathname);
  if (!meta) return html;

  const url = `${SITE}${pathname.replace(/\/+$/, "") || "/"}`;
  const image = `${SITE}/${meta.image}`;
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const imageAlt = escapeAttr(meta.imageAlt);

  const swaps: [RegExp, string][] = [
    [/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${escapeAttr(url)}" />`],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${description}" />`],
    [/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${escapeAttr(image)}" />`],
    [/<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image:alt" content="${imageAlt}" />`],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${description}" />`],
    [/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${escapeAttr(image)}" />`],
  ];

  return swaps.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), html);
}
