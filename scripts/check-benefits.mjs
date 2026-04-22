import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query("SELECT id, companyName, audienceTypes, categories FROM benefits LIMIT 5");
console.log("Total sample:", rows.length);
for (const r of rows) {
  console.log(JSON.stringify(r));
}
const [[{ total }]] = await conn.query("SELECT COUNT(*) as total FROM benefits");
console.log("Total in DB:", total);
await conn.end();
