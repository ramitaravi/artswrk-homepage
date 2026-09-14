import { describe, it, expect } from "vitest";
import { safeNextPath } from "./nav";

describe("safeNextPath", () => {
  it("keeps a path on this site, query string included", () => {
    expect(safeNextPath("/app/bookings/1110001")).toBe("/app/bookings/1110001");
    expect(safeNextPath("/subscribe/pro?next=%2Fapp")).toBe("/subscribe/pro?next=%2Fapp");
  });

  it("has nothing to follow when next is missing", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });

  it("refuses anything that would leave the site", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example/app",
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("refuses control characters browsers strip into a protocol-relative URL", () => {
    expect(safeNextPath("/\t/evil.example")).toBeNull();
    expect(safeNextPath("/\n/evil.example")).toBeNull();
  });
});
