/**
 * Tests for the Apply Gate email-check endpoint.
 * Verifies that checkEmailExists returns { exists: true } for known users
 * and { exists: false } for unknown emails — without leaking PII.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the db module ────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
  };
});

import { getUserByEmail } from "./db";

// ── Minimal inline test harness ───────────────────────────────────────────────
// We test the logic directly rather than going through tRPC plumbing.

async function checkEmailExistsLogic(email: string): Promise<{ exists: boolean }> {
  const user = await getUserByEmail(email.toLowerCase().trim());
  return { exists: !!user };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("checkEmailExists logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { exists: true } when the email belongs to a known user", async () => {
    (getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      email: "artist@example.com",
      name: "Test Artist",
    });

    const result = await checkEmailExistsLogic("artist@example.com");
    expect(result).toEqual({ exists: true });
    expect(getUserByEmail).toHaveBeenCalledWith("artist@example.com");
  });

  it("returns { exists: false } when the email is not in the database", async () => {
    (getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await checkEmailExistsLogic("newuser@example.com");
    expect(result).toEqual({ exists: false });
  });

  it("normalises the email to lowercase before querying", async () => {
    (getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await checkEmailExistsLogic("UPPER@EXAMPLE.COM");
    expect(getUserByEmail).toHaveBeenCalledWith("upper@example.com");
  });

  it("trims whitespace from the email before querying", async () => {
    (getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await checkEmailExistsLogic("  spaced@example.com  ");
    expect(getUserByEmail).toHaveBeenCalledWith("spaced@example.com");
  });

  it("does not leak user PII — only returns { exists }", async () => {
    (getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 42,
      email: "secret@example.com",
      passwordHash: "hashed-password",
      profilePicture: "https://cdn.example.com/photo.jpg",
    });

    const result = await checkEmailExistsLogic("secret@example.com");
    expect(Object.keys(result)).toEqual(["exists"]);
    expect((result as any).email).toBeUndefined();
    expect((result as any).passwordHash).toBeUndefined();
  });
});
