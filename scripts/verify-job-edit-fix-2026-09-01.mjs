/**
 * Reproduces the "value.toISOString is not a function" save failure and proves
 * the fix, using a throwaway job row that is deleted afterwards.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
const { updateAdminJob, getAdminJobById } = await import("../server/db.ts");

const c = await mysql.createConnection(process.env.DATABASE_URL);
const [ins] = await c.query(
  `INSERT INTO jobs (title, description, requestStatus, status, dateType, startDate, endDate, createdAt)
   VALUES ('QA date-coercion job', 'temp', 'Active', 'Active', 'Dates Flexible', '2026-10-01 00:00:00', '2026-10-05 00:00:00', NOW())`
);
const id = ins.insertId;
console.log(`temp job #${id} created\n`);

try {
  // Exactly what the Edit Job modal sends when only the title changed:
  // date-only STRINGS for startDate/endDate.
  console.log("1. simulating the old bug (raw strings straight to Drizzle):");
  try {
    const { getDb } = await import("../server/db.ts");
    const db = await getDb();
    const { eq } = await import("drizzle-orm");
    const { jobs } = await import("../drizzle/schema.ts");
    await db.update(jobs).set({ startDate: "2026-10-02" }).where(eq(jobs.id, id));
    console.log("   no error (unexpected)");
  } catch (e) {
    console.log("   reproduced:", e.message);
  }

  console.log("\n2. same strings through updateAdminJob (the fixed path):");
  await updateAdminJob(id, { title: "QA renamed only", startDate: "2026-10-02", endDate: "2026-10-06" });
  const after = await getAdminJobById(id);
  console.log("   saved OK");
  console.log("   title    :", after.title);
  console.log("   startDate:", after.startDate instanceof Date ? after.startDate.toISOString() : after.startDate);
  console.log("   endDate  :", after.endDate instanceof Date ? after.endDate.toISOString() : after.endDate);

  console.log("\n3. clearing a date (null) still works:");
  await updateAdminJob(id, { endDate: null });
  const cleared = await getAdminJobById(id);
  console.log("   endDate:", cleared.endDate);
} finally {
  await c.query("DELETE FROM jobs WHERE id = ?", [id]);
  console.log(`\ntemp job #${id} deleted`);
  await c.end();
}
process.exit(0);
