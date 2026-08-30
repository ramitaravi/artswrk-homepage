import { z } from "zod";
import { eq, count, desc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, normalizeSocialLink, resolveMasterArtistTypeNames, resolveMasterServiceTypeNames } from "./db";
import { users, artistReviews, artistServiceCategories, artistResumes, bookings } from "../drizzle/schema";
import { buildLocationColumns, locationInputSchema } from "./location";

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

type SubServiceSetting = { name: string; listOnProfile: boolean; jobEmailEnabled: boolean };
function parseSubServiceSettings(val: string | null | undefined): SubServiceSetting[] {
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

    const [[user], bookingCountResult] = await Promise.all([
      db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1),
      db.select({ value: count() }).from(bookings).where(eq(bookings.artistUserId, ctx.user.id)),
    ]);

    if (!user) throw new Error("User not found");

    const liveBookingCount = bookingCountResult[0]?.value ?? 0;
    const [masterArtistTypeNames, masterServiceTypeNames] = await Promise.all([
      resolveMasterArtistTypeNames(parseJsonArray(user.masterArtistTypes)),
      resolveMasterServiceTypeNames(parseJsonArray(user.masterServiceType)),
    ]);

    return {
      id: user.id,
      name: user.name || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      pronouns: user.pronouns || "",
      tagline: user.tagline || "",
      bio: user.bio || "",
      location: user.location || "",
      // Real coordinates behind the label, so the client can seed a radius
      // search (jobs near me) instead of a city-name text match.
      locationLat: user.locationLat ? Number(user.locationLat) : null,
      locationLng: user.locationLng ? Number(user.locationLng) : null,
      profilePicture: user.profilePicture || "",
      isPro: user.artswrkPro ?? false,
      bookingCount: liveBookingCount || user.bookingCount || 0,
      ratingScore: user.ratingScore ?? 0,
      reviewCount: user.reviewCount ?? 0,
      // Display names resolved from masterArtistTypes/masterServiceType (the
      // Bubble-matching, ID-keyed source of truth) — workTypes/artistServices
      // are no longer used for display.
      masterArtistTypeNames,
      masterServiceTypeNames,
      artistDisciplines: parseJsonArray(user.artistDisciplines),
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
      slug: user.slug || null,
    };
  }),

  /** Get a public profile by slug (for /book/:slug public pages) */
  getProfileBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Duplicate Bubble-migrated rows can share a slug — no ordering here meant
      // whichever row the DB happened to return first won, fully nondeterministic.
      // Prefer the real migrated row over an empty later duplicate, same
      // tiebreak as getUserByEmail/getUserByBubbleId.
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.slug, input.slug))
        .orderBy(desc(users.bubbleSourcePresent), desc(users.updatedAt), desc(users.id))
        .limit(1);
      if (!user) throw new Error("Profile not found");
      const bookingCountResult = await db.select({ value: count() }).from(bookings).where(eq(bookings.artistUserId, user.id));
      const liveBookingCount = bookingCountResult[0]?.value ?? 0;
      const [masterArtistTypeNames, masterServiceTypeNames] = await Promise.all([
        resolveMasterArtistTypeNames(parseJsonArray(user.masterArtistTypes)),
        resolveMasterServiceTypeNames(parseJsonArray(user.masterServiceType)),
      ]);
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
        bookingCount: liveBookingCount || user.bookingCount || 0,
        ratingScore: user.ratingScore ?? 0,
        reviewCount: user.reviewCount ?? 0,
        masterArtistTypeNames,
        masterServiceTypeNames,
        artistDisciplines: parseJsonArray(user.artistDisciplines),
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
        bubbleId: user.bubbleId || null,
        slug: user.slug || null,
      };
    }),

  /** Get reviews for any artist by userId (public) */
  getPublicReviews: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const reviews = await db
        .select()
        .from(artistReviews)
        .where(eq(artistReviews.artistUserId, input.userId))
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

  /** Get service categories for any artist by userId (public) */
  getPublicServiceCategories: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const cats = await db
        .select()
        .from(artistServiceCategories)
        .where(eq(artistServiceCategories.artistUserId, input.userId))
        .orderBy(artistServiceCategories.sortOrder);
      return cats
        .map(c => {
          const savedSettings = parseSubServiceSettings(c.subServiceSettings);
          const settingsByName = new Map(savedSettings.map(s => [s.name, s]));
          // Only show sub-services the artist hasn't unchecked "List on
          // Profile" for. No saved setting (older categories) defaults to shown.
          const subServices = parseJsonArray(c.subServices).filter(
            name => settingsByName.get(name)?.listOnProfile !== false
          );
          return {
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl || "",
            subServices,
            sortOrder: c.sortOrder ?? 0,
          };
        })
        .filter(c => c.subServices.length > 0);
    }),

  /**
   * Get a public profile by user ID — this is the query behind the in-app
   * client "view artist" page (/app/artists/:id), NOT the artist's own
   * shareable public profile (that's getProfileBySlug, at /book/:slug,
   * which stays fully open — an artist wants their socials visible there).
   * Here, socials/contact/bio are only for an admin, a subscribed client
   * (client_premium / enterprise_subscription), or the artist themselves —
   * an on-demand client, logged-out visitor, or another artist gets a
   * locked preview with `locked: true` so the frontend can render a
   * "Subscribe to connect" CTA instead of a real profile.
   */
  getPublicProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [[user], bookingCountResult] = await Promise.all([
        db.select().from(users).where(eq(users.id, input.userId)).limit(1),
        db.select({ value: count() }).from(bookings).where(eq(bookings.artistUserId, input.userId)),
      ]);

      if (!user) throw new Error("Profile not found");

      const liveBookingCount = bookingCountResult[0]?.value ?? 0;

      const viewerId = ctx.user?.id;
      let hasFullAccess = false;
      if (viewerId) {
        if (viewerId === input.userId) hasFullAccess = true;
        else {
          const [viewer] = await db.select({ role: users.role, planTier: users.planTier }).from(users).where(eq(users.id, viewerId)).limit(1);
          hasFullAccess = viewer?.role === "admin"
            || viewer?.planTier === "client_premium"
            || viewer?.planTier === "enterprise_subscription";
        }
      }

      const [masterArtistTypeNames, masterServiceTypeNames] = await Promise.all([
        resolveMasterArtistTypeNames(parseJsonArray(user.masterArtistTypes)),
        resolveMasterServiceTypeNames(parseJsonArray(user.masterServiceType)),
      ]);

      return {
        id: user.id,
        name: user.name || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        pronouns: user.pronouns || "",
        tagline: user.tagline || "",
        bio: hasFullAccess ? (user.bio || "") : "",
        location: user.location || "",
        profilePicture: user.profilePicture || "",
        isPro: user.artswrkPro ?? false,
        bookingCount: liveBookingCount || user.bookingCount || 0,
        ratingScore: user.ratingScore ?? 0,
        reviewCount: user.reviewCount ?? 0,
        masterArtistTypeNames,
        masterServiceTypeNames,
        artistDisciplines: parseJsonArray(user.artistDisciplines),
        masterArtistTypes: parseJsonArray(user.masterArtistTypes),
        masterStyles: parseJsonArray(user.masterStyles),
        mediaPhotos: hasFullAccess ? parseJsonArray(user.mediaPhotos) : [],
        resumeFiles: hasFullAccess ? parseResumeFiles(user.resumeFiles) : [],
        resumes: hasFullAccess ? parseJsonArray(user.resumes) : [],
        videos: hasFullAccess ? parseJsonArray(user.videos) : [],
        instagram: hasFullAccess ? (user.instagram || "") : "",
        tiktok: hasFullAccess ? (user.tiktok || "") : "",
        youtube: hasFullAccess ? (user.youtube || "") : "",
        website: hasFullAccess ? (user.website || "") : "",
        portfolio: hasFullAccess ? (user.portfolio || "") : "",
        joinedAt: user.createdAt,
        bubbleCreatedAt: user.bubbleCreatedAt,
        locked: !hasFullAccess,
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

  /**
   * Job alert preferences. Reads user_notification_settings, falling back to
   * the artist's profile service types when no row exists yet — so the settings
   * page shows what they would actually receive today, not an empty form.
   */
  getJobAlertSettings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { getAllMasterServiceTypes } = await import("./db");
    const all = await getAllMasterServiceTypes();

    const rows: any = await db.execute(
      `SELECT s.jobEmailsEnabled, s.lastMinuteEnabled, s.serviceTypes, u.masterServiceType
       FROM users u LEFT JOIN user_notification_settings s ON s.userId = u.id
       WHERE u.id = ${ctx.user.id}`
    );
    const row = (Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [])[0] ?? {};

    const parse = (v: unknown): string[] => {
      if (!v) return [];
      try { const p = JSON.parse(String(v)); return Array.isArray(p) ? p.filter((x) => typeof x === "string") : []; }
      catch { return []; }
    };
    const enabled = new Set(
      parse(row.serviceTypes).length ? parse(row.serviceTypes) : parse(row.masterServiceType)
    );

    return {
      jobEmailsEnabled: row.jobEmailsEnabled == null ? true : !!row.jobEmailsEnabled,
      lastMinuteEnabled: row.lastMinuteEnabled == null ? true : !!row.lastMinuteEnabled,
      /** Only the artist's own service types — offering all 56 would invite
       *  opting into work they don't do. */
      serviceTypes: all
        .filter((t) => enabled.has(t.bubbleId ?? String(t.id)))
        .map((t) => ({ id: t.bubbleId ?? String(t.id), name: t.name, group: t.artistTypeName ?? "Other", enabled: true })),
      allServiceTypes: all.map((t) => ({
        id: t.bubbleId ?? String(t.id), name: t.name, group: t.artistTypeName ?? "Other",
        enabled: enabled.has(t.bubbleId ?? String(t.id)),
      })),
    };
  }),

  /**
   * Save job alert preferences. Writes user_notification_settings AND mirrors a
   * global opt-out into email_suppressions, so the send worker has exactly one
   * pre-send check to make rather than two sources that can disagree.
   */
  updateJobAlertSettings: protectedProcedure
    .input(z.object({
      jobEmailsEnabled: z.boolean().optional(),
      lastMinuteEnabled: z.boolean().optional(),
      serviceTypes: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const uid = ctx.user.id;

      const esc = (v: string) => `'${v.replace(/'/g, "''")}'`;
      const sets: string[] = [];
      const cols: string[] = ["userId"];
      const vals: string[] = [String(uid)];
      if (input.jobEmailsEnabled !== undefined) {
        cols.push("jobEmailsEnabled"); vals.push(input.jobEmailsEnabled ? "1" : "0");
        sets.push(`jobEmailsEnabled = ${input.jobEmailsEnabled ? 1 : 0}`);
      }
      if (input.lastMinuteEnabled !== undefined) {
        cols.push("lastMinuteEnabled"); vals.push(input.lastMinuteEnabled ? "1" : "0");
        sets.push(`lastMinuteEnabled = ${input.lastMinuteEnabled ? 1 : 0}`);
      }
      if (input.serviceTypes !== undefined) {
        const json = esc(JSON.stringify(input.serviceTypes));
        cols.push("serviceTypes"); vals.push(json);
        sets.push(`serviceTypes = ${json}`);
      }
      if (sets.length) {
        await db.execute(
          `INSERT INTO user_notification_settings (${cols.join(",")}) VALUES (${vals.join(",")})
           ON DUPLICATE KEY UPDATE ${sets.join(", ")}, updatedAt = NOW()`
        );
      }

      if (input.jobEmailsEnabled !== undefined) {
        const emailRows: any = await db.execute(`SELECT email FROM users WHERE id = ${uid}`);
        const email = String(
          (Array.isArray(emailRows) ? (Array.isArray(emailRows[0]) ? emailRows[0] : emailRows) : [])[0]?.email ?? ""
        ).trim().toLowerCase();
        if (email) {
          if (input.jobEmailsEnabled) {
            // Only clear OUR own opt-out. A bounce or spam report recorded by
            // the provider must survive the artist flipping a toggle back on.
            await db.execute(
              `DELETE FROM email_suppressions
               WHERE email = ${esc(email)} AND source = 'inapp' AND scope = 'job_alerts'`
            );
          } else {
            await db.execute(
              `INSERT INTO email_suppressions (email, source, scope, reason, createdAt, updatedAt)
               VALUES (${esc(email)}, 'inapp', 'job_alerts', 'turned off in settings', NOW(), NOW())
               ON DUPLICATE KEY UPDATE source='inapp', reason='turned off in settings', updatedAt=NOW()`
            );
          }
        }
      }
      return { success: true };
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
    return cats.map(c => {
      const subServices = parseJsonArray(c.subServices);
      const savedSettings = parseSubServiceSettings(c.subServiceSettings);
      const settingsByName = new Map(savedSettings.map(s => [s.name, s]));
      return {
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl || "",
        subServices,
        // Every sub-service gets a setting row — defaulting to listed/enabled
        // for older categories saved before this per-item toggle existed.
        subServiceSettings: subServices.map(name => settingsByName.get(name) ?? {
          name,
          listOnProfile: true,
          jobEmailEnabled: true,
        }),
        sortOrder: c.sortOrder ?? 0,
      };
    });
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
        /** Real Google Places data behind `location` — powers radius filtering. */
        locationData: locationInputSchema,
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
      if (input.location !== undefined) {
        // Store the structured place alongside the label so "artists near me"
        // has coordinates to filter on. Falls back to geocoding when the
        // artist typed a location instead of picking a suggestion.
        Object.assign(updateData, await buildLocationColumns(input.location, input.locationData));
      }
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
      if (input.mediaPhotos !== undefined) {
        if (input.mediaPhotos.length > 3) {
          const [current] = await db
            .select({ planTier: users.planTier })
            .from(users)
            .where(eq(users.id, ctx.user.id))
            .limit(1);
          if (current?.planTier !== "artist_pro") {
            throw new Error("Upgrade to Artswrk PRO to upload more than 3 photos.");
          }
        }
        updateData.mediaPhotos = JSON.stringify(input.mediaPhotos);
      }
      if (input.resumeFiles !== undefined)
        updateData.resumeFiles = JSON.stringify(input.resumeFiles);
      if (input.instagram !== undefined) updateData.instagram = normalizeSocialLink(input.instagram, "instagram");
      if (input.tiktok !== undefined) updateData.tiktok = normalizeSocialLink(input.tiktok, "tiktok");
      if (input.youtube !== undefined) updateData.youtube = normalizeSocialLink(input.youtube, "youtube");
      if (input.website !== undefined) updateData.website = normalizeSocialLink(input.website, "website");
      if (input.portfolio !== undefined) updateData.portfolio = normalizeSocialLink(input.portfolio, "portfolio");
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

      // A resume saved here (Edit Profile) should also show up in the resume
      // picker on the job application page, which reads from the separate
      // artist_resumes table — insert any not already synced there.
      if (input.resumeFiles !== undefined && input.resumeFiles.length > 0) {
        const existing = await db
          .select({ fileUrl: artistResumes.fileUrl })
          .from(artistResumes)
          .where(eq(artistResumes.artistUserId, ctx.user.id));
        const existingUrls = new Set(existing.map(r => r.fileUrl));
        const toInsert = input.resumeFiles.filter(r => !existingUrls.has(r.url));
        for (const r of toInsert) {
          await db.insert(artistResumes).values({
            artistUserId: ctx.user.id,
            title: r.name,
            fileUrl: r.url,
          });
        }
      }

      return { success: true };
    }),

  /** Public: look up an artist profile by their slug (for /book/:slug pages) */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.slug, input.slug))
        .limit(1);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        slug: user.slug || "",
        pronouns: user.pronouns || "",
        tagline: user.tagline || "",
        bio: user.bio || "",
        location: user.location || "",
        profilePicture: user.profilePicture || "",
        artswrkPro: user.artswrkPro ?? false,
        artswrkBasic: user.artswrkBasic ?? false,
        bookingCount: user.bookingCount ?? 0,
        ratingScore: user.ratingScore ?? 0,
        reviewCount: user.reviewCount ?? 0,
        optionAvailability: user.optionAvailability || "",
        masterArtistTypes: user.masterArtistTypes || "",
        artistServices: user.artistServices || "",
        workTypes: user.workTypes || "",
        artistExperiences: user.artistExperiences || "",
        mediaPhotos: user.mediaPhotos || "",
        resumes: user.resumes || "",
        website: user.website || "",
        instagram: user.instagram || "",
        youtube: user.youtube || "",
        portfolio: user.portfolio || "",
        artistHourlyRate: (user as any).artistHourlyRate ?? null,
      };
    }),
});
