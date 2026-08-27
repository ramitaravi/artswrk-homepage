import { describe, expect, it } from "vitest";
import { toEpochSecond } from "../scripts/final-bubble-reconciliation";

describe("final Bubble reconciliation helpers", () => {
  it("compares source and destination modification timestamps at database precision", () => {
    expect(toEpochSecond("2026-08-27T07:15:12.999Z")).toBe(1787814913);
    expect(toEpochSecond(new Date("2026-08-27T07:15:12.001Z"))).toBe(1787814912);
    expect(toEpochSecond(null)).toBeNull();
  });
});
