import { describe, expect, it } from "vitest";
import { benefitArray, benefitLogo, benefitText } from "../scripts/sync-benefits-once";

describe("benefit reconciliation helpers", () => {
  it("preserves eligibility arrays exactly", () => {
    expect(benefitArray(["Artist", "Client"])).toBe('["Artist","Client"]');
    expect(benefitArray("Artist and Client")).toBe('["Artist and Client"]');
    expect(benefitArray([])).toBeNull();
  });

  it("normalizes benefit logos and bounded contact fields", () => {
    expect(benefitLogo("//cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    expect(benefitText("  contact@example.com ", 320)).toBe("contact@example.com");
  });
});
