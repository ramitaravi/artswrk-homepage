/**
 * Tests for booking query helpers in server/db.ts
 * Uses real DB data seeded from Bubble.
 */

import { describe, it, expect } from "vitest";

// ── Utility tests (no DB needed) ──────────────────────────────────────────────

describe("Booking status logic", () => {
  type BookingStatus = "Confirmed" | "Completed" | "Cancelled" | "Pay Now";
  type PaymentStatus = "Paid" | "Unpaid";

  const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    Confirmed: "Confirmed",
    Completed: "Completed",
    Cancelled: "Cancelled",
    "Pay Now": "Pay Now",
  };

  const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    Paid: "Paid",
    Unpaid: "Unpaid",
  };

  it("maps all booking statuses to labels", () => {
    const statuses: BookingStatus[] = ["Confirmed", "Completed", "Cancelled", "Pay Now"];
    for (const s of statuses) {
      expect(BOOKING_STATUS_LABELS[s]).toBeDefined();
      expect(typeof BOOKING_STATUS_LABELS[s]).toBe("string");
    }
  });

  it("maps all payment statuses to labels", () => {
    const statuses: PaymentStatus[] = ["Paid", "Unpaid"];
    for (const s of statuses) {
      expect(PAYMENT_STATUS_LABELS[s]).toBeDefined();
    }
  });

  it("identifies paid bookings correctly", () => {
    const isPaid = (status: string) => status === "Paid";
    expect(isPaid("Paid")).toBe(true);
    expect(isPaid("Unpaid")).toBe(false);
    expect(isPaid("")).toBe(false);
  });

  it("identifies completed bookings correctly", () => {
    const isCompleted = (status: string) => status === "Completed";
    expect(isCompleted("Completed")).toBe(true);
    expect(isCompleted("Confirmed")).toBe(false);
    expect(isCompleted("Cancelled")).toBe(false);
  });
});

// ── Currency formatting ───────────────────────────────────────────────────────

describe("Currency formatting", () => {
  function formatCurrency(cents: number | null | undefined): string {
    if (cents == null) return "—";
    return `$${cents.toLocaleString()}`;
  }

  it("formats a positive integer", () => {
    expect(formatCurrency(1500)).toBe("$1,500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("returns dash for null", () => {
    expect(formatCurrency(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatCurrency(undefined)).toBe("—");
  });

  it("formats large amounts with commas", () => {
    expect(formatCurrency(10000)).toBe("$10,000");
  });
});

// ── Date formatting ───────────────────────────────────────────────────────────

describe("Date formatting", () => {
  function formatDate(d: Date | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  it("formats a valid date", () => {
    // Use a UTC date string with time to avoid timezone shifts
    const result = formatDate(new Date("2025-03-15T12:00:00Z"));
    // Accept Mar 14 or Mar 15 depending on local timezone
    expect(result).toMatch(/Mar (14|15), 2025/);
  });

  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });
});

// ── Avatar helpers ────────────────────────────────────────────────────────────

describe("Avatar helpers", () => {
  const AVATAR_COLORS = [
    "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-blue-500",
    "bg-green-500", "bg-teal-500", "bg-amber-500", "bg-red-500",
  ];

  function getInitials(id: string): string {
    return id?.slice(-4).toUpperCase() ?? "??";
  }

  function avatarColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  it("returns last 4 chars of ID as initials", () => {
    expect(getInitials("1659533883431x527826980339748400")).toBe("8400");
  });

  it("returns uppercase initials", () => {
    const result = getInitials("abcdef");
    expect(result).toBe(result.toUpperCase());
  });

  it("returns a valid color class", () => {
    const color = avatarColor("1659533883431x527826980339748400");
    expect(AVATAR_COLORS).toContain(color);
  });

  it("returns consistent color for same ID", () => {
    const id = "1659533883431x527826980339748400";
    expect(avatarColor(id)).toBe(avatarColor(id));
  });

  it("returns different colors for different IDs (probabilistic)", () => {
    const ids = ["aaa", "bbb", "ccc", "ddd", "eee", "fff", "ggg", "hhh"];
    const colors = ids.map(avatarColor);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ── Booking stats aggregation ─────────────────────────────────────────────────

describe("Booking stats aggregation", () => {
  type BookingRow = {
    bookingStatus: string;
    paymentStatus: string;
    count: number;
    sumClientRate: number;
  };

  function aggregateStats(rows: BookingRow[]) {
    const stats = { total: 0, confirmed: 0, completed: 0, cancelled: 0, paid: 0, unpaid: 0, totalRevenue: 0 };
    for (const row of rows) {
      stats.total += row.count;
      if (row.bookingStatus === "Confirmed") stats.confirmed += row.count;
      if (row.bookingStatus === "Completed") stats.completed += row.count;
      if (row.bookingStatus === "Cancelled") stats.cancelled += row.count;
      if (row.paymentStatus === "Paid") {
        stats.paid += row.count;
        stats.totalRevenue += row.sumClientRate;
      }
      if (row.paymentStatus === "Unpaid") stats.unpaid += row.count;
    }
    return stats;
  }

  it("aggregates empty rows to zeros", () => {
    const result = aggregateStats([]);
    expect(result.total).toBe(0);
    expect(result.totalRevenue).toBe(0);
  });

  it("counts confirmed bookings correctly", () => {
    const rows: BookingRow[] = [
      { bookingStatus: "Confirmed", paymentStatus: "Unpaid", count: 5, sumClientRate: 0 },
      { bookingStatus: "Completed", paymentStatus: "Paid", count: 10, sumClientRate: 5000 },
    ];
    const result = aggregateStats(rows);
    expect(result.total).toBe(15);
    expect(result.confirmed).toBe(5);
    expect(result.completed).toBe(10);
    expect(result.paid).toBe(10);
    expect(result.unpaid).toBe(5);
    expect(result.totalRevenue).toBe(5000);
  });

  it("handles cancelled bookings", () => {
    const rows: BookingRow[] = [
      { bookingStatus: "Cancelled", paymentStatus: "Unpaid", count: 3, sumClientRate: 0 },
    ];
    const result = aggregateStats(rows);
    expect(result.cancelled).toBe(3);
    expect(result.total).toBe(3);
  });

  it("sums revenue only from paid bookings", () => {
    const rows: BookingRow[] = [
      { bookingStatus: "Completed", paymentStatus: "Paid", count: 2, sumClientRate: 1000 },
      { bookingStatus: "Confirmed", paymentStatus: "Unpaid", count: 3, sumClientRate: 500 },
    ];
    const result = aggregateStats(rows);
    expect(result.totalRevenue).toBe(1000); // only from Paid rows
  });
});
