import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HOME_FAQS } from "../client/src/data/homepageFaqs";
import {
  buildHomepageAuthDestination,
  HOMEPAGE_JOB_DRAFT_KEY,
} from "../client/src/lib/homepageSignup";

describe("homepage signup handoff", () => {
  it("routes an existing hirer to a prefilled login and returns to post a job", () => {
    expect(buildHomepageAuthDestination({
      email: "  Client@Example.COM ",
      role: "client",
      exists: true,
    })).toBe("/login?email=client%40example.com&role=client&next=%2Fpost-job");
  });

  it("routes a new hirer to a prefilled client registration and returns to post a job", () => {
    expect(buildHomepageAuthDestination({
      email: "new@example.com",
      role: "client",
      exists: false,
    })).toBe("/join?email=new%40example.com&role=client&next=%2Fpost-job");
    expect(HOMEPAGE_JOB_DRAFT_KEY).toBe("postJobPrefill");
  });

  it("routes artists through the same lookup without sending them to the job-post flow", () => {
    expect(buildHomepageAuthDestination({
      email: "artist@example.com",
      role: "artist",
      exists: true,
    })).toBe("/login?email=artist%40example.com&role=artist&next=%2Fapp");
  });
});

describe("homepage audience FAQs", () => {
  it("contains the complete supplied FAQ sets for hirers and artists", () => {
    expect(HOME_FAQS.hirers.map(item => item.q)).toEqual([
      "Are there fees to hire on Artswrk?",
      "How do payments work?",
      "Do I have to provide tax documentation?",
      "Who are the Artswrk artists?",
    ]);
    expect(HOME_FAQS.artists.map(item => item.q)).toEqual([
      "How do I get booked on Artswrk?",
      "Why do I need to share my rates, location, etc.?",
      "How do payments work?",
      "How do taxes work?",
      "Who are the Artswrk clients?",
    ]);
  });
});

describe("homepage responsive hero and CTA", () => {
  const source = readFileSync(
    new URL("../client/src/pages/Home.tsx", import.meta.url),
    "utf8",
  );

  it("keeps valid responsive hero typography and compact mobile spacing", () => {
    expect(source).not.toContain("fontSize: 'px'");
    expect(source).not.toContain("fontSize: \"px\"");
    expect(source).toContain("text-[clamp(46px,13vw,56px)]");
    expect(source).toContain("gap-5 px-5 pt-32 sm:gap-9");
  });

  it("keeps both final CTA buttons full-width on mobile", () => {
    expect(source.match(/w-full items-center justify-center rounded-full/g)).toHaveLength(2);
    expect(source.match(/sm:w-\[140px\]/g)).toHaveLength(2);
  });

  it("uses the requested artist signup headline and button copy", () => {
    expect(source).toContain('"Get Hired on Artswrk!"');
    expect(source).toContain('"Join Now →"');
  });
});

describe("homepage search metadata", () => {
  const homeSource = readFileSync(
    new URL("../client/src/pages/Home.tsx", import.meta.url),
    "utf8",
  );
  const htmlSource = readFileSync(
    new URL("../client/index.html", import.meta.url),
    "utf8",
  );

  it("uses the requested hiring and job-search headings", () => {
    expect(homeSource).toContain("on Artswrk");
    expect(homeSource).toContain(
      "Hire Dance Teachers, Dance Competition Staff, Photographers, Videographers and more on Artswrk.",
    );
    expect(homeSource).toContain("ballet teachers and choreographers");
    expect(homeSource).toContain("dance teacher jobs, competition jobs, judging jobs");
  });

  it("keeps the title and description concise while covering both search intents", () => {
    const title = htmlSource.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    const description = htmlSource.match(
      /<meta name="description" content="([^"]+)"/,
    )?.[1] ?? "";

    expect(title).toBe("Hire Artists &amp; Find Performing Arts Jobs | Artswrk");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain("Hire dance teachers");
    expect(description).toContain("performing arts jobs");
  });

  it("uses the supplied homepage tile for Open Graph and Twitter previews", () => {
    const imageUrl = "https://artswrk.com/manus-storage/artswrk-og-home_85a4ee93.png";
    expect(htmlSource).toContain(`<meta property="og:image" content="${imageUrl}"`);
    expect(htmlSource).toContain(`<meta name="twitter:image" content="${imageUrl}"`);
    expect(htmlSource).toContain('<meta property="og:image:width" content="1200"');
    expect(htmlSource).toContain('<meta property="og:image:height" content="630"');
  });

  it("publishes valid Organization, WebSite, and Service structured data", () => {
    const jsonLd = htmlSource.match(
      /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/,
    )?.[1];
    expect(jsonLd).toBeTruthy();

    const graph = JSON.parse(jsonLd!) as { "@graph": Array<{ "@type": string }> };
    expect(graph["@graph"].map(item => item["@type"])).toEqual([
      "Organization",
      "WebSite",
      "Service",
    ]);
  });
});
