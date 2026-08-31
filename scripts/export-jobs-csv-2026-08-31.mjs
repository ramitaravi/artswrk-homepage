import fs from "node:fs/promises";
import path from "node:path";
import { createConnection } from "mysql2/promise";
import "dotenv/config";

const outputDir = process.argv[2] || ".";

function csvValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function escapeCsv(value) {
  const s = csvValue(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function quoteIdentifier(id) {
  return `\`${id.replaceAll("`", "``")}\``;
}

async function exportTable(db, tableName, outPath) {
  const [rows] = await db.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);
  if (rows.length === 0) {
    await fs.writeFile(outPath, "");
    return { count: 0, columns: [] };
  }
  const columns = Object.keys(rows[0]);
  const lines = [columns.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsv(row[c])).join(","));
  }
  await fs.writeFile(outPath, lines.join("\n") + "\n", "utf-8");
  return { count: rows.length, columns };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const db = await createConnection(process.env.DATABASE_URL);
  try {
    const jobsOut = path.join(outputDir, "jobs.csv");
    const premiumOut = path.join(outputDir, "premium_jobs.csv");

    const jobsResult = await exportTable(db, "jobs", jobsOut);
    const premiumResult = await exportTable(db, "premium_jobs", premiumOut);

    console.log(`jobs.csv: ${jobsResult.count} rows, ${jobsResult.columns.length} columns`);
    console.log(`premium_jobs.csv: ${premiumResult.count} rows, ${premiumResult.columns.length} columns`);

    const [reqStatus] = await db.query(
      "SELECT requestStatus, COUNT(*) n FROM jobs GROUP BY requestStatus ORDER BY n DESC"
    );
    const [status] = await db.query(
      "SELECT status, COUNT(*) n FROM jobs GROUP BY status ORDER BY n DESC"
    );
    const [premiumStatus] = await db.query(
      "SELECT status, COUNT(*) n FROM premium_jobs GROUP BY status ORDER BY n DESC"
    );
    const [networkStatus] = await db.query(
      "SELECT networkStatus, COUNT(*) n FROM jobs GROUP BY networkStatus ORDER BY n DESC"
    );
    const [premiumNetworkStatus] = await db.query(
      "SELECT networkStatus, COUNT(*) n FROM premium_jobs GROUP BY networkStatus ORDER BY n DESC"
    );

    console.log("\n=== jobs.requestStatus distribution ===");
    console.log(JSON.stringify(reqStatus, null, 2));
    console.log("\n=== jobs.status distribution ===");
    console.log(JSON.stringify(status, null, 2));
    console.log("\n=== jobs.networkStatus distribution ===");
    console.log(JSON.stringify(networkStatus, null, 2));
    console.log("\n=== premium_jobs.status distribution ===");
    console.log(JSON.stringify(premiumStatus, null, 2));
    console.log("\n=== premium_jobs.networkStatus distribution ===");
    console.log(JSON.stringify(premiumNetworkStatus, null, 2));
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
