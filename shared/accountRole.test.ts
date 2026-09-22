import { describe, expect, it } from "vitest";
import { isArtistAccount, isClientAccount, planTierMatchesUserRole } from "./accountRole";

describe("account role classification", () => {
  it("keeps an explicit Client in the client experience even with a stale artist tier", () => {
    const cynthia = { userRole: "Client", planTier: "artist_basic" };
    expect(isArtistAccount(cynthia)).toBe(false);
    expect(isClientAccount(cynthia)).toBe(true);
    expect(planTierMatchesUserRole(cynthia)).toBe(false);
  });

  it("keeps an explicit Artist in the artist experience even with a stale client tier", () => {
    const artist = { userRole: "Artist", planTier: "client_premium" };
    expect(isArtistAccount(artist)).toBe(true);
    expect(isClientAccount(artist)).toBe(false);
    expect(planTierMatchesUserRole(artist)).toBe(false);
  });

  it("uses planTier only as a fallback for legacy rows without userRole", () => {
    expect(isArtistAccount({ userRole: null, planTier: "artist_pro" })).toBe(true);
    expect(isClientAccount({ userRole: null, planTier: "client_on_demand" })).toBe(true);
    expect(planTierMatchesUserRole({ userRole: null, planTier: "artist_free" })).toBe(true);
  });

  it("recognizes consistent modern records", () => {
    expect(planTierMatchesUserRole({ userRole: "Client", planTier: "client_premium" })).toBe(true);
    expect(planTierMatchesUserRole({ userRole: "Artist", planTier: "artist_basic" })).toBe(true);
  });
});
