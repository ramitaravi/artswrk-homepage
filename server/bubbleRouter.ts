/**
 * BUBBLE ROUTER
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC procedures that proxy live data from the Bubble API.
 * These are used when we want real-time data rather than the cached DB snapshot.
 *
 * Usage in frontend:
 *   const { data } = trpc.bubble.getArtist.useQuery({ bubbleId: "..." });
 *   const { data } = trpc.bubble.getLiveJobs.useQuery({ limit: 20 });
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getBubbleArtistById,
  getBubbleArtists,
  getBubbleJobs,
  getBubbleJobById,
  bustCache,
} from "./bubbleApi";

export const bubbleRouter = router({
  /**
   * Fetch a single artist's live profile from Bubble by their Bubble ID.
   * Falls back gracefully if Bubble is unreachable.
   */
  getArtist: publicProcedure
    .input(z.object({ bubbleId: z.string() }))
    .query(async ({ input }) => {
      const artist = await getBubbleArtistById(input.bubbleId);
      if (!artist) return null;

      return {
        bubbleId: artist._id,
        firstName: artist["First name"] ?? "",
        lastName: artist["Last name"] ?? "",
        email: artist.email,
        bio: artist.bio ?? null,
        location: artist.location ?? null,
        profilePicture: artist["Profile picture"] ?? null,
        masterArtistTypes: artist["Master artist types"] ?? [],
        artistServices: artist["Artist services"] ?? [],
        artswrkPro: artist["Artswrk Pro"] ?? false,
        ratingAverage: artist["Rating average"] ?? null,
        totalBookings: artist["Total bookings"] ?? null,
        mediaPhotos: artist.Portfolio ?? [],
        instagram: artist.Instagram ?? null,
        website: artist.Website ?? null,
        pronouns: artist.Pronouns ?? null,
        phoneNumber: artist["Phone number"] ?? null,
        createdAt: artist["Created Date"] ?? null,
      };
    }),

  /**
   * Fetch a paginated list of artists live from Bubble.
   */
  getArtists: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().default(0),
        search: z.string().optional(),
        artistType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getBubbleArtists(input);
    }),

  /**
   * Fetch live active jobs from Bubble.
   * This is the real-time feed — always fresh from Bubble.
   */
  getLiveJobs: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().default(0),
        status: z.string().default("Active"),
      })
    )
    .query(async ({ input }) => {
      const result = await getBubbleJobs(input);
      return {
        jobs: result.jobs.map((job) => ({
          bubbleId: job._id,
          serviceType: job["Service type"] ?? "",
          description: job.Description ?? null,
          startDate: job["Start date"] ?? null,
          endDate: job["End date"] ?? null,
          locationAddress: job["Location address"] ?? null,
          rateType: job["Rate type"] ?? null,
          rate: job.Rate ?? null,
          requestStatus: job["Request status"] ?? "Active",
          artistTypes: job["Artist types"] ?? [],
          jobType: job["Job type"] ?? null,
          isPremium: job["Is premium"] ?? false,
          createdAt: job["Created Date"] ?? null,
        })),
        count: result.count,
        remaining: result.remaining,
      };
    }),

  /**
   * Fetch a single job live from Bubble by its Bubble ID.
   */
  getLiveJob: publicProcedure
    .input(z.object({ bubbleId: z.string() }))
    .query(async ({ input }) => {
      const job = await getBubbleJobById(input.bubbleId);
      if (!job) return null;
      return {
        bubbleId: job._id,
        serviceType: job["Service type"] ?? "",
        description: job.Description ?? null,
        startDate: job["Start date"] ?? null,
        endDate: job["End date"] ?? null,
        locationAddress: job["Location address"] ?? null,
        rateType: job["Rate type"] ?? null,
        rate: job.Rate ?? null,
        requestStatus: job["Request status"] ?? "Active",
        artistTypes: job["Artist types"] ?? [],
        jobType: job["Job type"] ?? null,
        isPremium: job["Is premium"] ?? false,
        createdAt: job["Created Date"] ?? null,
      };
    }),

  /**
   * Manually bust the Bubble API cache.
   * Useful after a webhook is received or after a profile update.
   */
  bustCache: publicProcedure
    .input(z.object({ pattern: z.string().optional() }))
    .mutation(async ({ input }) => {
      bustCache(input.pattern);
      return { success: true };
    }),
});
