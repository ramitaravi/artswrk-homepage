/**
 * ARTSWRK MCP CONNECTOR — read-only database access for Claude
 * ─────────────────────────────────────────────────────────────────────────────
 * A remote MCP server (Streamable HTTP, stateless) so Claude on claude.ai,
 * desktop and mobile can query the Artswrk database directly in chat.
 *
 * READ-ONLY. It never writes to the database, sends email, or touches Stripe.
 *
 * Endpoints (both disabled with 503 until MCP_ACCESS_KEY is set):
 *   POST /mcp/:key  — for claude.ai custom connectors, which can't send custom
 *                     headers: the key lives in the URL, so treat the full URL
 *                     like a password.
 *   POST /mcp       — same server, key sent as `Authorization: Bearer <key>`
 *                     (Claude Code, scripts).
 *
 * Env:
 *   MCP_ACCESS_KEY      required — long random string (openssl rand -hex 32)
 *   MCP_DATABASE_URL    recommended — a TiDB user with SELECT-only grants.
 *                       Falls back to DATABASE_URL, in which case the SQL guard
 *                       in ./sqlGuard.ts is the only thing stopping writes.
 *
 * Sensitive columns (password hashes, tokens, secrets, card IDs) are redacted
 * from every result by column name — see isSensitiveColumn().
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import mysql from "mysql2/promise";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { assertReadOnlySql, redactRow, UnsafeQueryError, withRowCap } from "./sqlGuard";

const QUERY_TIMEOUT_MS = 20_000;
const DEFAULT_ROWS = 200;
const MAX_ROWS = 1000;

const INSTRUCTIONS = `Read-only access to the live Artswrk database (TiDB, MySQL dialect).
Start with list_tables / describe_table if you don't know the schema; platform_snapshot and find_user cover common questions.

Key facts:
- users: one row per account. userRole = 'Artist' or 'Client' (hirers: studios, schools, competitions). Enterprise accounts are userRole 'Client' with enterprise = 1. Admin permission is users.role = 'admin'. planTier holds the current plan (artist_free/basic/pro, client_on_demand/premium, enterprise_on_demand/subscription). deactivatedAt set = deactivated account.
- jobs: requests posted by clients (clientUserId → users.id). requestStatus: Active, Confirmed, Completed, Deleted by Client, Submissions Paused, Lost - No Revenue, etc.
- interested_artists: applications (artist → job). bookings: confirmed work (jobId, clientUserId, artistUserId, bookingStatus, paymentStatus).
- premium_jobs: enterprise / competition jobs, with premium_job_interested_artists as applicants.
- payments, reimbursements, booking_periods: money. CAUTION: bookings.artistRate / clientRate are a TOTAL on some rows and a PER-HOUR rate on others (rateType null on legacy Bubble rows = total). Don't sum them blindly; say so when reporting revenue.
- leads_contacts, acquisition_leads: sales/outreach pipeline. email_send_log, email_suppressions: email ops.
- Rows migrated from Bubble have bubbleId set. All timestamps are stored in UTC; the business runs on US Eastern time.
- Sensitive columns (passwords, tokens, secrets) come back as [redacted].`;

// ── DB pool (separate from the app's, small, query-timeout on every conn) ────
let _pool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (_pool) return _pool;
  const uri = process.env.MCP_DATABASE_URL || process.env.DATABASE_URL;
  if (!uri) throw new Error("No MCP_DATABASE_URL or DATABASE_URL configured");
  _pool = mysql.createPool({ uri, timezone: "Z", connectionLimit: 3, multipleStatements: false, dateStrings: false });
  _pool.on("connection", conn => {
    // Callback-style connection here (not the promise wrapper) — fire and forget.
    conn.query("SET time_zone = '+00:00'");
    conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`);
  });
  return _pool;
}

async function runSql(sql: string, params: unknown[] = []) {
  const [rows, fields] = await getPool().query({ sql, timeout: QUERY_TIMEOUT_MS }, params);
  const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  return { rows: list.map(redactRow), columns: (fields ?? []).map((f: any) => f.name as string) };
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

// ── The MCP server (built fresh per request — stateless transport) ─────────
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "artswrk-db", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_tables",
    {
      title: "List tables",
      description: "List every table in the Artswrk database with an approximate row count.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { rows } = await runSql(
        `SELECT TABLE_NAME AS name, TABLE_ROWS AS approxRows
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME`,
      );
      return json(rows);
    },
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe table",
      description: "Show a table's columns: name, type, nullability, key and comment.",
      inputSchema: { table: z.string().regex(/^[A-Za-z0-9_]+$/).describe("Table name, e.g. users, jobs, bookings") },
      annotations: READ_ONLY,
    },
    async ({ table }) => {
      const { rows } = await runSql(
        `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable,
                COLUMN_KEY AS \`key\`, COLUMN_DEFAULT AS \`default\`, COLUMN_COMMENT AS comment
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [table],
      );
      if (!rows.length) return fail(`No table named "${table}". Call list_tables to see what exists.`);
      return json(rows);
    },
  );

  server.registerTool(
    "run_query",
    {
      title: "Run read-only SQL",
      description:
        "Run one read-only SQL statement (SELECT, WITH, SHOW, DESCRIBE or EXPLAIN) against the live database. " +
        `Results are capped at max_rows (default ${DEFAULT_ROWS}, max ${MAX_ROWS}); aggregate in SQL rather than pulling raw rows. ` +
        "Timestamps are UTC. Sensitive columns are redacted.",
      inputSchema: {
        sql: z.string().min(1).describe("A single read-only MySQL/TiDB statement"),
        max_rows: z.number().int().min(1).max(MAX_ROWS).optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ sql, max_rows }) => {
      const cap = max_rows ?? DEFAULT_ROWS;
      let safe: string;
      try {
        safe = assertReadOnlySql(sql);
      } catch (err) {
        if (err instanceof UnsafeQueryError) return fail(err.message);
        throw err;
      }
      try {
        const { rows, columns } = await runSql(withRowCap(safe, cap + 1));
        const truncated = rows.length > cap;
        return json({ columns, rowCount: Math.min(rows.length, cap), truncated, rows: rows.slice(0, cap) });
      } catch (err: any) {
        return fail(`Query failed: ${err?.message ?? String(err)}`);
      }
    },
  );

  server.registerTool(
    "platform_snapshot",
    {
      title: "Platform snapshot",
      description:
        "Headline numbers: artists and clients (total and new in the last 7/30 days), jobs posted, active jobs, bookings created, and upcoming confirmed bookings.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const [users, jobs, bookings] = await Promise.all([
        runSql(
          `SELECT userRole,
                  COUNT(*) AS total,
                  SUM(createdAt >= NOW() - INTERVAL 7 DAY) AS new7d,
                  SUM(createdAt >= NOW() - INTERVAL 30 DAY) AS new30d,
                  SUM(lastSignedIn >= NOW() - INTERVAL 30 DAY) AS signedIn30d
             FROM users
            WHERE deactivatedAt IS NULL
            GROUP BY userRole`,
        ),
        runSql(
          `SELECT COUNT(*) AS total,
                  SUM(createdAt >= NOW() - INTERVAL 7 DAY) AS posted7d,
                  SUM(createdAt >= NOW() - INTERVAL 30 DAY) AS posted30d,
                  SUM(requestStatus = 'Active') AS activeNow
             FROM jobs`,
        ),
        runSql(
          `SELECT COUNT(*) AS total,
                  SUM(createdAt >= NOW() - INTERVAL 30 DAY) AS created30d,
                  SUM(bookingStatus = 'Confirmed' AND startDate >= NOW()) AS upcomingConfirmed
             FROM bookings`,
        ),
      ]);
      const toNum = (r: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : v]));
      return json({
        asOfUtc: new Date().toISOString(),
        usersByRole: users.rows.map(toNum),
        jobs: toNum(jobs.rows[0] ?? {}),
        bookings: toNum(bookings.rows[0] ?? {}),
      });
    },
  );

  server.registerTool(
    "find_user",
    {
      title: "Find user",
      description: "Look up artists or clients by name, email, company name or user id. Returns up to 25 matches.",
      inputSchema: {
        search: z.string().min(1).describe("Name, email, company, or numeric user id"),
        role: z.enum(["Artist", "Client"]).optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ search, role }) => {
      const term = `%${search.trim()}%`;
      const params: unknown[] = [term, term, term, term, /^\d+$/.test(search.trim()) ? Number(search.trim()) : -1];
      let roleClause = "";
      if (role) {
        roleClause = "AND userRole = ?";
        params.push(role);
      }
      const { rows } = await runSql(
        `SELECT id, name, firstName, lastName, email, userRole, clientCompanyName, enterprise, planTier,
                location, createdAt, lastSignedIn, deactivatedAt, bubbleId
           FROM users
          WHERE (name LIKE ? OR email LIKE ? OR clientCompanyName LIKE ?
                 OR CONCAT_WS(' ', firstName, lastName) LIKE ? OR id = ?)
                ${roleClause}
          ORDER BY lastSignedIn DESC
          LIMIT 25`,
        params,
      );
      return json(rows);
    },
  );

  return server;
}

// ── HTTP wiring ────────────────────────────────────────────────────────────
function keysMatch(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function handleMcp(req: Request, res: Response, providedKey: string | undefined) {
  const expected = process.env.MCP_ACCESS_KEY;
  if (!expected) {
    res.status(503).json({ error: "MCP connector disabled (MCP_ACCESS_KEY not set)" });
    return;
  }
  if (!keysMatch(providedKey, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Stateless server: no sessions, so no server-initiated GET stream or DELETE.
  if (req.method !== "POST") {
    res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
    return;
  }

  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[MCP] Request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
}

export function registerMcpRoutes(app: Express) {
  const body = express.json({ limit: "1mb" });
  app.all("/mcp/:key", body, (req, res) => handleMcp(req, res, req.params.key));
  app.all("/mcp", body, (req, res) => {
    const auth = req.headers.authorization;
    const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : undefined;
    return handleMcp(req, res, bearer);
  });
}
