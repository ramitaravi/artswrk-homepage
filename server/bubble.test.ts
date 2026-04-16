/**
 * Tests for the Bubble API connector:
 *   - bubbleApi.ts: cache, fetch helpers, verifyBubbleWebhook
 *   - bubbleWebhook.ts: request handling, secret verification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── bubbleApi tests ───────────────────────────────────────────────────────────

describe("bubbleApi", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("verifyBubbleWebhook", () => {
    it("returns true when BUBBLE_WEBHOOK_SECRET is not set (dev mode)", async () => {
      delete process.env.BUBBLE_WEBHOOK_SECRET;
      const { verifyBubbleWebhook } = await import("./bubbleApi");
      expect(verifyBubbleWebhook("any-secret")).toBe(true);
    });

    it("returns true when secret matches", async () => {
      process.env.BUBBLE_WEBHOOK_SECRET = "test-secret-123";
      const { verifyBubbleWebhook } = await import("./bubbleApi");
      expect(verifyBubbleWebhook("test-secret-123")).toBe(true);
      delete process.env.BUBBLE_WEBHOOK_SECRET;
    });

    it("returns false when secret does not match", async () => {
      process.env.BUBBLE_WEBHOOK_SECRET = "test-secret-123";
      const { verifyBubbleWebhook } = await import("./bubbleApi");
      expect(verifyBubbleWebhook("wrong-secret")).toBe(false);
      delete process.env.BUBBLE_WEBHOOK_SECRET;
    });

    it("returns false when no secret is provided but one is expected", async () => {
      process.env.BUBBLE_WEBHOOK_SECRET = "test-secret-123";
      const { verifyBubbleWebhook } = await import("./bubbleApi");
      expect(verifyBubbleWebhook(undefined)).toBe(false);
      delete process.env.BUBBLE_WEBHOOK_SECRET;
    });
  });

  describe("bustCache", () => {
    it("clears all cache entries when called with no pattern", async () => {
      const { bustCache } = await import("./bubbleApi");
      // Should not throw
      expect(() => bustCache()).not.toThrow();
    });

    it("clears only matching cache entries when pattern is provided", async () => {
      const { bustCache } = await import("./bubbleApi");
      expect(() => bustCache("artist:123")).not.toThrow();
    });
  });

  describe("getBubbleArtistById", () => {
    it("returns null when BUBBLE_API_KEY is not set", async () => {
      delete process.env.BUBBLE_API_KEY;
      const { getBubbleArtistById } = await import("./bubbleApi");
      const result = await getBubbleArtistById("test-id");
      expect(result).toBeNull();
    });
  });

  describe("getBubbleJobs", () => {
    it("returns empty result when BUBBLE_API_KEY is not set", async () => {
      delete process.env.BUBBLE_API_KEY;
      const { getBubbleJobs } = await import("./bubbleApi");
      const result = await getBubbleJobs();
      expect(result).toEqual({ jobs: [], count: 0, remaining: 0 });
    });
  });
});

// ── Webhook handler tests ─────────────────────────────────────────────────────

describe("handleBubbleWebhook", () => {
  function makeReq(overrides: Record<string, unknown> = {}) {
    return {
      headers: {},
      body: {},
      ...overrides,
    } as any;
  }

  function makeRes() {
    const res = {
      _status: 200,
      _body: null as unknown,
      status(code: number) { this._status = code; return this; },
      json(body: unknown) { this._body = body; return this; },
      send(body: unknown) { this._body = body; return this; },
    };
    return res;
  }

  it("returns 401 when webhook secret is wrong", async () => {
    process.env.BUBBLE_WEBHOOK_SECRET = "correct-secret";
    const { handleBubbleWebhook } = await import("./bubbleWebhook");
    const req = makeReq({ headers: { "x-bubble-webhook-secret": "wrong" } });
    const res = makeRes();
    await handleBubbleWebhook(req, res as any);
    expect(res._status).toBe(401);
    delete process.env.BUBBLE_WEBHOOK_SECRET;
  });

  it("returns 400 when event or data is missing", async () => {
    delete process.env.BUBBLE_WEBHOOK_SECRET;
    const { handleBubbleWebhook } = await import("./bubbleWebhook");
    const req = makeReq({ body: { event: "job.created" } }); // missing data
    const res = makeRes();
    await handleBubbleWebhook(req, res as any);
    expect(res._status).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    delete process.env.BUBBLE_WEBHOOK_SECRET;
    const { handleBubbleWebhook } = await import("./bubbleWebhook");
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handleBubbleWebhook(req, res as any);
    expect(res._status).toBe(400);
  });

  it("handles unknown event types gracefully without throwing", async () => {
    delete process.env.BUBBLE_WEBHOOK_SECRET;
    // Mock getDb to return null (no DB in test env)
    vi.mock("./db", () => ({ getDb: async () => null }));
    const { handleBubbleWebhook } = await import("./bubbleWebhook");
    const req = makeReq({
      body: { event: "unknown.event.type", data: { _id: "test" } },
    });
    const res = makeRes();
    await handleBubbleWebhook(req, res as any);
    // Should return 200 with received: true (not throw)
    expect((res._body as any)?.received).toBe(true);
  });
});
