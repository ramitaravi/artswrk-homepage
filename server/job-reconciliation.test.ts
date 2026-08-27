import { describe, expect, it } from "vitest";
import {
  bubbleBoolean,
  limitJobText,
  parseBubbleLocation,
  safeJobNumber,
  serializeBubbleList,
} from "../scripts/sync-jobs-once";

describe("standard job reconciliation helpers", () => {
  it("normalizes scalar fields without inventing values", () => {
    expect(limitJobText("  Active  ", 64)).toBe("Active");
    expect(limitJobText("abcdef", 4)).toBe("abcd");
    expect(safeJobNumber("42.5")).toBe(42.5);
    expect(safeJobNumber("not-a-number")).toBeNull();
  });

  it("preserves Bubble relationship lists as JSON", () => {
    expect(serializeBubbleList(["a", "b"])).toBe('["a","b"]');
    expect(serializeBubbleList([])).toBeNull();
  });

  it("parses Bubble geographic objects and plain locations", () => {
    expect(parseBubbleLocation({ address: "New York, NY", lat: 40.7, lng: -74 })).toEqual({
      address: "New York, NY",
      lat: "40.7",
      lng: "-74",
    });
    expect(parseBubbleLocation("Remote")).toEqual({ address: "Remote", lat: null, lng: null });
  });

  it("only maps explicit Bubble true values to true", () => {
    expect(bubbleBoolean(true)).toBe(1);
    expect(bubbleBoolean(false)).toBe(0);
    expect(bubbleBoolean(undefined)).toBe(0);
  });
});
