import { describe, expect, it } from "vitest";
import {
  limitPremiumText,
  normalizeCompanyName,
  normalizePremiumLogo,
  parsePremiumLocation,
  serializePremiumApplicants,
} from "../scripts/sync-premium-jobs-once";

describe("premium-job reconciliation helpers", () => {
  it("normalizes URLs and bounded text", () => {
    expect(normalizePremiumLogo("//cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    expect(limitPremiumText("abcdef", 4)).toBe("abcd");
    expect(normalizeCompanyName("  Example   Dance Co. ")).toBe("example dance co.");
  });

  it("preserves Bubble location coordinates", () => {
    expect(parsePremiumLocation({ address: "Boston, MA", lat: 42.36, lng: -71.06 })).toEqual({
      address: "Boston, MA",
      lat: "42.36",
      lng: "-71.06",
    });
  });

  it("preserves the source applicant list as JSON", () => {
    expect(serializePremiumApplicants(["a", "b"])).toBe('["a","b"]');
    expect(serializePremiumApplicants([])).toBeNull();
  });
});
