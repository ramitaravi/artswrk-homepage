/**
 * Archives (does NOT delete) the 11 Bubble test jobs Ramita identified
 * directly in Bubble's editor before tonight's cutover. These are all
 * synced into our own `jobs` table with a real bubbleId, so the earlier
 * `bubbleId IS NULL` sweep never caught them — several are still
 * requestStatus='Confirmed', meaning some may currently be visible on the
 * live /jobs page. This only hides them on our side (reversible); the
 * source records still exist in Bubble and need deleting there separately.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const BUBBLE_IDS = [
  "1730745867776x170347210925146100", "1697646731116x308787820533199300",
  "1684510582897x450006234862452740", "1684005456986x324654264790810600",
  "1682974405846x871746824821896200", "1682974404792x647383704081668400",
  "1686408145587x430911115319574500", "1694730437976x118195605704015870",
  "1736964305891x422615165883383800", "1736964377220x552192294336069600",
  "1785522555657x517056874663378940",
];

const c = await mysql.createConnection(process.env.DATABASE_URL);
const placeholders = BUBBLE_IDS.map(() => "?").join(",");

const [before] = await c.query(
  `SELECT id, title, requestStatus FROM jobs WHERE bubbleId IN (${placeholders})`,
  BUBBLE_IDS
);
console.log(`${before.length} jobs found, archiving...`);

await c.query(
  `UPDATE jobs SET requestStatus = 'Archived', networkStatus = 'suppressed' WHERE bubbleId IN (${placeholders})`,
  BUBBLE_IDS
);

const [after] = await c.query(
  `SELECT id, title, requestStatus, networkStatus FROM jobs WHERE bubbleId IN (${placeholders})`,
  BUBBLE_IDS
);
console.table(after);
await c.end();
