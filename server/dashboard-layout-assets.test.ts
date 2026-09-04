import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../client/src/components/DashboardLayout.tsx", import.meta.url),
  "utf8",
);

describe("dashboard layout assets", () => {
  it("uses managed storage for both Artswrk sidebar logos", () => {
    expect(source).toContain("/manus-storage/artswrk-orange_928de736.png");
    expect(source).toContain("/manus-storage/artswrk-pink_904a2428.png");
  });

  it("does not depend on the removed app.artswrk.com domain", () => {
    expect(source).not.toContain("https://app.artswrk.com/logos/");
  });
});
