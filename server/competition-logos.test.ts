import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { COMPETITION_LOGOS } from "@/data/competitionLogos";

describe("competition logo marquee", () => {
  it("contains the ten supplied competition logos exactly once", () => {
    expect(COMPETITION_LOGOS).toHaveLength(10);
    expect(new Set(COMPETITION_LOGOS.map((logo) => logo.name)).size).toBe(10);
    expect(new Set(COMPETITION_LOGOS.map((logo) => logo.src)).size).toBe(10);
  });

  it("uses deployable storage paths and declares presentation metadata", () => {
    for (const logo of COMPETITION_LOGOS) {
      expect(logo.src).toMatch(/^\/manus-storage\/[a-z0-9-]+_[a-f0-9]{8}\.(png|webp)$/);
      expect(["light", "dark"]).toContain(logo.surface);
      expect(["wide", "standard", "compact"]).toContain(logo.sizing);
    }

    expect(COMPETITION_LOGOS.some((logo) => logo.surface === "dark")).toBe(true);
    expect(COMPETITION_LOGOS.some((logo) => logo.sizing === "wide")).toBe(true);
    expect(COMPETITION_LOGOS.some((logo) => logo.sizing === "compact")).toBe(true);
  });

  it("keeps the marquee accessible and motion-safe", async () => {
    const source = await readFile(
      new URL("../client/src/pages/DanceCompetitions.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("[false, true].map");
    expect(source).toContain('alt={duplicate ? "" : logo.name}');
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("animation-play-state: paused");
  });
});
