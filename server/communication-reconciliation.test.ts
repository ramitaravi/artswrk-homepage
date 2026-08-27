import { describe, expect, it } from "vitest";
import { communicationText, unreadMessages } from "../scripts/sync-communications-once";

describe("communication reconciliation helpers", () => {
  it("preserves source identifiers with length bounds", () => {
    expect(communicationText("  user-123  ", 64)).toBe("user-123");
    expect(communicationText("abcdef", 4)).toBe("abcd");
    expect(communicationText(null, 4)).toBeNull();
  });

  it("normalizes unread counts safely", () => {
    expect(unreadMessages("3")).toBe(3);
    expect(unreadMessages(-2)).toBe(0);
    expect(unreadMessages("bad")).toBe(0);
  });
});
