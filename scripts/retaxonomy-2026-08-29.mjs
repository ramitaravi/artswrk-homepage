/**
 * One-time taxonomy restructure for master_artist_types / master_service_types,
 * per Ramita's 2026-08-29 spec. Everything below is keyed by id/bubbleId, never
 * by name — renames only touch the lookup row, so any user's stored bubbleId
 * keeps resolving to the new label automatically. Merges (Yoga/Pilates ->
 * Fitness, Creator -> Content Creator) remap affected users' stored bubbleId
 * before retiring the old row (isPublic=false, not deleted).
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

function log(...args) {
  console.log(...args);
}

// ── Step 1: renames (id stable, bubbleId stable — no user data touched) ──
log("\n=== Step 1: renames ===");
await conn.execute(`UPDATE master_service_types SET name = 'Weekly Teacher' WHERE id = 3`);
log("  service id 3: Recurring Classes -> Weekly Teacher");
await conn.execute(`UPDATE master_artist_types SET name = 'Dance Competition Staff' WHERE id = 3`);
log("  artist type id 3: Dance Adjudicator -> Dance Competition Staff");
await conn.execute(`UPDATE master_service_types SET name = 'Judge' WHERE id = 13`);
log("  service id 13: Dance Competition Judge -> Judge");

// ── Step 2: new competition-staff sub-roles under artist type id 3 ──
log("\n=== Step 2: insert Dance Competition Staff sub-roles (parent id 3) ===");
const staffRoles = [
  "Tabulator", "Emcee", "Backstage Staff", "Merch", "Awards",
  "Registration", "Stage Manager", "Crew", "Event Director",
];
for (const name of staffRoles) {
  const [res] = await conn.execute(
    `INSERT INTO master_service_types (name, masterArtistTypeId, isPublic) VALUES (?, 3, 1)`,
    [name]
  );
  log(`  inserted "${name}" (id ${res.insertId})`);
}

// ── Step 3: Competition Photography / Videography ──
log("\n=== Step 3: insert Competition Photography/Videography ===");
{
  const [res] = await conn.execute(
    `INSERT INTO master_service_types (name, masterArtistTypeId, isPublic) VALUES ('Competition Photography', 2, 1)`
  );
  log(`  inserted "Competition Photography" (parent 2, id ${res.insertId})`);
}
{
  const [res] = await conn.execute(
    `INSERT INTO master_service_types (name, masterArtistTypeId, isPublic) VALUES ('Competition Videography', 4, 1)`
  );
  log(`  inserted "Competition Videography" (parent 4, id ${res.insertId})`);
}

// ── Step 4: Sales, Data Entry under Side Jobs (id 7) ──
log("\n=== Step 4: insert Sales, Data Entry (parent id 7) ===");
for (const name of ["Sales", "Data Entry"]) {
  const [res] = await conn.execute(
    `INSERT INTO master_service_types (name, masterArtistTypeId, isPublic) VALUES (?, 7, 1)`,
    [name]
  );
  log(`  inserted "${name}" (id ${res.insertId})`);
}

// ── Step 5: reparent Event Performers (id 20) under Side Jobs (id 7) ──
log("\n=== Step 5: reparent Event Performers -> Side Jobs ===");
await conn.execute(`UPDATE master_service_types SET masterArtistTypeId = 7 WHERE id = 20`);
log("  service id 20 (Event Performers): masterArtistTypeId NULL -> 7");

// ── Step 6: merge + retire Yoga(22)/Pilates(23) -> Fitness(31), Creator(21) -> Content Creator(32) ──
log("\n=== Step 6: merge + retire ===");
const MERGES = [
  { fromId: 22, fromName: "Yoga Instructor", toId: 31, toName: "Fitness" },
  { fromId: 23, fromName: "Pilates Instructor", toId: 31, toName: "Fitness" },
  { fromId: 21, fromName: "Creator", toId: 32, toName: "Content Creator" },
];

for (const { fromId, fromName, toId, toName } of MERGES) {
  const [[fromRow]] = await conn.execute(`SELECT bubbleId FROM master_service_types WHERE id = ?`, [fromId]);
  const [[toRow]] = await conn.execute(`SELECT bubbleId FROM master_service_types WHERE id = ?`, [toId]);
  const fromBubbleId = fromRow?.bubbleId;
  const toBubbleId = toRow?.bubbleId;

  if (!fromBubbleId) {
    log(`  ${fromName} (id ${fromId}) has no bubbleId — nothing to remap by ID, checking for stray literal-name matches only`);
  }

  let remapped = 0;
  if (fromBubbleId) {
    for (const col of ["artistServices", "masterServiceType"]) {
      const [rows] = await conn.execute(
        `SELECT id, ${col} AS val FROM users WHERE ${col} LIKE ?`,
        [`%${fromBubbleId}%`]
      );
      for (const row of rows) {
        let arr;
        try {
          arr = JSON.parse(row.val);
        } catch {
          continue;
        }
        if (!Array.isArray(arr) || !arr.includes(fromBubbleId)) continue;
        const next = arr.filter((v) => v !== fromBubbleId);
        if (toBubbleId && !next.includes(toBubbleId)) next.push(toBubbleId);
        await conn.execute(`UPDATE users SET ${col} = ? WHERE id = ?`, [JSON.stringify(next), row.id]);
        remapped++;
      }
    }
  }
  log(`  ${fromName} -> ${toName}: remapped ${remapped} user field(s)`);

  await conn.execute(`UPDATE master_service_types SET isPublic = 0 WHERE id = ?`, [fromId]);
  log(`  ${fromName} (id ${fromId}) set isPublic = 0 (retired, not deleted)`);
}

// ── Step 7: one-off literal-string fixes for the 2 real users found during planning ──
log("\n=== Step 7: one-off literal-string fixes ===");
{
  const [res] = await conn.execute(
    `UPDATE users SET artistServices = REPLACE(artistServices, 'Recurring Classes', 'Weekly Teacher')
     WHERE artistServices LIKE '%Recurring Classes%'`
  );
  log(`  artistServices literal "Recurring Classes" -> "Weekly Teacher": ${res.affectedRows} row(s)`);
}
{
  const [res] = await conn.execute(
    `UPDATE users SET workTypes = REPLACE(workTypes, 'Dance Adjudicator', 'Dance Competition Staff')
     WHERE workTypes LIKE '%Dance Adjudicator%'`
  );
  log(`  workTypes literal "Dance Adjudicator" -> "Dance Competition Staff": ${res.affectedRows} row(s)`);
}

// ── Verification ──
log("\n=== Verification: post-merge reference counts (should all be 0) ===");
for (const { fromId, fromName } of MERGES) {
  const [[fromRow]] = await conn.execute(`SELECT bubbleId FROM master_service_types WHERE id = ?`, [fromId]);
  if (!fromRow?.bubbleId) {
    log(`  ${fromName}: no bubbleId, skip`);
    continue;
  }
  const [[a]] = await conn.execute(`SELECT COUNT(*) n FROM users WHERE artistServices LIKE ?`, [`%${fromRow.bubbleId}%`]);
  const [[m]] = await conn.execute(`SELECT COUNT(*) n FROM users WHERE masterServiceType LIKE ?`, [`%${fromRow.bubbleId}%`]);
  log(`  ${fromName}: artistServices refs=${a.n}, masterServiceType refs=${m.n}`);
}

log("\n=== Final master_service_types under artist type id 3 (Dance Competition Staff) ===");
const [finalRows] = await conn.execute(
  `SELECT id, name, isPublic FROM master_service_types WHERE masterArtistTypeId = 3 ORDER BY id`
);
console.table(finalRows);

log("\nDone.");
await conn.end();
