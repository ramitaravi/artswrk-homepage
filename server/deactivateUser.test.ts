/**
 * Admin "Deactivate account": who can be deactivated, and who can do it.
 * The scrub itself runs against the database, so here the router is exercised
 * with deactivateUser mocked, and the refusal rules are tested directly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, deactivateUser: vi.fn() };
});

import { appRouter } from "./routers";
import * as db from "./db";
import { deactivationBlocker } from "./db";

const mocked = <T>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const freeArtist = {
  role: "user", openId: "artist-open-id", deactivatedAt: null, planTier: "artist_free",
  artswrkPro: false, artswrkBasic: false, clientPremium: false, enterprisePlan: null,
};

function ctxAs(role: "admin" | "user", id = 1): TrpcContext {
  return {
    user: {
      id, openId: `${role}-open-id`, email: `${role}@example.com`, name: "Test", loginMethod: "local",
      role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("deactivationBlocker", () => {
  it("allows a free account", () => {
    expect(deactivationBlocker(freeArtist)).toBeNull();
  });

  it("refuses an account that is already deactivated", () => {
    expect(deactivationBlocker({ ...freeArtist, deactivatedAt: new Date() })).toMatch(/already deactivated/);
  });

  it("refuses an admin", () => {
    expect(deactivationBlocker({ ...freeArtist, role: "admin" })).toMatch(/admin access/);
  });

  it.each([
    ["a paid plan tier", { planTier: "artist_pro" }],
    ["a PRO flag", { artswrkPro: true }],
    ["a Basic flag", { artswrkBasic: true }],
    ["client Premium", { planTier: "client_on_demand", clientPremium: true }],
    ["an enterprise subscription", { planTier: "enterprise_on_demand", enterprisePlan: "subscriber" }],
  ])("refuses %s so Stripe doesn't keep charging", (_label, overrides) => {
    expect(deactivationBlocker({ ...freeArtist, ...overrides })).toMatch(/paid plan/);
  });
});

describe("admin.deactivateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked(db.deactivateUser).mockResolvedValue({ ok: true });
  });

  it("deactivates when an admin confirms", async () => {
    const caller = appRouter.createCaller(ctxAs("admin"));
    await expect(caller.admin.deactivateUser({ userId: 42, confirm: "DEACTIVATE" })).resolves.toEqual({ success: true });
    expect(db.deactivateUser).toHaveBeenCalledWith(42, "admin@example.com");
  });

  it("rejects non-admins", async () => {
    const caller = appRouter.createCaller(ctxAs("user"));
    await expect(caller.admin.deactivateUser({ userId: 42, confirm: "DEACTIVATE" })).rejects.toThrow(/admin only/);
    expect(db.deactivateUser).not.toHaveBeenCalled();
  });

  it("rejects an admin deactivating themselves", async () => {
    const caller = appRouter.createCaller(ctxAs("admin", 42));
    await expect(caller.admin.deactivateUser({ userId: 42, confirm: "DEACTIVATE" })).rejects.toThrow(/your own account/);
  });

  it("requires the typed confirmation", async () => {
    const caller = appRouter.createCaller(ctxAs("admin"));
    await expect(caller.admin.deactivateUser({ userId: 42, confirm: "yes" as any })).rejects.toThrow();
    expect(db.deactivateUser).not.toHaveBeenCalled();
  });

  it("surfaces why an account can't be deactivated", async () => {
    mocked(db.deactivateUser).mockResolvedValue({ ok: false, reason: "This account is on a paid plan." });
    const caller = appRouter.createCaller(ctxAs("admin"));
    await expect(caller.admin.deactivateUser({ userId: 42, confirm: "DEACTIVATE" })).rejects.toThrow(/paid plan/);
  });
});
