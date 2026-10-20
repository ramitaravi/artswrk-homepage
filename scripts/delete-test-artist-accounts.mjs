/**
 * Remove the three throwaway accounts created while testing the admin
 * "Create Artist" form on 2026-10-19.
 *
 *   211800014  ramita+testensite@artswrk.com          location "New Y"
 *   212070003  ramita+new+artist@artswrk.com
 *   212130002  ramita+artistnewtestbrody@artswrk.com
 *
 * ramita+brody@artswrk.com (212280034) is deliberately NOT in this list — it
 * is the one created after the fixes and is worth keeping to test with.
 *
 * A real person asking to be removed should go through admin.deactivateUser
 * instead, which is reversible and keeps the row. These are synthetic rows
 * inflating the artist counts, so they go properly.
 *
 * It refuses outright if an account turns out to have any real activity —
 * a booking, a payment, an application or a message. Test accounts have
 * none; anything that does is not a test account.
 *
 * Dry run by default. Pass --write to apply.
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const WRITE = process.argv.includes("--write");
const IDS = [211800014, 212070003, 212130002];
const KEEP = 212280034;

const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 30000 });

console.log(`${WRITE ? "APPLYING" : "DRY RUN"}\n`);

let blocked = false;
for (const id of IDS) {
  if (id === KEEP) { console.log(`✗ refusing to touch ${KEEP} — that one is being kept.`); blocked = true; continue; }

  const [[u]] = await c.query(
    `SELECT id, name, email, userRole, addedByAdmin, createdAt FROM users WHERE id = ?`, [id]);
  if (!u) { console.log(`  ${id}  already gone`); continue; }

  // Anything that would make this a real account rather than a test row.
  const counts = {};
  for (const [label, sql, param] of [
    ["bookings (as artist)", `SELECT COUNT(*) n FROM bookings WHERE artistUserId = ? AND deleted = 0`, id],
    ["bookings (as client)", `SELECT COUNT(*) n FROM bookings WHERE clientUserId = ? AND deleted = 0`, id],
    ["job applications",     `SELECT COUNT(*) n FROM interested_artists WHERE artistUserId = ?`, id],
    ["messages sent",        `SELECT COUNT(*) n FROM messages WHERE senderUserId = ?`, id],
    ["payments",             `SELECT COUNT(*) n FROM payments WHERE userId = ?`, id],
  ]) {
    try { const [[r]] = await c.query(sql, [param]); counts[label] = Number(r.n); }
    catch { counts[label] = "n/a"; }
  }
  const real = Object.values(counts).some((n) => typeof n === "number" && n > 0);
  const extras = Object.entries(counts).filter(([, n]) => n !== 0).map(([k, n]) => `${k}=${n}`);

  console.log(`  ${u.id}  ${u.name}  <${u.email}>  ${u.userRole}  created ${String(u.createdAt).slice(4, 15)}`);
  console.log(`      activity: ${extras.length ? extras.join(", ") : "none"}`);

  if (real) {
    console.log(`      ✗ REFUSING — this account has real activity, it is not a test row.\n`);
    blocked = true;
    continue;
  }

  if (WRITE) {
    // Dependent rows first; `users` has no cascade.
    const [aff] = await c.query(`DELETE FROM user_affiliations WHERE artistUserId = ?`, [id]);
    const [tok] = await c.query(`DELETE FROM password_reset_tokens WHERE userId = ?`, [id]);
    await c.query(`DELETE FROM users WHERE id = ?`, [id]);
    console.log(`      ✓ deleted (plus ${aff.affectedRows} affiliation tag(s), ${tok.affectedRows} claim token(s))\n`);
  } else {
    console.log(`      would delete the user, its affiliation tags and any claim tokens\n`);
  }
}

if (!WRITE) console.log("Nothing written — re-run with --write.");
else if (blocked) console.log("Finished, but something was refused above.");

await c.end();
