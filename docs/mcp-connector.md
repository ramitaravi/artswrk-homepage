# Artswrk MCP connector (Claude ↔ database)

Read-only remote MCP server so Claude (claude.ai, desktop, mobile, Claude Code)
can query the live Artswrk database in chat. Code: `server/mcp/`.

## Tools

| Tool | What it does |
|---|---|
| `list_tables` | Every table + approximate row count |
| `describe_table` | Columns, types, comments for one table |
| `run_query` | One read-only SQL statement (SELECT / WITH / SHOW / DESCRIBE / EXPLAIN), capped at 200 rows by default (max 1000), 20s timeout |
| `platform_snapshot` | Artists/clients total + new in 7/30 days, jobs posted, active jobs, bookings, upcoming confirmed |
| `find_user` | Look up a user by name, email, company or id |

## Safety

- **Read-only, three layers:** the SQL guard (`server/mcp/sqlGuard.ts`) rejects
  anything but a single read statement; a 20s execution cap; and — once set up —
  a database user that only has `SELECT`.
- **Redaction:** any column whose name contains password / token / secret /
  api key / cardId comes back as `[redacted]`.
- **Off by default:** without `MCP_ACCESS_KEY` both endpoints return 503.
- The full connector URL contains the key — treat it like a password. To revoke,
  change `MCP_ACCESS_KEY` and redeploy; every old URL stops working.

## Setup (one time)

1. **Create a read-only DB user** in the TiDB Cloud SQL editor (Manus → Database):

   ```sql
   CREATE USER 'claude_readonly'@'%' IDENTIFIED BY '<long random password>';
   GRANT SELECT ON <database_name>.* TO 'claude_readonly'@'%';
   ```

   Build its connection string from the existing `DATABASE_URL`, swapping in the
   new username and password.

2. **Set env vars** in Manus (Settings → Secrets / env), then redeploy:

   | Var | Value |
   |---|---|
   | `MCP_ACCESS_KEY` | output of `openssl rand -hex 32` |
   | `MCP_DATABASE_URL` | the read-only connection string from step 1 (optional but strongly recommended — falls back to `DATABASE_URL`) |

3. **Add the connector in Claude**
   - Pro / Max: Settings → Connectors → **Add custom connector**
   - Team / Enterprise: an Owner adds it under Organization settings → Connectors → Add → Custom → Web
   - Name: `Artswrk DB`
   - URL: `https://artswrk.com/mcp/<MCP_ACCESS_KEY>`
   - Leave OAuth settings blank.

4. **Claude Code (optional):**

   ```bash
   claude mcp add --transport http artswrk-db https://artswrk.com/mcp \
     --header "Authorization: Bearer <MCP_ACCESS_KEY>"
   ```

## Smoke test

```bash
curl -s https://artswrk.com/mcp/<MCP_ACCESS_KEY> \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Should list the five tools. A 503 means `MCP_ACCESS_KEY` isn't set; 401 means the key is wrong.

## Possible next steps

- Replace the key-in-URL with OAuth (sign in with an Artswrk admin account)
  so access is per-person and revocable individually.
- Add more shortcut tools for questions that come up a lot (revenue by month
  using `bookingMoney()`, WRK Experience registrations, subscriber/MRR counts).
