import { describe, expect, it } from "vitest";
import { decideGraphic, graphicDate, graphicLocation, graphicRate, graphicTitle, type GraphicJob } from "./format";
import { decryptSecret, encryptSecret } from "./canva";

const NOW = new Date("2026-11-04T17:00:00Z");
const job = (over: Partial<GraphicJob> = {}): GraphicJob => ({
  id: 1, title: "Weekly Acro Teacher", dateType: "Weekly", startDate: "2026-11-04T16:30:00Z",
  isHourly: 1, openRate: 0, artistHourlyRate: null, clientHourlyRate: 70,
  locationAddress: "756 Old Bethpage Rd, Old Bethpage, NY 11804, USA", ...over,
});

describe("job graphic rules", () => {
  it("fills every field from a real listing", () => {
    expect(decideGraphic(job(), NOW)).toMatchObject({
      ok: true,
      fields: { title: "Weekly Acro Teacher", date: "WEDNESDAYS", location: "Old Bethpage, NY", rate: "$70/HR" },
    });
  });
  it("never includes the street address", () => {
    expect(graphicLocation(job())).toBe("Old Bethpage, NY");
    expect(graphicLocation(job({ locationCity: "Norwalk", locationState: "CT" }))).toBe("Norwalk, CT");
  });
  it("cleans titles", () => {
    expect(graphicTitle("Hip Hop instructor")).toBe("Hip Hop Instructor");
    expect(graphicTitle("Part-Time Dance Instructor - Friday Evenings")).toBe("Part-Time Dance Instructor");
    expect(graphicTitle("Strings and Piano Instructor - Fort Salonga, NY")).toBe("Strings and Piano Instructor");
  });
  it("keeps a date-only value on its picked day", () => {
    expect(graphicDate({ dateType: "Single Date", startDate: "2026-11-14T00:00:00Z" })).toBe("NOV 14");
    expect(graphicDate({ dateType: "Single Date", startDate: "2026-11-14T14:00:00Z" })).toBe("NOV 14");
  });
  it("formats rates like the listing page", () => {
    expect(graphicRate(job({ openRate: 1 }))).toBe("OPEN RATE");
    expect(graphicRate(job({ isHourly: 0, clientHourlyRate: 300 }))).toBe("$300 FLAT");
  });
  it("skips jobs that would make a bad post", () => {
    const reason = (over: Partial<GraphicJob>) => {
      const d = decideGraphic(job(over), NOW);
      return d.ok ? null : d.reason;
    };
    expect(reason({ title: "" })).toBe("no title");
    expect(reason({ title: null })).toBe("no title");
    expect(reason({ dateType: "Single Date", startDate: "2026-10-28T14:00:00Z" })).toBe("date has passed");
    expect(reason({ clientHourlyRate: 250 })).toBe("no usable rate");
    expect(reason({ clientHourlyRate: null })).toBe("no usable rate");
    expect(reason({ locationAddress: null })).toBe("no city and state");
  });
  it("gives duplicate postings the same key", () => {
    const a = decideGraphic(job({ id: 1 }), NOW);
    const b = decideGraphic(job({ id: 2 }), NOW);
    expect(a.ok && b.ok && a.dedupeKey === b.dedupeKey).toBe(true);
  });
  it("round-trips an encrypted token", () => {
    const stored = encryptSecret("refresh-token");
    expect(stored).not.toContain("refresh-token");
    expect(decryptSecret(stored)).toBe("refresh-token");
  });
});
