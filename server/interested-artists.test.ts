/**
 * Tests for interested artists (applicants) query helpers and data mapping.
 * These are unit tests that don't require a live DB connection.
 */

import { describe, it, expect } from "vitest";

// ── Helpers under test (pure logic, no DB) ────────────────────────────────────

function getArtistColor(bubbleId: string | null | undefined): string {
  const AVATAR_COLORS = [
    "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-green-500",
    "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-violet-500",
  ];
  if (!bubbleId) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < bubbleId.length; i++) {
    hash = (hash * 31 + bubbleId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getArtistInitials(bubbleId: string | null | undefined): string {
  if (!bubbleId) return "?";
  return bubbleId.slice(-2).toUpperCase();
}

function mapBubbleRecord(rec: Record<string, unknown>, jobMap: Map<string, number>, clientLocalId: number) {
  const bubbleRequestId = (rec.request as string) ?? null;
  return {
    bubbleId: rec._id as string,
    jobId: bubbleRequestId ? (jobMap.get(bubbleRequestId) ?? null) : null,
    bubbleRequestId,
    bubbleArtistId: (rec.artist as string) ?? null,
    bubbleClientId: (rec.client as string) ?? null,
    bubbleServiceId: (rec.service as string) ?? null,
    bubbleBookingId: (rec.booking as string) ?? null,
    status: (rec.status_interestedartists as string) ?? null,
    converted: rec["converted?"] ? 1 : 0,
    isHourlyRate: rec["is hourly rate?"] ? 1 : 0,
    artistHourlyRate: (rec["artist hourly rate"] as number) ?? null,
    clientHourlyRate: (rec["client hourly rate"] as number) ?? null,
    artistFlatRate: (rec["artist flat rate"] as number) ?? null,
    clientFlatRate: (rec["client flat rate"] as number) ?? null,
    totalHours: (rec["total hours"] as number) ?? null,
    resumeLink: (rec.link as string) ?? null,
    message: (rec.message as string) ?? null,
    clientUserId: clientLocalId,
  };
}

function getApplicantStats(records: { status: string | null }[]) {
  const stats = { total: 0, interested: 0, confirmed: 0, declined: 0 };
  for (const r of records) {
    stats.total++;
    if (r.status === "Interested") stats.interested++;
    if (r.status === "Confirmed") stats.confirmed++;
    if (r.status === "Declined") stats.declined++;
  }
  return stats;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getArtistInitials", () => {
  it("returns last 2 chars of bubbleId uppercased", () => {
    expect(getArtistInitials("1653049440073x136476040164303260")).toBe("60");
  });

  it("returns ? for null", () => {
    expect(getArtistInitials(null)).toBe("?");
  });

  it("returns ? for undefined", () => {
    expect(getArtistInitials(undefined)).toBe("?");
  });

  it("handles short IDs", () => {
    expect(getArtistInitials("AB")).toBe("AB");
  });
});

describe("getArtistColor", () => {
  it("returns a valid tailwind color class", () => {
    const color = getArtistColor("1653049440073x136476040164303260");
    expect(color).toMatch(/^bg-\w+-500$/);
  });

  it("returns first color for null", () => {
    expect(getArtistColor(null)).toBe("bg-purple-500");
  });

  it("is deterministic for the same ID", () => {
    const id = "1653049440073x136476040164303260";
    expect(getArtistColor(id)).toBe(getArtistColor(id));
  });

  it("produces different colors for different IDs", () => {
    const colors = new Set([
      getArtistColor("1653049440073x136476040164303260"),
      getArtistColor("1657803300863x308802375086870000"),
      getArtistColor("1653036992375x461137216374631900"),
      getArtistColor("1653028323509x337649619112267800"),
    ]);
    // At least 2 different colors across 4 IDs
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });
});

describe("mapBubbleRecord", () => {
  const jobMap = new Map([
    ["1682974141189x419583841311258050", 42],
    ["1682974368477x595894443891908500", 99],
  ]);

  const sampleRecord = {
    _id: "1682974141775x336999775061148640",
    artist: "1653049440073x136476040164303260",
    client: "1659533883431x527826980339748400",
    request: "1682974141189x419583841311258050",
    service: "1667426487406x181070042319331650",
    booking: null,
    status_interestedartists: "Interested",
    "converted?": true,
    "is hourly rate?": true,
    "artist hourly rate": 45,
    "client hourly rate": 50,
    "artist flat rate": null,
    "client flat rate": null,
    "total hours": null,
    link: "http://s3.amazonaws.com/appforest_uf/resume.pdf",
    message: null,
  };

  it("maps bubbleId correctly", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 1);
    expect(row.bubbleId).toBe("1682974141775x336999775061148640");
  });

  it("resolves jobId from jobMap", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 1);
    expect(row.jobId).toBe(42);
  });

  it("returns null jobId when request not in map", () => {
    const rec = { ...sampleRecord, request: "unknown-id" };
    const row = mapBubbleRecord(rec, jobMap, 1);
    expect(row.jobId).toBeNull();
  });

  it("maps status correctly", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 1);
    expect(row.status).toBe("Interested");
  });

  it("maps converted flag", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 1);
    expect(row.converted).toBe(1);
  });

  it("maps rates correctly", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 1);
    expect(row.artistHourlyRate).toBe(45);
    expect(row.clientHourlyRate).toBe(50);
  });

  it("maps resumeLink", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 1);
    expect(row.resumeLink).toBe("http://s3.amazonaws.com/appforest_uf/resume.pdf");
  });

  it("assigns clientUserId", () => {
    const row = mapBubbleRecord(sampleRecord, jobMap, 7);
    expect(row.clientUserId).toBe(7);
  });
});

describe("getApplicantStats", () => {
  const records = [
    { status: "Interested" },
    { status: "Interested" },
    { status: "Interested" },
    { status: "Confirmed" },
    { status: "Confirmed" },
    { status: "Declined" },
    { status: null },
  ];

  it("counts total correctly", () => {
    expect(getApplicantStats(records).total).toBe(7);
  });

  it("counts interested correctly", () => {
    expect(getApplicantStats(records).interested).toBe(3);
  });

  it("counts confirmed correctly", () => {
    expect(getApplicantStats(records).confirmed).toBe(2);
  });

  it("counts declined correctly", () => {
    expect(getApplicantStats(records).declined).toBe(1);
  });

  it("handles empty array", () => {
    const stats = getApplicantStats([]);
    expect(stats).toEqual({ total: 0, interested: 0, confirmed: 0, declined: 0 });
  });
});
