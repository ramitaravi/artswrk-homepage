import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../client/src/pages/DanceCompetitions.tsx", import.meta.url),
  "utf8",
);

describe("Dance Competitions live design", () => {
  it("preserves the correct GitHub redesign hero and enterprise inquiry form", () => {
    expect(pageSource).toContain("Hire Dance<br />Competition Staff on");
    expect(pageSource).toContain("Post Your Competition Job");
    expect(pageSource).toContain("Competition Name");
    expect(pageSource).toContain("Job Description");
    expect(pageSource).not.toContain("The #1 Platform");
    expect(pageSource).not.toContain("Tell us what you need");
  });

  it("retains the current inquiry email and existing-account handoff", () => {
    expect(pageSource).toContain("trpc.inquiry.submit.useMutation");
    expect(pageSource).toContain('source: "dance-competitions"');
    expect(pageSource).toContain("saveInquiryDraft");
    expect(pageSource).toContain('data.isEnterprise ? "/enterprise?postJob=1" : "/post-job"');
    expect(pageSource).toContain('/login?email=${encodeURIComponent(email.trim())}');
  });

  it("keeps managed assets and the complete GitHub redesign sections", () => {
    expect(pageSource).toContain("COMPETITION_LOGOS.map");
    expect(pageSource).toContain("How it WRKs");
    expect(pageSource).toContain("The Judge Experience");
    expect(pageSource).toContain("Train My Staff");
    expect(pageSource).toContain("Frequently Asked Questions");
    expect(pageSource).toContain("Ready to staff your next competition?");
    expect(pageSource).toContain("/manus-storage/dance-competition-dancer_4c9a27e5.png");
    expect(pageSource).toContain("/manus-storage/dance-competition-imagine_d2ac6e89.png");
    expect(pageSource).toContain("/manus-storage/judge-experience-bg_9e9b0dc6.png");
    expect(pageSource).toContain("/manus-storage/judge-experience-card_e60a685f.png");
  });

  it("locks the correct GitHub redesign against the mistaken historical-layout restore", () => {
    expect(pageSource).toContain("BOARD_JOBS");
    expect(pageSource).toContain("JudgeTrainingModal");
    expect(pageSource).toContain("Hire Dance<br />Competition Staff on");
  });
});
