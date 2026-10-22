/**
 * A guard against the bug that keeps coming back.
 *
 * `bookings.artistRate` / `clientRate` hold a booking TOTAL on a job booking
 * and a per-hour UNIT on a class date. Five production bugs have come from
 * code reading one as the other — most visibly Camia Green's $85/hr, 5-hour
 * sub displayed to everyone as "$425/hr".
 *
 * There is no ESLint in this project, so the rule lives here: it runs with
 * `pnpm test` and fails the build rather than relying on anyone remembering.
 *
 * Rule 1 is absolute: never put "/hr" next to artistRate or clientRate.
 * Rule 2 is a ratchet: the number of raw reads may fall, never rise.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["client/src", "server", "shared"];
/** Where reading the raw columns IS the job. */
const ALLOWED = ["shared/bookingRates.ts", "shared/invoicePreview.ts", "client/src/lib/weeklyBookings.ts"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { out.push(...walk(p)); continue; }
    if (!/\.(ts|tsx)$/.test(p)) continue;
    if (/\.test\.tsx?$|\.guard\.test\.ts$/.test(p)) continue;
    out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap(walk).filter((f) => !ALLOWED.some((a) => f.endsWith(a)));
const RAW = /\b(artistRate|clientRate)\b/;

describe("artistRate / clientRate usage", () => {
  it("never labels one of them as a per-hour rate", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      // Blank out comments first. A comment explaining this very rule should
      // not trip it, and a block comment's continuation lines start with prose,
      // not with an asterisk, so matching on line starts missed them.
      const original = readFileSync(file, "utf8");
      const raw = original.split("\n");
      const source = original
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
      const arr = source.split("\n");
      arr.forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("//")) return;
        // Deriving a unit rate FROM a total is the correct thing to do.
        if (/unitRateFromTotal\s*\(/.test(line)) return;
        // Word-boundary on both sides: artistRateDollars and artistRateCents
        // are local variables that already hold the right thing.
        if (!/\b(artistRate|clientRate)\b/.test(line)) return;
        // An explicit, reviewed exception. Some rows DO store a unit rate in
        // these columns (admin recurring bookings, legacy weekly periods), so
        // the marker says "I checked, and here is why" rather than the rule
        // being quietly loosened for everyone.
        // Markers live in comments, so look them up in the ORIGINAL source —
        // the stripped copy has had them blanked out along with everything else.
        const nearby = [raw[i], raw[i - 1], raw[i - 2], raw[i - 3]].join("\n");
        if (/unit-rate:/.test(nearby)) return;
        // "/hr" in the same expression as the raw column — the exact shape of
        // the Camia Green bug: `${b.artistRate}/hr`.
        if (/\b(artistRate|clientRate)\b[^\n]{0,40}\/hr/.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(offenders, [
      "A booking TOTAL is being labelled as a per-hour rate.",
      "Use bookingRateLabel() from shared/bookingRates — it only prints /hr",
      "next to a genuine unit rate.",
      "",
      ...offenders,
    ].join("\n")).toEqual([]);
  });

  it("does not grow the number of files reading the raw columns", () => {
    // A ratchet, not a ban: 14 files read these today. Bring that down over
    // time, but a NEW file reaching for the raw column should be a decision
    // someone makes on purpose, not an accident.
    const BASELINE = 14;
    const touching = FILES.filter((f) => RAW.test(readFileSync(f, "utf8")));
    expect(
      touching.length,
      `Files reading artistRate/clientRate directly grew past ${BASELINE}:\n` +
        touching.join("\n") +
        "\n\nPrefer bookingRateLabel() for display and bookingMoney() for maths.",
    ).toBeLessThanOrEqual(BASELINE);
  });
});
