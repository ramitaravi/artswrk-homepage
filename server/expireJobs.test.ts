import type { Response } from "express";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest, getDb } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest },
}));
vi.mock("./db", () => ({ getDb }));

import { expirePastJobs, handleScheduledJobExpiry, isPastJobExpiryDate } from "./expireJobs";

const now = new Date("2026-03-20T12:00:00.000Z");
const response = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  authenticateRequest.mockReset();
  getDb.mockReset();
});

describe("handleScheduledJobExpiry", () => {
  it.each([
    ["an ordinary signed-in user", { isCron: false }],
    ["a cron identity without a task uid", { isCron: true }],
    ["a missing authenticated identity", undefined],
  ])("returns 403 without touching the database for %s", async (_case, identity) => {
    authenticateRequest.mockResolvedValue(identity);
    const res = response();

    await handleScheduledJobExpiry({ headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only endpoint" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns 403 without touching the database for an invalid signed request", async () => {
    authenticateRequest.mockRejectedValue(new Error("invalid heartbeat signature"));
    const res = response();

    await handleScheduledJobExpiry({ headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only endpoint" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("accepts a trusted Heartbeat callback and executes parameterized eligibility SQL", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task_expire_jobs" });
    const execute = vi.fn().mockResolvedValue([[]]);
    getDb.mockResolvedValue({ execute });
    const res = response();

    await handleScheduledJobExpiry({ headers: {} } as any, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, expired: 0 });
    expect(execute).toHaveBeenCalledTimes(1);

    const query = new MySqlDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain("j.requestStatus = ?");
    expect(query.sql).toContain("j.endDate > j.startDate");
    expect(query.sql).toContain("b.bookingStatus IN (?, ?)");
    expect(query.params).toEqual(expect.arrayContaining(["Active", "Weekly", "Ongoing", "Dates Flexible", "Recurring"]));
  });

  it("returns a consistent JSON error when the expiry query fails", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task_expire_jobs" });
    getDb.mockResolvedValue({ execute: vi.fn().mockRejectedValue(new Error("database unavailable")) });
    const res = response();

    await handleScheduledJobExpiry({ headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to expire jobs" });
  });
});

describe("isPastJobExpiryDate", () => {
  it("keeps recurring date types open without a valid later end date", () => {
    for (const dateType of ["Weekly", "Ongoing", "Dates Flexible", "Recurring"]) {
      expect(isPastJobExpiryDate({ dateType, startDate: "2026-01-01T00:00:00.000Z" }, now)).toBe(false);
      expect(isPastJobExpiryDate({
        dateType,
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2025-12-31T00:00:00.000Z",
      }, now)).toBe(false);
    }
  });

  it("expires ongoing and multiple-date jobs only after their valid later end date plus grace", () => {
    expect(isPastJobExpiryDate({
      dateType: "Weekly",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-03-18T11:59:59.000Z",
    }, now)).toBe(true);
    expect(isPastJobExpiryDate({
      dateType: "Multiple Dates",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-03-21T00:00:00.000Z",
    }, now)).toBe(false);
    expect(isPastJobExpiryDate({
      dateType: "Multiple Dates",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: null,
    }, now)).toBe(false);
  });

  it("gives one-off jobs a full one-day grace period", () => {
    expect(isPastJobExpiryDate({
      dateType: "Single Date",
      startDate: "2026-03-19T12:00:00.000Z",
    }, now)).toBe(false);
    expect(isPastJobExpiryDate({
      dateType: "Single Date",
      startDate: "2026-03-19T11:59:59.000Z",
    }, now)).toBe(true);
  });
});

describe("expirePastJobs", () => {
  it("is a no-op on a repeat run after the first run archived the candidate", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ id: 42 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]]);
    getDb.mockResolvedValue({ execute });

    await expect(expirePastJobs()).resolves.toEqual({ expired: 1, ids: [42] });
    await expect(expirePastJobs()).resolves.toEqual({ expired: 0, ids: [] });

    expect(execute).toHaveBeenCalledTimes(3);
    const update = new MySqlDialect().sqlToQuery(execute.mock.calls[1][0]);
    expect(update.sql).toContain("UPDATE jobs AS j SET requestStatus = ?");
    expect(update.sql).toContain("j.requestStatus = ?");
    expect(update.sql).toContain("j.endDate > j.startDate");
    expect(update.sql).toContain("b.bookingStatus IN (?, ?)");
  });
});
