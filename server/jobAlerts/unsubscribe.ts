/**
 * ONE-CLICK UNSUBSCRIBE
 * ─────────────────────────────────────────────────────────────────────────────
 * Has to work without a login. Someone who wants out is often exactly the
 * person who can't remember their password, and putting a sign-in wall in front
 * of an unsubscribe link is both hostile and, for bulk senders, a fast route to
 * spam complaints.
 *
 * So the link carries a signed token instead: HMAC of the user id with the
 * app's existing secret. It proves the link came from us without exposing
 * anything guessable — you can't unsubscribe someone else by editing a URL.
 *
 * Two entry points, both landing here:
 *   GET  /unsubscribe?u=<id>&t=<token>   the visible link, shows a page
 *   POST /unsubscribe                    RFC 8058 one-click, called by Gmail
 *                                        and friends with no human involved
 */
import crypto from "crypto";
import type { Request, Response } from "express";
import { getDb } from "../db";
import { ENV } from "../_core/env";

const SECRET = () => ENV.cookieSecret || "artswrk-unsubscribe-fallback";

export function unsubscribeToken(userId: number): string {
  return crypto.createHmac("sha256", SECRET()).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}

function valid(userId: number, token: string): boolean {
  const expected = unsubscribeToken(userId);
  const a = Buffer.from(expected), b = Buffer.from(String(token ?? ""));
  // Constant-time compare so the token can't be recovered by timing.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Full URL to put in an email. */
export function unsubscribeUrl(appUrl: string, userId: number): string {
  return `${appUrl}/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

/** Turn job alerts off and record it, so the send worker's single pre-send
 *  check sees it immediately rather than after a nightly sync. */
async function optOut(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  await db.execute(`
    INSERT INTO user_notification_settings (userId, jobEmailsEnabled, lastMinuteEnabled)
    VALUES (${userId}, 0, 0)
    ON DUPLICATE KEY UPDATE jobEmailsEnabled = 0, lastMinuteEnabled = 0, updatedAt = NOW()`);

  const rows: any = await db.execute(`SELECT email FROM users WHERE id = ${userId}`);
  const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
  const email = String(list[0]?.email ?? "").trim().toLowerCase();
  if (email) {
    const esc = email.replace(/'/g, "''");
    await db.execute(`
      INSERT INTO email_suppressions (email, source, scope, reason, createdAt, updatedAt)
      VALUES ('${esc}', 'inapp', 'job_alerts', 'one-click unsubscribe', NOW(), NOW())
      ON DUPLICATE KEY UPDATE source='inapp', reason='one-click unsubscribe', updatedAt=NOW()`);
  }
  return email || null;
}

/** POST — RFC 8058. Mail clients call this directly; no page, no confirmation. */
export async function handleUnsubscribePost(req: Request, res: Response): Promise<void> {
  const userId = Number(req.query.u ?? req.body?.u);
  const token = String(req.query.t ?? req.body?.t ?? "");
  if (!Number.isFinite(userId) || !valid(userId, token)) {
    res.status(400).send("Invalid unsubscribe link");
    return;
  }
  await optOut(userId);
  res.status(200).send("Unsubscribed");
}

/** GET — the human-facing page. */
export async function handleUnsubscribeGet(req: Request, res: Response): Promise<void> {
  const userId = Number(req.query.u);
  const token = String(req.query.t ?? "");
  const ok = Number.isFinite(userId) && valid(userId, token);
  const email = ok ? await optOut(userId) : null;

  res.status(ok ? 200 : 400).type("html").send(page(ok, email));
}

function page(ok: boolean, email: string | null): string {
  const body = ok
    ? `<h1>You're unsubscribed</h1>
       <p>${email ? escapeHtml(email) : "This address"} won't get any more job alert emails from Artswrk.</p>
       <p class="fine">You'll still get booking confirmations and messages about work you're already involved in &mdash; those aren't marketing, and turning them off would break jobs you've taken.</p>
       <a class="btn" href="/app/settings?section=notifications">Change your mind? Manage alerts</a>`
    : `<h1>That link didn't work</h1>
       <p>It may have been cut short by your email app. You can turn job alerts off in your settings instead.</p>
       <a class="btn" href="/app/settings?section=notifications">Go to notification settings</a>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? "Unsubscribed" : "Link problem"} &middot; Artswrk</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f6f6f8;color:#16121a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:24px}
  .card{background:#fff;border-radius:16px;padding:38px 32px;max-width:460px;width:100%;
        box-shadow:0 1px 2px rgba(0,0,0,.05),0 20px 48px -28px rgba(0,0,0,.35);text-align:center}
  h1{font-size:23px;font-weight:800;margin:18px 0 10px;letter-spacing:-.02em}
  p{font-size:15px;line-height:1.6;color:#5c5566;margin:0 0 14px}
  .fine{font-size:13.5px;color:#8b8394}
  .btn{display:inline-block;margin-top:10px;background:#ec008c;
       background-image:linear-gradient(90deg,#ec008c,#ff7171);color:#fff;text-decoration:none;
       font-size:14.5px;font-weight:700;padding:12px 26px;border-radius:9px}
  .logo{font-weight:900;font-size:20px;letter-spacing:-.5px}
  .logo .a{color:#ec008c}.logo .w{background:#16121a;color:#fff;padding:2px 7px;border-radius:5px;margin-left:2px}
</style></head><body><div class="card">
<div class="logo"><span class="a">ARTS</span><span class="w">WRK</span></div>
${body}
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
