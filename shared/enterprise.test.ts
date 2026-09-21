import { describe, it, expect } from "vitest";
import { isEnterpriseAccount } from "./enterprise";

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
