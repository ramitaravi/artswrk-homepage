/**
 * BUBBLE API PROXY
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side module that talks to the live Artswrk Bubble app's REST Data API.
 * All responses are cached in-memory for CACHE_TTL_MS to avoid hammering Bubble.
 *
 * Bubble Data API base: https://artswrk.com/version-live/api/1.1/obj/<type>
 * Bubble Workflow API:  https://artswrk.com/version-live/api/1.1/wf/<workflow>
 *
 * Env vars required:
 *   BUBBLE_API_KEY          — Bearer token from Bubble Settings → API
 *   BUBBLE_WEBHOOK_SECRET   — Shared secret for verifying incoming Bubble webhooks
 */

import { ENV } from "./_core/env";

// ── Config ────────────────────────────────────────────────────────────────────

const BUBBLE_BASE = "https://artswrk.com/version-live/api/1.1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function bustCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function bubbleFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = process.env.BUBBLE_API_KEY;
  if (!apiKey) throw new Error("BUBBLE_API_KEY is not configured");

  const url = `${BUBBLE_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bubble API error ${res.status} for ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Bubble response shapes ────────────────────────────────────────────────────

export interface BubbleListResponse<T> {
  response: {
    results: T[];
    count: number;
    remaining: number;
    cursor: number;
  };
}

export interface BubbleSingleResponse<T> {
  response: T;
}

// ── Artist / User types ───────────────────────────────────────────────────────

export interface BubbleArtist {
  _id: string;
  "Created Date": string;
  "Modified Date": string;
  "First name": string;
  "Last name": string;
  email: string;
  slug?: string;
  bio?: string;
  location?: string;
  "Profile picture"?: string;
  "Master artist types"?: string[];
  "Artist services"?: string[];
  "Artswrk Pro"?: boolean;
  "Rating average"?: number;
  "Total bookings"?: number;
  Portfolio?: string[];
  Resumes?: string[];
  Instagram?: string;
  Website?: string;
  Pronouns?: string;
  "Phone number"?: string;
}

// ── Job types ─────────────────────────────────────────────────────────────────

export interface BubbleJob {
  _id: string;
  "Created Date": string;
  "Modified Date": string;
  "Service type": string;
  Description?: string;
  "Start date"?: string;
  "End date"?: string;
  "Location address"?: string;
  "Rate type"?: string;
  Rate?: number;
  "Request status"?: string;
  "Client user"?: string; // Bubble user ID
  "Artist types"?: string[];
  "Job type"?: string;
  "Is premium"?: boolean;
}

// ── Booking types ─────────────────────────────────────────────────────────────

export interface BubbleBooking {
  _id: string;
  "Created Date": string;
  "Modified Date": string;
  "Job request"?: string;
  "Artist user"?: string;
  "Client user"?: string;
  Status?: string;
  "Payment status"?: string;
  "Total amount"?: number;
}

// ── API methods ───────────────────────────────────────────────────────────────

/**
 * Fetch a single artist/user from Bubble by their Bubble ID.
 * Cached for 5 minutes.
 */
export async function getBubbleArtistById(bubbleId: string): Promise<BubbleArtist | null> {
  const cacheKey = `artist:${bubbleId}`;
  const cached = getCached<BubbleArtist>(cacheKey);
  if (cached) return cached;

  try {
    const data = await bubbleFetch<BubbleSingleResponse<BubbleArtist>>(`/obj/user/${bubbleId}`);
    setCached(cacheKey, data.response);
    return data.response;
  } catch (err) {
    console.error("[BubbleAPI] getBubbleArtistById error:", err);
    return null;
  }
}

/**
 * Fetch a paginated list of artists from Bubble.
 * Supports search by name and filtering by artist type.
 */
export async function getBubbleArtists({
  limit = 20,
  cursor = 0,
  search,
  artistType,
}: {
  limit?: number;
  cursor?: number;
  search?: string;
  artistType?: string;
} = {}): Promise<{ artists: BubbleArtist[]; count: number; remaining: number }> {
  const params = new URLSearchParams({
    limit: String(limit),
    cursor: String(cursor),
  });

  const constraints: object[] = [
    { key: "User type", constraint_type: "equals", value: "Artist" },
  ];

  if (search) {
    constraints.push({
      key: "name",
      constraint_type: "contains",
      value: search,
    });
  }

  if (artistType) {
    constraints.push({
      key: "Master artist types",
      constraint_type: "contains",
      value: artistType,
    });
  }

  params.set("constraints", JSON.stringify(constraints));

  const cacheKey = `artists:${params.toString()}`;
  const cached = getCached<{ artists: BubbleArtist[]; count: number; remaining: number }>(cacheKey);
  if (cached) return cached;

  try {
    const data = await bubbleFetch<BubbleListResponse<BubbleArtist>>(`/obj/user?${params}`);
    const result = {
      artists: data.response.results,
      count: data.response.count,
      remaining: data.response.remaining,
    };
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[BubbleAPI] getBubbleArtists error:", err);
    return { artists: [], count: 0, remaining: 0 };
  }
}

/**
 * Fetch a paginated list of active jobs from Bubble.
 */
export async function getBubbleJobs({
  limit = 20,
  cursor = 0,
  status = "Active",
}: {
  limit?: number;
  cursor?: number;
  status?: string;
} = {}): Promise<{ jobs: BubbleJob[]; count: number; remaining: number }> {
  const constraints = [
    { key: "Request status", constraint_type: "equals", value: status },
  ];

  const params = new URLSearchParams({
    limit: String(limit),
    cursor: String(cursor),
    constraints: JSON.stringify(constraints),
    sort_field: "Created Date",
    descending: "true",
  });

  const cacheKey = `jobs:${params.toString()}`;
  const cached = getCached<{ jobs: BubbleJob[]; count: number; remaining: number }>(cacheKey);
  if (cached) return cached;

  try {
    const data = await bubbleFetch<BubbleListResponse<BubbleJob>>(`/obj/job-request?${params}`);
    const result = {
      jobs: data.response.results,
      count: data.response.count,
      remaining: data.response.remaining,
    };
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[BubbleAPI] getBubbleJobs error:", err);
    return { jobs: [], count: 0, remaining: 0 };
  }
}

/**
 * Fetch a single job from Bubble by its Bubble ID.
 */
export async function getBubbleJobById(bubbleId: string): Promise<BubbleJob | null> {
  const cacheKey = `job:${bubbleId}`;
  const cached = getCached<BubbleJob>(cacheKey);
  if (cached) return cached;

  try {
    const data = await bubbleFetch<BubbleSingleResponse<BubbleJob>>(`/obj/job-request/${bubbleId}`);
    setCached(cacheKey, data.response);
    return data.response;
  } catch (err) {
    console.error("[BubbleAPI] getBubbleJobById error:", err);
    return null;
  }
}

/**
 * Update a user record in Bubble (for two-way sync when user edits profile in Manus app).
 * This calls the Bubble Workflow API — requires a "update_user_from_manus" workflow to be
 * set up in Bubble Backend Workflows.
 */
export async function pushProfileUpdateToBubble(bubbleId: string, fields: {
  bio?: string;
  location?: string;
  instagram?: string;
  website?: string;
  pronouns?: string;
}): Promise<boolean> {
  try {
    await bubbleFetch(`/wf/update_user_from_manus`, {
      method: "POST",
      body: JSON.stringify({ bubble_id: bubbleId, ...fields }),
    });
    // Bust the cache for this artist so next read is fresh
    bustCache(`artist:${bubbleId}`);
    return true;
  } catch (err) {
    console.error("[BubbleAPI] pushProfileUpdateToBubble error:", err);
    return false;
  }
}

// ── Webhook event types ───────────────────────────────────────────────────────

export type BubbleWebhookEvent =
  | { event: "job.created"; data: BubbleJob }
  | { event: "job.updated"; data: BubbleJob }
  | { event: "booking.confirmed"; data: BubbleBooking }
  | { event: "booking.completed"; data: BubbleBooking }
  | { event: "profile.updated"; data: BubbleArtist };

/**
 * Verify a Bubble webhook request using the shared secret.
 * Bubble sends the secret as a custom header: X-Bubble-Webhook-Secret
 */
export function verifyBubbleWebhook(secret: string | undefined): boolean {
  const expected = process.env.BUBBLE_WEBHOOK_SECRET;
  if (!expected) {
    // If no secret is configured, skip verification (dev mode)
    console.warn("[BubbleWebhook] BUBBLE_WEBHOOK_SECRET not set — skipping verification");
    return true;
  }
  return secret === expected;
}
