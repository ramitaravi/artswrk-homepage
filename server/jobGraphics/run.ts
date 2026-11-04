/**
 * The daily run: new jobs from our own database -> filled Canva designs -> the
 * team's shared folder. A Manus Heartbeat cron calls it, so it runs whether or
 * not anyone's computer is on. The team posts from the folder; nothing here
 * publishes anywhere public.
 */
import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { requireCronRequest } from "../_core/cronAuth";
import { ENV } from "../_core/env";
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { createDesignFromTemplate, getCanvaAccessToken, moveToFolder } from "./canva";
import { decideGraphic, type GraphicJob } from "./format";

/** Most graphics in one day, so a burst of jobs can't flood the folder. */
export const MAX_GRAPHICS_PER_RUN = 10;
/** Only recently posted jobs, so the first run doesn't work through the backlog. */
export const LOOKBACK_DAYS = 7;
const MAX_ATTEMPTS = 3;
/** The platform drops callbacks after about 2 minutes. Stop early; tomorrow picks up the rest. */
const TIME_BUDGET_MS = 90_000;

export type RunResult = { created: number; failed: number; skipped: number; errors: string[] };

const rowsOf = <T>(result: unknown): T[] => (result as [T[]])[0];

async function ensureTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_graphics (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      jobId int NOT NULL UNIQUE,
      dedupeKey varchar(191) NOT NULL,
      status enum('created','failed') NOT NULL,
      attempts int NOT NULL DEFAULT 1,
      canvaDesignId varchar(64),
      lastError text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY job_graphics_dedupeKey_idx (dedupeKey)
    )`);
}

export async function runJobGraphics(): Promise<RunResult> {
  const templateId = ENV.canvaTemplateDesignId;
  const folderId = ENV.canvaJobsFolderId;
  if (!templateId || !folderId) throw new Error("CANVA_TEMPLATE_DESIGN_ID and CANVA_JOBS_FOLDER_ID are required");
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  await ensureTable(db);

  // Same audience as the public board: Active and not a direct-hire request.
  const jobs = rowsOf<GraphicJob & { attempts: number | null }>(await db.execute(sql`
    SELECT j.id, j.title, j.dateType, j.startDate, j.isHourly, j.openRate,
           j.artistHourlyRate, j.clientHourlyRate, j.artistFlatRate, j.clientFlatRate,
           j.locationCity, j.locationState, j.locationAddress, g.attempts
    FROM jobs j
    LEFT JOIN job_graphics g ON g.jobId = j.id
    WHERE j.requestStatus = 'Active'
      AND (j.direct IS NULL OR j.direct = 0)
      AND j.createdAt >= NOW() - INTERVAL ${LOOKBACK_DAYS} DAY
      AND (g.id IS NULL OR (g.status = 'failed' AND g.attempts < ${MAX_ATTEMPTS}))
    ORDER BY j.createdAt DESC
    LIMIT 200`));
  const madeKeys = new Set(
    rowsOf<{ dedupeKey: string }>(await db.execute(sql`SELECT dedupeKey FROM job_graphics WHERE status = 'created'`))
      .map((r) => r.dedupeKey),
  );

  const result: RunResult = { created: 0, failed: 0, skipped: 0, errors: [] };
  const startedAt = Date.now();
  let token: string | null = null;

  for (const job of jobs) {
    if (result.created >= MAX_GRAPHICS_PER_RUN || Date.now() - startedAt > TIME_BUDGET_MS) break;
    const decision = decideGraphic(job);
    if (!decision.ok || madeKeys.has(decision.dedupeKey)) {
      result.skipped++;
      continue;
    }
    token ??= await getCanvaAccessToken();
    try {
      const { title, location } = decision.fields;
      const designId = await createDesignFromTemplate(token, templateId, `${title} - ${location}`, {
        ...decision.fields,
        location: `📍 ${location}`,
      });
      await moveToFolder(token, designId, folderId);
      await db.execute(sql`
        INSERT INTO job_graphics (jobId, dedupeKey, status, canvaDesignId)
        VALUES (${job.id}, ${decision.dedupeKey}, 'created', ${designId})
        ON DUPLICATE KEY UPDATE status = 'created', canvaDesignId = ${designId},
          attempts = attempts + 1, lastError = NULL`);
      madeKeys.add(decision.dedupeKey);
      result.created++;
    } catch (err) {
      const message = (err as Error).message.slice(0, 1000);
      await db.execute(sql`
        INSERT INTO job_graphics (jobId, dedupeKey, status, lastError)
        VALUES (${job.id}, ${decision.dedupeKey}, 'failed', ${message})
        ON DUPLICATE KEY UPDATE status = 'failed', attempts = attempts + 1, lastError = ${message}`);
      result.failed++;
      result.errors.push(`job ${job.id}: ${message}`);
    }
  }
  return result;
}

/** Tell the owner when it breaks: otherwise the folder just quietly stops filling. */
async function alertFailure(summary: string) {
  try {
    await notifyOwner({ title: "Daily job graphics had a problem", content: summary.slice(0, 2000) });
  } catch (err) {
    console.error("[job-graphics] could not send alert:", (err as Error).message);
  }
}

export async function handleScheduledJobGraphics(req: Request, res: Response): Promise<void> {
  try {
    await requireCronRequest(req);
  } catch {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }
  try {
    const result = await runJobGraphics();
    console.log(`[job-graphics] created ${result.created}, failed ${result.failed}, skipped ${result.skipped}`);
    if (result.failed) await alertFailure(result.errors.join("\n"));
    res.json({ ok: true, ...result });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[job-graphics] run failed:", message);
    await alertFailure(message);
    res.status(500).json({ error: "job graphics run failed" });
  }
}
