/**
 * One-off fix: user 781383 (Sabrina Breslin — real Stripe customer, held
 * out from the non-Bubble account cleanup for manual review) has
 * masterArtistTypes stored as literal name strings (["Dance Educator",
 * "Side Jobs"]) instead of ids — she onboarded through the live UI before
 * today's fix to the save path. Every other user in the DB was already
 * id-shaped (verified: 1 name-shaped row out of 4,653 populated rows).
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  `SELECT bubbleId, id, name FROM master_artist_types WHERE name IN ('Dance Educator', 'Side Jobs')`
);
const ids = rows.map((r) => r.bubbleId ?? String(r.id));
console.log("Resolved:", rows.map((r) => `${r.name} -> ${r.bubbleId ?? r.id}`));

await conn.execute(`UPDATE users SET masterArtistTypes = ? WHERE id = 781383`, [JSON.stringify(ids)]);
const [[check]] = await conn.execute(`SELECT masterArtistTypes FROM users WHERE id = 781383`);
console.log("Now:", check.masterArtistTypes);

await conn.end();
