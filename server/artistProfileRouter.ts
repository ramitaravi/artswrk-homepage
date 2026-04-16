import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users, artistReviews, artistServiceCategories } from "../drizzle/schema";

// ─── Helper: parse JSON array safely ──────────────────────────────────────────
function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseResumeFiles(
  val: string | null | undefined
): { url: string; name: string }[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Public profile shape ─────────────────────────────────────────────────────
export const artistProfileRouter = router({
  /** Get the currently authenticated user's own profile */
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) throw new Error("User not found");

    return {
      id: user.id,
      name: user.name || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      pronouns: user.pronouns || "",
      tagline: user.tagline || "",
      bio: user.bio || "",
      location: user.location || "",
      profilePicture: user.profilePicture || "",
      isPro: user.artswrkPro ?? false,
      bookingCount: user.bookingCount ?? 0,
      ratingScore: user.ratingScore ?? 0,
      reviewCount: user.reviewCount ?? 0,
      workTypes: parseJsonArray(user.workTypes),
      artistDisciplines: parseJsonArray(user.artistDisciplines),
      artistServices: parseJsonArray(user.artistServices),
      masterArtistTypes: parseJsonArray(user.masterArtistTypes),
      masterStyles: parseJsonArray(user.masterStyles),
      mediaPhotos: parseJsonArray(user.mediaPhotos),
      resumeFiles: parseResumeFiles(user.resumeFiles),
      resumes: parseJsonArray(user.resumes),
      videos: parseJsonArray(user.videos),
      instagram: user.instagram || "",
      tiktok: user.tiktok || "",
      youtube: user.youtube || "",
      website: user.website || "",
      portfolio: user.portfolio || "",
      phoneNumber: user.phoneNumber || "",
      joinedAt: user.createdAt,
      bubbleCreatedAt: user.bubbleCreatedAt,
      bubbleId: user.bubbleId || null,
    };
  }),

  /** Get a public profile by user ID */
  getPublicProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new Error("Profile not found");

      return {
        id: user.id,
        name: user.name || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        pronouns: user.pronouns || "",
        tagline: user.tagline || "",
        bio: user.bio || "",
        location: user.location || "",
        profilePicture: user.profilePicture || "",
        isPro: user.artswrkPro ?? false,
        bookingCount: user.bookingCount ?? 0,
        ratingScore: user.ratingScore ?? 0,
        reviewCount: user.reviewCount ?? 0,
        workTypes: parseJsonArray(user.workTypes),
        artistDisciplines: parseJsonArray(user.artistDisciplines),
        artistServices: parseJsonArray(user.artistServices),
        masterArtistTypes: parseJsonArray(user.masterArtistTypes),
        masterStyles: parseJsonArray(user.masterStyles),
        mediaPhotos: parseJsonArray(user.mediaPhotos),
        resumeFiles: parseResumeFiles(user.resumeFiles),
        resumes: parseJsonArray(user.resumes),
        videos: parseJsonArray(user.videos),
        instagram: user.instagram || "",
        tiktok: user.tiktok || "",
        youtube: user.youtube || "",
        website: user.website || "",
        portfolio: user.portfolio || "",
        joinedAt: user.createdAt,
        bubbleCreatedAt: user.bubbleCreatedAt,
      };
    }),

  /** Get reviews for the current user's profile */
  getMyReviews: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const reviews = await db
      .select()
      .from(artistReviews)
      .where(eq(artistReviews.artistUserId, ctx.user.id))
      .orderBy(artistReviews.reviewDate);
    return reviews.map(r => ({
      id: r.id,
      reviewerName: r.reviewerName || "",
      reviewerStudio: r.reviewerStudio || "",
      reviewerAvatar: r.reviewerAvatar || "",
      rating: r.rating ?? 5,
      body: r.body || "",
      reviewDate: r.reviewDate,
    }));
  }),

  /** Get service categories for the current user's profile */
  getMyServiceCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const cats = await db
      .select()
      .from(artistServiceCategories)
      .where(eq(artistServiceCategories.artistUserId, ctx.user.id))
      .orderBy(artistServiceCategories.sortOrder);
    return cats.map(c => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl || "",
      subServices: parseJsonArray(c.subServices),
      sortOrder: c.sortOrder ?? 0,
    }));
  }),

  /** Update service categories for the current user */
  updateMyServiceCategories: protectedProcedure
    .input(
      z.object({
        categories: z.array(
          z.object({
            id: z.number().optional(), // existing category id
            name: z.string(),
            imageUrl: z.string().optional(),
            subServices: z.array(z.string()),
            subServiceSettings: z.array(
              z.object({
                name: z.string(),
                listOnProfile: z.boolean(),
                jobEmailEnabled: z.boolean(),
              })
            ).optional(),
            sortOrder: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Delete all existing categories for this user and re-insert
      await db
        .delete(artistServiceCategories)
        .where(eq(artistServiceCategories.artistUserId, ctx.user.id));

      for (let i = 0; i < input.categories.length; i++) {
        const cat = input.categories[i];
        await db.insert(artistServiceCategories).values({
          artistUserId: ctx.user.id,
          name: cat.name,
          imageUrl: cat.imageUrl || "",
          subServices: JSON.stringify(cat.subServices),
          subServiceSettings: cat.subServiceSettings
            ? JSON.stringify(cat.subServiceSettings)
            : null,
          sortOrder: cat.sortOrder ?? i,
        });
      }

      return { success: true };
    }),

  /** Upload a file to S3 and return the URL */
  uploadFile: protectedProcedure
    .input(
      z.object({
        base64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        folder: z.string().default("profile"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.fileName.split(".").pop() || "bin";
      const key = `${input.folder}/${ctx.user.id}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  /** Update the currently authenticated user's profile */
  updateMyProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().max(128).optional(),
        lastName: z.string().max(128).optional(),
        pronouns: z.string().max(64).optional(),
        tagline: z.string().max(256).optional(),
        bio: z.string().optional(),
        location: z.string().max(256).optional(),
        profilePicture: z.string().optional(),
        workTypes: z.array(z.string()).optional(),
        artistDisciplines: z.array(z.string()).optional(),
        artistServices: z.array(z.string()).optional(),
        masterArtistTypes: z.array(z.string()).optional(),
        masterStyles: z.array(z.string()).optional(),
        mediaPhotos: z.array(z.string()).optional(),
        resumeFiles: z
          .array(z.object({ url: z.string(), name: z.string() }))
          .optional(),
        instagram: z.string().max(128).optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        website: z.string().optional(),
        portfolio: z.string().optional(),
        phoneNumber: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updateData: Record<string, unknown> = {};

      if (input.firstName !== undefined) {
        updateData.firstName = input.firstName;
        // Also update the combined name field
      }
      if (input.lastName !== undefined) updateData.lastName = input.lastName;
      if (input.pronouns !== undefined) updateData.pronouns = input.pronouns;
      if (input.tagline !== undefined) updateData.tagline = input.tagline;
      if (input.bio !== undefined) updateData.bio = input.bio;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.profilePicture !== undefined)
        updateData.profilePicture = input.profilePicture;
      if (input.workTypes !== undefined)
        updateData.workTypes = JSON.stringify(input.workTypes);
      if (input.artistDisciplines !== undefined)
        updateData.artistDisciplines = JSON.stringify(input.artistDisciplines);
      if (input.artistServices !== undefined)
        updateData.artistServices = JSON.stringify(input.artistServices);
      if (input.masterArtistTypes !== undefined)
        updateData.masterArtistTypes = JSON.stringify(input.masterArtistTypes);
      if (input.masterStyles !== undefined)
        updateData.masterStyles = JSON.stringify(input.masterStyles);
      if (input.mediaPhotos !== undefined)
        updateData.mediaPhotos = JSON.stringify(input.mediaPhotos);
      if (input.resumeFiles !== undefined)
        updateData.resumeFiles = JSON.stringify(input.resumeFiles);
      if (input.instagram !== undefined) updateData.instagram = input.instagram;
      if (input.tiktok !== undefined) updateData.tiktok = input.tiktok;
      if (input.youtube !== undefined) updateData.youtube = input.youtube;
      if (input.website !== undefined) updateData.website = input.website;
      if (input.portfolio !== undefined) updateData.portfolio = input.portfolio;
      if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber;

      // Update combined name if first/last changed
      if (input.firstName !== undefined || input.lastName !== undefined) {
        const [current] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        const fn = input.firstName ?? current?.firstName ?? "";
        const ln = input.lastName ?? current?.lastName ?? "";
        updateData.name = `${fn} ${ln}`.trim();
      }

      await db
        .update(users)
        .set(updateData as any)
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
});
