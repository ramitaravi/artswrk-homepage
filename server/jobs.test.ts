/**
 * Tests for jobs-related logic.
 * Tests the pure calculation logic that doesn't require a DB connection.
 */
import { describe, it, expect } from "vitest";

// ─── Stats calculation logic (mirrors db.ts getJobStatsByUserId) ──────────────
describe("job stats calculation", () => {
  function calcStats(rows: { requestStatus: string; count: number }[]) {
    const stats = { total: 0, active: 0, confirmed: 0, completed: 0 };
    for (const row of rows) {
      const count = Number(row.count);
      stats.total += count;
      if (row.requestStatus === "Active") stats.active += count;
      if (row.requestStatus === "Confirmed") stats.confirmed += count;
      if (row.requestStatus === "Completed") stats.completed += count;
    }
    return stats;
  }

  it("correctly sums status counts", () => {
    const rows = [
      { requestStatus: "Active", count: 5 },
      { requestStatus: "Confirmed", count: 2 },
      { requestStatus: "Completed", count: 8 },
      { requestStatus: "Deleted by Client", count: 3 },
    ];
    const stats = calcStats(rows);
    expect(stats.total).toBe(18);
    expect(stats.active).toBe(5);
    expect(stats.confirmed).toBe(2);
    expect(stats.completed).toBe(8);
  });

  it("handles empty rows gracefully", () => {
    const stats = calcStats([]);
    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.confirmed).toBe(0);
    expect(stats.completed).toBe(0);
  });

  it("ignores unknown statuses in named counts but includes in total", () => {
    const rows = [
      { requestStatus: "Submissions Paused", count: 4 },
      { requestStatus: "Lost - No Revenue", count: 2 },
    ];
    const stats = calcStats(rows);
    expect(stats.total).toBe(6);
    expect(stats.active).toBe(0);
    expect(stats.confirmed).toBe(0);
    expect(stats.completed).toBe(0);
  });
});

// ─── Job title extraction logic (mirrors Jobs.tsx extractTitle) ───────────────
describe("job title extraction", () => {
  function extractTitle(description: string | null | undefined): string {
    if (!description) return "Open Position";
    const firstLine = description.split("\n")[0].trim();
    if (firstLine.length > 0 && firstLine.length < 80) return firstLine;
    const patterns: [RegExp, string][] = [
      [/sub(stitute)?\s+teacher/i, "Substitute Teacher"],
      [/ballet/i, "Ballet Teacher"],
      [/hip\s*hop/i, "Hip Hop Instructor"],
      [/recurring|weekly|instructor/i, "Dance Instructor"],
      [/teacher|coach/i, "Dance Teacher"],
    ];
    for (const [re, label] of patterns) {
      if (re.test(description)) return label;
    }
    return "Open Position";
  }

  it("extracts substitute teacher from description (multi-line)", () => {
    // When first line is >= 80 chars, it falls through to pattern matching
    const longDesc = "Looking for a sub teacher this Saturday for a very important recurring class that needs coverage and must be committed through the end of the season.";
    expect(extractTitle(longDesc)).toBe("Substitute Teacher");
  });

  it("extracts ballet teacher (multi-line)", () => {
    const longDesc = "Need a ballet instructor for weekly classes starting in April and going through the end of the season in June with a full commitment required.";
    expect(extractTitle(longDesc)).toBe("Ballet Teacher");
  });

  it("returns first line when it is short", () => {
    expect(extractTitle("Hip hop class instructor needed")).toBe("Hip hop class instructor needed");
  });

  it("falls back to first line if short enough", () => {
    expect(extractTitle("Dance Competition Judge\nMore details here")).toBe("Dance Competition Judge");
  });

  it("returns Open Position for null/empty", () => {
    expect(extractTitle(null)).toBe("Open Position");
    expect(extractTitle("")).toBe("Open Position");
  });
});

// ─── Time ago formatting (mirrors Jobs.tsx timeAgo) ───────────────────────────
describe("timeAgo formatting", () => {
  function timeAgo(date: Date | string | null | undefined): string {
    if (!date) return "recently";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "recently";
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "a day ago";
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  it("returns recently for null", () => {
    expect(timeAgo(null)).toBe("recently");
  });

  it("returns just now for very recent dates", () => {
    const now = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns hours ago for same-day dates", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
    expect(timeAgo(twoHoursAgo)).toBe("2 hours ago");
  });

  it("returns a day ago for yesterday", () => {
    const yesterday = new Date(Date.now() - 25 * 3600000);
    expect(timeAgo(yesterday)).toBe("a day ago");
  });

  it("returns days ago for this week", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600000);
    expect(timeAgo(threeDaysAgo)).toBe("3 days ago");
  });
});
