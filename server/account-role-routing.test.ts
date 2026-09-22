import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

describe("canonical account-role routing", () => {
  it("routes the app and shared dashboard from userRole-aware helpers", () => {
    const app = read("client/src/App.tsx");
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(app).toContain("isArtistAccount(user as any)");
    expect(layout).toContain("isArtistAccount(artswrkUser)");
  });

  it("filters admin Artist and Client lists using userRole", () => {
    const db = read("server/db.ts");
    expect(db).toContain('eq(users.userRole, "Artist")');
    expect(db).toContain('const conditions = [eq(users.userRole, "Client")]');
  });

  it("rejects plan-tier assignments that conflict with userRole", () => {
    const db = read("server/db.ts");
    expect(db).toContain("assertPlanTierCompatibleWithUserRole");
    expect(db).toContain("planTierMatchesUserRole");
    expect(db).toContain('await assertPlanTierCompatibleWithUserRole(userId, "artist_basic")');
    expect(db).toContain('await assertPlanTierCompatibleWithUserRole(userId, "client_premium")');
  });

  it("scopes Stripe webhook plan updates to the matching account role", () => {
    const server = read("server/_core/index.ts");
    expect(server).toContain('eq(users.userRole, "Artist")');
    expect(server).toContain('eq(users.userRole, "Client")');
  });
});
