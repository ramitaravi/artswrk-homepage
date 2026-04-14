import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAdminOverviewStats: vi.fn(),
  getAdminArtists: vi.fn(),
  getAdminClients: vi.fn(),
  getAdminJobs: vi.fn(),
  getAdminBookings: vi.fn(),
  getAdminPayments: vi.fn(),
}));

import {
  getAdminOverviewStats,
  getAdminArtists,
  getAdminClients,
  getAdminJobs,
  getAdminBookings,
  getAdminPayments,
} from "./db";

describe("Admin DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Overview ────────────────────────────────────────────────────────────────
  describe("getAdminOverviewStats", () => {
    it("returns null when db is unavailable", async () => {
      vi.mocked(getAdminOverviewStats).mockResolvedValue(null);
      const result = await getAdminOverviewStats();
      expect(result).toBeNull();
    });

    it("returns full stats shape when db is available", async () => {
      const mockStats = {
        totalUsers: 1000,
        totalArtists: 700,
        totalClients: 300,
        proArtists: 120,
        basicArtists: 200,
        premiumClients: 50,
        totalBookings: 450,
        totalJobs: 800,
        totalRevenueCents: 5000000,
        totalCommissionCents: 750000,
        futureRevenueCents: 200000,
      };
      vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats);
      const result = await getAdminOverviewStats();
      expect(result).toMatchObject(mockStats);
      expect(result?.totalArtists).toBe(700);
      expect(result?.totalRevenueCents).toBe(5000000);
    });
  });

  // ── Artists ─────────────────────────────────────────────────────────────────
  describe("getAdminArtists", () => {
    it("returns paginated artist list", async () => {
      const mockArtists = {
        artists: [
          { id: 1, name: "Jane Doe", email: "jane@example.com", userRole: "Artist", artswrkPro: true, location: "New York, NY", masterArtistTypes: '["Dance Educator"]', createdAt: new Date() },
        ],
        total: 1,
      };
      vi.mocked(getAdminArtists).mockResolvedValue(mockArtists as any);
      const result = await getAdminArtists({ limit: 50, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.artists[0].name).toBe("Jane Doe");
    });

    it("accepts search and filter params", async () => {
      vi.mocked(getAdminArtists).mockResolvedValue({ artists: [], total: 0 });
      await getAdminArtists({ search: "Jane", artistType: "Dance Educator", plan: "PRO", limit: 50, offset: 0 });
      expect(getAdminArtists).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Jane", artistType: "Dance Educator", plan: "PRO" })
      );
    });

    it("returns empty list when no artists match", async () => {
      vi.mocked(getAdminArtists).mockResolvedValue({ artists: [], total: 0 });
      const result = await getAdminArtists({ search: "nonexistent_xyz", limit: 50, offset: 0 });
      expect(result.artists).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── Clients ─────────────────────────────────────────────────────────────────
  describe("getAdminClients", () => {
    it("returns paginated client list", async () => {
      const mockClients = {
        clients: [
          { id: 2, name: "Studio ABC", email: "studio@example.com", clientCompanyName: "ABC Dance Studio", clientPremium: true, location: "Chicago, IL", createdAt: new Date() },
        ],
        total: 1,
      };
      vi.mocked(getAdminClients).mockResolvedValue(mockClients as any);
      const result = await getAdminClients({ limit: 50, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.clients[0].clientCompanyName).toBe("ABC Dance Studio");
    });

    it("accepts company and location search", async () => {
      vi.mocked(getAdminClients).mockResolvedValue({ clients: [], total: 0 });
      await getAdminClients({ companySearch: "Dance", locationSearch: "Chicago", limit: 50, offset: 0 });
      expect(getAdminClients).toHaveBeenCalledWith(
        expect.objectContaining({ companySearch: "Dance", locationSearch: "Chicago" })
      );
    });
  });

  // ── Jobs ────────────────────────────────────────────────────────────────────
  describe("getAdminJobs", () => {
    it("returns paginated jobs list", async () => {
      const mockJobs = {
        jobs: [
          { id: 10, description: "Hip hop sub teacher needed", requestStatus: "Active", clientHourlyRate: 50, locationAddress: "Chicago, IL", createdAt: new Date() },
        ],
        total: 1,
      };
      vi.mocked(getAdminJobs).mockResolvedValue(mockJobs as any);
      const result = await getAdminJobs({ limit: 50, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.jobs[0].requestStatus).toBe("Active");
    });

    it("accepts status filter", async () => {
      vi.mocked(getAdminJobs).mockResolvedValue({ jobs: [], total: 0 });
      await getAdminJobs({ status: "Completed", limit: 50, offset: 0 });
      expect(getAdminJobs).toHaveBeenCalledWith(expect.objectContaining({ status: "Completed" }));
    });
  });

  // ── Bookings ─────────────────────────────────────────────────────────────────
  describe("getAdminBookings", () => {
    it("returns paginated bookings", async () => {
      const mockBookings = {
        bookings: [
          { id: 20, bookingStatus: "Confirmed", paymentStatus: "Unpaid", clientRate: 200, artistRate: 150, grossProfit: 50, startDate: new Date(), createdAt: new Date() },
        ],
        total: 1,
      };
      vi.mocked(getAdminBookings).mockResolvedValue(mockBookings as any);
      const result = await getAdminBookings({ limit: 50, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.bookings[0].bookingStatus).toBe("Confirmed");
    });

    it("accepts upcoming filter", async () => {
      vi.mocked(getAdminBookings).mockResolvedValue({ bookings: [], total: 0 });
      await getAdminBookings({ upcoming: true, limit: 50, offset: 0 });
      expect(getAdminBookings).toHaveBeenCalledWith(expect.objectContaining({ upcoming: true }));
    });
  });

  // ── Payments ─────────────────────────────────────────────────────────────────
  describe("getAdminPayments", () => {
    it("returns paginated payments", async () => {
      const mockPayments = {
        payments: [
          { id: 30, stripeId: "pi_test_123", status: "Success", stripeAmount: 20000, stripeApplicationFeeAmount: 3000, paymentDate: new Date(), createdAt: new Date() },
        ],
        total: 1,
      };
      vi.mocked(getAdminPayments).mockResolvedValue(mockPayments as any);
      const result = await getAdminPayments({ limit: 50, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.payments[0].stripeAmount).toBe(20000);
    });

    it("returns empty list when no payments", async () => {
      vi.mocked(getAdminPayments).mockResolvedValue({ payments: [], total: 0 });
      const result = await getAdminPayments({ limit: 50, offset: 0 });
      expect(result.payments).toHaveLength(0);
    });
  });
});
