/**
 * Posting a PRO job creates-or-reuses the owner's company by name. Names that
 * differ only in case, spacing or apostrophe style must count as the same
 * company, or each post adds another duplicate.
 */
import { describe, it, expect } from "vitest";
import { normalizeCompanyName } from "./db";

describe("normalizeCompanyName", () => {
  it("matches curly and straight apostrophes", () => {
    expect(normalizeCompanyName("That’s Entertainment")).toBe(normalizeCompanyName("That's Entertainment"));
  });

  it("ignores case and extra or trailing spaces", () => {
    expect(normalizeCompanyName("  THAT'S   entertainment ")).toBe("that's entertainment");
  });

  it("keeps genuinely different names apart", () => {
    expect(normalizeCompanyName("That's Entertainment")).not.toBe(normalizeCompanyName("That's Entertainment PA"));
  });
});
