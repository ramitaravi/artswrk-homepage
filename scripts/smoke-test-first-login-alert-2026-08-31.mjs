/**
 * Disposable end-to-end test of the setInitialPassword flow + first-login
 * alert email: creates a fake legacy user with no password, calls the real
 * tRPC mutation against the running local dev server, confirms the password
 * hash gets set, then cleans up. Doesn't call the real email sender —
 * intercepts sgMail.send first, same technique as the preview scripts.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import crypto from "crypto";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const testEmail = `smoketest-first-login-${Date.now()}@example.com`;
const openId = `smoketest_${crypto.randomBytes(8).toString("hex")}`;

const [insertResult] = await c.query(
  `INSERT INTO users (openId, email, firstName, name, userRole, role, planTier, passwordHash, createdAt)
   VALUES (?, ?, 'Test', 'Test Smoketest', 'Artist', 'user', 'artist_free', NULL, NOW())`,
  [openId, testEmail]
);
const userId = insertResult.insertId;
console.log(`Created test user #${userId} (${testEmail}), no password set`);

const res = await fetch("http://localhost:3000/api/trpc/auth.setInitialPassword", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ json: { email: testEmail, password: "smoketest12345" } }),
});
const body = await res.json();
console.log("Mutation response status:", res.status);
console.log("Response:", JSON.stringify(body).slice(0, 300));

const [after] = await c.query("SELECT passwordHash IS NOT NULL AS hasPassword FROM users WHERE id = ?", [userId]);
console.log("Password hash set:", !!after[0].hasPassword);

if (res.status === 200 && after[0].hasPassword) {
  console.log("\nPASS — mutation succeeded and password was set. Check dev server logs for the alert email send.");
} else {
  console.log("\nFAIL — check response above.");
}

await c.query("DELETE FROM users WHERE id = ?", [userId]);
console.log("Cleaned up test user.");
await c.end();
