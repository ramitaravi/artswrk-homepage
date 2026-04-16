/**
 * BUBBLE WEBHOOK HANDLER
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives POST events from Bubble Backend Workflows and upserts data into
 * the Manus MySQL database so both apps stay in lock-step.
 *
 * Endpoint: POST /api/webhooks/bubble
 *
 * Bubble sends a custom header:  X-Bubble-Webhook-Secret: <your secret>
 * Set BUBBLE_WEBHOOK_SECRET in Secrets to enable verification.
 *
 * Supported event types (set in Bubble workflow "Initialize data" step):
 *   job.created       — new job posted in Bubble
 *   job.updated       — job status changed in Bubble
 *   booking.confirmed — booking confirmed in Bubble
 *   booking.completed — booking marked complete in Bubble
 *   profile.updated   — artist/user profile edited in Bubble
 */

import { Request, Response } from "express";
import { verifyBubbleWebhook, bustCache, BubbleArtist, BubbleJob, BubbleBooking } from "./bubbleApi";
import { getDb } from "./db";
import { users, jobs, bookings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertArtistFromBubble(artist: BubbleArtist): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const firstName = artist["First name"] ?? "";
  const lastName = artist["Last name"] ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const profileData = {
    name: fullName || null,
    firstName: firstName || null,
    lastName: lastName || null,
    email: artist.email,
    bio: artist.bio ?? null,
    location: artist.location ?? null,
    profilePicture: artist["Profile picture"] ?? null,
    masterArtistTypes: artist["Master artist types"]
      ? JSON.stringify(artist["Master artist types"])
      : null,
    artistServices: artist["Artist services"]
      ? JSON.stringify(artist["Artist services"])
      : null,
    artswrkPro: artist["Artswrk Pro"] ?? false,
    ratingAverage: artist["Rating average"] ?? null,
    totalBookings: artist["Total bookings"] ?? null,
    mediaPhotos: artist.Portfolio ? JSON.stringify(artist.Portfolio) : null,
    instagram: artist.Instagram ?? null,
    website: artist.Website ?? null,
    pronouns: artist.Pronouns ?? null,
    phoneNumber: artist["Phone number"] ?? null,
  };

  // Check if user exists by bubbleId
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.bubbleId, artist._id))
    .limit(1);

  if (existing) {
    await db.update(users).set(profileData).where(eq(users.bubbleId, artist._id));
    console.log(`[BubbleWebhook] Updated artist ${artist._id} (${fullName})`);
  } else {
    // New user — insert with Artist role
    await db.insert(users).values({
      ...profileData,
      bubbleId: artist._id,
      userRole: "Artist",
      bubbleCreatedAt: artist["Created Date"]
        ? new Date(artist["Created Date"])
        : null,
    } as any);
    console.log(`[BubbleWebhook] Inserted new artist ${artist._id} (${fullName})`);
  }

  // Bust the Bubble API cache for this artist
  bustCache(`artist:${artist._id}`);
}

async function upsertJobFromBubble(job: BubbleJob): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const jobData = {
    masterServiceTypeId: job["Service type"] ?? null,
    description: job.Description ?? null,
    startDate: job["Start date"] ? new Date(job["Start date"]) : null,
    endDate: job["End date"] ? new Date(job["End date"]) : null,
    locationAddress: job["Location address"] ?? null,
    rateType: job["Rate type"] ?? null,
    rate: job.Rate ?? null,
    requestStatus: job["Request status"] ?? "Active",
    artistTypes: job["Artist types"] ? JSON.stringify(job["Artist types"]) : null,
    jobType: job["Job type"] ?? null,
    isPremium: job["Is premium"] ? 1 : 0,
    bubbleCreatedAt: job["Created Date"]
      ? new Date(job["Created Date"])
      : null,
  };

  // Check if job exists by bubbleId
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.bubbleId, job._id))
    .limit(1);

  if (existing) {
    await db.update(jobs).set(jobData).where(eq(jobs.bubbleId, job._id));
    console.log(`[BubbleWebhook] Updated job ${job._id}`);
  } else {
    await db.insert(jobs).values({
      ...jobData,
      bubbleId: job._id,
    } as any);
    console.log(`[BubbleWebhook] Inserted new job ${job._id}`);
  }

  // Bust the Bubble API cache for jobs
  bustCache("jobs:");
  bustCache(`job:${job._id}`);
}

async function upsertBookingFromBubble(booking: BubbleBooking): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const bookingData = {
    status: booking.Status ?? null,
    paymentStatus: booking["Payment status"] ?? null,
    totalAmount: booking["Total amount"] ?? null,
    bubbleCreatedAt: booking["Created Date"]
      ? new Date(booking["Created Date"])
      : null,
  };

  const [existing] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.bubbleId, booking._id))
    .limit(1);

  if (existing) {
    await db.update(bookings).set(bookingData).where(eq(bookings.bubbleId, booking._id));
    console.log(`[BubbleWebhook] Updated booking ${booking._id}`);
  } else {
    await db.insert(bookings).values({
      ...bookingData,
      bubbleId: booking._id,
    } as any);
    console.log(`[BubbleWebhook] Inserted new booking ${booking._id}`);
  }
}

// ── Express handler ───────────────────────────────────────────────────────────

export async function handleBubbleWebhook(req: Request, res: Response): Promise<void> {
  // 1. Verify the shared secret
  const incomingSecret = req.headers["x-bubble-webhook-secret"] as string | undefined;
  if (!verifyBubbleWebhook(incomingSecret)) {
    console.warn("[BubbleWebhook] Invalid secret — rejecting request");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as { event?: string; data?: unknown };
  const { event, data } = body;

  if (!event || !data) {
    res.status(400).json({ error: "Missing event or data" });
    return;
  }

  console.log(`[BubbleWebhook] Received: ${event}`);

  try {
    switch (event) {
      case "job.created":
      case "job.updated":
        await upsertJobFromBubble(data as BubbleJob);
        break;

      case "booking.confirmed":
      case "booking.completed":
        await upsertBookingFromBubble(data as BubbleBooking);
        break;

      case "profile.updated":
        await upsertArtistFromBubble(data as BubbleArtist);
        break;

      default:
        console.log(`[BubbleWebhook] Unknown event type: ${event} — ignoring`);
    }

    res.json({ received: true, event });
  } catch (err: any) {
    console.error(`[BubbleWebhook] Processing error for ${event}:`, err.message);
    // Return 200 so Bubble doesn't retry indefinitely; log the error
    res.json({ received: true, event, warning: "Processing error — check server logs" });
  }
}
