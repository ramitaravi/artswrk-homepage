import "dotenv/config";
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);
await c.query("ALTER TABLE bookings ADD completionReminderSentAt timestamp");
const [cols] = await c.query("SHOW COLUMNS FROM bookings LIKE 'completionReminderSentAt'");
console.log("column now exists:", cols.length > 0);
await c.end();
