import { describe, expect, it } from "vitest";
import { DEFAULT_META, getRouteMeta, injectRouteMeta } from "./seoMeta";

const HTML = `<!doctype html>
<html>
  <head>
    <title>Default</title>
    <meta name="description" content="Default description" />
    <link rel="canonical" href="https://artswrk.com/" />
    <meta property="og:url" content="https://artswrk.com/" />
    <meta property="og:title" content="Default" />
    <meta property="og:description" content="Default description" />
    <meta property="og:image" content="https://artswrk.com/default.png" />
    <meta property="og:image:secure_url" content="https://artswrk.com/default.png" />
    <meta property="og:image:alt" content="Default" />
    <meta name="twitter:title" content="Default" />
    <meta name="twitter:description" content="Default description" />
    <meta name="twitter:image" content="https://artswrk.com/default.png" />
    <meta name="twitter:image:alt" content="Default" />
  </head>
</html>`;

describe("server-rendered SEO metadata", () => {
  it("uses the optimized managed homepage image as the default", () => {
    expect(DEFAULT_META.title).toBe("Hire Artists & Find Performing Arts Jobs | Artswrk");
    expect(DEFAULT_META.image).toBe("manus-storage/artswrk-og-home_85a4ee93.png");
  });

  it("publishes route-specific Dance Competitions metadata for crawlers", () => {
    const result = injectRouteMeta(HTML, "/dance-competitions/");

    expect(result).toContain("<title>Hire Competition Staff | Artswrk</title>");
    expect(result).toContain('<link rel="canonical" href="https://artswrk.com/dance-competitions" />');
    expect(result).toContain('<meta property="og:url" content="https://artswrk.com/dance-competitions" />');
    expect(result).toContain("https://artswrk.com/manus-storage/dance-competitions_a12ba7c1.png");
    expect(result).toContain('<meta name="twitter:image:alt" content="Artswrk — Hire Competition Staff." />');
  });

  it("keeps every configured social image in managed storage", () => {
    for (const route of ["/", "/dance-studios", "/dance-competitions", "/music-schools", "/dance-teachers", "/dance-judges", "/jobs", "/browse"]) {
      const meta = getRouteMeta(route);
      expect(meta?.image).toMatch(/^manus-storage\//);
    }
  });

  it("leaves unlisted application routes unchanged", () => {
    expect(injectRouteMeta(HTML, "/app/settings")).toBe(HTML);
  });
});
