import bcrypt from "bcryptjs";
import { COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME, IMPERSONATION_MARKER_COOKIE, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { acquisitionRouter } from "./acquisitionRouter";
import { artistProfileRouter } from "./artistProfileRouter";
import { bubbleRouter } from "./bubbleRouter";
import { getAllUsers, getUserByBubbleId, getUserByEmail, setUserPassword, getUserById, getUserByOpenId, createPasswordResetToken, getPasswordResetToken, deletePasswordResetToken, getArtistResumes, applyToJob, getJobsByUserId, getJobStatsByUserId, getPublicJobs, getPublicJobsEnriched, getJobDetailById, getArtistJobApplications, getInterestedArtistsByClientId, getApplicantStatsByClientId, getApplicantsByJobId, getBookingsByClientId, getBookingStatsByClientId, getBookingsByJobId, getBookingById, getBookingByInterestedArtistId, getPaymentsByClientId, getPaymentStatsByClientId, getWalletStatsByClientId, getPendingPaymentsByClientId, getConversationsByClientId, getMessagesByConversationId, getMessageStatsByClientId, getArtistById, getArtistHistoryForClient, createJob, activateJob, saveClientStripeCustomerId, saveClientSubscriptionId, createNewUser, updateUserOnboarding, activateBoost, getJobById, getArtistsList, getAdminOverviewStats, getAdminArtists, getAdminClients, getAdminJobs, getAdminBookings, getAdminPayments, getPremiumJobsByUserId, getPremiumJobById, getAllPremiumJobs, getPremiumJobInterestedArtists, getPremiumInterestedArtistsByCreatorId, getEnterpriseClients, getClientCompaniesByUserId, createClientCompany, createPremiumJob, getArtistJobsFeed, getArtistProJobsFeed, getArtistProApplications, getArtistBookings, getArtistPayments, getArtistSubscriptionInfo, saveArtistStripeCustomerId, saveArtistProSubscription, cancelArtistProSubscription, saveArtistBasicSubscription, setEnterprisePlan, getEnterpriseBillingInfo, saveEnterpriseStripeCustomerId, saveEnterpriseSubscription, cancelEnterpriseSubscription, recordEnterpriseJobUnlock, getUnlockedJobIds, isJobUnlocked, getBenefits, getOrCreateConversation, sendMessageToConversation, isClientJobUnlocked, createClientJobUnlock, getJobApplicantsWithDetails, getApplicantDetail, getAdminJobById, getAdminJobBookings, getMyAffiliations } from "./db";
import { invokeLLM } from "./_core/llm";
import { sendPasswordResetEmail, sendApplicationConfirmationEmail, sendNewApplicantAlertEmail, sendSimpleEmail, sendArtistWelcomeEmail, sendProJobPostedEmail, sendJobPostedEmail, sendNewMessageEmail } from "./email";
import crypto from "crypto";
import { createJobPostCheckoutSession, createSubscriptionCheckoutSession, createBoostCheckoutSession, getStripe, createArtistProCheckoutSession, createArtistBasicCheckoutSession, createArtistPortalSession, createEnterpriseJobUnlockCheckoutSession, createEnterpriseSubscriptionCheckoutSession, createClientJobUnlockCheckoutSession, createClientSubscriptionCheckoutSession } from "./stripe";
import { calcBoostTotal } from "./stripe-products";
import { storagePut } from "./storage";
import { artistResumes } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { z } from "zod";
import { leadsRouter } from "./routers/leads";

const SALT_ROUNDS = 12;

export const appRouter = router({
  system: systemRouter,
  acquisition: acquisitionRouter,
  artistProfile: artistProfileRouter,
  bubble: bubbleRouter,
  leads: leadsRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    /**
     * Password login — works for any user who has had a password set by an admin.
     */
    passwordLogin: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new Error("Invalid email or password");
        }

        // Create a real JWT session
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.firstName || "User",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        const isAdmin = user.role === "admin" || user.openId === ENV.ownerOpenId;
        return {
          success: true,
          isTemporary: user.passwordIsTemporary ?? true,
          isAdmin,
          enterprise: !!(user as any).enterprise,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            userRole: user.userRole,
            clientCompanyName: user.clientCompanyName,
            clientPremium: user.clientPremium,
            profilePicture: user.profilePicture,
            slug: user.slug,
            onboardingStep: user.onboardingStep,
          },
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Forgot password — generates a reset token and emails it to the user.
     * Always returns success to prevent email enumeration.
     */
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email(), origin: z.string().url() }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (user) {
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          await createPasswordResetToken(user.id, token, expiresAt);
          const resetUrl = `${input.origin}/reset-password?token=${token}`;
          await sendPasswordResetEmail({
            to: user.email!,
            firstName: user.firstName ?? user.name ?? "there",
            resetUrl,
          });
        }
        // Always return success to prevent email enumeration
        return { success: true };
      }),

    /**
     * Reset password — validates the token and sets the new password.
     */
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }))
      .mutation(async ({ input }) => {
        const record = await getPasswordResetToken(input.token);
        if (!record) throw new Error("Invalid or expired reset link.");
        if (record.expiresAt < new Date()) {
          await deletePasswordResetToken(input.token);
          throw new Error("This reset link has expired. Please request a new one.");
        }
        const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
        await setUserPassword(record.userId, hash, false);
        await deletePasswordResetToken(input.token);
        return { success: true };
      }),

    /**
     * Check if an email address belongs to an existing user.
     * Used by the Apply Gate modal to route to login vs. join.
     * Deliberately returns only { exists } — no PII leaked.
     */
    checkEmailExists: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        return { exists: !!user };
      }),

    /**
     * Smart email lookup for the login branching flow.
     * Returns enough info to show a personalised welcome state without leaking PII.
     */
    lookupEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user) return { exists: false as const, hasPassword: false, userRole: null, firstName: null, profilePicture: null, clientCompanyName: null };
        return {
          exists: true as const,
          hasPassword: !!user.passwordHash,
          userRole: user.userRole ?? null,
          firstName: user.firstName ?? user.name ?? null,
          profilePicture: user.profilePicture ?? null,
          clientCompanyName: user.clientCompanyName ?? null,
        };
      }),

    /**
     * Set a password for a user who has never had one (imported from Bubble).
     * Auto-logs them in after setting the password.
     */
    setInitialPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user) throw new Error("No account found.");
        if (user.passwordHash) throw new Error("This account already has a password. Please log in normally.");

        const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
        await setUserPassword(user.id, hash, false);

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.firstName || "User",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const isAdmin = user.role === "admin" || user.openId === ENV.ownerOpenId;
        return {
          success: true,
          isAdmin,
          enterprise: !!(user as any).enterprise,
          user: {
            id: user.id,
            email: user.email,
            userRole: user.userRole,
            onboardingStep: user.onboardingStep,
          },
        };
      }),
  }),

  // ── Admin procedures ────────────────────────────────────────────────────────
  admin: router({
    /**
     * Set a temporary password for any user by email.
     * Only callable by the app owner (ENV.ownerOpenId).
     */
    setPassword: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6, "Password must be at least 6 characters"),
        isTemporary: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user) throw new Error(`No user found with email: ${input.email}`);
        const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
        await setUserPassword(user.id, hash, input.isTemporary);
        return { success: true, message: `Password set for ${user.email}`, isTemporary: input.isTemporary };
      }),

    listUsers: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50), offset: z.number().min(0).default(0), search: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAllUsers(input.limit, input.offset);
      }),

    getUser: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getUserById(input.id);
      }),

    /** Overview stats for the admin dashboard */
    overview: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
      return getAdminOverviewStats();
    }),

    /** All artists with search + filters */
    artists: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        locationSearch: z.string().optional(),
        artistType: z.string().optional(),
        state: z.string().optional(),
        plan: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAdminArtists(input);
      }),

    /** Get a single artist (full user row) by ID — admin only */
    getArtist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getUserById(input.id);
      }),

    /** Update artist fields — admin only */
    updateArtist: protectedProcedure
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        pronouns: z.string().optional(),
        location: z.string().optional(),
        bio: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        profilePicture: z.string().optional(),
        masterArtistTypes: z.array(z.string()).optional(),
        artistServices: z.array(z.string()).optional(),
        masterStyles: z.array(z.string()).optional(),
        tagline: z.string().optional(),
        credits: z.string().optional(),
        artswrkPro: z.boolean().optional(),
        artswrkBasic: z.boolean().optional(),
        priorityList: z.boolean().optional(),
        slug: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, masterArtistTypes, artistServices, masterStyles, ...rest } = input;
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.update(usersTable).set({
          ...rest,
          ...(masterArtistTypes !== undefined ? { masterArtistTypes: JSON.stringify(masterArtistTypes) } : {}),
          ...(artistServices !== undefined ? { artistServices: JSON.stringify(artistServices) } : {}),
          ...(masterStyles !== undefined ? { masterStyles: JSON.stringify(masterStyles) } : {}),
        }).where(eq(usersTable.id, id));
        return getUserById(id);
      }),

    /** Create a new artist account — admin only */
    createArtist: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(8).optional(),
        pronouns: z.string().optional(),
        location: z.string().optional(),
        bio: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        profilePicture: z.string().optional(),
        masterArtistTypes: z.array(z.string()).default([]),
        artistServices: z.array(z.string()).default([]),
        masterStyles: z.array(z.string()).default([]),
        tagline: z.string().optional(),
        artswrkPro: z.boolean().default(false),
        artswrkBasic: z.boolean().default(false),
        sendWelcomeEmail: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");

        // Check email not already in use
        const existing = await getUserByEmail(input.email.toLowerCase().trim());
        if (existing) throw new Error(`An account with email ${input.email} already exists`);

        // Generate openId for the new user
        const openId = `admin_${crypto.randomBytes(16).toString("hex")}`;

        // Slug from name
        const slug = `${input.firstName}-${input.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

        const values: any = {
          openId,
          email: input.email.toLowerCase().trim(),
          firstName: input.firstName,
          lastName: input.lastName,
          name: `${input.firstName} ${input.lastName}`,
          slug,
          userRole: "Artist" as const,
          pronouns: input.pronouns ?? null,
          location: input.location ?? null,
          bio: input.bio ?? null,
          website: input.website ?? null,
          instagram: input.instagram ?? null,
          profilePicture: input.profilePicture ?? null,
          masterArtistTypes: input.masterArtistTypes.length ? JSON.stringify(input.masterArtistTypes) : null,
          artistServices: input.artistServices.length ? JSON.stringify(input.artistServices) : null,
          masterStyles: input.masterStyles.length ? JSON.stringify(input.masterStyles) : null,
          tagline: input.tagline ?? null,
          artswrkPro: input.artswrkPro,
          artswrkBasic: input.artswrkBasic,
          userSignedUp: true,
          onboardingStep: 4,
        };

        if (input.password) {
          values.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
          values.passwordIsTemporary = false;
        }

        const result = await db.insert(usersTable).values(values);
        const newId = (result as any).insertId as number;

        if (input.sendWelcomeEmail) {
          sendArtistWelcomeEmail({ to: input.email, firstName: input.firstName })
            .catch((err) => console.error("[Admin] Welcome email failed:", err.message));
        }

        return getUserById(newId);
      }),

    /** Send welcome email to an existing artist — admin only */
    sendWelcomeEmail: protectedProcedure
      .input(z.object({ artistId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const artist = await getUserById(input.artistId);
        if (!artist?.email) throw new Error("Artist has no email address");
        await sendArtistWelcomeEmail({ to: artist.email, firstName: artist.firstName || artist.name?.split(" ")[0] || "there" });
        return { success: true };
      }),

    /** All applications for a specific artist — admin only */
    artistApplications: protectedProcedure
      .input(z.object({ artistId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminArtistApplications } = await import("./db");
        return getAdminArtistApplications(input.artistId);
      }),

    /** All bookings for a specific artist with earnings — admin only */
    artistBookings: protectedProcedure
      .input(z.object({ artistId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminArtistBookings } = await import("./db");
        const rows = await getAdminArtistBookings(input.artistId);
        const totalEarningsCents = rows.reduce((sum: number, b: any) => {
          const rate = b.totalArtistRate ?? b.artistRate ?? 0;
          return sum + (b.bookingStatus === "Completed" ? Number(rate) : 0);
        }, 0);
        const completedCount = rows.filter((b: any) => b.bookingStatus === "Completed").length;
        return { bookings: rows, totalEarningsCents, completedCount };
      }),

    /** Get a single client (full user row) by ID — admin only */
    getClient: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getUserById(input.id);
      }),

    /** Update client fields — admin only */
    updateClient: protectedProcedure
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        clientCompanyName: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        profilePicture: z.string().optional(),
        businessOrIndividual: z.string().optional(),
        hiringCategory: z.string().optional(),
        clientPremium: z.boolean().optional(),
        enterprise: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, ...rest } = input;
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.update(usersTable).set(rest).where(eq(usersTable.id, id));
        return getUserById(id);
      }),

    /** Create a new client account — admin only */
    createClient: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(8).optional(),
        clientCompanyName: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        profilePicture: z.string().optional(),
        businessOrIndividual: z.string().optional(),
        hiringCategory: z.string().optional(),
        clientPremium: z.boolean().default(false),
        enterprise: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const existing = await getUserByEmail(input.email.toLowerCase().trim());
        if (existing) throw new Error(`An account with email ${input.email} already exists`);
        const openId = `admin_${crypto.randomBytes(16).toString("hex")}`;
        const slug = `${input.firstName}-${input.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const values: any = {
          openId,
          email: input.email.toLowerCase().trim(),
          firstName: input.firstName,
          lastName: input.lastName,
          name: `${input.firstName} ${input.lastName}`,
          slug,
          userRole: "Client" as const,
          clientCompanyName: input.clientCompanyName ?? null,
          location: input.location ?? null,
          website: input.website ?? null,
          profilePicture: input.profilePicture ?? null,
          businessOrIndividual: input.businessOrIndividual ?? null,
          hiringCategory: input.hiringCategory ?? null,
          clientPremium: input.clientPremium,
          enterprise: input.enterprise,
          userSignedUp: true,
          onboardingStep: 4,
        };
        if (input.password) {
          values.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
          values.passwordIsTemporary = false;
        }
        const result = await db.insert(usersTable).values(values);
        const newId = (result as any).insertId as number;
        return getUserById(newId);
      }),

    /** All jobs posted by a specific client — admin only */
    clientJobs: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminClientJobs } = await import("./db");
        return getAdminClientJobs(input.clientId);
      }),

    /** All bookings for a specific client with spend totals — admin only */
    clientBookings: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminClientBookings } = await import("./db");
        const rows = await getAdminClientBookings(input.clientId);
        const totalSpendCents = rows.reduce((sum: number, b: any) => {
          const rate = b.totalClientRate ?? b.clientRate ?? 0;
          return sum + (b.bookingStatus === "Completed" ? Number(rate) : 0);
        }, 0);
        const completedCount = rows.filter((b: any) => b.bookingStatus === "Completed").length;
        return { bookings: rows, totalSpendCents, completedCount };
      }),

    /** Get a single regular job with client info — admin only */
    getJob: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminJobById } = await import("./db");
        return getAdminJobById(input.id);
      }),

    /** Update a regular job — admin only */
    updateJob: protectedProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        requestStatus: z.string().optional(),
        locationAddress: z.string().optional(),
        hiringCategory: z.string().optional(),
        artistHourlyRate: z.number().nullable().optional(),
        clientHourlyRate: z.number().nullable().optional(),
        openRate: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, ...fields } = input;
        const { updateAdminJob, getAdminJobById } = await import("./db");
        await updateAdminJob(id, fields);
        return getAdminJobById(id);
      }),

    /** All applicants for a specific regular job — admin only */
    jobApplicants: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminJobApplicants } = await import("./db");
        return getAdminJobApplicants(input.jobId);
      }),

    /** All bookings for a specific regular job — admin only */
    jobBookings: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminJobBookings } = await import("./db");
        return getAdminJobBookings(input.jobId);
      }),

    /** Get a single PRO job by id — admin only */
    getProJob: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getPremiumJobById } = await import("./db");
        return getPremiumJobById(input.id);
      }),

    /** Update a PRO job — admin only */
    updateProJob: protectedProcedure
      .input(z.object({
        id: z.number(),
        company: z.string().optional(),
        logo: z.string().optional(),
        serviceType: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        budget: z.string().optional(),
        location: z.string().optional(),
        status: z.string().optional(),
        workFromAnywhere: z.boolean().optional(),
        featured: z.boolean().optional(),
        applyDirect: z.boolean().optional(),
        applyEmail: z.string().optional(),
        applyLink: z.string().optional(),
        tag: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, ...fields } = input;
        const { updateAdminProJob, getPremiumJobById } = await import("./db");
        await updateAdminProJob(id, fields);
        return getPremiumJobById(id);
      }),

    /** All clients with search + filters */
    clients: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        companySearch: z.string().optional(),
        locationSearch: z.string().optional(),
        hiringCategory: z.string().optional(),
        state: z.string().optional(),
        plan: z.string().optional(),
        businessType: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAdminClients(input);
      }),

    /** All jobs with search + filters */
    jobs: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        companySearch: z.string().optional(),
        artistSearch: z.string().optional(),
        locationSearch: z.string().optional(),
        service: z.string().optional(),
        status: z.string().optional(),
        state: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAdminJobs(input);
      }),

    /** All bookings with filters */
    bookings: protectedProcedure
      .input(z.object({
        upcoming: z.boolean().optional(),
        paymentStatus: z.string().optional(),
        bookingStatus: z.string().optional(),
        artistSearch: z.string().optional(),
        clientSearch: z.string().optional(),
        companySearch: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAdminBookings(input);
      }),

    /** Single booking with client + artist + job info — admin only */
    getBooking: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminBookingById } = await import("./db");
        return getAdminBookingById(input.id);
      }),

    /** Payments for a booking — admin only */
    bookingPayments: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminBookingPayments } = await import("./db");
        return getAdminBookingPayments(input.bookingId);
      }),

    /** Recent payments paginated */
    payments: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAdminPayments(input);
      }),

    /** Single payment with booking + client + artist info — admin only */
    getPayment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminPaymentById } = await import("./db");
        return getAdminPaymentById(input.id);
      }),

    /**
     * Live Stripe subscription data for artist Basic + PRO plans.
     * Fetches all subscriptions across both plans and both billing intervals,
     * joins with local DB users by stripeCustomerId, and computes MRR/ARR.
     */
    subscriptions: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
        throw new Error("Forbidden: admin only");
      }

      const stripe = getStripe();
      const { STRIPE_PRODUCTS } = await import("./stripe-products");

      // Fetch all subscriptions for each of our 4 price IDs in parallel
      const [bmRes, baRes, pmRes, paRes] = await Promise.all([
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_BASIC.monthly.priceId, status: "all", limit: 100, expand: ["data.customer"] }),
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_BASIC.annual.priceId,  status: "all", limit: 100, expand: ["data.customer"] }),
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_PRO.monthly.priceId,   status: "all", limit: 100, expand: ["data.customer"] }),
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_PRO.annual.priceId,    status: "all", limit: 100, expand: ["data.customer"] }),
      ]);

      type RawSub = { sub: any; plan: "basic" | "pro"; interval: "month" | "year" };
      const tagged: RawSub[] = [
        ...bmRes.data.map(s => ({ sub: s, plan: "basic" as const, interval: "month" as const })),
        ...baRes.data.map(s => ({ sub: s, plan: "basic" as const, interval: "year" as const })),
        ...pmRes.data.map(s => ({ sub: s, plan: "pro"   as const, interval: "month" as const })),
        ...paRes.data.map(s => ({ sub: s, plan: "pro"   as const, interval: "year" as const })),
      ];

      // Deduplicate by Stripe subscription ID
      const seen = new Set<string>();
      const unique = tagged.filter(({ sub }) => {
        if (seen.has(sub.id)) return false;
        seen.add(sub.id);
        return true;
      });

      // Collect all Stripe customer IDs so we can batch-look up DB users
      const customerIds: string[] = unique
        .map(({ sub }) => (typeof sub.customer === "string" ? sub.customer : sub.customer?.id))
        .filter(Boolean) as string[];

      const { getDb } = await import("./db");
      const { users: usersTable } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      const db = await getDb();

      // Look up DB users by stripeCustomerId
      const dbUsers: Array<{
        id: number;
        firstName: string | null;
        lastName: string | null;
        name: string | null;
        email: string | null;
        profilePicture: string | null;
        stripeCustomerId: string | null;
      }> = db && customerIds.length > 0
        ? await db
            .select({
              id: usersTable.id,
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
              name: usersTable.name,
              email: usersTable.email,
              profilePicture: usersTable.profilePicture,
              stripeCustomerId: usersTable.stripeCustomerId,
            })
            .from(usersTable)
            .where(inArray(usersTable.stripeCustomerId, customerIds))
        : [];

      const userByCustomerId = new Map<string, typeof dbUsers[0]>();
      for (const u of dbUsers) {
        if (u.stripeCustomerId) userByCustomerId.set(u.stripeCustomerId, u);
      }

      let mrrCents = 0;

      const subscriptions = unique.map(({ sub, plan, interval }) => {
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const customerObj = typeof sub.customer === "object" && sub.customer !== null ? sub.customer : null;

        const dbUser = customerId ? userByCustomerId.get(customerId) : null;
        const email = dbUser?.email ?? customerObj?.email ?? "";
        const fullName = dbUser
          ? (`${dbUser.firstName ?? ""} ${dbUser.lastName ?? ""}`.trim() || dbUser.name || email)
          : (customerObj?.name || email);

        // Amount from Stripe item
        const item = sub.items?.data?.[0];
        const amountCents: number = item?.price?.unit_amount ?? 0;
        const monthlyAmountCents = interval === "year" ? Math.round(amountCents / 12) : amountCents;

        // Derived status
        const isAtRisk = (sub.status === "active" && sub.cancel_at_period_end) || sub.status === "past_due" || sub.status === "unpaid";
        const isCanceled = sub.status === "canceled";
        const isActive = sub.status === "active" && !sub.cancel_at_period_end && !isAtRisk;
        const isTrialing = sub.status === "trialing";

        const derivedStatus: "active" | "at_risk" | "canceled" | "trialing" | "past_due" =
          isCanceled ? "canceled"
          : isTrialing ? "trialing"
          : isAtRisk ? "at_risk"
          : "active";

        if (isActive || isTrialing) mrrCents += monthlyAmountCents;

        return {
          stripeSubId: sub.id as string,
          customerId: customerId as string | null,
          userId: dbUser?.id ?? null,
          name: fullName,
          email,
          plan,
          interval,
          amountCents,
          monthlyAmountCents,
          status: derivedStatus,
          cancelAtPeriodEnd: sub.cancel_at_period_end as boolean,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          createdAt: new Date(sub.created * 1000).toISOString(),
        };
      });

      // Sort: active first, then at_risk, then trialing, then canceled; within each by createdAt desc
      const ORDER = { active: 0, trialing: 1, at_risk: 2, past_due: 3, canceled: 4 };
      subscriptions.sort((a, b) =>
        (ORDER[a.status] - ORDER[b.status]) || (b.createdAt > a.createdAt ? 1 : -1)
      );

      const activeCount = subscriptions.filter(s => s.status === "active" || s.status === "trialing").length;
      const basicActiveCount = subscriptions.filter(s => (s.status === "active" || s.status === "trialing") && s.plan === "basic").length;
      const proActiveCount = subscriptions.filter(s => (s.status === "active" || s.status === "trialing") && s.plan === "pro").length;
      const atRiskCount = subscriptions.filter(s => s.status === "at_risk").length;
      const canceledCount = subscriptions.filter(s => s.status === "canceled").length;

      return {
        subscriptions,
        summary: {
          mrrCents,
          arrCents: mrrCents * 12,
          activeCount,
          basicActiveCount,
          proActiveCount,
          atRiskCount,
          canceledCount,
          totalCount: subscriptions.length,
        },
      };
    }),

    /** Interested artists for a specific PRO job (admin view) */
    premiumJobArtists: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getPremiumJobInterestedArtists(input.jobId);
      }),

    /** All enterprise clients with job + artist counts */
    enterpriseClients: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getEnterpriseClients(input);
      }),

    /** Set the enterprise billing plan for a client (on_demand | subscriber | null) */
    setEnterprisePlan: protectedProcedure
      .input(z.object({
        userId: z.number(),
        plan: z.enum(["on_demand", "subscriber"]).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        await setEnterprisePlan(input.userId, input.plan);
        return { success: true };
      }),

    /** All PRO jobs with search + filters */
    premiumJobs: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        status: z.string().optional(),
        clientUserId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAllPremiumJobs(input);
      }),

    /**
     * Impersonate a user — creates a session token for the target user,
     * backs up the current admin session in a separate cookie, and returns
     * the target user's details so the frontend can redirect appropriately.
     */
    impersonate: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        const target = await getUserById(input.userId);
        if (!target) throw new Error("User not found");

        // Back up the current admin session cookie before overwriting it
        const currentCookie = ctx.req.headers.cookie
          ? ctx.req.headers.cookie.split(";").find((c: string) => c.trim().startsWith(COOKIE_NAME + "="))
          : undefined;
        const adminToken = currentCookie ? currentCookie.split("=").slice(1).join("=").trim() : "";

        // Create a new session token for the target user
        const targetToken = await sdk.createSessionToken(target.openId, {
          name: target.name || target.firstName || target.email || "User",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);

        // Save the admin's original session in a backup cookie
        if (adminToken) {
          ctx.res.cookie(ADMIN_SESSION_COOKIE_NAME, adminToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });
        }

        // Set a non-httpOnly marker cookie so the client-side banner can detect impersonation
        ctx.res.cookie(IMPERSONATION_MARKER_COOKIE, "1", {
          ...cookieOptions,
          httpOnly: false,
          maxAge: ONE_YEAR_MS,
        });

        // Set the session cookie to the target user's token
        ctx.res.cookie(COOKIE_NAME, targetToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          targetUser: {
            id: target.id,
            name: target.name || target.firstName || target.email,
            email: target.email,
            userRole: target.userRole,
            enterprise: (target as any).enterprise,
          },
        };
      }),

    /**
     * Stop impersonating — restore the original admin session from the backup cookie.
     */
    stopImpersonating: protectedProcedure
      .mutation(async ({ ctx }) => {
        const cookies = ctx.req.headers.cookie || "";
        const adminBackup = cookies.split(";").find((c: string) => c.trim().startsWith(ADMIN_SESSION_COOKIE_NAME + "="));
        if (!adminBackup) throw new Error("No admin session backup found");

        const adminToken = adminBackup.split("=").slice(1).join("=").trim();
        const cookieOptions = getSessionCookieOptions(ctx.req);

        // Restore the admin session
        ctx.res.cookie(COOKIE_NAME, adminToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // Clear the backup cookie and the impersonation marker
        ctx.res.clearCookie(ADMIN_SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        ctx.res.clearCookie(IMPERSONATION_MARKER_COOKIE, { ...cookieOptions, httpOnly: false, maxAge: -1 });

        return { success: true };
      }),
  }),

  // ── Jobs ────────────────────────────────────────────────────────────────────────
  jobs: router({
    /**
     * Get jobs for the currently logged-in user (client dashboard).
     */
    myJobs: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        status: z.array(z.string()).optional(),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getJobsByUserId(user.id, input.limit, input.offset, input.status);
      }),

    /**
     * Get job stats for the currently logged-in user.
     */
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { total: 0, active: 0, confirmed: 0, completed: 0 };
        return getJobStatsByUserId(user.id);
      }),

    /**
     * Public job listings for the /jobs page.
     */
    publicList: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getPublicJobs(input.limit, input.offset);
      }),

    /**
     * Enriched public job listings (includes client company name + avatar).
     * Used by the /jobs page for richer cards and the map view.
     */
    publicListEnriched: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getPublicJobsEnriched(input.limit, input.offset);
      }),

    /**
     * Single job detail by ID — public, enriched with client info.
     * Used by the /jobs/[location]/[title-id] detail page.
     */
    getDetail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const job = await getJobDetailById(input.id);
        if (!job) return null;
        return job;
      }),

    /**
     * Get the logged-in artist's saved resumes for the apply page resume picker.
     */
    myResumes: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return [];
        return getArtistResumes(user.id);
      }),

    /**
     * Submit a job application (creates an interested_artists record).
     */
    submitApplication: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        message: z.string().max(2000).optional(),
        resumeLink: z.string().url().optional().or(z.literal("")),
        artistHourlyRate: z.number().min(0).optional(),
        artistFlatRate: z.number().min(0).optional(),
        isHourlyRate: z.union([z.boolean(), z.number()]).transform(v => !!v).optional(),
        startDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const id = await applyToJob({
          jobId: input.jobId,
          artistUserId: user.id,
          message: input.message,
          resumeLink: input.resumeLink || undefined,
          artistHourlyRate: input.artistHourlyRate,
          artistFlatRate: input.artistFlatRate,
          isHourlyRate: input.isHourlyRate,
          startDate: input.startDate,
        });

        // Send confirmation + alert emails (non-blocking — never fail the application)
        try {
          const job = await getJobDetailById(input.jobId);
          if (job) {
            const jobTitle = job.description
              ? job.description.split("\n")[0].slice(0, 80)
              : "Open Position";
            const jobLocation = job.locationAddress ?? "Location TBD";
            const jobRate = job.openRate
              ? "Open rate"
              : job.isHourly
              ? `$${job.clientHourlyRate ?? job.artistHourlyRate ?? 0}/hr`
              : `$${job.clientHourlyRate ?? job.artistHourlyRate ?? 0} flat`;
            const origin = (ctx.req.headers.origin as string) || "https://artswrk.com";
            const citySlug = (job.locationAddress ?? "remote").split(",")[0].trim().toLowerCase().replace(/\s+/g, "-");
            const titleSlug = jobTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
            const jobUrl = `${origin}/jobs/${citySlug}/${titleSlug}-${job.id}`;

            await Promise.allSettled([
              sendApplicationConfirmationEmail({
                artistName: user.firstName ?? user.name ?? "Artist",
                jobTitle,
                jobLocation,
                jobRate,
                jobUrl,
              }),
              sendNewApplicantAlertEmail({
                artistName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || user.email || "Unknown",
                artistEmail: user.email ?? "(no email)",
                jobTitle,
                jobLocation,
                jobRate,
                jobUrl,
                message: input.message,
                resumeLink: input.resumeLink || undefined,
              }),
            ]);
          }
        } catch (emailErr) {
          console.error("[submitApplication] Email error (non-fatal):", emailErr);
        }

        return { success: true, applicationId: id };
      }),

    /**
     * An artist's own job applications.
     * Protected — only returns applications for the logged-in user.
     */
    myApplications: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return [];
        return getArtistJobApplications(user.id, input.limit, input.offset);
      }),
  }),

  // ── Applicants (Interested Artists) ────────────────────────────────────────
  applicants: router({
    /**
     * Get all applicants for the currently logged-in client.
     */
    myApplicants: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        status: z.array(z.string()).optional(),
        jobId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getInterestedArtistsByClientId(
          user.id,
          input.limit,
          input.offset,
          input.status,
          input.jobId
        );
      }),

    /**
     * Get applicant stats for the currently logged-in client.
     */
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { total: 0, interested: 0, confirmed: 0, declined: 0 };
        return getApplicantStatsByClientId(user.id);
      }),

    /**
     * Get applicants for a specific job (by local job ID).
     */
    byJob: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getApplicantsByJobId(input.jobId, input.limit, input.offset);
      }),
  }),

  // ── Bookings ────────────────────────────────────────────────────────────────
  bookings: router({
    /**
     * Get all bookings for the currently logged-in client.
     */
    myBookings: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
        status: z.array(z.string()).optional(),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getBookingsByClientId(user.id, input.limit, input.offset, input.status);
      }),

    /**
     * Get booking stats for the currently logged-in client.
     */
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { total: 0, confirmed: 0, completed: 0, cancelled: 0, paid: 0, unpaid: 0, totalRevenue: 0 };
        return getBookingStatsByClientId(user.id);
      }),

    /**
     * Get bookings for a specific job.
     */
    byJob: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getBookingsByJobId(input.jobId, input.limit, input.offset);
      }),

    /**
     * Get a single booking by local ID.
     */
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getBookingById(input.id);
      }),

    /**
     * Get the booking linked to an interested artist record.
     */
    byApplicant: protectedProcedure
      .input(z.object({ interestedArtistId: z.number() }))
      .query(async ({ input }) => {
        return getBookingByInterestedArtistId(input.interestedArtistId);
      }),
  }),

  // ── Payments ────────────────────────────────────────────────────────────────
  payments: router({
    /**
     * Get all payments for the currently logged-in client.
     */
    myPayments: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getPaymentsByClientId(user.id, input.limit, input.offset);
      }),

    /**
     * Get payment stats for the currently logged-in client.
     */
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { total: 0, succeeded: 0, totalAmount: 0, totalFees: 0 };
        return getPaymentStatsByClientId(user.id);
      }),

    /**
     * Get wallet stats: total spent, future payments, pending count.
     */
    walletStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { totalSpent: 0, futurePayments: 0, pendingCount: 0, totalPaidAmount: 0 };
        return getWalletStatsByClientId(user.id);
      }),

    /**
     * Get pending "Pay Now" bookings for the client.
     */
    pendingPayments: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return [];
        return getPendingPaymentsByClientId(user.id);
      }),
  }),

  // ── Messages ─────────────────────────────────────────────────────────────────
  messages: router({
    /**
     * Get all conversations for the currently logged-in client.
     */
    myConversations: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getConversationsByClientId(user.id, input.limit, input.offset);
      }),

    /**
     * Get all messages for a specific conversation.
     */
    byConversation: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getMessagesByConversationId(input.conversationId, input.limit, input.offset);
      }),

    /**
     * Get message stats for the currently logged-in client.
     */
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { totalConversations: 0, totalMessages: 0, unreadMessages: 0 };
        return getMessageStatsByClientId(user.id);
      }),

    /**
     * Send a message in an existing conversation.
     * Saves to DB and emails the recipient.
     */
    sendMessage: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string().min(1).max(5000),
      }))
      .mutation(async ({ input, ctx }) => {
        const sender = await getUserByOpenId(ctx.user.openId);
        if (!sender) throw new Error("User not found");

        const msg = await sendMessageToConversation({
          conversationId: input.conversationId,
          senderUserId: sender.id,
          content: input.content,
        });

        // Determine recipient from conversation
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { conversations } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const convRows = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
          const conv = convRows[0];
          if (conv) {
            // Recipient is whoever isn't the sender
            const recipientId = sender.id === conv.clientUserId ? conv.artistUserId : conv.clientUserId;
            if (recipientId) {
              const recipient = await getUserById(recipientId);
              if (recipient?.email) {
                const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
                const senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.name || "Someone";
                sendNewMessageEmail({
                  to: recipient.email,
                  recipientFirstName: recipient.firstName || recipient.name?.split(" ")[0] || "there",
                  senderName,
                  messagePreview: input.content,
                  dashboardUrl: `${appUrl}/app/messages`,
                }).catch((err) => console.error("[Messages] Email send failed:", err.message));
              }
            }
          }
        }

        return { message: msg };
      }),

    /**
     * Get or create a conversation between the logged-in user and an artist, then send an optional first message.
     */
    startConversation: protectedProcedure
      .input(z.object({
        artistUserId: z.number(),
        initialMessage: z.string().min(1).max(5000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const sender = await getUserByOpenId(ctx.user.openId);
        if (!sender) throw new Error("User not found");

        // Determine client vs artist role — clients start convos with artists
        const isClient = sender.userRole !== "Artist";
        const clientUserId = isClient ? sender.id : input.artistUserId;
        const artistUserId = isClient ? input.artistUserId : sender.id;

        const convo = await getOrCreateConversation(clientUserId, artistUserId);

        if (input.initialMessage) {
          await sendMessageToConversation({
            conversationId: convo.id,
            senderUserId: sender.id,
            content: input.initialMessage,
          });
          // Email recipient
          const recipientId = isClient ? artistUserId : clientUserId;
          const recipient = await getUserById(recipientId);
          if (recipient?.email) {
            const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
            const senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.name || "Someone";
            sendNewMessageEmail({
              to: recipient.email,
              recipientFirstName: recipient.firstName || recipient.name?.split(" ")[0] || "there",
              senderName,
              messagePreview: input.initialMessage,
              dashboardUrl: `${appUrl}/app/messages`,
            }).catch((err) => console.error("[Messages] Email send failed:", err.message));
          }
        }

        return { conversationId: convo.id };
      }),
  }),

  // ── Artist Profile ──────────────────────────────────────────────────────────
  artists: router({
    /**
     * Get a single artist by their local DB id.
     */
    getById: protectedProcedure
      .input(z.object({ artistId: z.number() }))
      .query(async ({ input }) => {
        return getArtistById(input.artistId);
      }),

    /**
     * Get an artist's full history with the currently logged-in client.
     */
    getHistory: protectedProcedure
      .input(z.object({ artistId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getArtistHistoryForClient(input.artistId, user.id);
      }),

    /**
     * List all artists who have interacted with the current client (distinct artists from interested_artists).
     */
    listMyArtists: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getInterestedArtistsByClientId(user.id, input.limit, input.offset);
      }),

    /**
     * Browse all artists from the users table (userRole = 'Artist').
     * Supports search by name/location and filter by artist type.
     */
    browse: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(48),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        artistType: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getArtistsList({
          limit: input.limit,
          offset: input.offset,
          search: input.search || undefined,
          artistType: input.artistType || undefined,
        });
      }),

    /**
     * Upload a resume file (base64) to S3 and save it to artist_resumes table.
     * Returns the CDN URL and new resume record.
     */
    uploadResume: protectedProcedure
      .input(z.object({
        fileName: z.string().max(256),
        mimeType: z.string().max(128),
        base64: z.string().max(10 * 1024 * 1024), // ~7.5 MB file limit
        title: z.string().max(256).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("DB unavailable");

        const buffer = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `resumes/${user.id}/${Date.now()}-${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        const title = input.title || input.fileName;
        const [result] = await db.insert(artistResumes).values({
          artistUserId: user.id,
          title,
          fileUrl: url,
        });
        const insertId = (result as any).insertId;
        return { id: `lib-${insertId}`, title, fileUrl: url, source: "library" as const };
      }),
  }),

  // ── Job Posting (Post a Job flow) ─────────────────────────────────────────
  postJob: router({
    /**
     * Parse a natural language job description using AI and return structured fields.
     * Public so unauthenticated users can preview before being asked to log in.
     */
    parseText: publicProcedure
      .input(z.object({ text: z.string().min(10).max(2000) }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an assistant that extracts structured job posting data from natural language descriptions for an arts hiring platform (Artswrk). Extract the following fields and return valid JSON. For fields you cannot determine, return null. Today's date is ${new Date().toISOString().split('T')[0]}.

Fields to extract:
- title: string (short job title, e.g. "Ballet Substitute Teacher", "Hip Hop Choreographer", "Competition Judge")
- description: string (the original text, cleaned up)
- locationAddress: string or null (full address or city/state)
- dateType: "Single Date" | "Weekly" | "Multiple Dates" | "Dates Flexible" | "Ongoing" (infer from context; use "Weekly" for recurring weekly classes, "Multiple Dates" for multiple specific dates, "Dates Flexible" if no specific date is mentioned)
- startDate: ISO 8601 datetime string or null
- endDate: ISO 8601 datetime string or null (for single date jobs, this is the end time same day)
- isHourly: boolean (true if hourly rate, false if flat rate)
- openRate: boolean (true if rate is open/negotiable)
- clientHourlyRate: number or null (hourly rate in dollars)
- clientFlatRate: number or null (flat rate in dollars, only if not hourly)
- transportation: boolean (true if travel/transportation is covered)
- serviceType: string or null (e.g. "Ballet", "Hip Hop", "Yoga", "Competition", "Piano", "Violin")`,
            },
            { role: "user", content: input.text },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "job_parse",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: ["string", "null"] },
                  description: { type: "string" },
                  locationAddress: { type: ["string", "null"] },
                  dateType: { type: "string", enum: ["Single Date", "Weekly", "Multiple Dates", "Dates Flexible", "Ongoing"] },
                  startDate: { type: ["string", "null"] },
                  endDate: { type: ["string", "null"] },
                  isHourly: { type: "boolean" },
                  openRate: { type: "boolean" },
                  clientHourlyRate: { type: ["number", "null"] },
                  clientFlatRate: { type: ["number", "null"] },
                  transportation: { type: "boolean" },
                  serviceType: { type: ["string", "null"] },
                },
                required: ["title", "description", "locationAddress", "dateType", "startDate", "endDate", "isHourly", "openRate", "clientHourlyRate", "clientFlatRate", "transportation", "serviceType"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0].message.content;
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    /**
     * Create a free job (no payment required) — job goes live immediately as Active.
     * Returns the jobId so the frontend can optionally create a boost checkout.
     */
    createFreeJob: protectedProcedure
      .input(z.object({
        description: z.string().min(10),
        locationAddress: z.string().optional(),
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        dateType: z.enum(["Single Date", "Weekly", "Multiple Dates", "Dates Flexible", "Ongoing", "Recurring"]).default("Single Date"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        multipleDates: z.array(z.string()).optional(),
        isHourly: z.boolean().default(true),
        openRate: z.boolean().default(false),
        clientHourlyRate: z.number().optional(),
        clientFlatRate: z.number().optional(),
        transportation: z.boolean().default(false),
        transportationInstructions: z.string().optional(),
        studioName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await createJob({
          clientUserId: user.id,
          clientEmail: user.email ?? undefined,
          description: input.description,
          locationAddress: input.locationAddress,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          dateType: input.dateType,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          isHourly: input.isHourly,
          openRate: input.openRate,
          clientHourlyRate: input.clientHourlyRate,
          transportation: input.transportation,
          requestStatus: "Active",
        });

        // Send confirmation email (no Stripe webhook fires for free jobs)
        if (user.email) {
          const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
          const rateDisplay = input.openRate
            ? "Open rate (negotiable)"
            : input.isHourly && input.clientHourlyRate
            ? `$${input.clientHourlyRate}/hr`
            : input.clientHourlyRate
            ? `$${input.clientHourlyRate} flat`
            : "Rate TBD";
          sendJobPostedEmail({
            to: user.email,
            firstName: user.firstName ?? user.name?.split(" ")[0] ?? "there",
            serviceType: "Job Posting",
            date: input.startDate
              ? new Date(input.startDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
              : input.dateType === "Ongoing" ? "Ongoing" : "Flexible / TBD",
            location: input.locationAddress || "Location TBD",
            rate: rateDisplay,
            description: input.description,
            transportation: input.transportation,
            jobLink: `${appUrl}/app/jobs`,
          }).catch((err) => console.error("[free job email]", err));
        }

        return { jobId: job.id };
      }),

    /**
     * Create a draft job and return the job ID + Stripe checkout URL.
     * Requires authentication.
     */
    createAndCheckout: protectedProcedure
      .input(z.object({
        description: z.string().min(10),
        locationAddress: z.string().optional(),
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        dateType: z.enum(["Single Date", "Weekly", "Multiple Dates", "Dates Flexible", "Ongoing", "Recurring"]).default("Single Date"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        multipleDates: z.array(z.string()).optional(),
        isHourly: z.boolean().default(true),
        openRate: z.boolean().default(false),
        clientHourlyRate: z.number().optional(),
        clientFlatRate: z.number().optional(),
        transportation: z.boolean().default(false),
        transportationInstructions: z.string().optional(),
        studioName: z.string().optional(),
        plan: z.enum(["one_time", "subscription"]).default("one_time"),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");

        // Create the job in "Pending Payment" status
        const job = await createJob({
          clientUserId: user.id,
          clientEmail: user.email ?? undefined,
          description: input.description,
          locationAddress: input.locationAddress,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          dateType: input.dateType,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          isHourly: input.isHourly,
          openRate: input.openRate,
          clientHourlyRate: input.clientHourlyRate,
          transportation: input.transportation,
          requestStatus: "Pending Payment",
        });

        // Create Stripe checkout session
        const checkoutOpts = {
          email: user.email ?? undefined,
          userId: user.id,
          jobId: job.id,
          origin: input.origin,
          stripeCustomerId: user.clientStripeCustomerId,
        };

        const { url, sessionId } = input.plan === "subscription"
          ? await createSubscriptionCheckoutSession(checkoutOpts)
          : await createJobPostCheckoutSession(checkoutOpts);

        return { jobId: job.id, checkoutUrl: url, sessionId };
      }),

     /**
     * Get all companies for the logged-in user (for the "posting on behalf of" dropdown).
     * Falls back to the user's clientCompanyName if no client_companies rows exist.
     */
    getMyCompanies: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const companies = await getClientCompaniesByUserId(user.id);
        return {
          companies,
          primaryCompanyName: user.clientCompanyName ?? null,
          userFullName: user.name ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          userLocation: user.location ?? null,
        };
      }),
    /**
     * Get defaults from the user's most recent job post (rate, transport details, location).
     * Used to auto-populate Step 2 fields for returning hirers.
     */
    getLastJobDefaults: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const jobList = await getJobsByUserId(user.id, 1);
        if (!jobList || jobList.length === 0) return null;
        const last = jobList[0];
        return {
          isHourly: last.isHourly ?? true,
          openRate: last.openRate ?? false,
          clientHourlyRate: last.clientHourlyRate ?? null,
          transportation: last.transportation ?? false,
          locationAddress: last.locationAddress ?? null,
        };
      }),
    /**
     * Add a new company to the logged-in user's profile.
     */
    addCompany: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        logo: z.string().optional(),
        locationAddress: z.string().optional(),
        website: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const newId = await createClientCompany({
          ownerUserId: user.id,
          name: input.name,
          logo: input.logo ?? null,
          locationAddress: input.locationAddress ?? null,
          website: input.website ?? null,
          description: input.description ?? null,
        });
        const companies = await getClientCompaniesByUserId(user.id);
        return { success: true, newCompanyId: newId, companies };
      }),
    /**
     * Verify a completed Stripe checkout session and activate the job.
     * Called from the success page.
     */
    verifyCheckout: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(input.sessionId);
        if (session.payment_status !== "paid" && session.status !== "complete") {
          throw new Error("Payment not completed");
        }
        const jobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
        if (jobId) {
          await activateJob(jobId);
        }

        // Save Stripe customer ID for future use
        if (session.customer && typeof session.customer === "string" && !user.clientStripeCustomerId) {
          await saveClientStripeCustomerId(user.id, session.customer);
        }

        // Save subscription ID if applicable
        if (session.subscription && typeof session.subscription === "string") {
          await saveClientSubscriptionId(user.id, session.subscription);
        }

        return { success: true, jobId, plan: session.metadata?.type ?? "one_time" };
      }),
  }),

  // ── Signup & Onboarding ────────────────────────────────────────────────────
  signup: router({
    /**
     * Register a new user account.
     * Creates the user, hashes the password, and sets a session cookie.
     */
    register: publicProcedure
      .input(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
        let newUser: { id: number; openId: string };
        try {
          newUser = await createNewUser({ email, firstName: input.firstName, lastName: input.lastName, passwordHash });
        } catch (err: any) {
          if (err.message === "EMAIL_TAKEN") {
            throw new Error("An account with this email already exists.");
          }
          throw err;
        }
        // Create session cookie so user is logged in immediately
        const sessionToken = await sdk.createSessionToken(newUser.openId, {
          name: `${input.firstName} ${input.lastName}`,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, userId: newUser.id };
      }),

    /**
     * Get current onboarding status for the logged-in client.
     * Used by /client-onboarding to resume from the last saved step.
     */
    getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new Error("User not found");
      return {
        onboardingStep: user.onboardingStep ?? 0,
        businessOrIndividual: (user as any).businessOrIndividual ?? null,
        hiringCategory: user.hiringCategory ?? null,
        clientCompanyName: user.clientCompanyName ?? null,
        location: user.location ?? null,
        website: user.website ?? null,
        phoneNumber: user.phoneNumber ?? null,
        userSignedUp: user.userSignedUp ?? false,
        firstName: user.firstName ?? null,
      };
    }),

    /**
     * Save onboarding step data (business type, company details, etc.).
     */
    updateOnboarding: protectedProcedure
      .input(z.object({
        businessOrIndividual: z.string().optional(),
        hiringCategory: z.string().optional(),
        clientCompanyName: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        phoneNumber: z.string().optional(),
        onboardingStep: z.number().optional(),
        userSignedUp: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await updateUserOnboarding(user.id, input);
        return { success: true };
      }),

    /**
     * Get artist onboarding status for resume-from-step.
     */
    getArtistOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new Error("User not found");
      return {
        onboardingStep: user.onboardingStep ?? 0,
        masterArtistTypes: user.masterArtistTypes ? JSON.parse(user.masterArtistTypes as string) : [],
        artistServices: user.artistServices ? JSON.parse(user.artistServices as string) : [],
        bio: user.bio ?? null,
        location: user.location ?? null,
        phoneNumber: user.phoneNumber ?? null,
        instagram: user.instagram ?? null,
        tiktok: user.tiktok ?? null,
        youtube: user.youtube ?? null,
        profilePicture: user.profilePicture ?? null,
        firstName: user.firstName ?? null,
        userSignedUp: user.userSignedUp ?? false,
      };
    }),

    /**
     * Save artist onboarding data (artist types, services, profile info).
     * Fires welcome email when userSignedUp transitions to true.
     */
    updateArtistOnboarding: protectedProcedure
      .input(z.object({
        masterArtistTypes: z.array(z.string()).optional(),
        artistServices: z.array(z.string()).optional(),
        bio: z.string().optional(),
        location: z.string().optional(),
        phoneNumber: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        profilePicture: z.string().optional(),
        onboardingStep: z.number().optional(),
        userSignedUp: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const wasSignedUp = user.userSignedUp;
        await updateUserOnboarding(user.id, input);
        // Send welcome email on first completion
        if (input.userSignedUp && !wasSignedUp && user.email) {
          sendArtistWelcomeEmail({
            to: user.email,
            firstName: user.firstName ?? user.name ?? "there",
          }).catch((err) => console.error("[welcome email]", err));
        }
        return { success: true };
      }),

    /**
     * Upload a profile picture (base64) and save the URL to the user record.
     */
    uploadProfilePicture: protectedProcedure
      .input(z.object({
        base64: z.string(),
        contentType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const buf = Buffer.from(input.base64, "base64");
        const ext = input.contentType.split("/")[1] ?? "jpg";
        const { url } = await storagePut(
          `profile-pictures/${user.id}-${Date.now()}.${ext}`,
          buf,
          input.contentType
        );
        await updateUserOnboarding(user.id, { profilePicture: url });
        return { url };
      }),

    /**
     * Send artist invite emails.
     */
    sendArtistInvites: protectedProcedure
      .input(z.object({ emails: z.array(z.string().email()).min(1).max(20) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const senderName = user.firstName ?? user.name ?? "A fellow artist";
        const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
        const results = await Promise.allSettled(
          input.emails.map((email) =>
            sendSimpleEmail({
              to: email,
              subject: `${senderName} invited you to join Artswrk`,
              html: `
                <div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0">
                  <div style="background:linear-gradient(135deg,#FFBC5D,#F25722);padding:28px 36px">
                    <div style="display:inline-flex;align-items:center;gap:6px">
                      <span style="font-size:20px;font-weight:900;color:#fff">ARTS</span>
                      <span style="font-size:20px;font-weight:900;background:#111;color:#fff;padding:2px 8px;border-radius:6px">WRK</span>
                    </div>
                  </div>
                  <div style="padding:36px">
                    <h2 style="color:#111;font-size:22px;font-weight:900;margin:0 0 12px">Hey there,</h2>
                    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px">
                      Hope you're doing well! I wanted to invite you to join me on Artswrk.
                    </p>
                    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px">
                      <strong>Artswrk is a jobs network for artists.</strong> You can find jobs for dance teachers, music teachers, photographers, videographers, and more. You can also pick up side jobs!
                    </p>
                    <a href="${appUrl}/join" style="display:inline-block;background:linear-gradient(90deg,#FFBC5D,#F25722);color:#fff;font-weight:800;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:28px">
                      Get started at artswrk.com ⭐️
                    </a>
                    <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 20px" />
                    <p style="color:#888;font-size:13px;margin:0">
                      Talk to you soon!<br/><br/>
                      Best,<br/>
                      <strong style="color:#111">${senderName}</strong>
                    </p>
                  </div>
                </div>
              `,
            })
          )
        );
        const sent = results.filter((r) => r.status === "fulfilled").length;
        return { sent, total: input.emails.length };
      }),
  }),

  // ── Boost ────────────────────────────────────────────────────────────────────
  boost: router({
    /**
     * Create a Stripe checkout session for a job boost.
     */
    createCheckout: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        dailyBudget: z.number().min(5).max(100),
        durationDays: z.number().min(1).max(30),
        origin: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        const totalAmountCents = calcBoostTotal(input.dailyBudget, input.durationDays);
        const { url, sessionId } = await createBoostCheckoutSession({
          email: user.email ?? undefined,
          userId: user.id,
          jobId: input.jobId,
          origin: input.origin,
          stripeCustomerId: user.clientStripeCustomerId,
          dailyBudget: input.dailyBudget,
          durationDays: input.durationDays,
          totalAmountCents,
        });
        return { checkoutUrl: url, sessionId, totalAmountCents };
      }),

    /**
     * Verify a completed boost checkout and activate the boost on the job.
     */
    verifyCheckout: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(input.sessionId);
        if (session.payment_status !== "paid" && session.status !== "complete") {
          throw new Error("Payment not completed");
        }
        const jobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
        const dailyBudget = session.metadata?.daily_budget ? parseFloat(session.metadata.daily_budget) : 10;
        const durationDays = session.metadata?.duration_days ? parseInt(session.metadata.duration_days) : 7;
        if (jobId) {
          await activateBoost(jobId, {
            dailyBudget,
            durationDays,
            stripeSessionId: session.id,
          });
        }
        if (session.customer && typeof session.customer === "string" && !user.clientStripeCustomerId) {
          await saveClientStripeCustomerId(user.id, session.customer);
        }
        return { success: true, jobId };
      }),
  }),

  // ── Enterprise Dashboard ────────────────────────────────────────────────────
  enterprise: router({
    /**
     * PRO Jobs posted by this enterprise client — queries premium_jobs table.
     * Falls back to regular jobs table if no premium jobs found.
     */
    getJobs: publicProcedure
      .input(z.object({ clientUserId: z.number().optional() }))
      .query(async ({ input }) => {
        if (!input.clientUserId) return { jobs: [] };
        const proJobs = await getPremiumJobsByUserId(input.clientUserId);
        if ((proJobs as any[]).length > 0) {
          return { jobs: proJobs as any[] };
        }
        // Fallback to regular jobs for non-premium enterprise users
        const regularJobs = await getJobsByUserId(input.clientUserId);
        return { jobs: regularJobs as any[] };
      }),

    /** Interested artists (applications) across all enterprise PRO jobs */
    getApplications: publicProcedure
      .input(z.object({ clientUserId: z.number().optional() }))
      .query(async ({ input }) => {
        if (!input.clientUserId) return { applications: [] };
        const raw = await getPremiumInterestedArtistsByCreatorId(input.clientUserId);
        const applications = (raw as any[]).map((ia) => ({
          id: ia.id,
          artistName: ia.artistFirstName ? `${ia.artistFirstName || ''} ${ia.artistLastName || ''}`.trim() : 'Artist',
          profilePicture: ia.artistProfilePicture,
          jobTitle: ia.jobTitle || 'PRO Job',
        }));
        return { applications };
      }),

    /** Companies under this enterprise account */
    getCompanies: publicProcedure
      .input(z.object({ clientUserId: z.number().optional() }))
      .query(async ({ input }) => {
        if (!input.clientUserId) return { companies: [] };
        const user = await getUserById(input.clientUserId);
        if (!user) return { companies: [] };
        const proJobs = await getPremiumJobsByUserId(input.clientUserId);
        const openRoles = (proJobs as any[]).filter((j) => j.status === 'Active' || !j.status).length;
        const companies = [{
          id: user.id,
          name: user.clientCompanyName || user.name || 'Company',
          logoUrl: user.enterpriseLogoUrl || user.profilePicture,
          location: user.location,
          openRoles,
        }];
        return { companies };
      }),

    /** Unique interested artists across all PRO jobs for this enterprise user */
    getInterestedArtists: publicProcedure
      .input(z.object({ clientUserId: z.number().optional() }))
      .query(async ({ input }) => {
        if (!input.clientUserId) return { artists: [] };
        const raw = await getPremiumInterestedArtistsByCreatorId(input.clientUserId);
        // Deduplicate by artistUserId
        const seen = new Set<number>();
        const artists = (raw as any[])
          .filter((ia) => {
            if (!ia.artistUserId || seen.has(ia.artistUserId)) return false;
            seen.add(ia.artistUserId);
            return true;
          })
          .slice(0, 100)
          .map((a) => ({
            id: a.artistUserId,
            name: a.artistName,
            firstName: a.artistFirstName,
            lastName: a.artistLastName,
            profilePicture: a.artistProfilePicture,
            location: a.artistLocation,
            artswrkPro: a.artswrkPro,
          }));
        return { artists };
      }),
    /** Get a single premium job by ID */
    getJobDetail: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const job = await getPremiumJobById(input.jobId);
        return { job };
      }),
    /** Get applicants (interested artists) for a specific premium job */
    getJobApplicants: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        // Check if this is an on-demand enterprise client who hasn't unlocked this job
        const user = await getUserById(ctx.user.id);
        const isOnDemand = user?.enterprise && user.enterprisePlan === "on_demand";
        const isSubscriber = user?.enterprise && user.enterprisePlan === "subscriber";
        // Admin and subscriber: full access. On-demand: check unlock. No plan: show count only.
        const isAdmin = ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin";

        if (!isAdmin && isOnDemand) {
          const unlocked = await isJobUnlocked(ctx.user.id, input.jobId);
          if (!unlocked) {
            // Return count only — frontend shows paywall
            const raw = await getPremiumJobInterestedArtists(input.jobId);
            return { applicants: [], applicantCount: (raw as any[]).length, locked: true, plan: "on_demand" as const };
          }
        }

        const raw = await getPremiumJobInterestedArtists(input.jobId);
        const applicants = (raw as any[]).map((ia) => ({
          id: ia.id,
          artistUserId: ia.artistUserId,
          name: ia.artistFirstName
            ? `${ia.artistFirstName || ''} ${ia.artistLastName || ''}`.trim()
            : (ia.artistName || 'Artist'),
          firstName: ia.artistFirstName,
          lastName: ia.artistLastName,
          profilePicture: ia.artistProfilePicture,
          location: ia.artistLocation,
          bio: ia.artistBio,
          disciplines: ia.artistDisciplines,
          slug: ia.artistSlug,
          message: ia.message,
          rate: ia.rate,
          resumeLink: ia.resumeLink,
          status: ia.status,
          createdAt: ia.createdAt,
          artswrkPro: ia.artswrkPro,
        }));
        return { applicants, applicantCount: applicants.length, locked: false, plan: (isOnDemand ? "on_demand" : isSubscriber ? "subscriber" : null) as "on_demand" | "subscriber" | null };
      }),

    /** Get client companies for this enterprise user */
    getClientCompanies: protectedProcedure
      .query(async ({ ctx }) => {
        const companies = await getClientCompaniesByUserId(ctx.user.id);
        return { companies };
      }),

    /** Create a new premium job */
    postJob: protectedProcedure
      .input(z.object({
        serviceType: z.string().min(1, 'Job title is required'),
        company: z.string().min(1, 'Company is required'),
        logo: z.string().optional(),
        category: z.string().optional(),
        location: z.string().optional(),
        budget: z.string().optional(),
        workFromAnywhere: z.boolean().default(false),
        description: z.string().optional(),
        applyEmail: z.string().email().optional().or(z.literal('')),
        bubbleClientCompanyId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const jobId = await createPremiumJob({
          serviceType: input.serviceType,
          company: input.company,
          logo: input.logo || null,
          category: input.category || null,
          location: input.location || null,
          budget: input.budget || null,
          workFromAnywhere: input.workFromAnywhere,
          description: input.description || null,
          applyEmail: input.applyEmail || null,
          createdByUserId: ctx.user.id,
          bubbleClientCompanyId: input.bubbleClientCompanyId || null,
        });

        // Send PRO job confirmation email
        const poster = await getUserByOpenId(ctx.user.openId);
        if (poster?.email) {
          const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
          sendProJobPostedEmail({
            to: poster.email,
            firstName: poster.firstName ?? poster.name?.split(" ")[0] ?? "there",
            company: input.company,
            serviceType: input.serviceType,
            category: input.category || null,
            location: input.location || null,
            budget: input.budget || null,
            description: input.description || null,
            workFromAnywhere: input.workFromAnywhere,
            jobLink: `${appUrl}/enterprise`,
          }).catch((err) => console.error("[PRO job email]", err));
        }

        return { success: true, jobId };
      }),

    /** Get enterprise billing info for the logged-in client */
    getBillingInfo: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.enterprise) throw new Error("Not an enterprise account");
      const billing = await getEnterpriseBillingInfo(ctx.user.id);
      // Fetch live subscription status from Stripe if subscriber
      let subscriptionStatus: string | null = null;
      let subscriptionInterval: string | null = null;
      let currentPeriodEnd: string | null = null;
      let cancelAtPeriodEnd = false;
      if (billing?.enterpriseStripeSubscriptionId) {
        try {
          const stripe = getStripe();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = await stripe.subscriptions.retrieve(
            billing.enterpriseStripeSubscriptionId,
            { expand: ["items.data.price"] }
          ) as any;
          subscriptionStatus = sub.status;
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
          const price = sub.items?.data?.[0]?.price;
          subscriptionInterval = price?.recurring?.interval ?? null;
        } catch {
          // sub may have been deleted in Stripe
        }
      }
      return {
        enterprisePlan: billing?.enterprisePlan ?? null,
        enterpriseStripeCustomerId: billing?.enterpriseStripeCustomerId ?? null,
        enterpriseStripeSubscriptionId: billing?.enterpriseStripeSubscriptionId ?? null,
        subscriptionStatus,
        subscriptionInterval,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      };
    }),

    /** Get which job IDs this enterprise client has unlocked (on-demand) */
    getUnlockedJobs: protectedProcedure.query(async ({ ctx }) => {
      const unlockedJobIds = await getUnlockedJobIds(ctx.user.id);
      return { unlockedJobIds };
    }),

    /** Start a Stripe checkout to unlock a single job ($100, on-demand plan) */
    checkoutJobUnlock: protectedProcedure
      .input(z.object({ jobId: z.number(), jobTitle: z.string().optional(), origin: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user?.enterprise) throw new Error("Not an enterprise account");
        if (user.enterprisePlan !== "on_demand") throw new Error("Job unlock is only for on-demand plan");
        // Prevent double-paying
        const alreadyUnlocked = await isJobUnlocked(ctx.user.id, input.jobId);
        if (alreadyUnlocked) return { alreadyUnlocked: true, url: null };
        const { url, sessionId } = await createEnterpriseJobUnlockCheckoutSession({
          email: user.email ?? undefined,
          userId: ctx.user.id,
          jobId: input.jobId,
          jobTitle: input.jobTitle,
          origin: input.origin,
          stripeCustomerId: user.enterpriseStripeCustomerId ?? null,
        });
        return { alreadyUnlocked: false, url, sessionId };
      }),

    /** Start a Stripe checkout for enterprise subscription (monthly or annual) */
    checkoutSubscription: protectedProcedure
      .input(z.object({ interval: z.enum(["month", "year"]), origin: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user?.enterprise) throw new Error("Not an enterprise account");
        if (user.enterprisePlan !== "subscriber") throw new Error("Subscription checkout is only for subscriber plan");
        const { url, sessionId } = await createEnterpriseSubscriptionCheckoutSession({
          email: user.email ?? undefined,
          userId: ctx.user.id,
          interval: input.interval,
          origin: input.origin,
          stripeCustomerId: user.enterpriseStripeCustomerId ?? null,
        });
        return { url, sessionId };
      }),

    /** Open Stripe Customer Portal for enterprise subscription management */
    billingPortal: protectedProcedure
      .input(z.object({ returnUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const billing = await getEnterpriseBillingInfo(ctx.user.id);
        if (!billing?.enterpriseStripeCustomerId) throw new Error("No Stripe customer found");
        const stripe = getStripe();
        const session = await stripe.billingPortal.sessions.create({
          customer: billing.enterpriseStripeCustomerId,
          return_url: input.returnUrl,
        });
        return { url: session.url };
      }),

    /** Send a direct message to an artist from enterprise job detail view */
    messageArtist: protectedProcedure
      .input(z.object({ artistUserId: z.number(), message: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const sender = await getUserById(ctx.user.id);
        if (!sender) throw new Error("User not found");
        const conversation = await getOrCreateConversation(ctx.user.id, input.artistUserId);
        await sendMessageToConversation({ conversationId: conversation.id, senderUserId: ctx.user.id, content: input.message });
        const artist = await getUserById(input.artistUserId);
        if (artist?.email) {
          try {
            await sendSimpleEmail({
              to: artist.email,
              subject: `New message from ${(sender as any).clientCompanyName ?? sender.name ?? "Artswrk Client"}`,
              html: `<p>Hi ${artist.firstName ?? "there"},</p><p>${(sender as any).clientCompanyName ?? sender.name ?? "A client"} has sent you a message on Artswrk:</p><blockquote style="border-left:3px solid #F25722;padding-left:12px;color:#555">${input.message}</blockquote><p><a href="https://artswrk.com/app/messages">Log in to reply</a></p><p>Best,<br/>The Artswrk Team</p>`,
            });
          } catch (e) {
            console.error("[enterprise.messageArtist] Email send failed (non-fatal):", e);
          }
        }
        return { success: true, conversationId: conversation.id };
      }),
  }),
  // ── Artswrk user queries ─────────────────────────────────────────────────────────────────
  artistDashboard: router({
    /** Get public jobs feed for artist dashboard, optionally filtered by 50-mile radius */
    getJobsFeed: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getArtistJobsFeed(input.limit, input.offset, input.lat, input.lng);
      }),
    /** Get the logged-in artist's affiliations */
    getMyAffiliations: protectedProcedure.query(async ({ ctx }) => {
      return getMyAffiliations(ctx.user.id);
    }),
    /** Get PRO jobs feed for artist dashboard */
    getProJobsFeed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20), offset: z.number().min(0).default(0) }))
      .query(async ({ input }) => {
        return getArtistProJobsFeed(input.limit, input.offset);
      }),
    /** Get PRO job applications for the logged-in artist */
    getProApplications: protectedProcedure
      .query(async ({ ctx }) => {
        return getArtistProApplications(ctx.user.id);
      }),
    /** Get bookings for the logged-in artist */
    getBookings: protectedProcedure
      .query(async ({ ctx }) => {
        return getArtistBookings(ctx.user.id);
      }),
    /** Get payments for the logged-in artist */
    getPayments: protectedProcedure
      .query(async ({ ctx }) => {
        return getArtistPayments(ctx.user.id);
      }),
    /** Apply to a PRO job as artist */
    applyToProJob: protectedProcedure
      .input(z.object({ premiumJobId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Insert into premium_job_interested_artists
        const { getDb } = await import('./db');
        const dbConn = await getDb();
        if (!dbConn) throw new Error('DB unavailable');
        const { premiumJobInterestedArtists } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        // Check if already applied
        const existing = await dbConn.select().from(premiumJobInterestedArtists)
          .where(and(
            eq(premiumJobInterestedArtists.artistUserId, ctx.user.id),
            eq(premiumJobInterestedArtists.premiumJobId, input.premiumJobId)
          ));
        if (existing.length > 0) return { success: true, alreadyApplied: true };
        await dbConn.insert(premiumJobInterestedArtists).values({
          artistUserId: ctx.user.id,
          premiumJobId: input.premiumJobId,
          status: 'Pending',
          createdAt: new Date(),
        });
        return { success: true, alreadyApplied: false };
      }),
  }),

  artswrkUsers: router({
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await getUserById(input.id);
        return { user };
      }),
    getByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        return getUserByEmail(input.email);
      }),

    getByBubbleId: publicProcedure
      .input(z.object({ bubbleId: z.string() }))
      .query(async ({ input }) => {
        return getUserByBubbleId(input.bubbleId);
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50), offset: z.number().min(0).default(0) }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        return getAllUsers(input.limit, input.offset);
      }),
  }),

  // ── Artist Subscription Management ─────────────────────────────────────────
  artistSubscription: router({
    /**
     * Get the current artist's plan status.
     * Returns { plan: 'free' | 'basic' | 'pro', stripeCustomerId, subscriptionId }
     */
    getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
      const info = await getArtistSubscriptionInfo(ctx.user.id);
      if (!info) return {
        plan: "free" as const,
        stripeCustomerId: null,
        subscriptionId: null,
        billing: null,
      };
      const plan = info.artswrkPro ? "pro" : info.artswrkBasic ? "basic" : "free";

      // Fetch live billing details from Stripe if the user has an active subscription
      let billing: {
        interval: "month" | "year";
        intervalLabel: "Monthly" | "Annual";
        amount: number;
        currency: string;
        formattedPrice: string;
        currentPeriodEnd: number; // Unix timestamp (ms)
        cancelAtPeriodEnd: boolean;
      } | null = null;

      if (info.artistStripeProductId && plan !== "free") {
        try {
          const { getStripe } = await import("./stripe");
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            info.artistStripeProductId,
            { expand: ["items.data.price"] }
          ) as unknown as {
            items: { data: Array<{ price: import("stripe").default.Price }> };
            current_period_end: number;
            cancel_at_period_end: boolean;
          };
          const item = subscription.items.data[0];
          const price = item?.price;
          if (price) {
            const interval = price.recurring?.interval as "month" | "year" | undefined;
            const amount = price.unit_amount ?? 0;
            const currency = price.currency ?? "usd";
            const formattedPrice = (amount / 100).toLocaleString("en-US", {
              style: "currency",
              currency: currency.toUpperCase(),
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            });
            billing = {
              interval: interval ?? "month",
              intervalLabel: interval === "year" ? "Annual" : "Monthly",
              amount,
              currency,
              formattedPrice,
              currentPeriodEnd: subscription.current_period_end * 1000, // convert to ms
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            };
          }
        } catch {
          // Stripe fetch failed — billing stays null, plan info still returned
        }
      }

      return {
        plan: plan as "free" | "basic" | "pro",
        stripeCustomerId: info.stripeCustomerId,
        subscriptionId: info.artistStripeProductId,
        billing,
      };
    }),

    /**
     * Fetch real pricing from Stripe for Basic and PRO plans.
     * Returns formatted price strings (e.g. "$9/mo", "$90/yr").
     * Public so the plan page can show prices before login.
     */
    getPricing: publicProcedure.query(async () => {
      const { getStripe } = await import("./stripe");
      const { STRIPE_PRODUCTS } = await import("./stripe-products");
      const stripe = getStripe();

      async function fetchPrice(priceId: string) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount ?? 0;
          const currency = price.currency ?? "usd";
          const dollars = (amount / 100).toLocaleString("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });
          return { dollars, amount, currency };
        } catch {
          return { dollars: null, amount: null, currency: "usd" };
        }
      }

      const [basicMonthly, basicAnnual, proMonthly, proAnnual] = await Promise.all([
        fetchPrice(STRIPE_PRODUCTS.ARTIST_BASIC.monthly.priceId),
        fetchPrice(STRIPE_PRODUCTS.ARTIST_BASIC.annual.priceId),
        fetchPrice(STRIPE_PRODUCTS.ARTIST_PRO.monthly.priceId),
        fetchPrice(STRIPE_PRODUCTS.ARTIST_PRO.annual.priceId),
      ]);

      return {
        basic: {
          monthly: basicMonthly,
          annual: basicAnnual,
        },
        pro: {
          monthly: proMonthly,
          annual: proAnnual,
        },
      };
    }),

    /**
     * Create a Stripe Checkout session for the artist Basic plan.
     * interval: 'month' | 'year'
     */
    createBasicCheckout: protectedProcedure
      .input(z.object({
        interval: z.enum(["month", "year"]),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const info = await getArtistSubscriptionInfo(ctx.user.id);
        const { url, sessionId } = await createArtistBasicCheckoutSession({
          email: ctx.user.email ?? undefined,
          userId: ctx.user.id,
          origin: input.origin,
          stripeCustomerId: info?.stripeCustomerId ?? null,
          interval: input.interval,
        });
        return { url, sessionId };
      }),

    /**
     * Create a Stripe Checkout session for the artist PRO plan.
     * interval: 'month' | 'year'
     */
    createProCheckout: protectedProcedure
      .input(z.object({
        interval: z.enum(["month", "year"]),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const info = await getArtistSubscriptionInfo(ctx.user.id);
        const { url, sessionId } = await createArtistProCheckoutSession({
          email: ctx.user.email ?? undefined,
          userId: ctx.user.id,
          origin: input.origin,
          stripeCustomerId: info?.stripeCustomerId ?? null,
          interval: input.interval,
        });
        return { url, sessionId };
      }),

    /**
     * Create a Stripe Customer Portal session so the artist can manage their subscription.
     */
    createPortalSession: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const info = await getArtistSubscriptionInfo(ctx.user.id);
        if (!info?.stripeCustomerId) {
          throw new Error("No Stripe customer found. Please subscribe first.");
        }
        const { url } = await createArtistPortalSession(
          info.stripeCustomerId,
          `${input.origin}/artist-dashboard?tab=settings`
        );
        return { url };
      }),
  }),

  /** Client job detail, applicant review, and unlock flows */
  clientJobs: router({
    /** Get a single job with full details for the client dashboard. */
    getDetail: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) return null;
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const unlocked = await isClientJobUnlocked(user.id, input.jobId);
        const bookings = await getAdminJobBookings(input.jobId);
        return { ...job, unlocked, bookingCount: bookings.length };
      }),
    /** Get applicants for a job. If locked, returns blurred preview only. */
    getApplicants: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const applicants = await getJobApplicantsWithDetails(input.jobId);
        const unlocked = user.role === "admin" || await isClientJobUnlocked(user.id, input.jobId);
        if (!unlocked) {
          return {
            locked: true,
            applicantCount: applicants.length,
            preview: applicants.slice(0, 3).map((a: any) => ({
              id: a.id,
              artistFirstName: a.artistFirstName ? a.artistFirstName[0] + "•••" : "Artist",
              artistName: "Locked",
              artistLocation: a.artistLocation ? a.artistLocation.split(",")[0] + ", •••" : "Location hidden",
              artistProfilePicture: null,
              artswrkPro: a.artswrkPro,
              status: a.status,
            })),
          };
        }
        return { locked: false, applicantCount: applicants.length, applicants };
      }),
    /** Get full detail for a single applicant (drill-down view). */
    getApplicantDetail: protectedProcedure
      .input(z.object({ applicantId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const applicant = await getApplicantDetail(input.applicantId);
        if (!applicant) throw new Error("Applicant not found");
        const job = await getAdminJobById(applicant.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const unlocked = user.role === "admin" || await isClientJobUnlocked(user.id, applicant.jobId);
        if (!unlocked) throw new Error("Job must be unlocked to view applicant details");
        return applicant;
      }),
    /** Get bookings for a job (shown only if bookings exist). */
    getBookings: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        return getAdminJobBookings(input.jobId);
      }),
    /** Start a Stripe checkout to unlock a single job ($30, on-demand). */
    createUnlockCheckout: protectedProcedure
      .input(z.object({ jobId: z.number(), origin: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const alreadyUnlocked = await isClientJobUnlocked(user.id, input.jobId);
        if (alreadyUnlocked) return { alreadyUnlocked: true, url: null };
        const jobTitle = (job.description ?? "").split("\n")[0].slice(0, 60);
        const { url } = await createClientJobUnlockCheckoutSession({
          userId: user.id,
          email: user.email ?? undefined,
          stripeCustomerId: user.clientStripeCustomerId ?? undefined,
          origin: input.origin,
          jobId: input.jobId,
          jobTitle,
        });
        return { alreadyUnlocked: false, url };
      }),
    /** Start a Stripe checkout for a client monthly subscription ($50/mo). */
    createSubscriptionCheckout: protectedProcedure
      .input(z.object({ jobId: z.number().optional(), origin: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { url } = await createClientSubscriptionCheckoutSession({
          userId: user.id,
          email: user.email ?? undefined,
          stripeCustomerId: user.clientStripeCustomerId ?? undefined,
          origin: input.origin,
          jobId: input.jobId,
        });
        return { url };
      }),
    /** Verify a job unlock after Stripe redirect and record it in the DB. */
    verifyUnlock: protectedProcedure
      .input(z.object({ sessionId: z.string(), jobId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(input.sessionId);
        if (session.payment_status !== "paid" && session.status !== "complete") {
          throw new Error("Payment not completed");
        }
        await createClientJobUnlock({
          clientUserId: user.id,
          jobId: input.jobId,
          stripeSessionId: input.sessionId,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          amountCents: session.amount_total ?? 3000,
        });
        return { success: true };
      }),
    /** Send a message to an applicant (creates/finds conversation and sends message). */
    messageApplicant: protectedProcedure
      .input(z.object({ applicantId: z.number(), message: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const applicant = await getApplicantDetail(input.applicantId);
        if (!applicant) throw new Error("Applicant not found");
        const job = await getAdminJobById(applicant.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const unlocked = user.role === "admin" || await isClientJobUnlocked(user.id, applicant.jobId);
        if (!unlocked) throw new Error("Job must be unlocked to message applicants");
        const conversation = await getOrCreateConversation(user.id, applicant.artistId);
        const msg = await sendMessageToConversation({ conversationId: conversation.id, senderUserId: user.id, content: input.message });
        if ((user as any).enterprise && applicant.artistEmail) {
          try {
            await sendSimpleEmail({
              to: applicant.artistEmail,
              subject: `New message from ${(user as any).clientCompanyName ?? user.name ?? "Artswrk Client"}`,
              html: `<p>Hi ${applicant.artistFirstName ?? "there"},</p><p>${(user as any).clientCompanyName ?? user.name ?? "A client"} has sent you a message on Artswrk:</p><blockquote style="border-left:3px solid #F25722;padding-left:12px;color:#555">${input.message}</blockquote><p><a href="https://artswrk.com/app/messages">Log in to reply</a></p><p>Best,<br/>The Artswrk Team</p>`,
            });
          } catch (e) {
            console.error("[messageApplicant] Email send failed (non-fatal):", e);
          }
        }
        return { success: true, conversationId: conversation.id, messageId: msg.id };
      }),
  }),
  /** Benefits / Partner perks — filtered by audience type */
  benefits: router({
    list: protectedProcedure
      .input(z.object({ audienceType: z.enum(["Artist", "Client"]) }))
      .query(async ({ input }) => {
        const rows = await getBenefits(input.audienceType);
        return {
          benefits: rows.map((b) => ({
            id: b.id,
            companyName: b.companyName ?? "",
            logoUrl: b.logoUrl ?? null,
            url: b.url ?? null,
            businessDescription: b.businessDescription ?? null,
            discountOffering: b.discountOffering ?? null,
            howToRedeem: b.howToRedeem ?? null,
            categories: (() => { try { return JSON.parse(b.categories ?? "[]") as string[]; } catch { return [] as string[]; } })(),
            audienceTypes: (() => { try { return JSON.parse(b.audienceTypes ?? "[]") as string[]; } catch { return [] as string[]; } })(),
          })),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
