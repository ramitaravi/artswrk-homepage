/**
 * Minimal Canva Connect client. Runs entirely on the server: the connection
 * lives in app_settings, so nothing depends on anyone's computer or browser.
 *
 * Canva refresh tokens are single use, so each new one is saved before the
 * access token it came with is used. Tokens are encrypted at rest.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { appSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";

const API = "https://api.canva.com/rest/v1";
const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const REFRESH_KEY = "canva_refresh_token";
const PENDING_KEY = "canva_oauth_pending";
const AUTOFILL_POLL_MS = 1500;
const AUTOFILL_TIMEOUT_MS = 30_000;
export const CANVA_SCOPES = "design:content:read design:content:write folder:write";

const secretKey = () => createHash("sha256").update(`canva:${ENV.cookieSecret}`).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

async function readSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  return rows[0]?.settingValue ?? null;
}

async function writeSetting(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  await db
    .insert(appSettings)
    .values({ settingKey: key, settingValue: value, updatedBy: "canva-connection" })
    .onDuplicateKeyUpdate({ set: { settingValue: value, updatedBy: "canva-connection" } });
}

const basicAuth = () =>
  `Basic ${Buffer.from(`${ENV.canvaClientId}:${ENV.canvaClientSecret}`).toString("base64")}`;

async function requestToken(body: Record<string, string>): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Canva token request failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export const canvaRedirectUri = () => `${ENV.canvaRedirectBaseUrl.replace(/\/+$/, "")}/api/canva/callback`;

/** Step 1 of connecting: remember the PKCE secret and build Canva's approval URL. */
export async function startCanvaConnection(): Promise<string> {
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  await writeSetting(PENDING_KEY, encryptSecret(JSON.stringify({ verifier, state })));
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "s256",
    response_type: "code",
    client_id: ENV.canvaClientId,
    scope: CANVA_SCOPES,
    redirect_uri: canvaRedirectUri(),
    state,
  }).toString();
  return url.toString();
}

/** Step 2: Canva sent the admin back with a code. Store the long-lived connection. */
export async function finishCanvaConnection(code: string, state: string): Promise<void> {
  const pending = await readSetting(PENDING_KEY);
  if (!pending) throw new Error("no connection in progress");
  const { verifier, state: expected } = JSON.parse(decryptSecret(pending));
  if (state !== expected) throw new Error("state mismatch");
  const tokens = await requestToken({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: canvaRedirectUri(),
  });
  await writeSetting(REFRESH_KEY, encryptSecret(tokens.refresh_token));
  await writeSetting(PENDING_KEY, null);
}

export async function getCanvaAccessToken(): Promise<string> {
  const stored = await readSetting(REFRESH_KEY);
  if (!stored) throw new Error("Canva is not connected");
  const tokens = await requestToken({ grant_type: "refresh_token", refresh_token: decryptSecret(stored) });
  await writeSetting(REFRESH_KEY, encryptSecret(tokens.refresh_token));
  return tokens.access_token;
}

async function canvaJson(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Canva ${path} failed (${res.status}): ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Copy the template design with these text fields filled; returns the new design's id. */
export async function createDesignFromTemplate(
  token: string,
  templateDesignId: string,
  title: string,
  fields: Record<string, string>,
): Promise<string> {
  const data = Object.fromEntries(
    Object.entries(fields).map(([name, text]) => [name, { type: "text", text }]),
  );
  const created = await canvaJson(token, "/autofills", {
    method: "POST",
    body: JSON.stringify({ type: "create_from_design", design_id: templateDesignId, title, data }),
  });
  let job = created.job;
  const deadline = Date.now() + AUTOFILL_TIMEOUT_MS;
  while (job.status === "in_progress") {
    if (Date.now() > deadline) throw new Error(`Canva autofill ${job.id} timed out`);
    await new Promise((r) => setTimeout(r, AUTOFILL_POLL_MS));
    job = (await canvaJson(token, `/autofills/${job.id}`)).job;
  }
  const designId = job.result?.design?.id;
  if (job.status !== "success" || !designId) {
    throw new Error(`Canva autofill failed: ${job.error?.message ?? job.status}`);
  }
  return designId;
}

export async function moveToFolder(token: string, itemId: string, folderId: string): Promise<void> {
  await canvaJson(token, "/folders/move", {
    method: "POST",
    body: JSON.stringify({ item_id: itemId, to_folder_id: folderId }),
  });
}
