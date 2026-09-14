import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest },
}));

import { requireCronRequest } from "./_core/cronAuth";

describe("Heartbeat callback authentication", () => {
  beforeEach(() => authenticateRequest.mockReset());

  it("accepts a trusted Heartbeat identity and returns its task uid", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task_123" });
    await expect(requireCronRequest({ headers: {} } as any)).resolves.toMatchObject({
      isCron: true,
      taskUid: "task_123",
    });
  });

  it("rejects ordinary users and cron identities without a task uid", async () => {
    authenticateRequest.mockResolvedValueOnce({ id: 1, isCron: false });
    await expect(requireCronRequest({ headers: {} } as any)).rejects.toThrow("Cron-only endpoint");

    authenticateRequest.mockResolvedValueOnce({ id: -1, isCron: true });
    await expect(requireCronRequest({ headers: {} } as any)).rejects.toThrow("Cron-only endpoint");
  });

  it("keeps active scheduled handlers on signed-cookie authentication, not the obsolete header", () => {
    const root = path.resolve(import.meta.dirname);
    for (const relative of ["jobAlerts/scheduled.ts", "bookingReminders.ts"]) {
      const source = fs.readFileSync(path.join(root, relative), "utf8");
      expect(source).toContain("requireCronRequest(req)");
      expect(source).not.toContain("x-manus-cron-task-uid");
    }

    const sdkSource = fs.readFileSync(path.join(root, "_core/sdk.ts"), "utf8");
    expect(sdkSource).toContain('session.openId.startsWith(CRON_OPEN_ID_PREFIX)');
    expect(sdkSource).toContain("Cron session missing task_uid");
  });
});
