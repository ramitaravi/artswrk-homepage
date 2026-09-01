import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../client/src/pages/DanceCompetitions.tsx", import.meta.url),
  "utf8",
);

describe("Dance Competitions live design", () => {
  it("preserves the live hero and inquiry form copy", () => {
    expect(pageSource).toContain("The #1 Platform");
    expect(pageSource).toContain("to Hire Dance");
    expect(pageSource).toContain("Competition Staff");
    expect(pageSource).toContain("Tell us what you need");
    expect(pageSource).toContain("What do you need? (optional)");
    expect(pageSource).toContain("Post your first job in under a minute");
  });

  it("retains the current inquiry email and existing-account handoff", () => {
    expect(pageSource).toContain("trpc.inquiry.submit.useMutation");
    expect(pageSource).toContain('source: "dance-competitions"');
    expect(pageSource).toContain("saveInquiryDraft");
    expect(pageSource).toContain('data.isEnterprise ? "/enterprise?postJob=1" : "/post-job"');
    expect(pageSource).toContain('/login?email=${encodeURIComponent(email.trim())}');
  });

  it("keeps managed logos and the complete live page sections", () => {
    expect(pageSource).toContain("COMPETITION_LOGOS.map");
    expect(pageSource).toContain("Hire Competition Staff");
    expect(pageSource).toContain("One tool to find, hire, and pay artists");
    expect(pageSource).toContain("Frequently Asked Questions");
    expect(pageSource).toContain("Ready to staff your next competition?");
  });

  it("does not restore the stale enterprise dashboard and Judge Experience layout", () => {
    expect(pageSource).not.toContain("BOARD_JOBS");
    expect(pageSource).not.toContain("JudgeTrainingModal");
    expect(pageSource).not.toContain("Hire Dance<br />Competition Staff on");
  });
});
