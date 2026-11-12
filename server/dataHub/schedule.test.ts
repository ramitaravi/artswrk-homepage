import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDataHubDailyWindow } from "./schedule";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), pull: vi.fn(), engagement: vi.fn(), dnc: vi.fn(), push: vi.fn(),
}));
vi.mock("../_core/cronAuth", () => ({ requireCronRequest: mocks.auth }));
vi.mock("../leadsSync", () => ({ syncLeadsFromBrevo: mocks.pull }));
vi.mock("./engagement", () => ({ refreshEngagement: mocks.engagement }));
vi.mock("./dnc", () => ({ applyDnc: mocks.dnc }));
vi.mock("./hubspotSync", () => ({ pushToHubspot: mocks.push }));
import { handleScheduledDataHubSync, startDataHubSync } from "./run";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isCron: true, taskUid: "test-cron" });
  for (const fn of [mocks.pull, mocks.engagement, mocks.dnc, mocks.push]) fn.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe("Data Hub daily America/New_York schedule", () => {
  it.each([
    ["2026-11-13T07:17:00Z", false], ["2026-11-13T08:17:00Z", true],
    ["2027-07-13T07:17:00Z", true], ["2027-07-13T08:17:00Z", false],
    ["2027-03-14T07:17:00Z", true], ["2027-03-14T08:17:00Z", false],
    ["2027-11-07T07:17:00Z", false], ["2027-11-07T08:17:00Z", true],
    ["2026-11-13T08:16:59Z", false], ["2026-11-13T08:23:00Z", true],
  ])("gates %s correctly", (date, expected) => {
    expect(isDataHubDailyWindow(new Date(date))).toBe(expected);
  });
  it("rejects unsigned callbacks before any provider operation", async () => {
    mocks.auth.mockRejectedValue(new Error("invalid identity"));
    const res = response();
    await handleScheduledDataHubSync({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("skips the wrong UTC offset without triggering work", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T07:17:00Z"));
    const res = response();
    await handleScheduledDataHubSync({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accepted: false, skipped: expect.any(String) }));
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it("starts only the valid scheduled slot with fully mocked providers", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T08:17:00Z"));
    const res = response();
    await handleScheduledDataHubSync({} as any, res as any);
    await flush();
    expect(res.json).toHaveBeenCalledWith({ accepted: true, alreadyRunning: false });
    expect(mocks.pull).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });
  it("does not restrict manual admin runs to the scheduled window", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T19:00:00Z"));
    expect(startDataHubSync()).toBe(true);
    await flush();
    expect(mocks.pull).toHaveBeenCalledTimes(1);
  });
});
