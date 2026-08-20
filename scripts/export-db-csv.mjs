import fs from "node:fs/promises";
import path from "node:path";
import { createConnection } from "mysql2/promise";

const outputDir = process.argv[2];

if (!outputDir) {
  throw new Error("Usage: node scripts/export-db-csv.mjs <output-directory>");
}

function csvValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsv(value) {
  const stringValue = csvValue(value);
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function quoteIdentifier(identifier) {
  return `\`${identifier.replaceAll("`", "``")}\``;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const csvDir = path.join(outputDir, "tables");
  await fs.mkdir(csvDir, { recursive: true });

  const db = await createConnection(process.env.DATABASE_URL);
  try {
    const [databaseRows] = await db.query("SELECT DATABASE() AS database_name");
    const databaseName = databaseRows[0]?.database_name;
    if (!databaseName) throw new Error("Could not determine the active database name");

    const [tables] = await db.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [databaseName]
    );

    const manifest = {
      format_version: 1,
      generated_at_utc: new Date().toISOString(),
      database_name: databaseName,
      csv_encoding: "UTF-8",
      null_encoding: "Empty field; use schema_reference.md and source semantics to distinguish null from an empty string where required.",
      tables: [],
    };
    const schemaLines = [
      "# Artswrk Database Schema Reference",
      "",
      `**Generated (UTC):** ${manifest.generated_at_utc}`,
      "",
      "This package contains one UTF-8 CSV file per database table in `tables/`. The CSV header uses the source column names in source order. Values containing commas, quotes, or new lines are RFC 4180-style quoted. `NULL` values are serialized as empty fields; consult the original application semantics where an empty string must be distinguished from `NULL`.",
      "",
      "## Tables",
      "",
      "| Table | CSV file | Rows |",
      "|---|---|---:|",
    ];

    for (const table of tables) {
      const tableName = table.table_name;
      const [columnRows] = await db.query(
        `SELECT column_name, column_type, is_nullable, column_default, column_key, extra, column_comment, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [databaseName, tableName]
      );
      const [rows] = await db.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);
      const columns = columnRows.map((column) => column.column_name);
      const csvContents = [
        columns.map(escapeCsv).join(","),
        ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")),
      ].join("\r\n") + "\r\n";
      const csvFileName = `${tableName}.csv`;
      await fs.writeFile(path.join(csvDir, csvFileName), csvContents, "utf8");

      manifest.tables.push({
        table: tableName,
        csv_file: `tables/${csvFileName}`,
        row_count: rows.length,
        columns: columnRows.map((column) => ({
          name: column.column_name,
          type: column.column_type,
          nullable: column.is_nullable === "YES",
          default: column.column_default,
          key: column.column_key || null,
          extra: column.extra || null,
          comment: column.column_comment || null,
        })),
      });
      schemaLines.push(`| \`${tableName}\` | \`tables/${csvFileName}\` | ${rows.length.toLocaleString("en-US")} |`);
    }

    for (const table of manifest.tables) {
      schemaLines.push("", `## \`${table.table}\``, "", "| # | Column | Type | Nullable | Default | Key | Extra |", "|---:|---|---|:---:|---|---|---|");
      table.columns.forEach((column, index) => {
        const defaultValue = column.default === null ? "" : `\`${String(column.default).replaceAll("`", "\\`")}\``;
        schemaLines.push(`| ${index + 1} | \`${column.name}\` | \`${column.type}\` | ${column.nullable ? "Yes" : "No"} | ${defaultValue} | ${column.key ?? ""} | ${column.extra ?? ""} |`);
      });
    }

    await fs.writeFile(path.join(outputDir, "schema_reference.md"), schemaLines.join("\n") + "\n", "utf8");
    await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    await fs.writeFile(
      path.join(outputDir, "README.md"),
      [
        "# Artswrk Database CSV Export",
        "",
        "This is a point-in-time logical export of the Artswrk application database. Each table is exported as a separate UTF-8 CSV file in `tables/`, with its columns and row count documented in `schema_reference.md` and `manifest.json`.",
        "",
        "The package can be inspected with a spreadsheet or imported into a MySQL/TiDB-compatible target after creating a compatible schema. Treat it as confidential because it contains production application data, including user and operational records.",
      ].join("\n") + "\n",
      "utf8"
    );

    const totalRows = manifest.tables.reduce((sum, table) => sum + table.row_count, 0);
    console.log(JSON.stringify({ outputDir, tableCount: manifest.tables.length, totalRows }, null, 2));
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
