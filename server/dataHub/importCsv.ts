/**
 * Admin import of the master Data Hub Google Sheet.
 *
 * The sheet holds studio PII and the repo is public, so nothing from it is
 * committed: an admin exports a tab as CSV (File → Download → CSV) and
 * uploads it on the Leads CRM page. Recognised tabs:
 *   - "Studios | Ensemble Master List"  → Row ID + DO NOT CONTACT
 *   - "Studios | Dance TAM (Non Ensemble)" → DO NOT CONTACT
 *   - "DNC Log" → Email + Scope
 *
 * DNC is sticky: an import can set it but never clear it. Lifting a DNC is a
 * deliberate admin action (clearDnc), so re-importing an older export can't
 * silently put someone back on the mailing list.
 */
import { parse } from "csv-parse/sync";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { dataHubFlags } from "../../drizzle/schema";

export type SourceTab = "master_list" | "dance_tam" | "dnc_log";

export interface ParsedFlag {
  email: string;
  masterRowId: string | null;
  studioName: string | null;
  doNotContact: boolean;
  dncScope: string | null;
}

const norm = (s: unknown) => String(s ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Scope text → whether email outreach must stop. "M&A only" stays contactable. */
export function scopeBlocksEmail(scope: string): boolean {
  const s = scope.trim().toLowerCase();
  if (!s) return false;
  if (s.startsWith("m&a only") || s.startsWith("m & a only")) return false;
  return true;
}

/** Pure: parse a CSV export of one Data Hub tab. */
export function parseDataHubCsv(text: string, tab: SourceTab): ParsedFlag[] {
  const rows: string[][] = parse(text, { relax_column_count: true, skip_empty_lines: false, bom: true });
  const headerIdx = rows.findIndex((r) => r.some((c) => /^e-?mail$/i.test(norm(c))));
  if (headerIdx < 0) throw new Error("Couldn't find a header row with an 'Email' column");
  const header = rows[headerIdx].map((h) => norm(h).toLowerCase());
  const col = (pred: (h: string) => boolean) => header.findIndex(pred);

  const emailCol = col((h) => /^e-?mail$/.test(h));
  const rowIdCol = col((h) => h === "row id");
  const studioCol = col((h) => h === "studio name" || h === "studio/person");
  const dncCol = col((h) => h === "do not contact");
  const scopeCol = col((h) => h.startsWith("scope"));

  const byEmail = new Map<string, ParsedFlag>();
  for (const r of rows.slice(headerIdx + 1)) {
    const email = norm(r[emailCol]).toLowerCase();
    if (!EMAIL.test(email)) continue;

    let dncScope: string | null = null;
    let doNotContact = false;
    if (tab === "dnc_log" && scopeCol >= 0) {
      dncScope = norm(r[scopeCol]) || null;
      doNotContact = !!dncScope && scopeBlocksEmail(dncScope);
    } else if (dncCol >= 0) {
      const v = norm(r[dncCol]);
      if (/do not contact/i.test(v)) {
        dncScope = v.length > 128 ? v.slice(0, 128) : v;
        doNotContact = true;
      }
    }

    const prev = byEmail.get(email);
    byEmail.set(email, {
      email,
      masterRowId: prev?.masterRowId ?? (tab === "master_list" && rowIdCol >= 0 ? norm(r[rowIdCol]) || null : null),
      studioName: prev?.studioName ?? (studioCol >= 0 ? norm(r[studioCol]).slice(0, 256) || null : null),
      doNotContact: (prev?.doNotContact ?? false) || doNotContact,
      dncScope: doNotContact ? dncScope : prev?.dncScope ?? dncScope,
    });
  }
  return [...byEmail.values()];
}

export async function importDataHubCsv(text: string, tab: SourceTab) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const flags = parseDataHubCsv(text, tab);

  let written = 0;
  for (let i = 0; i < flags.length; i += 500) {
    const chunk = flags.slice(i, i + 500).map((f) => ({ ...f, sourceTab: tab }));
    await db
      .insert(dataHubFlags)
      .values(chunk)
      .onDuplicateKeyUpdate({
        set: {
          masterRowId: sql`COALESCE(VALUES(masterRowId), masterRowId)`,
          studioName: sql`COALESCE(VALUES(studioName), studioName)`,
          // Sticky: once DNC, always DNC until clearDnc.
          doNotContact: sql`doNotContact OR VALUES(doNotContact)`,
          dncScope: sql`IF(VALUES(doNotContact), VALUES(dncScope), dncScope)`,
        },
      });
    written += chunk.length;
  }
  const dnc = flags.filter((f) => f.doNotContact).length;
  console.log(`[data-hub] import ${tab}: ${written} rows, ${dnc} DNC`);
  return { rows: written, dnc };
}

/** Deliberately lift a DNC. Does not un-blacklist in Brevo — do that in Brevo. */
export async function clearDnc(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(dataHubFlags)
    .set({ doNotContact: false, dncScope: null, dncAppliedAt: null })
    .where(eq(dataHubFlags.email, email.trim().toLowerCase()));
}
