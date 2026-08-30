import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("client job entitlement gates", () => {
  it("uses the centralized unlock helper for client applicant access", () => {
    const routersSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");

    expect(routersSource).not.toMatch(
      /clientPremium\s*\|\|\s*await\s+isClientJobUnlocked/,
    );
    expect(routersSource.match(/await\s+isClientJobUnlocked\(/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it("grants subscription-wide access only through active unified plan tiers", () => {
    const dbSource = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");

    expect(dbSource).toContain('user?.planTier === "client_premium"');
    expect(dbSource).toContain('user?.planTier === "enterprise_subscription"');
    expect(dbSource).not.toMatch(
      /SELECT\s+clientSubscriptionId[^]*isClientJobUnlocked/,
    );
  });
});
