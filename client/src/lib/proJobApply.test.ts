import { describe, it, expect } from "vitest";
import { externalApplyTarget, followUpApplyLink } from "./proJobApply";

describe("externalApplyTarget", () => {
  it("never sends an enterprise account's applicants off-site", () => {
    // Journey: Paylocity link. Thunderstruck: an email. Both must apply on Artswrk.
    expect(externalApplyTarget({ ownerIsEnterprise: true, applyLink: "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4350679" })).toBeNull();
    expect(externalApplyTarget({ ownerIsEnterprise: true, applyEmail: "tiffany@thunderstruckdance.com" })).toBeNull();
  });

  it("keeps link-out for jobs not owned by an enterprise account", () => {
    expect(externalApplyTarget({ applyLink: "https://www.miamicityballet.org/about/careers/" })).toBe("https://www.miamicityballet.org/about/careers/");
    expect(externalApplyTarget({ applyEmail: "jobs@studio.com" })).toBe("mailto:jobs@studio.com");
  });

  it("ignores Artswrk aliases and junk in the email field", () => {
    expect(externalApplyTarget({ applyEmail: "contact@artswrk.com" })).toBeNull();
    expect(externalApplyTarget({ applyEmail: "Several emails - Nick" })).toBeNull();
    expect(externalApplyTarget({})).toBeNull();
  });
});

describe("followUpApplyLink", () => {
  it("offers an enterprise's own form as a step after applying on Artswrk", () => {
    const link = "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4350679";
    expect(followUpApplyLink({ ownerIsEnterprise: true, applyLink: link })).toBe(link);
  });
  it("is null without a link, or for non-enterprise jobs (they link out instead)", () => {
    expect(followUpApplyLink({ ownerIsEnterprise: true })).toBeNull();
    expect(followUpApplyLink({ ownerIsEnterprise: false, applyLink: "https://x.com/apply" })).toBeNull();
  });
});
