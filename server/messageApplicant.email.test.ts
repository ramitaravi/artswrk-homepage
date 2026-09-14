/**
 * clientJobs.messageApplicant must email the artist for every client, not just
 * enterprise accounts, using the shared new-message template (sanitized text,
 * support cc). Previously non-enterprise clients sent no email at all.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByOpenId: vi.fn(),
    getApplicantDetail: vi.fn(),
    getAdminJobById: vi.fn(),
    isClientJobUnlocked: vi.fn(),
    getOrCreateConversation: vi.fn(),
    sendMessageToConversation: vi.fn(),
  };
});

vi.mock("./email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email")>();
  return {
    ...actual,
    sendNewMessageEmail: vi.fn(),
    sendSimpleEmail: vi.fn(),
  };
});

import { appRouter } from "./routers";
import * as db from "./db";
import * as email from "./email";

const mocked = <T>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

function ctxFor(openId: string): TrpcContext {
  return {
    user: {
      id: 10, openId, email: "client@example.com", name: "Sample Client", loginMethod: "local",
      role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("clientJobs.messageApplicant email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked(db.getUserByOpenId).mockResolvedValue({
      id: 10, openId: "client-open-id", role: "user", enterprise: false,
      name: "Sample Client", clientCompanyName: "Sample Dance Studio",
    });
    mocked(db.getApplicantDetail).mockResolvedValue({
      id: 3, jobId: 5, artistId: 20, artistEmail: "artist@example.com", artistFirstName: "Jordan",
    });
    mocked(db.getAdminJobById).mockResolvedValue({ id: 5, clientUserId: 10 });
    mocked(db.isClientJobUnlocked).mockResolvedValue(true);
    mocked(db.getOrCreateConversation).mockResolvedValue({ id: 7 });
    mocked(db.sendMessageToConversation).mockResolvedValue({ id: 99 });
    mocked(email.sendNewMessageEmail).mockResolvedValue(true);
  });

  it("emails the artist when a non-enterprise client sends a message", async () => {
    const caller = appRouter.createCaller(ctxFor("client-open-id"));
    const result = await caller.clientJobs.messageApplicant({ applicantId: 3, message: "Are you free Wednesday?" });

    expect(result).toEqual({ success: true, conversationId: 7, messageId: 99 });
    expect(email.sendNewMessageEmail).toHaveBeenCalledTimes(1);
    expect(email.sendNewMessageEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "artist@example.com",
      recipientFirstName: "Jordan",
      senderName: "Sample Dance Studio",
      messagePreview: "Are you free Wednesday?",
    }));
    expect(email.sendSimpleEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the email fails to send", async () => {
    mocked(email.sendNewMessageEmail).mockRejectedValue(new Error("SendGrid down"));
    const caller = appRouter.createCaller(ctxFor("client-open-id"));
    const result = await caller.clientJobs.messageApplicant({ applicantId: 3, message: "Hello" });
    expect(result.success).toBe(true);
  });
});
