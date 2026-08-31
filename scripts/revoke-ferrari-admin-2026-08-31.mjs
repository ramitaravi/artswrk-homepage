/**
 * Revokes unauthorized admin access from ferraridancecenternyc@gmail.com
 * (user #780194, "Phyllis F") — role='admin', addedByAdmin=0, never
 * deliberately granted. Confirmed by Ramita to revoke. Downgrades to 'user',
 * does not touch any other field or delete anything.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const [before] = await c.query(
  `SELECT id, email, name, role, addedByAdmin FROM users WHERE email = 'ferraridancecenternyc@gmail.com'`
);
console.log("Before:", before);

if (before.length && before[0].role === "admin") {
  await c.query(`UPDATE users SET role = 'user' WHERE email = 'ferraridancecenternyc@gmail.com'`);
  const [after] = await c.query(
    `SELECT id, email, name, role, addedByAdmin FROM users WHERE email = 'ferraridancecenternyc@gmail.com'`
  );
  console.log("After:", after);
} else {
  console.log("No change needed (already not admin, or not found).");
}
await c.end();
