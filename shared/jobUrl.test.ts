/**
 * Every job URL has to end in the job's id, because that is what JobDetail
 * looks the job up by. A URL without it is a 404 no matter how it reads.
 */
import { describe, it, expect } from "vitest";
import { jobPath, jobUrl, buildJobSlug, slugifyTitle } from "./jobUrl";

/** The parser JobDetail actually uses. */
const extractIdFromSlug = (slug: string) => {
  const m = slug.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

describe("jobPath", () => {
  it("uses a stored slug when there is one", () => {
    expect(jobPath({ id: 1, slug: "hip-hop-instructor-1", title: "Hip Hop" })).toBe("/jobs/hip-hop-instructor-1");
  });

  it("still resolves when the slug is null — Kennedi Tillman's job", () => {
    const path = jobPath({ id: 2820001, slug: null, title: "After School Dance Instructor" });
    expect(path).toBe("/jobs/after-school-dance-instructor-2820001");
    expect(extractIdFromSlug(path.replace("/jobs/", ""))).toBe(2820001);
  });

  it("resolves even with no title at all", () => {
    const path = jobPath({ id: 999, slug: null, title: null });
    expect(extractIdFromSlug(path.replace("/jobs/", ""))).toBe(999);
  });

  it("never produces the strings the old fallbacks did", () => {
    const path = jobPath({ id: 42, slug: null, title: "Teacher" });
    expect(path).not.toContain("null");
    expect(path).not.toBe("/jobs");
  });
});

describe("jobUrl", () => {
  it("is absolute and has no double slash", () => {
    expect(jobUrl({ id: 7, slug: "x-7" }, "https://artswrk.com/")).toBe("https://artswrk.com/jobs/x-7");
  });
});

describe("buildJobSlug", () => {
  it("ends in the id so the stored slug resolves too", () => {
    expect(buildJobSlug("After School Dance Instructor", 2820001)).toBe("after-school-dance-instructor-2820001");
    expect(extractIdFromSlug(buildJobSlug("", 55))).toBe(55);
  });

  it("strips punctuation and accents of apostrophes", () => {
    expect(slugifyTitle("Kid's Hip-Hop & Jazz!")).toBe("kids-hip-hop-jazz");
  });
});

describe("legacy Bubble slugs", () => {
  // 489 jobs carried slugs like "queens-based-dance-studio-" — trailing
  // hyphen, no id. The detail page resolves by the trailing id, so linking
  // off these sent people to "job not found".
  it("does not trust a slug with no id on the end", () => {
    const path = jobPath({ id: 90186, slug: "queens-based-dance-studio-", title: "Queens Based Dance Studio" });
    expect(path).toBe("/jobs/queens-based-dance-studio-90186");
    expect(extractIdFromSlug(path.replace("/jobs/", ""))).toBe(90186);
  });

  it("still trusts a well-formed stored slug", () => {
    expect(jobPath({ id: 4800001, slug: "dance-teacher-4800001", title: "Dance Teacher" }))
      .toBe("/jobs/dance-teacher-4800001");
  });
});
