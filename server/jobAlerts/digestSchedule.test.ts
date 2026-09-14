import { describe, it, expect } from "vitest";
import { digestModeFor } from "./digestSchedule";
import { renderProDigest, renderDigest } from "./templates";

const SCHEDULE = JSON.stringify({ "2026-09-15": "pro", "2026-09-16": "jobs" });

describe("digestModeFor", () => {
  it("reads the mode for a scheduled date", () => {
    expect(digestModeFor(SCHEDULE, "2026-09-15")).toBe("pro");
    expect(digestModeFor(SCHEDULE, "2026-09-16")).toBe("jobs");
  });

  it("goes back to normal on any other date", () => {
    expect(digestModeFor(SCHEDULE, "2026-09-17")).toBe("combined");
    expect(digestModeFor(SCHEDULE, "2026-09-14")).toBe("combined");
  });

  it("falls back to normal when the setting is missing, malformed or unknown", () => {
    expect(digestModeFor(null, "2026-09-15")).toBe("combined");
    expect(digestModeFor("not json", "2026-09-15")).toBe("combined");
    expect(digestModeFor(JSON.stringify({ "2026-09-15": "everything" }), "2026-09-15")).toBe("combined");
  });
});

const pro = [1, 2, 3].map((i) => ({
  title: `PRO job ${i}`, company: "Studio", location: "Remote", budget: "$500", excerpt: "Details", applyUrl: `https://artswrk.com/pro/${i}`,
}));
const base = {
  firstName: "Alex", jobs: [], totalMatchCount: 0, proJobs: pro as any,
  jobsUrl: "https://artswrk.com/jobs", preferencesUrl: "https://artswrk.com/app/settings", unsubscribeUrl: "https://artswrk.com/unsubscribe",
};

describe("renderProDigest", () => {
  it("names the PRO job count for members and shows every job's details", () => {
    const { subject, html } = renderProDigest({ ...base, isProMember: true });
    expect(subject).toBe("Artswrk PRO: 3 new PRO jobs for you");
    for (const p of pro) expect(html).toContain(p.title);
    expect(html).toContain("Apply now");
  });

  it("teases the jobs with an upgrade button for everyone else", () => {
    const { subject, html } = renderProDigest({ ...base, isProMember: false });
    expect(subject).toBe("Artswrk: 3 new PRO jobs this week");
    expect(html).toContain("Upgrade to PRO");
    expect(html).not.toContain("Apply now");
  });

  it("never says zero jobs, unlike the regular digest would with no regular jobs", () => {
    expect(renderDigest({ ...base, isProMember: false }).subject).toContain("0 new jobs");
    expect(renderProDigest({ ...base, isProMember: false }).subject).not.toMatch(/\b0\b/);
  });
});
