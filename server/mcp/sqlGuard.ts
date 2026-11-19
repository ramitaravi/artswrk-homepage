/**
 * SQL guard for the Artswrk MCP connector — pure functions, no DB access.
 *
 * Two layers keep the connector read-only:
 *   1. This guard — one statement only, must start with SELECT / WITH / SHOW /
 *      DESCRIBE / DESC / EXPLAIN, and must not contain any write or
 *      side-effect keyword anywhere (so `WITH x AS (...) DELETE ...` and
 *      `SELECT ... INTO OUTFILE` are both rejected).
 *   2. The database user — point MCP_DATABASE_URL at a TiDB user that only has
 *      SELECT grants. The guard is a seatbelt; the read-only user is the lock.
 */

const ALLOWED_START = /^(select|with|show|describe|desc|explain)\b/i;

/** Anything that writes, locks, changes session state, or can stall the DB. */
const FORBIDDEN = new RegExp(
  "\\b(" +
    [
      // REPLACE is deliberately absent: as a statement it can't start with
      // SELECT/WITH, and REPLACE() is a useful string function.
      "insert", "update", "delete",
      "drop", "alter", "create", "truncate", "rename",
      "grant", "revoke", "set", "call", "handler", "load",
      "lock", "unlock", "into", "outfile", "dumpfile",
      "sleep", "benchmark", "get_lock", "release_lock",
      "flush", "kill", "shutdown", "optimize", "repair",
      "prepare", "execute", "deallocate", "commit", "rollback", "savepoint",
    ].join("|") +
    ")\\b",
  "i",
);

/** Remove string literals, quoted identifiers and comments so keyword checks
 *  only look at real SQL tokens (a job titled "Delete me" is fine). */
export function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(--|#)[^\n]*/g, " ")
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
    .replace(/"(?:[^"\\]|\\.|"")*"/g, '""')
    .replace(/`(?:[^`]|``)*`/g, "``");
}

export class UnsafeQueryError extends Error {}

/** Returns the trimmed SQL (trailing semicolon removed) or throws. */
export function assertReadOnlySql(raw: string): string {
  const sql = raw.trim().replace(/;\s*$/, "").trim();
  if (!sql) throw new UnsafeQueryError("Empty query.");

  const bare = stripLiteralsAndComments(sql).trim();
  if (bare.includes(";")) throw new UnsafeQueryError("Only one statement per call.");
  if (!ALLOWED_START.test(bare)) {
    throw new UnsafeQueryError("Read-only connector: queries must start with SELECT, WITH, SHOW, DESCRIBE or EXPLAIN.");
  }
  const hit = bare.match(FORBIDDEN);
  if (hit) throw new UnsafeQueryError(`Read-only connector: "${hit[1].toUpperCase()}" is not allowed.`);
  if (/\bfor\s+(update|share)\b|\block\s+in\s+share\s+mode\b/i.test(bare)) {
    throw new UnsafeQueryError("Read-only connector: locking reads are not allowed.");
  }
  return sql;
}

/** Append a LIMIT to SELECT/WITH queries that don't already end in one, so a
 *  careless `SELECT * FROM users` can't pull the whole table into memory. */
export function withRowCap(sql: string, cap: number): string {
  const bare = stripLiteralsAndComments(sql).trim();
  if (!/^(select|with)\b/i.test(bare)) return sql;
  if (/\blimit\s+\d+(\s*,\s*\d+|\s+offset\s+\d+)?\s*$/i.test(bare)) return sql;
  return `${sql}\nLIMIT ${cap}`;
}

/** Column names whose values never leave the server, whatever the query. */
const SENSITIVE_COLUMN = /password|token|secret|api_?key|cardid/i;

export function isSensitiveColumn(name: string): boolean {
  return SENSITIVE_COLUMN.test(name);
}

export function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isSensitiveColumn(key) && value !== null && value !== undefined) out[key] = "[redacted]";
    else if (typeof value === "bigint") out[key] = Number(value);
    else if (Buffer.isBuffer(value)) out[key] = value.length === 1 ? value[0] : `[binary ${value.length} bytes]`;
    else out[key] = value;
  }
  return out;
}
