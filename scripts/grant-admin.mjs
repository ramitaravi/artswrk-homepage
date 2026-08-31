/**
 * Grant or revoke admin on one account, by email.
 *
 *   node scripts/grant-admin.mjs <email>            # grant
 *   node scripts/grant-admin.mjs <email> --revoke   # revoke
 *   node scripts/grant-admin.mjs --list             # show current admins
 *
 * Admin is `users.role = 'admin'`. It is checked as
 * `user.role === "admin" || user.openId === ENV.ownerOpenId`, so the owner
 * account keeps access even if its row is changed.
 *
 * Prints the target row and asks nothing — read the output before trusting it.
 * There are, for example, three "Nick Silverio" accounts; matching on email
 * rather than name is deliberate.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const args = process.argv.slice(2);
const list = args.includes("--list");
const revoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"));

const c = await mysql.createConnection(process.env.DATABASE_URL);

const showAdmins = async () => {
  const [rows] = await c.query(
    `SELECT id, email, name, userRole, lastSignedIn FROM users WHERE role='admin' ORDER BY id`
  );
  console.log(`\nAccounts with admin (${rows.length}):`);
  for (const r of rows) {
    console.log(`  #${String(r.id).padEnd(9)} ${String(r.email ?? "—").padEnd(34)} ${String(r.name ?? "").padEnd(20)} ${r.userRole ?? "—"}`);
  }
};

if (list || !email) { await showAdmins(); await c.end(); process.exit(0); }

const [found] = await c.query(
  `SELECT id, email, name, role, userRole, lastSignedIn FROM users WHERE email = ?`, [email]
);
if (!found.length) { console.error(`No account with email ${email}`); await c.end(); process.exit(1); }
if (found.length > 1) {
  console.error(`${found.length} accounts share that email — refusing to guess:`);
  found.forEach((r) => console.error(`  #${r.id} ${r.name}`));
  await c.end(); process.exit(1);
}

const u = found[0];
console.log(`Target: #${u.id}  ${u.email}  ${u.name}  (currently role=${u.role})`);
if (u.role === (revoke ? "user" : "admin")) {
  console.log("Already in that state — nothing to do.");
} else {
  await c.query(`UPDATE users SET role = ? WHERE id = ?`, [revoke ? "user" : "admin", u.id]);
  console.log(revoke ? "✓ admin REVOKED" : "✓ admin GRANTED");
}
await showAdmins();
await c.end();
