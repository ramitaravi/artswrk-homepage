/**
 * Leads Dashboard — Brevo integration tests
 * Validates that the API key is valid and core endpoints are reachable.
 */
import { describe, it, expect } from "vitest";
import { getContacts, getLists, getCampaigns, getOverviewStats } from "./brevo";

describe("Brevo API integration", () => {
  it("should fetch contacts and return a non-zero count", async () => {
    const result = await getContacts({ limit: 1, offset: 0 });
    expect(result).toBeDefined();
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThan(0);
  });

  it("should fetch lists and return a non-zero count", async () => {
    const result = await getLists({ limit: 1, offset: 0 });
    expect(result).toBeDefined();
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThan(0);
  });

  it("should fetch campaigns and return a non-zero count", async () => {
    const result = await getCampaigns({ limit: 1, offset: 0, status: "sent" });
    expect(result).toBeDefined();
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThan(0);
  });

  it("should compute overview stats with valid numeric fields", async () => {
    const stats = await getOverviewStats();
    expect(stats.totalContacts).toBeGreaterThan(0);
    expect(stats.totalLists).toBeGreaterThan(0);
    expect(stats.totalCampaignsSent).toBeGreaterThan(0);
    expect(stats.avgOpenRate).toBeGreaterThanOrEqual(0);
    expect(stats.avgClickRate).toBeGreaterThanOrEqual(0);
  });
});
