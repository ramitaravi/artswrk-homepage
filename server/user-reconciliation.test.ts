import { describe, expect, it } from "vitest";
import {
  findDemotedAdminIds,
  isSyntheticOpenId,
  limitText,
  normalizeEmail,
  selectCanonicalUser,
} from "../scripts/sync-users-once";

describe("user reconciliation helpers", () => {
  it("normalizes email deterministically", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail(null)).toBe("");
    expect(limitText("  abcdef  ", 4)).toBe("abcd");
  });

  it("identifies Bubble placeholders without treating real OAuth IDs as synthetic", () => {
    expect(isSyntheticOpenId("bubble_123")).toBe(true);
    expect(isSyntheticOpenId("bubble_csv_person@example.com")).toBe(true);
    expect(isSyntheticOpenId("oauth-real-user")).toBe(false);
  });

  it("preserves the strongest login identity as the canonical destination row", () => {
    const canonical = selectCanonicalUser([
      { id: 3, openId: "bubble_123", bubbleId: "123", email: "a@example.com", passwordHash: null, loginMethod: "bubble", role: "user" },
      { id: 2, openId: "oauth-real-user", bubbleId: "123", email: "a@example.com", passwordHash: null, loginMethod: "manus", role: "user" },
      { id: 1, openId: "bubble_csv_a@example.com", bubbleId: "123", email: "a@example.com", passwordHash: "hash", loginMethod: "password", role: "user" },
    ]);

    expect(canonical?.id).toBe(2);
  });

  it("uses a password-bearing placeholder when no real OAuth identity exists", () => {
    const canonical = selectCanonicalUser([
      { id: 4, openId: "bubble_456", bubbleId: "456", email: "b@example.com", passwordHash: null, loginMethod: "bubble", role: "user" },
      { id: 5, openId: "bubble_csv_b@example.com", bubbleId: "456", email: "b@example.com", passwordHash: "hash", loginMethod: "password", role: "user" },
    ]);

    expect(canonical?.id).toBe(5);
  });

  it("detects any administrator demoted or removed during reconciliation", () => {
    const before = [
      { id: 10, role: "admin" as const },
      { id: 11, role: "admin" as const },
      { id: 12, role: "user" as const },
    ];
    const after = [
      { id: 10, role: "admin" as const },
      { id: 11, role: "user" as const },
      { id: 12, role: "user" as const },
    ];

    expect(findDemotedAdminIds(before, after)).toEqual([11]);
    expect(findDemotedAdminIds(before, before)).toEqual([]);
  });
});
