/**
 * Regression: drizzle's mysql2 driver resolves insert() to [ResultSetHeader, fields],
 * so the new row id lives at result[0].insertId. Reading result.insertId returned
 * undefined, which made sendMessageToConversation return undefined and crashed
 * clientJobs.messageApplicant with "Cannot read properties of undefined (reading 'id')".
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (_col: unknown, value: unknown) => ({ kind: "eq", value }),
    and: (...conds: unknown[]) => ({ kind: "and", conds }),
  };
});

vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ on: () => {} }) },
}));

const INSERTED_ID = 42;

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    insert: () => ({ values: async () => [{ insertId: INSERTED_ID }, []] }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    select: () => ({
      from: () => ({
        where: (cond: { kind: string; value?: unknown }) => ({
          // Lookups by id only find the freshly inserted row; lookups by
          // client+artist find nothing, so the insertId path must work on its own.
          limit: async () =>
            cond.kind === "eq" && cond.value === INSERTED_ID ? [{ id: INSERTED_ID }] : [],
        }),
      }),
    }),
  }),
}));

describe("insert id handling for messaging", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "mysql://test@localhost/test";
  });

  it("sendMessageToConversation returns the inserted message", async () => {
    const { sendMessageToConversation } = await import("./db");
    const msg = await sendMessageToConversation({ conversationId: 1, senderUserId: 2, content: "Hi" });
    expect(msg?.id).toBe(INSERTED_ID);
  });

  it("getOrCreateConversation returns the new conversation without the fallback lookup", async () => {
    const { getOrCreateConversation } = await import("./db");
    const convo = await getOrCreateConversation(1, 2);
    expect(convo.id).toBe(INSERTED_ID);
  });
});
