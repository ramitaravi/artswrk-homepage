import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import { assertReadOnlySql, redactRow, withRowCap } from "./sqlGuard";
import { registerMcpRoutes } from "./index";

describe("assertReadOnlySql", () => {
  it.each([
    "SELECT * FROM users",
    "select count(*) from jobs where requestStatus = 'Active';",
    "WITH recent AS (SELECT * FROM jobs WHERE createdAt > NOW() - INTERVAL 7 DAY) SELECT COUNT(*) FROM recent",
    "SHOW TABLES",
    "DESCRIBE bookings",
    "EXPLAIN SELECT * FROM bookings",
    "SELECT * FROM jobs WHERE title LIKE '%delete%'",
    "SELECT startDate, updatedAt, REPLACE(title, 'a', 'b') FROM jobs",
    "SELECT `update` FROM t",
  ])("allows %s", sql => {
    expect(() => assertReadOnlySql(sql)).not.toThrow();
  });

  it.each([
    "DELETE FROM users",
    "UPDATE users SET role = 'admin'",
    "INSERT INTO users (id) VALUES (1)",
    "DROP TABLE users",
    "WITH x AS (SELECT id FROM users) DELETE FROM users WHERE id IN (SELECT id FROM x)",
    "SELECT * FROM users; DROP TABLE users",
    "SELECT * FROM users INTO OUTFILE '/tmp/x'",
    "SELECT * FROM users FOR UPDATE",
    "SELECT SLEEP(100)",
    "SET @a = 1",
    "",
    "/* sneaky */ DELETE FROM users",
  ])("rejects %s", sql => {
    expect(() => assertReadOnlySql(sql)).toThrow();
  });
});

describe("withRowCap", () => {
  it("adds a LIMIT to uncapped selects", () => {
    expect(withRowCap("SELECT * FROM users", 201)).toMatch(/LIMIT 201$/);
  });
  it("leaves an existing trailing LIMIT alone", () => {
    expect(withRowCap("SELECT * FROM users LIMIT 5", 201)).toBe("SELECT * FROM users LIMIT 5");
    expect(withRowCap("SELECT * FROM users LIMIT 5 OFFSET 10", 201)).toBe("SELECT * FROM users LIMIT 5 OFFSET 10");
  });
  it("doesn't touch SHOW / DESCRIBE", () => {
    expect(withRowCap("SHOW TABLES", 201)).toBe("SHOW TABLES");
  });
});

describe("redactRow", () => {
  it("hides sensitive columns, keeps the rest", () => {
    expect(
      redactRow({ id: 1, email: "a@b.com", passwordHash: "$2b$...", invoicePaymentToken: "abc", magicLinkToken: null }),
    ).toEqual({ id: 1, email: "a@b.com", passwordHash: "[redacted]", invoicePaymentToken: "[redacted]", magicLinkToken: null });
  });
});

describe("MCP HTTP auth", () => {
  const original = process.env.MCP_ACCESS_KEY;
  afterEach(() => {
    process.env.MCP_ACCESS_KEY = original;
  });

  async function call(path: string, headers: Record<string, string> = {}) {
    const app = express();
    registerMcpRoutes(app);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
      return { status: res.status, body: await res.text() };
    } finally {
      server.close();
    }
  }

  it("is disabled when MCP_ACCESS_KEY is unset", async () => {
    delete process.env.MCP_ACCESS_KEY;
    expect((await call("/mcp/anything")).status).toBe(503);
  });

  it("rejects a wrong key", async () => {
    process.env.MCP_ACCESS_KEY = "right-key";
    expect((await call("/mcp/wrong-key")).status).toBe(401);
    expect((await call("/mcp", { authorization: "Bearer wrong-key" })).status).toBe(401);
  });

  it("lists the tools with the right key (URL or bearer)", async () => {
    process.env.MCP_ACCESS_KEY = "right-key";
    for (const res of [await call("/mcp/right-key"), await call("/mcp", { authorization: "Bearer right-key" })]) {
      expect(res.status).toBe(200);
      const names = JSON.parse(res.body).result.tools.map((t: { name: string }) => t.name);
      expect(names).toEqual(["list_tables", "describe_table", "run_query", "platform_snapshot", "find_user"]);
    }
  });
});
