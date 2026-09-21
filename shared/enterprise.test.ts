import { describe, it, expect } from "vitest";
import {
  canAccessEnterpriseJobApplicants,
  enterpriseFollowUpApplyLink,
  isEnterpriseAccount,
  visibleProJobApplyFields,
} from "./enterprise";

describe("isEnterpriseAccount", () => {
  it("recognises both enterprise plans", () => {
    expect(isEnterpriseAccount({ planTier: "enterprise_subscription" })).toBe(true);
    expect(isEnterpriseAccount({ planTier: "enterprise_on_demand" })).toBe(true);
  });
  it("honours the older enterprise flag", () => {
    expect(isEnterpriseAccount({ planTier: null, enterprise: 1 })).toBe(true);
    expect(isEnterpriseAccount({ planTier: null, enterprise: true })).toBe(true);
  });
  it("is false for studios, artists and missing owners", () => {
    expect(isEnterpriseAccount({ planTier: "client_premium", enterprise: 0 })).toBe(false);
    expect(isEnterpriseAccount({ planTier: "artist_pro" })).toBe(false);
    expect(isEnterpriseAccount(null)).toBe(false);
  });
});

describe("canAccessEnterpriseJobApplicants", () => {
  it("allows the owner and Artswrk admins", () => {
    expect(canAccessEnterpriseJobApplicants({ viewerUserId: 10, ownerUserId: 10, isAdmin: false })).toBe(true);
    expect(canAccessEnterpriseJobApplicants({ viewerUserId: 99, ownerUserId: 10, isAdmin: true })).toBe(true);
  });

  it("denies another enterprise account and ownerless jobs", () => {
    expect(canAccessEnterpriseJobApplicants({ viewerUserId: 11, ownerUserId: 10, isAdmin: false })).toBe(false);
    expect(canAccessEnterpriseJobApplicants({ viewerUserId: 11, ownerUserId: null, isAdmin: false })).toBe(false);
  });
});

describe("visibleProJobApplyFields", () => {
  const job = { applyLink: "https://company.test/apply", applyEmail: "jobs@company.test", applyDirect: true };

  it("reveals off-site targets only to PRO viewers of non-enterprise jobs", () => {
    expect(visibleProJobApplyFields(job, { viewerIsPro: true, ownerIsEnterprise: false })).toEqual(job);
  });

  it("redacts targets from non-PRO viewers and enterprise job details", () => {
    expect(visibleProJobApplyFields(job, { viewerIsPro: false, ownerIsEnterprise: false })).toEqual({ applyLink: null, applyEmail: null, applyDirect: false });
    expect(visibleProJobApplyFields(job, { viewerIsPro: true, ownerIsEnterprise: true })).toEqual({ applyLink: null, applyEmail: null, applyDirect: false });
  });
});

describe("enterpriseFollowUpApplyLink", () => {
  it("returns an enterprise form only for an authenticated application response", () => {
    expect(enterpriseFollowUpApplyLink({ applyLink: "https://company.test/form" }, { planTier: "enterprise_subscription" })).toBe("https://company.test/form");
    expect(enterpriseFollowUpApplyLink({ applyLink: "https://company.test/form" }, { planTier: "client_premium" })).toBeNull();
    expect(enterpriseFollowUpApplyLink({ applyLink: "" }, { enterprise: true })).toBeNull();
  });
});
