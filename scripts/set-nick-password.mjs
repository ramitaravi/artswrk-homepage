import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const PASSWORD = "ArtswrkDemo2024";
const EMAIL = "nick+ferrari@artswrk.com";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const hash = await bcrypt.hash(PASSWORD, 12);

  const [result] = await conn.execute(
    "UPDATE users SET passwordHash = ?, passwordIsTemporary = 0, updatedAt = NOW() WHERE email = ?",
    [hash, EMAIL]
  );

  console.log("Updated rows:", result.affectedRows);
  if (result.affectedRows === 1) {
    console.log(`✅ Password set for ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
  } else {
    console.log("❌ No user found with that email");
  }

  await conn.end();
}

main().catch(console.error);
