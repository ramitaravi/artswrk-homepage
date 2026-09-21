import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const routerSource = readFileSync(path.join(root, "server/routers.ts"), "utf8");
const detailSource = readFileSync(path.join(root, "client/src/pages/ProJobDetail.tsx"), "utf8");

function procedure(name: string, nextName: string): string {
  const start = routerSource.indexOf(`${name}:`);
  const end = routerSource.indexOf(`${nextName}:`, start + name.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routerSource.slice(start, end);
}

describe("enterprise PRO application access wiring", () => {
  it("redacts paid application targets in the public job-detail response", () => {
    const source = procedure("getJobDetail", "getJobApplicants");
    expect(source).toContain("visibleProJobApplyFields");
    expect(source).toContain('viewerIsPro: (viewer as any)?.planTier === "artist_pro"');
    expect(source).toContain("...applyFields");
  });

  it("requires the viewer to own the requested job before loading applicants", () => {
    const source = procedure("getJobApplicants", "getClientCompanies");
    expect(source).toContain("canAccessEnterpriseJobApplicants");
    expect(source).toContain('throw new Error("Forbidden: not your job")');
    expect(source.indexOf("canAccessEnterpriseJobApplicants")).toBeLessThan(source.indexOf("getPremiumJobInterestedArtists"));
  });

  it("returns an enterprise follow-up form only from authenticated application procedures", () => {
    const applySource = procedure("applyToProJob", "checkProJobApplication");
    const checkSource = procedure("checkProJobApplication", "myConfirmations");
    expect(applySource).toContain("enterpriseFollowUpApplyLink");
    expect(applySource).toContain("followUpApplyLink");
    expect(checkSource).toContain("enterpriseFollowUpApplyLink");
    expect(detailSource).toContain("followUpApplyLink(appliedSummary)");
    expect(detailSource).not.toContain("followUpApplyLink(j)");
  });
});
