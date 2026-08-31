/**
 * Restores job #2370001 "Acro Instructor" to Active. It was accidentally
 * swept up by scripts/archive-nonbubble-test-jobs-2026-08-31.mjs (its
 * bubbleId IS NULL rule caught this one too), but Ramita confirmed it's a
 * real posting, not test data — do not touch it.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
await c.query(`UPDATE jobs SET requestStatus = 'Active', networkStatus = NULL WHERE id = 2370001`);
const [rows] = await c.query(`SELECT id, title, requestStatus, networkStatus FROM jobs WHERE id = 2370001`);
console.table(rows);
await c.end();
