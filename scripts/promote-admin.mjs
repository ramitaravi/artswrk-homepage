import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

// Show current users with their roles
const [users] = await db.execute(
  "SELECT id, name, email, role, openId FROM users ORDER BY createdAt ASC LIMIT 20"
);
console.log("\n=== Current users (first 20) ===");
console.table(users);

// Show the OWNER_OPEN_ID env
console.log("\nOWNER_OPEN_ID env:", process.env.OWNER_OPEN_ID || "(not set)");

// Promote users with nick+ferrari@artswrk.com or nick@artswrk.com to admin
const adminEmails = ["nick+ferrari@artswrk.com", "nick@artswrk.com", "artswrk@gmail.com"];
for (const email of adminEmails) {
  const [rows] = await db.execute("SELECT id, name, email, role FROM users WHERE email = ?", [email]);
  if (rows.length > 0) {
    await db.execute("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
    console.log(`\n✅ Promoted ${email} (${rows[0].name}) to admin`);
  } else {
    console.log(`\n⚠️  No user found with email: ${email}`);
  }
}

// Also promote by OWNER_OPEN_ID if set
if (process.env.OWNER_OPEN_ID) {
  const [rows] = await db.execute("SELECT id, name, email, role FROM users WHERE openId = ?", [process.env.OWNER_OPEN_ID]);
  if (rows.length > 0) {
    await db.execute("UPDATE users SET role = 'admin' WHERE openId = ?", [process.env.OWNER_OPEN_ID]);
    console.log(`\n✅ Promoted openId ${process.env.OWNER_OPEN_ID} (${rows[0].name} / ${rows[0].email}) to admin`);
  } else {
    console.log(`\n⚠️  No user found with OWNER_OPEN_ID: ${process.env.OWNER_OPEN_ID}`);
  }
}

// Show final admin users
const [admins] = await db.execute("SELECT id, name, email, role FROM users WHERE role = 'admin'");
console.log("\n=== Admin users after promotion ===");
console.table(admins);

await db.end();
