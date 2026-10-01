import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("alert emails point at the live site", () => {
  it("defaults to artswrk.com, never the pre-cutover host", async () => {
    const digestSrc = await readFile("server/jobAlerts/digest.ts", "utf-8");
    const lastMinuteSrc = await readFile("server/jobAlerts/lastMinute.ts", "utf-8");
    const templatesSrc = await readFile("server/jobAlerts/templates.ts", "utf-8");
    // Artists reported every job in every alert landing on the old site, because
    // the fallback host was app.artswrk.com and the env var is unset in production.
    for (const src of [digestSrc, lastMinuteSrc, templatesSrc]) {
      expect(src).not.toMatch(/["'`]https:\/\/app\.artswrk\.com/);
    }
    expect(digestSrc).toContain('"https://artswrk.com"');
    expect(lastMinuteSrc).toContain('"https://artswrk.com"');
  });
});
