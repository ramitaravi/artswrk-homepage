import { describe, expect, it } from "vitest";
import {
  applicationKind,
  applicationNumber,
  applicationText,
} from "../scripts/sync-interested-artists-once";

describe("interested-artist reconciliation helpers", () => {
  it("classifies standard, premium, dual, and orphan source records", () => {
    expect(applicationKind({ _id: "1", request: "r1" })).toBe("standard");
    expect(applicationKind({ _id: "2", premiumjob: "p1" })).toBe("premium");
    expect(applicationKind({ _id: "3", request: "r1", premiumjob: "p1" })).toBe("both");
    expect(applicationKind({ _id: "4" })).toBe("orphan");
  });

  it("preserves valid numbers and nulls invalid values", () => {
    expect(applicationNumber("12.5")).toBe(12.5);
    expect(applicationNumber("bad")).toBeNull();
  });

  it("bounds source text without inventing values", () => {
    expect(applicationText("  Interested  ", 64)).toBe("Interested");
    expect(applicationText("abcdef", 4)).toBe("abcd");
    expect(applicationText(null, 4)).toBeNull();
  });
});
