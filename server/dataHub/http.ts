/**
 * Minimal JSON-over-HTTPS helper for the Data Hub sync.
 * Uses node:https directly, like the rest of the Brevo code, to avoid the
 * undici TLS issues seen on this platform.
 */
import https from "https";

export interface JsonResponse<T = any> {
  status: number;
  data: T;
}

export function requestJson<T = any>(
  host: string,
  path: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
): Promise<JsonResponse<T>> {
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString() } : {}),
    ...opts.headers,
  };
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path, method: opts.method ?? "GET", headers }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let data: any = raw;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          /* keep raw text */
        }
        resolve({ status: res.statusCode ?? 0, data });
      });
    });
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout ${host}${path}`)));
    if (body) req.write(body);
    req.end();
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
