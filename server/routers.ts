import bcrypt from "bcryptjs";
import { APP_URL } from "./emailTemplates";
import { COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME, IMPERSONATION_MARKER_COOKIE, ONE_YEAR_MS } from "@shared/const";
import { isJobPubliclyLive } from "@shared/jobStatus";
import { resolveBookingBaseAmount, isHourlyBooking } from "@shared/bookingRates";
import { getPasswordError, PASSWORD_MAX_LENGTH } from "@shared/password";

/**
 * Shared by every flow where a user SETS a password (signup, reset, first
 * login, studio onboard, admin-created accounts). Login itself deliberately
 * keeps a bare min(1) — an existing password predating this policy must still
 * be able to sign in, and rejecting it at the login form would lock people out
 * rather than prompt them to change it.
 */
const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH)
  .superRefine((value, ctx) => {
    const error = getPasswordError(value);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { acquisitionRouter } from "./acquisitionRouter";
import { artistProfileRouter } from "./artistProfileRouter";
import { bubbleRouter } from "./bubbleRouter";
import { getAllUsers, getUserByBubbleId, getUserByEmail, setUserPassword, getUserById, getUserByOpenId, createPasswordResetToken, getPasswordResetToken, deletePasswordResetToken, getArtistResumes, deleteArtistResume, applyToJob, getJobsByUserId, getJobStatsByUserId, getPublicJobs, getPublicJobsEnriched, getJobDetailById, getArtistJobApplications, getInterestedArtistsByClientId, getApplicantStatsByClientId, getApplicantsByJobId, getBookingsByClientId, getBookingStatsByClientId, getBookingsByJobId, getBookingById, getBookingByInterestedArtistId, getPaymentsByClientId, getPaymentStatsByClientId, getWalletStatsByClientId, getPendingPaymentsByClientId, getConversationsByClientId, getConversationsByArtistId, getMessagesByConversationId, getMessageStatsByClientId, getMessageStatsByArtistId, markConversationAsRead, getArtistById, getArtistHistoryForClient, createJob, activateJob, saveClientStripeCustomerId, saveClientSubscriptionId, createNewUser, updateUserOnboarding, activateBoost, getJobById, getArtistsList, getAdminOverviewStats, getAdminArtists, getAdminClients, getAdminJobs, getAdminBookings, getAdminPayments, getPremiumJobsByUserId, getPremiumJobById, getAllPremiumJobs, getPremiumJobInterestedArtists, getPremiumInterestedArtistsByCreatorId, getEnterpriseClients, getClientCompaniesByUserId, createClientCompany, createPremiumJob, getArtistJobsFeed, getArtistProJobsFeed, getArtistProApplications, getArtistBookings, getArtistPayments, getArtistSubscriptionInfo, saveArtistStripeCustomerId, saveArtistProSubscription, cancelArtistProSubscription, saveArtistBasicSubscription, setEnterprisePlan, getEnterpriseBillingInfo, saveEnterpriseStripeCustomerId, saveEnterpriseSubscription, cancelEnterpriseSubscription, recordEnterpriseJobUnlock, getUnlockedJobIds, isJobUnlocked, getBenefits, getOrCreateConversation, sendMessageToConversation, isClientJobUnlocked, canClientMessageArtist, canArtistMessageClient, createClientJobUnlock, getJobApplicantsWithDetails, getApplicantDetail, getAdminJobById, getAdminJobBookings, getMyAffiliations, createBookingFromApplicant, getConfirmedBookingsForJob, getArtistConfirmedBookings, confirmDirectPayment, setBookingPaymentMethod, markArtswrkInvoiceSubmitted, getReimbursementsByBookingId, createReimbursement, getBookingByApplicantId, getBookingByInvoiceToken, approveArtswrkInvoice, approveBookingPeriodInvoice, markInvoicePaid, getArtistWalletData, getArtistStripeConnectAccount, createAdminBooking, listAdminBookings, getAdminBookingDetail, getBookingPeriodById, submitBookingPeriod, markPeriodInvoicePaid, getBookingPeriodByInvoiceToken, getArtistAdminBookings, getClientAdminBookings, getDuePeriods, markPeriodNotified, getReimbursementsByPeriodId, getSavedArtistsByClientId, toggleSavedArtist, getAllAffiliations, getAllMasterServiceTypes, getArtistTypeCounts, getArtistAffiliations, getFeaturedArtists, upsertClientCompany, getPublicCompanyPage, updateClientCompanyById, getClientCompaniesList, resolveMasterArtistTypeNames, resolveMasterServiceTypeNames, resolveMasterArtistTypeIds, resolveMasterServiceTypeIds, resolveMasterStyleTypeIds, resolveMasterStyleTypeNames, getAllMasterArtistTypes, getAllMasterStyleTypes, resolveJobServiceType, normalizeSocialLink } from "./db";
import { invokeLLM } from "./_core/llm";
import { sendPasswordResetEmail, sendApplicationConfirmationEmail, sendNewApplicantAlertEmail, sendSimpleEmail, sendArtistWelcomeEmail, sendProJobPostedEmail, sendJobPostedEmail, sendNewMessageEmail, sendProJobApplicantAlertEmail, sendProJobSubmissionConfirmationEmail, sendArtistBookingConfirmedEmail, sendClientBookingConfirmedEmail, sendClientPayArtistEmail, sendInquiryIntroEmail } from "./email";
import crypto from "crypto";
import { createJobPostCheckoutSession, createSubscriptionCheckoutSession, createBoostCheckoutSession, getStripe, createArtistProCheckoutSession, createArtistBasicCheckoutSession, createArtistPortalSession, createEnterpriseJobUnlockCheckoutSession, createEnterpriseSubscriptionCheckoutSession, createClientJobUnlockCheckoutSession, createClientSubscriptionCheckoutSession } from "./stripe";
import { calcBoostTotal } from "./stripe-products";
import { storagePut } from "./storage";
import { artistResumes } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { z } from "zod";
import { leadsRouter } from "./routers/leads";
import { buildLocationColumns, buildLocationColumnsNoCountry, resolveJobLocation, resolvePremiumJobLocation, locationInputSchema } from "./location";
import { applyCheckoutSessionCompleted } from "./checkoutEffects";

const SALT_ROUNDS = 12;

/**
 * Business-type classification for CLIENT accounts. Matches
 * BUSINESS_TYPES in client/src/pages/ClientOnboarding.tsx (the public
 * signup picker) and CLIENT_BUSINESS_TYPES in client/src/pages/Admin.tsx —
 * keep all three in sync if this list ever changes. Not enforced as a hard
 * DB-level enum (stays varchar) so the Bubble sync can't be broken by a
 * value outside this list — enforced here at the write layer instead.
 */
const CLIENT_HIRING_CATEGORIES = ["Dance Studio", "Dance Competition", "Music School", "Event Company", "Other"] as const;
const clientHiringCategorySchema = z.enum(CLIENT_HIRING_CATEGORIES).optional();

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
          // APP_URL, never input.origin: the recipient is not the person whose
          // browser made this request, so their origin is meaningless — which is
          // how a real reset email went out carrying localhost:3000 on 8/25 and
          // a manus.space staging host in April.
          const resetUrl = `${APP_URL}/reset-password?token=${token}`;
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
        password: passwordSchema,
      }))
      .mutation(async ({ input }) => {
        const record = await getPasswordResetToken(input.token);
        if (!record) throw new Error("Invalid or expired reset link.");
        if (record.expiresAt < new Date()) {
          await deletePasswordResetToken(input.token);
          throw new Error("This reset link has expired. Please request a new one.");
        }
        // Was this the account's first real password (e.g. admin-created, never
        // logged in)? If so, this is a "claim" rather than a forgot-password reset.
        const userBefore = await getUserById(record.userId);
        const isFirstClaim = !!userBefore?.passwordIsTemporary;

        const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
        await setUserPassword(record.userId, hash, false);
        await deletePasswordResetToken(input.token);

        if (isFirstClaim && userBefore?.email) {
          (async () => {
            try {
              const { upsertContact } = await import("./brevo");
              await upsertContact(userBefore.email!, {
                FIRSTNAME: userBefore.firstName ?? "",
                LASTNAME: userBefore.lastName ?? "",
                USERROLE: userBefore.userRole ?? "",
              });
            } catch (err) {
              console.error("[resetPassword] Brevo sync failed (non-fatal):", err instanceof Error ? err.message : err);
            }
          })();
        }

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
        password: passwordSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user) throw new Error("No account found.");
        if (user.passwordHash) throw new Error("This account already has a password. Please log in normally.");

        const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
        await setUserPassword(user.id, hash, false);

        // Internal signal, not user-facing — never block their login on it.
        try {
          const { sendFirstLoginAlertEmail } = await import("./email");
          await sendFirstLoginAlertEmail({
            name: user.name || user.firstName || "Someone",
            email: user.email ?? input.email,
            userRole: user.userRole,
            userId: user.id,
          });
        } catch (notifyErr) {
          console.error("[setInitialPassword] Internal alert email failed (non-fatal):", notifyErr);
        }

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
        password: passwordSchema,
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
        serviceType: z.string().optional(),
        state: z.string().optional(),
        plan: z.string().optional(),
        affiliationId: z.number().optional(),
        onboardingStep: z.number().optional(),
        missingProfilePicture: z.boolean().optional(),
        stripeConnected: z.boolean().optional(),
        createdFrom: z.coerce.date().optional(),
        createdTo: z.coerce.date().optional(),
        modifiedFrom: z.coerce.date().optional(),
        modifiedTo: z.coerce.date().optional(),
        sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        return getAdminArtists(input);
      }),

    /** Just the ids matching the current Artists filters — powers "select all N matching". */
    artistIds: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        locationSearch: z.string().optional(),
        artistType: z.string().optional(),
        serviceType: z.string().optional(),
        state: z.string().optional(),
        plan: z.string().optional(),
        affiliationId: z.number().optional(),
        onboardingStep: z.number().optional(),
        missingProfilePicture: z.boolean().optional(),
        stripeConnected: z.boolean().optional(),
        createdFrom: z.coerce.date().optional(),
        createdTo: z.coerce.date().optional(),
        modifiedFrom: z.coerce.date().optional(),
        modifiedTo: z.coerce.date().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getAdminArtistIds } = await import("./db");
        return getAdminArtistIds(input);
      }),

    /** Get a single artist (full user row) by ID — admin only */
    getArtist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const user = await getUserById(input.id);
        if (!user) return user;
        // masterArtistTypes/masterServiceType/masterStyles store Bubble-matching
        // ids — resolve to names here so the admin picker can show current
        // selections (and so re-saving them doesn't write names back into an
        // id-keyed column).
        const [masterArtistTypeNames, masterServiceTypeNames, masterStyleNames] = await Promise.all([
          resolveMasterArtistTypeNames(user.masterArtistTypes ? JSON.parse(user.masterArtistTypes as string) : []),
          resolveMasterServiceTypeNames(user.masterServiceType ? JSON.parse(user.masterServiceType as string) : []),
          resolveMasterStyleTypeNames(user.masterStyles ? JSON.parse(user.masterStyles as string) : []),
        ]);
        return { ...user, masterArtistTypeNames, masterServiceTypeNames, masterStyleNames };
      }),

    /** Update artist fields — admin only */
    updateArtist: protectedProcedure
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        pronouns: z.string().optional(),
        phoneNumber: z.string().optional(),
        location: z.string().optional(),
        bio: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        portfolio: z.string().optional(),
        profilePicture: z.string().optional(),
        // Display-name arrays from the admin picker — resolved to ids below,
        // matching how the live artist-facing save path stores them.
        masterArtistTypes: z.array(z.string()).optional(),
        masterServiceType: z.array(z.string()).optional(),
        masterStyles: z.array(z.string()).optional(),
        artistDisciplines: z.array(z.string()).optional(),
        tagline: z.string().optional(),
        credits: z.string().optional(),
        artswrkPro: z.boolean().optional(),
        artswrkBasic: z.boolean().optional(),
        priorityList: z.boolean().optional(),
        slug: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, masterArtistTypes, masterServiceType, masterStyles, artistDisciplines, website, instagram, tiktok, youtube, portfolio, ...rest } = input;
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const [artistTypeIds, serviceTypeIds, styleIds] = await Promise.all([
          masterArtistTypes !== undefined ? resolveMasterArtistTypeIds(masterArtistTypes) : undefined,
          masterServiceType !== undefined ? resolveMasterServiceTypeIds(masterServiceType) : undefined,
          masterStyles !== undefined ? resolveMasterStyleTypeIds(masterStyles) : undefined,
        ]);
        await db.update(usersTable).set({
          ...rest,
          ...(website !== undefined ? { website: normalizeSocialLink(website, "website") } : {}),
          ...(instagram !== undefined ? { instagram: normalizeSocialLink(instagram, "instagram") } : {}),
          ...(tiktok !== undefined ? { tiktok: normalizeSocialLink(tiktok, "tiktok") } : {}),
          ...(youtube !== undefined ? { youtube: normalizeSocialLink(youtube, "youtube") } : {}),
          ...(portfolio !== undefined ? { portfolio: normalizeSocialLink(portfolio, "portfolio") } : {}),
          ...(artistTypeIds !== undefined ? { masterArtistTypes: JSON.stringify(artistTypeIds) } : {}),
          ...(serviceTypeIds !== undefined ? { masterServiceType: JSON.stringify(serviceTypeIds) } : {}),
          ...(styleIds !== undefined ? { masterStyles: JSON.stringify(styleIds) } : {}),
          ...(artistDisciplines !== undefined ? { artistDisciplines: JSON.stringify(artistDisciplines) } : {}),
        }).where(eq(usersTable.id, id));
        return getUserById(id);
      }),

    /** Create a new artist account — admin only */
    createArtist: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: passwordSchema.optional(),
        pronouns: z.string().optional(),
        phoneNumber: z.string().optional(),
        location: z.string().optional(),
        bio: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        portfolio: z.string().optional(),
        profilePicture: z.string().optional(),
        masterArtistTypes: z.array(z.string()).default([]),
        masterServiceType: z.array(z.string()).default([]),
        masterStyles: z.array(z.string()).default([]),
        tagline: z.string().optional(),
        artswrkPro: z.boolean().default(false),
        artswrkBasic: z.boolean().default(false),
        sendWelcomeEmail: z.boolean().default(true),
        /** Custom email subject/body (from the admin rich-text composer). Falls back
         * to the fixed sendArtistWelcomeEmail template when either is omitted. */
        welcomeEmailSubject: z.string().optional(),
        welcomeEmailHtml: z.string().optional(),
        origin: z.string().url().optional(),
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
        const [artistTypeIds, serviceTypeIds, styleIds] = await Promise.all([
          resolveMasterArtistTypeIds(input.masterArtistTypes),
          resolveMasterServiceTypeIds(input.masterServiceType),
          resolveMasterStyleTypeIds(input.masterStyles),
        ]);

        const values: any = {
          openId,
          email: input.email.toLowerCase().trim(),
          firstName: input.firstName,
          lastName: input.lastName,
          name: `${input.firstName} ${input.lastName}`,
          slug,
          userRole: "Artist" as const,
          pronouns: input.pronouns ?? null,
          phoneNumber: input.phoneNumber ?? null,
          location: input.location ?? null,
          bio: input.bio ?? null,
          website: input.website ? normalizeSocialLink(input.website, "website") : null,
          instagram: input.instagram ? normalizeSocialLink(input.instagram, "instagram") : null,
          tiktok: input.tiktok ? normalizeSocialLink(input.tiktok, "tiktok") : null,
          youtube: input.youtube ? normalizeSocialLink(input.youtube, "youtube") : null,
          portfolio: input.portfolio ? normalizeSocialLink(input.portfolio, "portfolio") : null,
          profilePicture: input.profilePicture ?? null,
          masterArtistTypes: artistTypeIds.length ? JSON.stringify(artistTypeIds) : null,
          masterServiceType: serviceTypeIds.length ? JSON.stringify(serviceTypeIds) : null,
          masterStyles: styleIds.length ? JSON.stringify(styleIds) : null,
          tagline: input.tagline ?? null,
          artswrkPro: input.artswrkPro,
          artswrkBasic: input.artswrkBasic,
          planTier: input.artswrkPro
            ? "artist_pro" as const
            : input.artswrkBasic
              ? "artist_basic" as const
              : "artist_free" as const,
          userSignedUp: true,
          onboardingStep: 4,
          // Every account created from this admin form is, by definition,
          // admin-added — tag it so support/reporting can tell these apart
          // from real self-signups, matching the Bubble-sourced meaning of
          // this field.
          addedByAdmin: true,
          source: "Admin",
        };

        if (input.password) {
          values.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
          values.passwordIsTemporary = false;
        }

        const result = await db.insert(usersTable).values(values);
        const newId = (result as any).insertId as number;

        // Awaited, not fire-and-forget — an un-awaited send here would still
        // usually complete on its own, but it has nothing keeping it alive if
        // the server process restarts (a dev-server bounce, or a Manus
        // redeploy in production) before it finishes. It would vanish with no
        // error, no retry, and no record anywhere — confirmed via SendGrid's
        // own Activity log showing zero send attempt for exactly this case.
        // null = no email was requested; true/false = attempted, and whether it worked.
        let emailSent: boolean | null = null;
        if (input.sendWelcomeEmail) {
          try {
            // Admin-created accounts get no real password (passwordIsTemporary
            // stays true) — always generate a real claim link so "create your
            // password" isn't just decorative copy in a custom email.
            const origin = input.origin ?? APP_URL;
            const token = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await createPasswordResetToken(newId, token, expiresAt);
            const claimUrl = `${origin}/reset-password?token=${token}`;

            if (input.welcomeEmailSubject && input.welcomeEmailHtml) {
              const ctaBlock = `
                <div style="text-align:center;margin-top:28px">
                  <a href="${claimUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFBC5D,#F25722);color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:100px">Create Your Password →</a>
                </div>`;
              emailSent = await sendSimpleEmail({
                to: input.email,
                subject: input.welcomeEmailSubject,
                html: `<div style="font-family:'Helvetica Neue',sans-serif;max-width:580px;margin:0 auto">${input.welcomeEmailHtml}${ctaBlock}</div>`,
              });
            } else {
              emailSent = await sendArtistWelcomeEmail({ to: input.email, firstName: input.firstName });
            }
          } catch (err) {
            console.error("[Admin] Welcome email failed:", err instanceof Error ? err.message : err);
          }
        }

        const created = await getUserById(newId);
        return { ...created, emailSent };
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

    /** Bulk email a set of artists (or any user IDs) with admin-authored rich-text content. */
    bulkEmailUsers: protectedProcedure
      .input(z.object({
        userIds: z.array(z.number()).min(1).max(5000),
        subject: z.string().min(1),
        html: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getUsersByIds } = await import("./db");
        const targets = await getUsersByIds(input.userIds);
        const wrappedHtml = `<div style="font-family:'Helvetica Neue',sans-serif;max-width:580px;margin:0 auto">${input.html}</div>`;

        // Fire-and-forget — sequentially awaiting hundreds/thousands of sends
        // in-request would blow past any reasonable HTTP timeout.
        (async () => {
          for (const t of targets) {
            if (!t.email) continue;
            try {
              await sendSimpleEmail({ to: t.email, subject: input.subject, html: wrappedHtml });
            } catch (err) {
              console.error(`[bulkEmailUsers] Failed to send to ${t.email}:`, err instanceof Error ? err.message : err);
            }
          }
        })();

        const withEmail = targets.filter(t => t.email).length;
        return { queued: withEmail, skipped: targets.length - withEmail, total: targets.length };
      }),

    /** Bulk-set plan flags (Basic/PRO) across a set of artists. */
    bulkSetArtistPlan: protectedProcedure
      .input(z.object({
        artistIds: z.array(z.number()).min(1).max(5000),
        plan: z.enum(["free", "basic", "pro"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { setUserPlanFlags } = await import("./db");
        // planTier is what real access checks gate on — the booleans alone
        // used to leave real access unchanged while the admin UI showed the
        // plan as "updated."
        const flags = input.plan === "pro"
          ? { artswrkPro: true, artswrkBasic: false, planTier: "artist_pro" as const }
          : input.plan === "basic"
          ? { artswrkPro: false, artswrkBasic: true, planTier: "artist_basic" as const }
          : { artswrkPro: false, artswrkBasic: false, planTier: "artist_free" as const };
        for (const id of input.artistIds) await setUserPlanFlags(id, flags);
        return { updated: input.artistIds.length };
      }),

    /** Bulk-add an affiliation tag to a set of artists. */
    bulkAddAffiliation: protectedProcedure
      .input(z.object({
        artistIds: z.array(z.number()).min(1).max(5000),
        affiliationId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { addArtistAffiliation } = await import("./db");
        for (const id of input.artistIds) await addArtistAffiliation(id, input.affiliationId);
        return { updated: input.artistIds.length };
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
        phoneNumber: z.string().optional(),
        clientCompanyName: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        portfolio: z.string().optional(),
        profilePicture: z.string().optional(),
        businessOrIndividual: z.string().optional(),
        hiringCategory: clientHiringCategorySchema,
        /** Real, Bubble-sourced business category — Dance Studio / Dance
         * Competition / Music School / Event Company / Other. Drives
         * Enterprise auto-detection (see updateUserOnboarding in db.ts). */
        businessType: clientHiringCategorySchema,
        clientPremium: z.boolean().optional(),
        enterprise: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, website, instagram, tiktok, youtube, portfolio, enterprise, clientPremium, ...rest } = input;
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.update(usersTable).set({
          ...rest,
          ...(enterprise !== undefined ? { enterprise } : {}),
          ...(clientPremium !== undefined ? { clientPremium } : {}),
          // Keep planTier in sync with the toggles — these were previously
          // cosmetic (the toggle flipped but nothing gated on it read this
          // column), since access checks now key off planTier.
          ...(enterprise !== undefined || clientPremium !== undefined
            ? { planTier: enterprise ? "enterprise_on_demand" as const : clientPremium ? "client_premium" as const : "client_on_demand" as const }
            : {}),
          ...(website !== undefined ? { website: normalizeSocialLink(website, "website") } : {}),
          ...(instagram !== undefined ? { instagram: normalizeSocialLink(instagram, "instagram") } : {}),
          ...(tiktok !== undefined ? { tiktok: normalizeSocialLink(tiktok, "tiktok") } : {}),
          ...(youtube !== undefined ? { youtube: normalizeSocialLink(youtube, "youtube") } : {}),
          ...(portfolio !== undefined ? { portfolio: normalizeSocialLink(portfolio, "portfolio") } : {}),
        }).where(eq(usersTable.id, id));
        return getUserById(id);
      }),

    /** Create a new client account — admin only */
    createClient: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: passwordSchema.optional(),
        phoneNumber: z.string().optional(),
        clientCompanyName: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        portfolio: z.string().optional(),
        profilePicture: z.string().optional(),
        businessOrIndividual: z.string().optional(),
        hiringCategory: clientHiringCategorySchema,
        businessType: clientHiringCategorySchema,
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
          phoneNumber: input.phoneNumber ?? null,
          clientCompanyName: input.clientCompanyName ?? null,
          location: input.location ?? null,
          website: input.website ? normalizeSocialLink(input.website, "website") : null,
          instagram: input.instagram ? normalizeSocialLink(input.instagram, "instagram") : null,
          tiktok: input.tiktok ? normalizeSocialLink(input.tiktok, "tiktok") : null,
          youtube: input.youtube ? normalizeSocialLink(input.youtube, "youtube") : null,
          portfolio: input.portfolio ? normalizeSocialLink(input.portfolio, "portfolio") : null,
          profilePicture: input.profilePicture ?? null,
          businessOrIndividual: input.businessOrIndividual ?? null,
          hiringCategory: input.hiringCategory ?? null,
          businessType: input.businessType ?? null,
          clientPremium: input.clientPremium,
          enterprise: input.enterprise,
          planTier: input.enterprise
            ? "enterprise_on_demand" as const
            : input.clientPremium
              ? "client_premium" as const
              : "client_on_demand" as const,
          userSignedUp: true,
          onboardingStep: 4,
          addedByAdmin: true,
          source: "Admin",
        };
        if (input.password) {
          values.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
          values.passwordIsTemporary = false;
        }
        const result = await db.insert(usersTable).values(values);
        const newId = (result as any).insertId as number;
        return getUserById(newId);
      }),

    /**
     * Create an enterprise account on behalf of an organisation.
     * No password is set — the user must claim their account via /set-password.
     */
    createEnterpriseAccount: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        companyName: z.string().min(1),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        plan: z.enum(["on_demand", "subscriber"]).optional(),
        hiringCategory: clientHiringCategorySchema,
        businessType: clientHiringCategorySchema,
        businessOrIndividual: z.enum(["Business", "Individual"]).optional(),
        logoUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");

        const email = input.email.toLowerCase().trim();
        const existing = await getUserByEmail(email);
        if (existing) throw new Error(`An account with email ${email} already exists.`);

        const openId = `enterprise_${crypto.randomBytes(16).toString("hex")}`;
        const firstName = input.firstName ?? "";
        const lastName = input.lastName ?? "";

        await db.insert(usersTable).values({
          openId,
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          name: [firstName, lastName].filter(Boolean).join(" ") || input.companyName,
          userRole: "Client" as const,
          clientCompanyName: input.companyName,
          enterprise: true,
          enterprisePlan: input.plan ?? null,
          // No real Stripe subscription exists yet at creation time regardless
          // of `plan` — matches the pre-existing rule that enterprisePlan alone
          // (without a real subscription ID) was never enough for full access.
          planTier: "enterprise_on_demand" as const,
          hiringCategory: input.hiringCategory ?? null,
          businessType: input.businessType ?? null,
          businessOrIndividual: input.businessOrIndividual ?? "Business",
          profilePicture: input.logoUrl ?? null,
          enterpriseLogoUrl: input.logoUrl ?? null,
          userSignedUp: true,
          onboardingStep: 4,
          addedByAdmin: true,
          source: "Admin",
        } as any);

        // Look up by email to get the real DB id — more reliable than parsing insertId
        const newUser = await getUserByEmail(email);
        const newId = newUser?.id;
        if (!newId) throw new Error("User was created but could not be found — try again.");

        // Create the client_companies row so the enterprise dashboard has a company immediately
        await createClientCompany({
          ownerUserId: newId,
          name: input.companyName,
          logo: input.logoUrl ?? null,
        });

        const setupUrl = `/login?email=${encodeURIComponent(email)}`;
        return { id: newId, email, setupUrl };
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
        title: z.string().optional(),
        description: z.string().optional(),
        requestStatus: z.string().optional(),
        locationAddress: z.string().optional(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
        hiringCategory: z.string().optional(),
        artistHourlyRate: z.number().nullable().optional(),
        clientHourlyRate: z.number().nullable().optional(),
        openRate: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { id, locationData, ...fields } = input;
        const { updateAdminJob, getAdminJobById } = await import("./db");
        const location = input.locationAddress !== undefined
          ? await resolveJobLocation({ locationAddress: input.locationAddress, locationData })
          : {};
        await updateAdminJob(id, { ...fields, ...location });

        // An admin flipping a job to Active is a third way a job goes live, so
        // the 48-hour check belongs here too. (There is no start-date field on
        // this mutation, so the spec's "edit moves the date into the window"
        // case can't arise yet — add the check here when that field appears.)
        if (input.requestStatus === "Active") {
          import("./jobAlerts/lastMinute")
            .then(({ maybeSendLastMinute }) => maybeSendLastMinute(id))
            .then((r) => { if (r.eligible) console.log(`[last-minute] job ${id}: ${r.sent} sent`); })
            .catch((err) => console.error("[last-minute]", err));
        }
        return getAdminJobById(id);
      }),

    /**
     * Job alert master switch. Deliberately DB-backed rather than an env var:
     * it has to be flippable — especially OFF — without a deploy.
     */
    getJobAlertStatus: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
      const { getDb } = await import("./db");
      const { isEnabledInDb, ALLOWLIST } = await import("./jobAlerts/safety");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const one = async (sql: string) => {
        const r: any = await db.execute(sql);
        const l: any[] = Array.isArray(r) ? (Array.isArray(r[0]) ? r[0] : r) : [];
        return l[0] ?? {};
      };
      const queued = await one(
        `SELECT COUNT(*) n FROM jobs WHERE networkStatus = 'pending' AND requestStatus = 'Active'`);
      const queuedPro = await one(
        `SELECT COUNT(*) n FROM premium_jobs WHERE networkStatus = 'pending' AND status = 'Active'`);
      const sent24 = await one(
        `SELECT COUNT(*) n FROM email_send_log WHERE status='sent' AND sentAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
      const sentAll = await one(`SELECT COUNT(*) n FROM email_send_log WHERE status='sent'`);
      const suppressed = await one(`SELECT COUNT(*) n FROM email_suppressions`);
      const meta = await one(
        `SELECT settingValue, updatedBy, updatedAt FROM app_settings WHERE settingKey='job_alerts_enabled'`);

      return {
        enabled: await isEnabledInDb(),
        // A hard env kill beats the switch; surface it so the UI can't claim
        // "on" while something upstream is silently blocking every send.
        killSwitch: process.env.JOB_ALERTS_KILL === "true",
        allowlist: ALLOWLIST,
        lastChangedBy: meta.updatedBy ?? null,
        lastChangedAt: meta.updatedAt ?? null,
        queuedJobs: Number(queued.n ?? 0),
        queuedProJobs: Number(queuedPro.n ?? 0),
        emailsLast24h: Number(sent24.n ?? 0),
        emailsAllTime: Number(sentAll.n ?? 0),
        suppressedAddresses: Number(suppressed.n ?? 0),
      };
    }),

    /**
     * The jobs actually sitting in the alert queue, not just how many.
     * A count alone can't answer "did MY job go out?" — which is the question
     * anyone asks when a post seems to have gone quiet.
     */
    listJobAlertQueue: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const limit = input?.limit ?? 50;

        const rows: any = await db.execute(`
          SELECT j.id, j.title, j.slug, j.networkStatus, j.networkSentAt,
                 j.createdAt, j.startDate, j.locationAddress, j.requestStatus,
                 COALESCE(cc.name, u.clientCompanyName,
                   NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client
          FROM jobs j
          LEFT JOIN users u ON j.clientUserId = u.id
          LEFT JOIN client_companies cc ON j.clientCompanyId = cc.id
          WHERE j.requestStatus = 'Active'
            AND (j.networkStatus IN ('pending','sent_digest','sent_lastminute','expired')
                 OR j.networkStatus IS NULL)
          ORDER BY
            -- Anything still waiting sits at the top; then most recent first.
            CASE WHEN j.networkStatus = 'pending' OR j.networkStatus IS NULL THEN 0 ELSE 1 END,
            j.createdAt DESC
          LIMIT ${limit}`);
        const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
        return list.map((r) => ({
          id: Number(r.id),
          title: r.title ?? null,
          slug: r.slug ?? null,
          client: r.client ?? null,
          // Null is treated as suppressed everywhere else, but a job that
          // reaches this list with no status genuinely hasn't been queued yet.
          networkStatus: (r.networkStatus ?? "pending") as string,
          networkSentAt: r.networkSentAt ?? null,
          createdAt: r.createdAt ?? null,
          startDate: r.startDate ?? null,
          locationAddress: r.locationAddress ?? null,
        }));
      }),

    /**
     * Renders a job-alert email from REAL rows and returns the HTML, sending
     * nothing. Lets an admin see exactly what would land in an artist's inbox
     * before turning the switch on — the alternative was running a CLI script.
     */
    previewJobAlert: protectedProcedure
      .input(z.object({
        /** "last-minute" needs a jobId; "digest" previews the whole queue. */
        mode: z.enum(["last-minute", "digest"]),
        jobId: z.number().optional(),
        /** The digest looks different to a PRO member (extra PRO section). */
        isProMember: z.boolean().default(false),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const { renderDigest, renderLastMinute, excerpt } = await import("./jobAlerts/templates");
        const { toJobCard, toProCard, formatWhen, formatRate, formatLocation, jobTitle } =
          await import("./jobAlerts/format");
        const APP = APP_URL;

        const rowsOf = (r: any): any[] =>
          Array.isArray(r) ? (Array.isArray(r[0]) ? r[0] : r) : [];

        const JOB_COLS = `
          j.id, j.title, j.description, j.startDate, j.endDate, j.dateType,
          j.locationAddress, j.locationCity, j.locationState,
          j.isHourly, j.openRate, j.clientHourlyRate, j.clientFlatRate, j.hours,
          j.transportation, j.transportationDetails, m.name AS svc,
          COALESCE(cc.name, u.clientCompanyName,
            NULLIF(TRIM(CONCAT(COALESCE(u.firstName,''),' ',COALESCE(u.lastName,''))),'')) AS client`;
        const JOB_JOINS = `
          FROM jobs j
          LEFT JOIN users u ON j.clientUserId = u.id
          LEFT JOIN client_companies cc ON j.clientCompanyId = cc.id
          LEFT JOIN master_service_types m ON m.bubbleId = j.masterServiceTypeId`;

        const preferencesUrl = `${APP}/app/settings`;
        const unsubscribeUrl = `${APP}/unsubscribe?token=PREVIEW`;
        const firstName = "there";

        if (input.mode === "last-minute") {
          if (!input.jobId) throw new Error("jobId is required for a last-minute preview");
          const j = rowsOf(await db.execute(
            `SELECT ${JOB_COLS} ${JOB_JOINS} WHERE j.id = ${input.jobId} LIMIT 1`))[0];
          if (!j) throw new Error("Job not found");
          const r = renderLastMinute({
            firstName,
            serviceName: j.svc || jobTitle(j),
            title: jobTitle(j),
            client: j.client || null,
            whenLabel: formatWhen(
              j.startDate ? new Date(j.startDate) : null,
              j.endDate ? new Date(j.endDate) : null,
              j.dateType,
            ) || "Starting soon",
            location: formatLocation(j.locationAddress, j.locationCity, j.locationState),
            transportationNote: j.transportation ? (j.transportationDetails || "Travel reimbursed") : null,
            rateLabel: formatRate(j),
            excerpt: excerpt(j.description),
            applyUrl: `${APP}/app/jobs/${j.id}`,
            preferencesUrl,
            unsubscribeUrl,
          });
          return { subject: r.subject, html: r.html, jobCount: 1 };
        }

        // Digest: exactly the jobs a run would pick up right now.
        const queued = rowsOf(await db.execute(`
          SELECT ${JOB_COLS} ${JOB_JOINS}
          WHERE j.networkStatus = 'pending' AND j.requestStatus = 'Active'
          ORDER BY j.createdAt DESC LIMIT 10`));
        const proRows = rowsOf(await db.execute(`
          SELECT id, serviceType, company, location, budget, workFromAnywhere, description
          FROM premium_jobs WHERE status='Active' AND serviceType IS NOT NULL
          ORDER BY id DESC LIMIT 5`));

        const r = renderDigest({
          firstName,
          jobs: queued.map((row) => toJobCard(row, APP)),
          totalMatchCount: queued.length,
          proJobs: input.isProMember ? proRows.map((row) => toProCard(row, APP)) : [],
          jobsUrl: `${APP}/jobs`,
          preferencesUrl,
          unsubscribeUrl,
          isProMember: input.isProMember,
        });
        return { subject: r.subject, html: r.html, jobCount: queued.length };
      }),

    setJobAlertEnabled: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const who = String(ctx.user.email ?? ctx.user.openId ?? "admin").replace(/'/g, "''").slice(0, 128);
        await db.execute(`
          INSERT INTO app_settings (settingKey, settingValue, updatedBy)
          VALUES ('job_alerts_enabled', '${input.enabled ? "true" : "false"}', '${who}')
          ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue),
                                  updatedBy = VALUES(updatedBy), updatedAt = NOW()`);
        console.warn(`[job-alerts] master switch turned ${input.enabled ? "ON" : "OFF"} by ${who}`);
        return { enabled: input.enabled };
      }),

    /** Every account with admin access. */
    listAdmins: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows: any = await db.execute(
        `SELECT id, email, firstName, lastName, name, userRole, lastSignedIn
         FROM users WHERE role = 'admin' ORDER BY id`
      );
      const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
      return list.map((r) => ({
        id: r.id,
        email: r.email ?? null,
        name: (r.firstName ? `${r.firstName} ${r.lastName ?? ""}` : r.name || "").trim() || null,
        userRole: r.userRole ?? null,
        lastSignedIn: r.lastSignedIn ?? null,
        /** The owner account can't be demoted here — ENV.ownerOpenId grants
         *  access independently of this column, so revoking it would be a
         *  no-op that looks like it worked. */
        isOwner: r.id === ctx.user.id,
      }));
    }),

    /** Find an account by email, to grant admin to. */
    findUserByEmail: protectedProcedure
      .input(z.object({ email: z.string().min(3) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const esc = input.email.trim().toLowerCase().replace(/'/g, "''");
        const rows: any = await db.execute(
          `SELECT id, email, firstName, lastName, name, role, userRole, lastSignedIn
           FROM users WHERE LOWER(email) LIKE '%${esc}%' ORDER BY (LOWER(email) = '${esc}') DESC, id LIMIT 8`
        );
        const list: any[] = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
        return list.map((r) => ({
          id: r.id, email: r.email ?? null,
          name: (r.firstName ? `${r.firstName} ${r.lastName ?? ""}` : r.name || "").trim() || null,
          role: r.role, userRole: r.userRole ?? null, lastSignedIn: r.lastSignedIn ?? null,
        }));
      }),

    /**
     * Grant or revoke admin. Targeted by user id, never by email — three
     * separate accounts share the name "Nick Silverio", and two accounts can
     * share an email in this data.
     */
    setUserAdmin: protectedProcedure
      .input(z.object({ userId: z.number(), admin: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        if (input.userId === ctx.user.id && !input.admin) {
          throw new Error("You can't remove your own admin access.");
        }
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        await db.execute(
          `UPDATE users SET role = '${input.admin ? "admin" : "user"}' WHERE id = ${Number(input.userId)}`
        );
        console.warn(
          `[admin] user ${input.userId} ${input.admin ? "GRANTED" : "REVOKED"} admin by ${ctx.user.email ?? ctx.user.openId}`
        );
        return { success: true };
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
        /** Structured Google Places data for `location`. */
        locationData: locationInputSchema,
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
        const { id, locationData, ...fields } = input;
        const { updateAdminProJob, getPremiumJobById } = await import("./db");
        const location = input.location !== undefined
          ? await resolvePremiumJobLocation({ location: input.location, locationData })
          : {};
        await updateAdminProJob(id, { ...fields, ...location });
        return getPremiumJobById(id);
      }),

    /** All clients with search + filters */
    clients: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        companySearch: z.string().optional(),
        locationSearch: z.string().optional(),
        hiringCategory: clientHiringCategorySchema,
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
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_BASIC.legacyMonthly.priceId, status: "all", limit: 100, expand: ["data.customer"] }),
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_BASIC.annual.priceId,  status: "all", limit: 100, expand: ["data.customer"] }),
        stripe.subscriptions.list({ price: STRIPE_PRODUCTS.ARTIST_PRO.legacyMonthly.priceId,   status: "all", limit: 100, expand: ["data.customer"] }),
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
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          createdAt: sub.created ? new Date(sub.created * 1000).toISOString() : null,
        };
      });

      // Sort: active first, then at_risk, then trialing, then canceled; within each by createdAt desc
      const ORDER = { active: 0, trialing: 1, at_risk: 2, past_due: 3, canceled: 4 };
      subscriptions.sort((a, b) =>
        (ORDER[a.status] - ORDER[b.status]) || ((b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1)
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
        interval: z.enum(["month", "year"]).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        await setEnterprisePlan(input.userId, input.plan, input.interval ?? undefined);
        return { success: true };
      }),

    /** Admin: manually unlock a premium job for an enterprise client (no Stripe charge) */
    adminUnlockEnterpriseJob: protectedProcedure
      .input(z.object({
        clientUserId: z.number(),
        jobId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        // Check if already unlocked
        const alreadyUnlocked = await isJobUnlocked(input.clientUserId, input.jobId);
        if (alreadyUnlocked) return { success: true, alreadyUnlocked: true };
        await recordEnterpriseJobUnlock({
          clientUserId: input.clientUserId,
          jobId: input.jobId,
          stripeSessionId: `admin_unlock_${Date.now()}`,
          stripePaymentIntentId: null,
          amountCents: 0,
        });
        return { success: true, alreadyUnlocked: false };
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
     * Admin-only: directly override a user's plan-level flags (Basic/PRO for
     * artists, Premium/Enterprise for clients) — no Stripe involved. Lets an
     * admin test permission gating for any tier without a real subscription.
     */
    setUserPlan: protectedProcedure
      .input(z.object({
        userId: z.number(),
        plan: z.enum(["free", "basic", "pro", "premium", "enterprise"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        const target = await getUserById(input.userId);
        if (!target) throw new Error("User not found");
        const { setUserPlanFlags } = await import("./db");
        const targetIsArtist = (target as any).planTier
          ? (target as any).planTier.startsWith("artist_")
          : target.userRole === "Artist";
        if (targetIsArtist) {
          await setUserPlanFlags(input.userId, {
            artswrkBasic: input.plan === "basic",
            artswrkPro: input.plan === "pro",
            planTier: input.plan === "pro" ? "artist_pro" : input.plan === "basic" ? "artist_basic" : "artist_free",
          });
        } else {
          const isEnterprise = input.plan === "enterprise";
          await setUserPlanFlags(input.userId, {
            clientPremium: input.plan === "premium",
            enterprise: isEnterprise,
            planTier: isEnterprise ? "enterprise_on_demand" : input.plan === "premium" ? "client_premium" : "client_on_demand",
          });
        }
        return { success: true };
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
     * Supports filtering by artistType, serviceType, and location.
     */
    publicListEnriched: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
        artistType: z.string().optional(),
        serviceType: z.string().optional(),
        locationQuery: z.string().optional(),
        locationLat: z.number().optional(),
        locationLng: z.number().optional(),
        radiusMiles: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getPublicJobsEnriched(input.limit, input.offset, {
          artistType: input.artistType,
          serviceType: input.serviceType,
          locationQuery: input.locationQuery,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          radiusMiles: input.radiusMiles,
        });
      }),

    /**
     * Returns the master artist types and service types for the filter dropdowns.
     * Served from static reference data (master tables are empty in DB).
     */
    getFilterOptions: publicProcedure
      .query(async () => {
        const { MASTER_ARTIST_TYPES, MASTER_SERVICE_TYPES } = await import('../drizzle/seeds/reference_data');
        const publicArtistTypes = MASTER_ARTIST_TYPES.filter((t: any) => t.isPublic !== false);
        const publicServiceTypes = MASTER_SERVICE_TYPES.filter((t: any) => t.isPublic !== false);
        return {
          artistTypes: publicArtistTypes.map((t: any) => ({ name: t.name, bubbleId: t.bubbleId })),
          serviceTypes: publicServiceTypes.map((t: any) => ({
            name: t.name,
            bubbleId: t.bubbleId,
            artistTypeBubbleId: t.bubbleArtistTypeId ?? null,
          })),
        };
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
        // Archived/paused/completed jobs stay reachable by direct URL otherwise,
        // which also renders the apply form. Clients read their own jobs through
        // the separate protected clientJobs.getDetail, so this only hides them
        // from the public board.
        if (!isJobPubliclyLive(job.requestStatus)) return null;
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
        if (!["artist_basic", "artist_pro"].includes((user as any).planTier)) {
          throw new Error("Upgrade to Artswrk Basic or PRO to apply to jobs.");
        }
        const targetJob = await getJobDetailById(input.jobId);
        if (!targetJob || !isJobPubliclyLive(targetJob.requestStatus)) {
          throw new Error("This job is no longer accepting applications.");
        }
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
            // job.title first. This used to read only the description's first
            // line, which predates jobs having a title at all — so a job titled
            // "Ballet Substitute Teacher" went out as "I'm hiring a ballet
            // teacher for a sub on Monday!". Title is required at posting now;
            // the description fallback is only for migrated Bubble rows.
            const jobTitle = (job.title ?? "").trim()
              || (job.description ? job.description.split("\n")[0].slice(0, 80) : "")
              || "Open Position";
            const jobLocation = job.locationAddress ?? "Location TBD";
            const jobRate = job.openRate
              ? "Open rate"
              : job.isHourly
              ? `$${job.clientHourlyRate ?? job.artistHourlyRate ?? 0}/hr`
              : `$${job.clientHourlyRate ?? job.artistHourlyRate ?? 0} flat`;
            const origin = APP_URL;  // never the request Origin header — see APP_URL
            const citySlug = (job.locationAddress ?? "remote").split(",")[0].trim().toLowerCase().replace(/\s+/g, "-");
            const titleSlug = jobTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
            const jobUrl = `${origin}/jobs/${citySlug}/${titleSlug}-${job.id}`;
            const clientDashboardUrl = `${origin}/app/jobs/${job.id}`;

            const emailTasks: Promise<boolean>[] = [
              user.email
                ? sendApplicationConfirmationEmail({
                    to: user.email,
                    artistName: user.firstName ?? user.name ?? "Artist",
                    jobTitle,
                    jobLocation,
                    jobRate,
                    jobUrl,
                    jobDescription: job.description ?? undefined,
                    // What the artist actually pitched, so the email is a
                    // record of their application and not just a receipt.
                    pitchedRate:
                      input.artistHourlyRate != null
                        ? `$${input.artistHourlyRate}/hr`
                        : input.artistFlatRate != null
                        ? `$${input.artistFlatRate} flat`
                        : undefined,
                    artistMessage: input.message || undefined,
                  })
                : Promise.resolve(false),
            ];

            const clientUser = job.clientUserId ? await getUserById(job.clientUserId) : null;
            if (clientUser?.email) {
              emailTasks.push(
                sendNewApplicantAlertEmail({
                  to: clientUser.email,
                  artistFirstName: user.firstName || user.name?.split(" ")[0] || "An artist",
                  artistLastInitial: user.lastName ? user.lastName[0] : (user.name?.split(" ").slice(-1)[0]?.[0] ?? undefined),
                  jobTitle,
                  jobLocation,
                  jobRate,
                  jobUrl: clientDashboardUrl,
                  message: input.message,
                })
              );
            }

            await Promise.allSettled(emailTasks);
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

    /** Whether the logged-in artist has already applied to a specific regular job, with what they submitted. */
    checkApplication: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getDb } = await import('./db');
        const dbConn = await getDb();
        if (!dbConn) return { applied: false, message: null, resumeLink: null, rate: null };
        const { interestedArtists } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const existing = await dbConn.select({
          id: interestedArtists.id,
          message: interestedArtists.message,
          resumeLink: interestedArtists.resumeLink,
          isHourlyRate: interestedArtists.isHourlyRate,
          artistHourlyRate: interestedArtists.artistHourlyRate,
          artistFlatRate: interestedArtists.artistFlatRate,
        })
          .from(interestedArtists)
          .where(and(
            eq(interestedArtists.artistUserId, ctx.user.id),
            eq(interestedArtists.jobId, input.jobId)
          ))
          .limit(1);
        if (existing.length === 0) return { applied: false, message: null, resumeLink: null, rate: null };
        const rec = existing[0];
        const rateValue = rec.isHourlyRate ? rec.artistHourlyRate : rec.artistFlatRate;
        const rate = rateValue ? `$${rateValue}${rec.isHourlyRate ? "/hr" : " flat"}` : null;
        return { applied: true, message: rec.message ?? null, resumeLink: rec.resumeLink ?? null, rate };
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
     * Full booking detail for the client-facing booking detail page —
     * booking + artist profile summary + the job it came from.
     */
    clientDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { getClientBookingDetail } = await import("./db");
        const booking = await getClientBookingDetail(input.id, user.id);
        if (!booking) throw new Error("Booking not found");
        return booking;
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
        if (!user) return { totalSpent: 0, futurePayments: 0, futureCount: 0, pendingCount: 0, totalPaidAmount: 0 };
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
        if (((user as any).planTier ?? "").startsWith("artist_")) {
          return getConversationsByArtistId(user.id, input.limit, input.offset);
        }
        return getConversationsByClientId(user.id, input.limit, input.offset);
      }),

    /**
     * Get all messages for a specific conversation.
     * Only a participant (the client or the artist on this conversation) may
     * read it — previously unchecked, so any logged-in user could read any
     * conversation by guessing/iterating conversationId.
     */
    byConversation: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { getDb } = await import("./db");
        const { conversations } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
        if (!conv) throw new Error("Conversation not found");
        if (conv.clientUserId !== user.id && conv.artistUserId !== user.id) throw new Error("Forbidden: not a participant in this conversation");
        return getMessagesByConversationId(input.conversationId, input.limit, input.offset);
      }),

    /**
     * Get message stats (total conversations, total messages, unread count) for the logged-in user.
     * Role-aware: artists query by artistUserId, clients by clientUserId.
     */
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { totalConversations: 0, totalMessages: 0, unreadMessages: 0 };
        if (((user as any).planTier ?? "").startsWith("artist_")) return getMessageStatsByArtistId(user.id);
        return getMessageStatsByClientId(user.id);
      }),

    /**
     * Mark a conversation as read (clears unreadCount).
     * Silently ignored if the user is not a participant.
     */
    markAsRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return;
        await markConversationAsRead(input.conversationId, user.id);
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

        // Only a participant may send into this conversation — previously
        // unchecked, so any logged-in user could inject a message (and
        // trigger a real notification email) into any conversation.
        const { getDb } = await import("./db");
        const { conversations } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const [convCheck] = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
        if (!convCheck) throw new Error("Conversation not found");
        if (convCheck.clientUserId !== sender.id && convCheck.artistUserId !== sender.id) throw new Error("Forbidden: not a participant in this conversation");

        const msg = await sendMessageToConversation({
          conversationId: input.conversationId,
          senderUserId: sender.id,
          content: input.content,
        });

        // Determine recipient from conversation (reuse convCheck from the
        // participant check above — same row, no need to re-query)
        {
          const conv = convCheck;
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
        const isClient = !((sender as any).planTier ?? "").startsWith("artist_");
        const clientUserId = isClient ? sender.id : input.artistUserId;
        const artistUserId = isClient ? input.artistUserId : sender.id;

        if (isClient) {
          const allowed = await canClientMessageArtist(clientUserId, artistUserId);
          if (!allowed) {
            throw new Error("Upgrade to Premium to message artists.");
          }
        } else {
          const allowed = await canArtistMessageClient(artistUserId, clientUserId);
          if (!allowed) {
            throw new Error("Apply to one of this client's jobs (or upgrade to PRO) to message them.");
          }
        }

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
     * Full profile (bio, socials, contact-adjacent fields) is only for the
     * artist themselves, an admin, or a subscribed client (client_premium /
     * enterprise_subscription) — everyone else (logged out, on-demand
     * client/enterprise, another artist) gets a locked preview: name, photo,
     * location only, with an upgrade prompt to unlock the rest.
     */
    getById: publicProcedure
      .input(z.object({ artistId: z.number() }))
      .query(async ({ input, ctx }) => {
        const artist = await getArtistById(input.artistId);
        if (!artist) return null;

        const viewerId = ctx.user?.id;
        let hasFullAccess = false;
        if (viewerId) {
          if (viewerId === input.artistId) hasFullAccess = true;
          else {
            const viewer = await getUserById(viewerId);
            const v = viewer as any;
            hasFullAccess = viewer?.role === "admin"
              || v?.planTier === "client_premium"
              || v?.planTier === "enterprise_subscription";
          }
        }

        if (hasFullAccess) return { ...artist, locked: false as const };

        const { bio, pronouns, artistDisciplines, artistServices, masterArtistTypes, masterStyles,
          artistExperiences, portfolio, website, instagram, tiktok, youtube, videos, credits,
          ...preview } = artist as any;
        return { ...preview, locked: true as const };
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
     * Whether the logged-in client may message this artist — so the profile can
     * show a locked state up front instead of letting them write a message and
     * only then hit the same rule as an error. Mirrors canClientMessageArtist
     * exactly; that remains the enforcement point.
     */
    canMessage: protectedProcedure
      .input(z.object({ artistId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) return { allowed: false };
        // Artists reach this page too; the client-side rule doesn't apply to them.
        if (((user as any).planTier ?? "").startsWith("artist_")) return { allowed: true };
        return { allowed: await canClientMessageArtist(user.id, input.artistId) };
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
        affiliationId: z.number().optional(),
        /** Location text from the Places field — city-matched. */
        locationQuery: z.string().optional(),
        /** Coordinates of the selected place — enables true radius search. */
        locationLat: z.number().optional(),
        locationLng: z.number().optional(),
        radiusMiles: z.number().min(1).max(1000).optional(),
      }))
      .query(async ({ input }) => {
        return getArtistsList({
          limit: input.limit,
          offset: input.offset,
          search: input.search || undefined,
          artistType: input.artistType || undefined,
          affiliationId: input.affiliationId || undefined,
          locationQuery: input.locationQuery || undefined,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          radiusMiles: input.radiusMiles,
        });
      }),

    getAffiliations: publicProcedure.query(async () => {
      return getAllAffiliations();
    }),

    getMasterServiceTypes: publicProcedure.query(async () => {
      return getAllMasterServiceTypes();
    }),

    getMasterArtistTypes: publicProcedure.query(async () => {
      return getAllMasterArtistTypes();
    }),

    getMasterStyleTypes: publicProcedure.query(async () => {
      return getAllMasterStyleTypes();
    }),

    /**
     * Distinct artist type values that real artists actually have set,
     * with counts, sorted most-common first. Used to populate the
     * Browse Artists filter pills from live data instead of a static list.
     */
    getArtistTypeCounts: publicProcedure.query(async () => {
      return getArtistTypeCounts();
    }),

    getArtistAffiliations: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getArtistAffiliations(input.userId);
      }),

    getFeatured: publicProcedure.query(async () => {
      return getFeaturedArtists(24);
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

        // Also sync into the profile's resume list (users.resumeFiles) so a
        // resume uploaded here shows up on the Edit Profile > Resume tab too.
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        let currentResumeFiles: { url: string; name: string }[] = [];
        try {
          currentResumeFiles = JSON.parse(user.resumeFiles || "[]");
          if (!Array.isArray(currentResumeFiles)) currentResumeFiles = [];
        } catch {
          currentResumeFiles = [];
        }
        if (!currentResumeFiles.some(r => r.url === url)) {
          currentResumeFiles.push({ url, name: title });
          await db
            .update(usersTable)
            .set({ resumeFiles: JSON.stringify(currentResumeFiles) })
            .where(eq(usersTable.id, user.id));
        }

        return { id: `lib-${insertId}`, title, fileUrl: url, source: "library" as const };
      }),

    /**
     * Delete a resume from the artist_resumes table ("library" source only).
     * Legacy profile-JSON resumes are not deletable via this mutation.
     */
    deleteResume: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await deleteArtistResume(user.id, input.id);
        return { success: true };
      }),
  }),

  // ── Generic Checkout Verification ─────────────────────────────────────────
  // Synchronous fallback for every Stripe Checkout flow that doesn't already
  // have its own verify procedure (artist Basic/PRO, enterprise subscription,
  // enterprise job unlock, client subscription, client job unlock). The
  // success page calls this immediately on return from Stripe so the user's
  // plan/access updates right away instead of waiting on the webhook.
  checkout: router({
    verifySession: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(input.sessionId) as any;

        if (session.metadata?.user_id && session.metadata.user_id !== String(ctx.user.id)) {
          throw new Error("This checkout session does not belong to your account.");
        }
        if (session.payment_status !== "paid" && session.status !== "complete") {
          throw new Error("Payment not completed");
        }

        await applyCheckoutSessionCompleted(session);

        return { success: true, type: session.metadata?.type ?? null };
      }),
  }),

  // ── Job Posting (Post a Job flow) ─────────────────────────────────────────
  // ── Public inquiry form (enterprise / competition landing pages) ──────────
  inquiry: router({
    /**
     * Public: someone asks us to get in touch from a landing page. Emails the
     * team and confirms back to them. Public on purpose — most people filling
     * this in don't have an account, so requiring one would defeat the form.
     */
    submit: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().max(200).optional(),
        company: z.string().max(256).optional(),
        phone: z.string().max(64).optional(),
        message: z.string().max(2000).optional(),
        /** Which page it came from, for routing/attribution. */
        source: z.string().max(120).default("website"),
      }))
      .mutation(async ({ input }) => {
        const email = input.email.trim().toLowerCase();
        // One email, not two: it goes to the enquirer with contact@ cc'd, so
        // both sides start on the same thread. Guarded so a SendGrid hiccup
        // surfaces in the logs rather than making the form look broken to
        // someone who did nothing wrong.
        const introSent = await sendInquiryIntroEmail({
          email,
          name: input.name?.trim() || null,
          company: input.company?.trim() || null,
          phone: input.phone?.trim() || null,
          message: input.message?.trim() || null,
          source: input.source,
        }).catch((e) => { console.error("[inquiry] intro email failed:", e); return false; });
        if (!introSent) {
          console.error("[inquiry] NOT DELIVERED — follow up manually:", email, input.company, input.source);
        }

        // An existing customer shouldn't be told "we'll be in touch" — they
        // already have an account and can post the job themselves right now.
        // Only the booleans are returned, never profile data: this is a public
        // endpoint, so anything richer would make it an account-enumeration
        // oracle for anyone who can guess an email.
        const existing = await getUserByEmail(email);
        return {
          success: true,
          introSent,
          existingAccount: !!existing,
          isEnterprise: !!(existing as any)?.enterprise,
        };
      }),
  }),

  postJob: router({
    /**
     * Parse a natural language job description using AI and return structured fields.
     * Public so unauthenticated users can preview before being asked to log in.
     */
    parseText: publicProcedure
      .input(z.object({ text: z.string().min(10).max(2000) }))
      .mutation(async ({ input }) => {
        // The parsed service type has to be one the poster can actually pick,
        // otherwise the prefill never matches an option and every poster starts
        // that field from blank. Feed the real taxonomy in rather than letting
        // the model invent labels ("Ballet", "Hip Hop" — those are styles).
        const serviceTypeOptions = await getAllMasterServiceTypes();
        const serviceTypeNames = serviceTypeOptions.map((t) => t.name);
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
- endDate: ISO 8601 datetime string or null (for single date jobs, this is the end time same day — startDate plus the duration in hours, same calendar day, never crossing midnight)
- hours: number or null (duration of the engagement in hours, e.g. "5 hour" or "two hours" -> 5 or 2. Null if no duration is mentioned)
- isHourly: boolean (true if hourly rate, false if flat rate)
- openRate: boolean (true if rate is open/negotiable)
- clientHourlyRate: number or null (hourly rate in dollars)
- clientFlatRate: number or null (flat rate in dollars, only if not hourly)
- transportation: boolean (true if travel/transportation is covered)
- serviceType: string or null — the KIND OF WORK, chosen verbatim from this list and nothing else. Return null if none clearly fits; do not guess a close-sounding one, and never return a dance style or instrument name that isn't on the list:
${serviceTypeNames.map((n) => `  · ${n}`).join("\n")}`,
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
                  hours: { type: ["number", "null"] },
                  isHourly: { type: "boolean" },
                  openRate: { type: "boolean" },
                  clientHourlyRate: { type: ["number", "null"] },
                  clientFlatRate: { type: ["number", "null"] },
                  transportation: { type: "boolean" },
                  serviceType: { type: ["string", "null"] },
                },
                required: ["title", "description", "locationAddress", "dateType", "startDate", "endDate", "hours", "isHourly", "openRate", "clientHourlyRate", "clientFlatRate", "transportation", "serviceType"],
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
        /** Required. The form has always enforced this client-side, but the
         *  server accepted it as optional — which is how a couple of in-app
         *  jobs got in with no title. The digest email leads with the title,
         *  so a job without one is a blank card. */
        title: z.string().min(1, "Job title is required").max(256),
        description: z.string().min(10),
        locationAddress: z.string().optional(),
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
        dateType: z.enum(["Single Date", "Weekly", "Multiple Dates", "Dates Flexible", "Ongoing", "Recurring"]).default("Single Date"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        multipleDates: z.array(z.string()).optional(),
        hours: z.number().optional(),
        isHourly: z.boolean().default(true),
        openRate: z.boolean().default(false),
        clientHourlyRate: z.number().optional(),
        clientFlatRate: z.number().optional(),
        transportation: z.boolean().default(false),
        transportationInstructions: z.string().optional(),
        studioName: z.string().optional(),
        companyId: z.number().optional(),
        /** Master service type NAME from the picker. Required: it drives job
         *  alert matching and the personalized feed, so a job posted without
         *  one is invisible to the artists it's meant to reach. */
        serviceType: z.string().min(1, "Choose the type of work this job is for"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        // Reject rather than silently storing null — a job with an unresolvable
        // service type would post successfully and then never match an artist.
        const serviceType = await resolveJobServiceType(input.serviceType);
        if (!serviceType.masterServiceTypeId) {
          throw new Error(`Unknown service type: ${input.serviceType}`);
        }
        // Resolve the address into real place data (coordinates + city/state)
        // so the job is findable by radius, not just by matching text.
        const jobLocation = await resolveJobLocation(input);
        const job = await createJob({
          masterServiceTypeId: serviceType.masterServiceTypeId,
          bubbleArtistTypeId: serviceType.bubbleArtistTypeId,
          clientUserId: user.id,
          clientCompanyId: input.companyId,
          clientEmail: user.email ?? undefined,
          title: input.title,
          description: input.description,
          locationAddress: jobLocation.locationAddress ?? undefined,
          locationLat: jobLocation.locationLat ?? undefined,
          locationLng: jobLocation.locationLng ?? undefined,
          locationCity: jobLocation.locationCity,
          locationState: jobLocation.locationState,
          locationPlaceId: jobLocation.locationPlaceId,
          dateType: input.dateType,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          hours: input.hours,
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
            serviceType: input.serviceType,
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

        // Urgent path: a job starting inside 48 hours can't wait for 1pm.
        // Fire-and-forget so a slow match never blocks the post from returning.
        import("./jobAlerts/lastMinute")
          .then(({ maybeSendLastMinute }) => maybeSendLastMinute(job.id))
          .then((r) => {
            if (r.eligible) console.log(`[last-minute] job ${job.id}: ${r.sent} sent, ${r.capped} capped, ${r.skipped} held`);
          })
          .catch((err) => console.error("[last-minute]", err));

        return { jobId: job.id };
      }),

    /**
     * Create a draft job and return the job ID + Stripe checkout URL.
     * Requires authentication.
     */
    createAndCheckout: protectedProcedure
      .input(z.object({
        /** Required — see createFreeJob. */
        title: z.string().min(1, "Job title is required").max(256),
        description: z.string().min(10),
        locationAddress: z.string().optional(),
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
        dateType: z.enum(["Single Date", "Weekly", "Multiple Dates", "Dates Flexible", "Ongoing", "Recurring"]).default("Single Date"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        multipleDates: z.array(z.string()).optional(),
        hours: z.number().optional(),
        isHourly: z.boolean().default(true),
        openRate: z.boolean().default(false),
        clientHourlyRate: z.number().optional(),
        clientFlatRate: z.number().optional(),
        transportation: z.boolean().default(false),
        transportationInstructions: z.string().optional(),
        studioName: z.string().optional(),
        companyId: z.number().optional(),
        /** See createFreeJob — same requirement, same reason. */
        serviceType: z.string().min(1, "Choose the type of work this job is for"),
        plan: z.enum(["one_time", "subscription"]).default("one_time"),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");

        const serviceType = await resolveJobServiceType(input.serviceType);
        if (!serviceType.masterServiceTypeId) {
          throw new Error(`Unknown service type: ${input.serviceType}`);
        }

        // Create the job in "Pending Payment" status
        // Resolve the address into real place data (coordinates + city/state)
        // so the job is findable by radius, not just by matching text.
        const jobLocation = await resolveJobLocation(input);
        const job = await createJob({
          masterServiceTypeId: serviceType.masterServiceTypeId,
          bubbleArtistTypeId: serviceType.bubbleArtistTypeId,
          clientUserId: user.id,
          clientCompanyId: input.companyId,
          clientEmail: user.email ?? undefined,
          title: input.title,
          description: input.description,
          locationAddress: jobLocation.locationAddress ?? undefined,
          locationLat: jobLocation.locationLat ?? undefined,
          locationLng: jobLocation.locationLng ?? undefined,
          locationCity: jobLocation.locationCity,
          locationState: jobLocation.locationState,
          locationPlaceId: jobLocation.locationPlaceId,
          dateType: input.dateType,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          hours: input.hours,
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
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        // Each company keeps its own rate/transport memory — a client with
        // multiple studios shouldn't have one studio's rate bleed into
        // another's. Prefer the selected company's own last job; fall back
        // to the user's most recent job overall if that company has none yet.
        const companyId = input?.companyId;
        let jobList = companyId ? await getJobsByUserId(user.id, 20) : [];
        let last = companyId ? jobList.find((j: any) => j.clientCompanyId === companyId) : undefined;
        if (!last) {
          jobList = await getJobsByUserId(user.id, 1);
          last = jobList?.[0];
        }
        if (!last) return null;
        return {
          isHourly: last.isHourly ?? true,
          openRate: last.openRate ?? false,
          clientHourlyRate: last.clientHourlyRate ?? null,
          clientFlatRate: (last as any).clientFlatRate ?? null,
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
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
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
          ...(await resolveJobLocation(input)),
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
        password: passwordSchema,
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
        hiringCategory: clientHiringCategorySchema,
        /** The real, Bubble-sourced business category — client onboarding
         * previously only sent hiringCategory, so this column stayed NULL
         * for every new signup even after being made the primary field. */
        businessType: clientHiringCategorySchema,
        clientCompanyName: z.string().optional(),
        location: z.string().optional(),
        /** Structured Google Places data for `location`. */
        locationData: locationInputSchema,
        website: z.string().optional(),
        phoneNumber: z.string().optional(),
        onboardingStep: z.number().optional(),
        userSignedUp: z.boolean().optional(),
        userRole: z.enum(["Artist", "Client"]).optional(),
        /** Lightweight artist-signup flows (ArtistJoin, Join) collect this
         * on their "what do you do" step — was previously collected in the
         * UI and silently discarded since this schema didn't accept it. */
        masterArtistTypes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { locationData, ...rest } = input;
        const location = input.location !== undefined
          ? await buildLocationColumns(input.location, locationData)
          : {};
        await updateUserOnboarding(user.id, { ...rest, ...location } as any);
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
        // Stored as Bubble-matching IDs; resolved back to names here so the
        // checkbox UI (which compares against literal labels) can pre-check
        // the artist's existing selections when resuming onboarding.
        masterArtistTypes: user.masterArtistTypes
          ? await resolveMasterArtistTypeNames(JSON.parse(user.masterArtistTypes as string))
          : [],
        masterServiceType: user.masterServiceType
          ? await resolveMasterServiceTypeNames(JSON.parse(user.masterServiceType as string))
          : [],
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
        masterServiceType: z.array(z.string()).optional(),
        bio: z.string().optional(),
        location: z.string().optional(),
        /** Structured Google Places data for `location`. */
        locationData: locationInputSchema,
        phoneNumber: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
        profilePicture: z.string().optional(),
        onboardingStep: z.number().optional(),
        userSignedUp: z.boolean().optional(),
        userRole: z.enum(["Artist", "Client"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const wasSignedUp = user.userSignedUp;
        const { locationData, ...rest } = input;
        // Onboarding is where most artists set their location for the first
        // time — capture the coordinates here or "artists near me" never sees
        // them. Untouched when this step didn't include a location.
        const location = input.location !== undefined
          ? await buildLocationColumns(input.location, locationData)
          : {};
        await updateUserOnboarding(user.id, { ...rest, ...location } as any);
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
     * Save profile fields (name, pronouns, phone, location) for any user.
     */
    saveProfile: protectedProcedure
      .input(z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        pronouns: z.string().optional(),
        phoneNumber: z.string().optional(),
        location: z.string().optional(),
        /** Real Google Places data behind `location` — powers radius filtering. */
        locationData: locationInputSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { getDb } = await import("./db");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const updateData: Record<string, unknown> = {};
        if (input.firstName !== undefined) { updateData.firstName = input.firstName; updateData.name = [input.firstName, user.lastName].filter(Boolean).join(" "); }
        if (input.lastName !== undefined) { updateData.lastName = input.lastName; updateData.name = [user.firstName, input.lastName].filter(Boolean).join(" "); }
        if (input.firstName !== undefined && input.lastName !== undefined) updateData.name = [input.firstName, input.lastName].filter(Boolean).join(" ");
        if (input.pronouns !== undefined) updateData.pronouns = input.pronouns;
        if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber;
        if (input.location !== undefined) {
          Object.assign(updateData, await buildLocationColumns(input.location, input.locationData));
        }
        await db.update(usersTable).set(updateData as any).where(eq(usersTable.id, user.id));
        return { success: true };
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
    getApplications: protectedProcedure
      .input(z.object({ clientUserId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        if (!input.clientUserId) return { applications: [] };
        const isAdmin = ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin";
        if (!isAdmin && ctx.user.id !== input.clientUserId) return { applications: [] };
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
    getInterestedArtists: protectedProcedure
      .input(z.object({ clientUserId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        if (!input.clientUserId) return { artists: [] };
        const isAdmin = ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin";
        if (!isAdmin && ctx.user.id !== input.clientUserId) return { artists: [] };
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
        const user = await getUserById(ctx.user.id);
        const isAdmin = ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin";
        const isOnDemand = (user as any)?.planTier === "enterprise_on_demand";
        const isActiveSubscriber = (user as any)?.planTier === "enterprise_subscription";

        // Default-deny: only admin, an active subscriber, or an on-demand
        // client who has specifically unlocked THIS job get full access.
        // Everyone else — including a no-plan or lapsed enterprise account —
        // gets the locked count + blurred preview, same as on-demand.
        const hasFullAccess = isAdmin || isActiveSubscriber || (isOnDemand && await isJobUnlocked(ctx.user.id, input.jobId));

        if (!hasFullAccess) {
          const raw = await getPremiumJobInterestedArtists(input.jobId);
          const preview = (raw as any[]).map((ia: any) => ({
            firstName: ia.artistFirstName || null,
            lastName: ia.artistLastName ? ia.artistLastName.charAt(0) + "." : null,
            profilePicture: ia.artistProfilePicture || null,
          }));
          return { applicants: [], preview, applicantCount: (raw as any[]).length, locked: true, plan: (isOnDemand ? "on_demand" : null) as "on_demand" | null };
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
        return { applicants, applicantCount: applicants.length, locked: false, plan: (isOnDemand ? "on_demand" : isActiveSubscriber ? "subscriber" : null) as "on_demand" | "subscriber" | null };
      }),

    /** Get client companies for this enterprise user */
    getClientCompanies: protectedProcedure
      .query(async ({ ctx }) => {
        const rawCompanies = await getClientCompaniesByUserId(ctx.user.id);
        const user = await getUserById(ctx.user.id);
        const proJobs = await getPremiumJobsByUserId(ctx.user.id);
        // Enrich each company with openRoles count and normalized logoUrl
        const companies = rawCompanies.map((c) => {
          const openRoles = (proJobs as any[]).filter(
            (j) => (j.company === c.name) && (j.status === 'Active' || !j.status)
          ).length;
          return {
            ...c,
            logoUrl: c.logo || user?.enterpriseLogoUrl || user?.profilePicture || null,
            openRoles,
          };
        });
        return { companies };
      }),

    /** Create a new premium job */
    postJob: protectedProcedure
      .input(z.object({
        serviceType: z.string().min(1, 'Job title is required'),
        /** The taxonomy value, distinct from `serviceType` above — that one is
         *  the free-text job title. Required: without it a PRO job matches no
         *  artist and never reaches the network email. */
        masterServiceType: z.string().min(1, 'Choose the type of work this job is for'),
        company: z.string().min(1, 'Company is required'),
        logo: z.string().optional(),
        category: z.string().optional(),
        location: z.string().optional(),
        /** Structured Google Places data for `location`. */
        locationData: locationInputSchema,
        budget: z.string().optional(),
        workFromAnywhere: z.boolean().default(false),
        description: z.string().optional(),
        applyEmail: z.string().email().optional().or(z.literal('')),
        applyLink: z.string().url().optional().or(z.literal('')),
        applyDirect: z.boolean().default(false),
        bubbleClientCompanyId: z.string().optional(),
        appUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const poster0 = await getUserById(ctx.user.id);
        const isAdmin0 = ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin";
        if (!isAdmin0 && !(poster0 as any)?.enterprise) {
          throw new Error("An Enterprise account is required to post PRO jobs.");
        }
        const proServiceType = await resolveJobServiceType(input.masterServiceType);
        if (!proServiceType.masterServiceTypeId) {
          throw new Error(`Unknown service type: ${input.masterServiceType}`);
        }
        const jobId = await createPremiumJob({
          masterServiceTypeId: proServiceType.masterServiceTypeId,
          bubbleArtistTypeId: proServiceType.bubbleArtistTypeId,
          serviceType: input.serviceType,
          company: input.company,
          logo: input.logo || null,
          category: input.category || null,
          // Real coordinates so PRO jobs show up in radius search alongside
          // regular jobs, rather than only matching on city text.
          ...(await resolvePremiumJobLocation(input)),
          budget: input.budget || null,
          workFromAnywhere: input.workFromAnywhere === true,
          description: input.description || null,
          applyEmail: input.applyEmail || null,
          applyLink: input.applyLink || null,
          applyDirect: input.applyDirect,
          createdByUserId: ctx.user.id,
          bubbleClientCompanyId: input.bubbleClientCompanyId || null,
        });

        // Upsert a client_companies row so the company appears in the Companies tab
        await createClientCompany({
          ownerUserId: ctx.user.id,
          name: input.company,
          logo: input.logo || null,
        }).catch(() => {});  // non-fatal if already exists

        // Send PRO job confirmation email
        const poster = await getUserByOpenId(ctx.user.openId);
        if (poster?.email) {
          // Use client-supplied origin so the link works on any subdomain/preview env
          const appUrl = input.appUrl || process.env.VITE_APP_URL || "https://artswrk.com";
          sendProJobPostedEmail({
            to: poster.email,
            firstName: poster.firstName ?? poster.name?.split(" ")[0] ?? "there",
            company: input.company,
            serviceType: input.serviceType,
            location: input.location || null,
            description: input.description || null,
            workFromAnywhere: input.workFromAnywhere === true,
            jobLink: `${appUrl}/enterprise/${jobId}`,
          }).catch((err) => console.error("[PRO job email]", err));
        }

        return { success: true, jobId };
      }),

    /** Update a PRO job owned by the logged-in enterprise user */
    updateOwnJob: protectedProcedure
      .input(z.object({
        id: z.number(),
        serviceType: z.string().min(1).optional(),
        company: z.string().optional(),
        category: z.string().optional(),
        location: z.string().optional(),
        /** Structured Google Places data for `location`. */
        locationData: locationInputSchema,
        workFromAnywhere: z.boolean().optional(),
        budget: z.string().optional(),
        description: z.string().optional(),
        applyEmail: z.string().email().optional().or(z.literal("")),
        applyLink: z.string().url().optional().or(z.literal("")),
        applyDirect: z.boolean().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { premiumJobs: premiumJobsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");

        // Verify ownership before updating
        const [existing] = await db
          .select({ createdByUserId: premiumJobsTable.createdByUserId })
          .from(premiumJobsTable)
          .where(eq(premiumJobsTable.id, input.id))
          .limit(1);
        if (!existing) throw new Error("Job not found");
        if (existing.createdByUserId !== ctx.user.id) throw new Error("Forbidden: not your job");

        const { id, ...fields } = input;
        const patch: Record<string, any> = {};
        if (fields.serviceType !== undefined) patch.serviceType = fields.serviceType;
        if (fields.company !== undefined) patch.company = fields.company;
        if (fields.category !== undefined) patch.category = fields.category;
        if (fields.location !== undefined) {
          Object.assign(patch, await resolvePremiumJobLocation(fields));
        }
        if (fields.workFromAnywhere !== undefined) patch.workFromAnywhere = fields.workFromAnywhere;
        if (fields.budget !== undefined) patch.budget = fields.budget || null;
        if (fields.description !== undefined) patch.description = fields.description || null;
        if (fields.applyEmail !== undefined) patch.applyEmail = fields.applyEmail || null;
        if (fields.applyLink !== undefined) patch.applyLink = fields.applyLink || null;
        if (fields.applyDirect !== undefined) patch.applyDirect = fields.applyDirect;
        if (fields.status !== undefined) patch.status = fields.status;

        if (Object.keys(patch).length > 0) {
          await db.update(premiumJobsTable).set(patch).where(eq(premiumJobsTable.id, id));
        }
        return { success: true };
      }),

    /** Archive a PRO job owned by the logged-in enterprise user */
    archiveOwnJob: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { premiumJobs: premiumJobsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");

        const [existing] = await db
          .select({ createdByUserId: premiumJobsTable.createdByUserId })
          .from(premiumJobsTable)
          .where(eq(premiumJobsTable.id, input.id))
          .limit(1);
        if (!existing) throw new Error("Job not found");
        if (existing.createdByUserId !== ctx.user.id) throw new Error("Forbidden: not your job");

        await db.update(premiumJobsTable).set({ status: "Archived" }).where(eq(premiumJobsTable.id, input.id));
        return { success: true };
      }),

    /** Get enterprise billing info for the logged-in client */
    getBillingInfo: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.enterprise) throw new Error("Not an enterprise account");
      const billing = await getEnterpriseBillingInfo(ctx.user.id);
      // planTier is the real source of truth — the legacy enterprisePlan
      // column isn't reliably set by self-signup or every admin path, so
      // derive the displayed plan from planTier rather than trusting it raw.
      const derivedEnterprisePlan = (user.planTier as string | null) === "enterprise_subscription"
        ? "subscriber"
        : (user.planTier as string | null) === "enterprise_on_demand"
          ? "on_demand"
          : (billing?.enterprisePlan ?? null);
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
        // planTier is the real source of truth — self-signup (auto-detected
        // via businessType) and several admin-creation paths set planTier
        // but never touch the legacy enterprisePlan column, so checking that
        // column here left those accounts unable to ever pay the $100 unlock.
        if (user.planTier !== "enterprise_on_demand") throw new Error("Job unlock is only for on-demand plan");
        // Never take money to unlock a job that isn't live. NOTE: this id is a
        // premium_jobs id, not a jobs id — looking it up in `jobs` matched
        // nothing and rejected every enterprise unlock.
        const unlockTarget = await getPremiumJobById(input.jobId);
        if (!unlockTarget || !isJobPubliclyLive(unlockTarget.status)) {
          throw new Error("This job is no longer available to unlock.");
        }
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
        // Allow on-demand users to upgrade; only block if already actively
        // subscribed. planTier is the reliable signal (see checkoutJobUnlock).
        if (user.planTier === "enterprise_subscription" && user.enterpriseStripeSubscriptionId) {
          throw new Error("Already subscribed — manage your subscription via the billing portal");
        }
        const { url, sessionId } = await createEnterpriseSubscriptionCheckoutSession({
          email: user.email ?? undefined,
          userId: ctx.user.id,
          interval: input.interval,
          origin: input.origin,
          stripeCustomerId: user.enterpriseStripeCustomerId ?? null,
        });
        return { url, sessionId };
      }),

    /** Verify a completed Stripe job-unlock session and record the unlock in the DB */
    verifyJobUnlock: protectedProcedure
      .input(z.object({ sessionId: z.string(), jobId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Idempotent — skip if already recorded
        const already = await isJobUnlocked(ctx.user.id, input.jobId);
        if (already) return { success: true };
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(input.sessionId);
        if (session.payment_status !== "paid" && session.status !== "complete") {
          throw new Error("Payment not yet completed");
        }
        await recordEnterpriseJobUnlock({
          clientUserId: ctx.user.id,
          jobId: input.jobId,
          stripeSessionId: input.sessionId,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          amountCents: session.amount_total ?? 10000,
        });
        // Save Stripe customer ID for future use
        if (session.customer && typeof session.customer === "string") {
          await saveEnterpriseStripeCustomerId(ctx.user.id, session.customer);
        }
        return { success: true };
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

    /** Confirm a PRO job applicant and create a booking record */
    confirmApplicant: protectedProcedure
      .input(z.object({
        applicantId: z.number(),
        paymentMethod: z.enum(["artswrk", "direct"]),
        rateType: z.enum(["flat", "hourly"]).default("flat"),
        artistRateCents: z.number().int().optional(),  // rate artist receives, in cents
        hours: z.number().optional(),                  // if hourly
        startDate: z.string().optional(),              // ISO date string
        endDate: z.string().optional(),
        locationAddress: z.string().optional(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { premiumJobInterestedArtists, premiumJobs } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");

        // Fetch applicant from premium_interested_artists
        const [applicantRow] = await db
          .select()
          .from(premiumJobInterestedArtists)
          .where(eq(premiumJobInterestedArtists.id, input.applicantId))
          .limit(1);
        if (!applicantRow) throw new Error("Applicant not found");

        // Fetch the premium job and verify ownership
        const [jobRow] = await db
          .select()
          .from(premiumJobs)
          .where(eq(premiumJobs.id, applicantRow.premiumJobId!))
          .limit(1);
        if (!jobRow) throw new Error("Job not found");
        if (jobRow.createdByUserId !== ctx.user.id) throw new Error("Forbidden: not your job");

        // Ownership alone used to be a safe proxy for "this job was paid for,"
        // since only enterprise accounts could post one — postJob now enforces
        // that directly, but confirming still needs its own check: an
        // on-demand client must have actually unlocked THIS job, not just own it.
        const confirmer = await getUserById(ctx.user.id);
        const confirmerIsAdmin = ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin";
        // planTier is the reliable signal (see checkoutJobUnlock above).
        const confirmerIsActiveSubscriber = (confirmer as any)?.planTier === "enterprise_subscription" && !!(confirmer as any)?.enterpriseStripeSubscriptionId;
        if (!confirmerIsAdmin && !confirmerIsActiveSubscriber) {
          const unlocked = await isJobUnlocked(ctx.user.id, applicantRow.premiumJobId!);
          if (!unlocked) throw new Error("Unlock this job before confirming an applicant.");
        }

        // bookings.artistRate/clientRate hold the TOTAL for the booking, not a
        // unit rate — that's what all 5,679 migrated Bubble rows contain
        // ($50/hr × 5 hrs stored as 250). Storing the raw hourly rate here gave
        // the column two meanings and under-billed every hourly booking: $60/hr
        // × 3 hrs was saved as 60, so the studio was invoiced $63 instead of $189.
        const unitRate = input.artistRateCents ? Math.round(input.artistRateCents / 100) : null;
        const artistRateDollars = unitRate !== null && input.rateType === "hourly" && input.hours
          ? Math.round(unitRate * input.hours)
          : unitRate;
        const clientRateDollars = artistRateDollars !== null && input.paymentMethod === "artswrk"
          ? Math.round(artistRateDollars * 1.05)
          : artistRateDollars;

        // Create the booking (reuse existing helper, passing premium IDs in the jobId / interestedArtistId slots)
        const bookingId = await createBookingFromApplicant({
          jobId: applicantRow.premiumJobId!,
          interestedArtistId: input.applicantId,
          clientUserId: ctx.user.id,
          artistUserId: applicantRow.artistUserId!,
          paymentMethod: input.paymentMethod,
          artistRate: artistRateDollars,
          clientRate: clientRateDollars,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          ...(await resolveJobLocation({
            locationAddress: input.locationAddress ?? jobRow.location,
            locationLat: input.locationAddress ? undefined : jobRow.locationLat,
            locationLng: input.locationAddress ? undefined : jobRow.locationLng,
            locationData: input.locationData,
          })),
          description: [jobRow.description, input.notes].filter(Boolean).join("\n\n---\n\n") || null,
        });

        // Store hours on the booking if provided (hourly rate jobs)
        if (input.hours && bookingId) {
          const { bookings: bookingsTable } = await import("../drizzle/schema");
          await db.update(bookingsTable).set({ hours: input.hours } as any).where(eq(bookingsTable.id, bookingId));
        }

        // Mark applicant status as Confirmed
        await db.update(premiumJobInterestedArtists)
          .set({ status: "Confirmed" } as any)
          .where(eq(premiumJobInterestedArtists.id, input.applicantId));

        // Send confirmation email to artist
        try {
          const artist = await getUserById(applicantRow.artistUserId!);
          if (artist?.email) {
            const enterprise = await getUserById(ctx.user.id);
            const company = jobRow.company ?? enterprise?.clientCompanyName ?? enterprise?.name ?? "A company";
            const payNote = input.paymentMethod === "artswrk"
              ? "via Artswrk invoice (5% processing fee applies)"
              : "directly by the company";
            await sendSimpleEmail({
              to: artist.email,
              subject: `You've been confirmed for ${jobRow.serviceType ?? "a job"} at ${company}`,
              html: `<div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0"><div style="background:linear-gradient(135deg,#FFBC5D,#F25722);padding:28px 36px"><img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/ArtswrkWhiteLogo_d14af74c.png" alt="Artswrk" height="32" style="display:block;height:32px;width:auto"/></div><div style="padding:32px"><h2 style="font-size:20px;font-weight:900;color:#111;margin:0 0 6px">You've been confirmed! 🎉</h2><p style="font-size:15px;color:#555;margin:0 0 20px">Hi ${artist.firstName ?? "there"}, <strong>${company}</strong> has confirmed you for the role below.</p><div style="background:#f9f9f9;border-radius:12px;padding:16px 20px;margin-bottom:20px"><p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111">Job: ${jobRow.serviceType ?? "Role"}</p>${input.artistRateCents ? `<p style="margin:0 0 8px;font-size:13px;color:#555">Agreed rate: <strong>$${(input.artistRateCents / 100).toFixed(2)}${input.rateType === 'hourly' ? '/hr' : ' flat'}</strong></p>` : ""}${input.notes ? `<p style="margin:0;font-size:13px;color:#555">Notes: ${input.notes}</p>` : ""}</div><p style="font-size:13px;color:#666;margin:0 0 20px">Payment will be handled ${payNote}.</p><a href="${process.env.VITE_APP_URL ?? "https://artswrk.com"}/app" style="display:inline-block;background:linear-gradient(135deg,#FFBC5D,#F25722);color:#fff;font-weight:800;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none">View Dashboard →</a></div></div>`,
            });
          }
        } catch (e) {
          console.error("[enterprise.confirmApplicant] email send failed (non-fatal):", e);
        }

        return { success: true, bookingId };
      }),

    /** Send a direct message to an artist from enterprise job detail view */
    messageArtist: protectedProcedure
      .input(z.object({ artistUserId: z.number(), message: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const sender = await getUserById(ctx.user.id);
        if (!sender) throw new Error("User not found");
        const allowed = await canClientMessageArtist(ctx.user.id, input.artistUserId);
        if (!allowed) {
          throw new Error("Unlock this artist's job (or upgrade to Premium) to message them.");
        }
        const conversation = await getOrCreateConversation(ctx.user.id, input.artistUserId);
        await sendMessageToConversation({ conversationId: conversation.id, senderUserId: ctx.user.id, content: input.message });
        const artist = await getUserById(input.artistUserId);
        if (artist?.email) {
          try {
            const senderName = (sender as any).clientCompanyName ?? sender.name ?? "Artswrk Client";
            await sendNewMessageEmail({
              to: artist.email,
              recipientFirstName: artist.firstName ?? "there",
              senderName,
              messagePreview: input.message,
              dashboardUrl: `${process.env.VITE_APP_URL ?? "https://artswrk.com"}/app/messages`,
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
      .query(async ({ input, ctx }) => {
        return getArtistJobsFeed(input.limit, input.offset, input.lat, input.lng, ctx.user?.id);
      }),
    /** Get the logged-in artist's affiliations */
    getMyAffiliations: protectedProcedure.query(async ({ ctx }) => {
      return getMyAffiliations(ctx.user.id);
    }),
    /** Get PRO jobs feed for artist dashboard */
    getProJobsFeed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20), offset: z.number().min(0).default(0) }))
      .query(async ({ input, ctx }) => {
        const jobs = await getArtistProJobsFeed(input.limit, input.offset);
        // PRO job details (company, budget, full description) are enterprise-paid
        // content — only show them to a logged-in PRO artist. Everyone else gets
        // the same teaser treatment individual PRO job pages already use
        // ("Company hidden · Join to see").
        const viewer = ctx.user ? await getUserById(ctx.user.id) : null;
        const isPro = !!(viewer as any)?.artswrkPro;
        if (isPro) return jobs;
        return jobs.map(j => ({ ...j, company: null, logo: null, budget: null, description: null, locked: true }));
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
      .input(z.object({
        premiumJobId: z.number(),
        message: z.string().max(2000).optional(),
        resumeLink: z.string().optional(),
        rate: z.string().max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const applicant = await getUserById(ctx.user.id);
        if ((applicant as any)?.planTier !== "artist_pro") {
          throw new Error("Upgrade to Artswrk PRO to apply to PRO jobs.");
        }
        const { getDb } = await import('./db');
        const dbConn = await getDb();
        if (!dbConn) throw new Error('DB unavailable');
        const { premiumJobInterestedArtists } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const existing = await dbConn.select({ id: premiumJobInterestedArtists.id })
          .from(premiumJobInterestedArtists)
          .where(and(
            eq(premiumJobInterestedArtists.artistUserId, ctx.user.id),
            eq(premiumJobInterestedArtists.premiumJobId, input.premiumJobId)
          ))
          .limit(1);
        if (existing.length > 0) {
          // Record already exists — update message/resume/rate in case they were missing
          await dbConn.update(premiumJobInterestedArtists)
            .set({
              message: input.message || null,
              resumeLink: input.resumeLink || null,
              rate: input.rate || null,
            })
            .where(eq(premiumJobInterestedArtists.id, existing[0].id));
          return { success: true, alreadyApplied: true };
        }
        await dbConn.insert(premiumJobInterestedArtists).values({
          artistUserId: ctx.user.id,
          premiumJobId: input.premiumJobId,
          status: 'Pending',
          message: input.message || null,
          resumeLink: input.resumeLink || null,
          rate: input.rate || null,
          createdAt: new Date(),
        });

        // Fire-and-forget emails — don't block the response
        (async () => {
          try {
            const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
            const job = await getPremiumJobById(input.premiumJobId);
            if (!job) return;
            const clientUser = job.createdByUserId ? await getUserById(job.createdByUserId) : null;
            const artist = ctx.user as any;
            const artistFirstName: string = artist.firstName || "Artist";
            const artistLastInitial: string = (artist.lastName || "").charAt(0).toUpperCase();
            const locationDisplay: string = job.workFromAnywhere
              ? "Work From Anywhere"
              : (job.location || "Location TBD");
            const jobLink = `${appUrl}/enterprise/${job.id}`;
            const dashboardLink = `${appUrl}/app`;

            if (clientUser?.email) {
              await sendProJobApplicantAlertEmail({
                to: clientUser.email,
                artistFirstName,
                artistLastInitial,
                message: input.message || null,
                serviceType: job.serviceType || "Open Position",
                location: locationDisplay,
                description: job.description || null,
                jobLink,
              });
            }

            const artistEmail: string | undefined = (artist as any).email;
            if (artistEmail) {
              await sendProJobSubmissionConfirmationEmail({
                to: artistEmail,
                artistFirstName,
                serviceType: job.serviceType || "Open Position",
                location: locationDisplay,
                description: job.description || null,
                dashboardLink,
                // The artist's own submission echoed back — same as the basic
                // application confirmation. Their data, going to them.
                pitchedRate: input.rate || undefined,
                artistMessage: input.message || undefined,
                resumeLink: input.resumeLink || undefined,
              });
            }
          } catch (err) {
            console.error("[applyToProJob] email error:", err);
          }
        })();

        return { success: true, alreadyApplied: false };
      }),

    /** Check if the logged-in artist has already applied to a specific PRO job */
    checkProJobApplication: protectedProcedure
      .input(z.object({ premiumJobId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getDb } = await import('./db');
        const dbConn = await getDb();
        if (!dbConn) return { applied: false, message: null, resumeLink: null, rate: null };
        const { premiumJobInterestedArtists } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const existing = await dbConn.select({
          id: premiumJobInterestedArtists.id,
          message: premiumJobInterestedArtists.message,
          resumeLink: premiumJobInterestedArtists.resumeLink,
          rate: premiumJobInterestedArtists.rate,
        })
          .from(premiumJobInterestedArtists)
          .where(and(
            eq(premiumJobInterestedArtists.artistUserId, ctx.user.id),
            eq(premiumJobInterestedArtists.premiumJobId, input.premiumJobId)
          ))
          .limit(1);
        if (existing.length === 0) return { applied: false, message: null, resumeLink: null, rate: null };
        const rec = existing[0];
        return { applied: true, message: rec.message ?? null, resumeLink: rec.resumeLink ?? null, rate: rec.rate ?? null };
      }),

    /** Get all confirmed bookings for the logged-in artist. */
    myConfirmations: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getArtistConfirmedBookings(user.id);
      }),

    /** Set payment method for a booking: "artswrk" or "direct". */
    setPaymentMethod: protectedProcedure
      .input(z.object({ bookingId: z.number(), method: z.enum(["artswrk", "direct"]) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await setBookingPaymentMethod(input.bookingId, user.id, input.method);
        return { success: true };
      }),

    /** Artist confirms they received direct payment for a booking. */
    confirmDirectPayment: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await confirmDirectPayment(input.bookingId, user.id);
        return { success: true };
      }),

    /** Get all reimbursements for a booking (artist view). */
    getReimbursements: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getReimbursementsByBookingId(input.bookingId);
      }),

    /** Add a reimbursement item for a booking. */
    addReimbursement: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        value: z.number().positive(),
        note: z.string().max(500).optional(),
        fileUrl: z.string().url().optional(),
        expenseDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const id = await createReimbursement({
          bookingId: input.bookingId,
          artistUserId: user.id,
          value: input.value,
          note: input.note ?? null,
          fileUrl: input.fileUrl ?? null,
          expenseDate: input.expenseDate ?? null,
        });
        return { success: true, id };
      }),

    /**
     * Submit the Artswrk invoice for a booking.
     * 1. Generates a unique invoice payment token.
     * 2. Saves the token + estimated total on the booking record.
     * 3. Emails the studio to review the invoice.
     *
     * Deliberately does NOT create the Stripe Checkout session here — studios
     * sometimes need to adjust hours before paying, so the actual payment
     * link only gets created once they review and approve (invoice.approve),
     * matching how the old Bubble flow worked: artist invoices, studio
     * confirms, THAT confirm is what creates the payment link.
     */
    submitArtswrkInvoice: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        artistRate: z.number().optional(),
        notes: z.string().max(1000).optional(),
        origin: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");

        // Fetch the booking to get the client's info
        const booking = await getBookingById(input.bookingId);
        if (!booking) throw new Error("Booking not found");
        if (booking.artistUserId !== user.id) throw new Error("Not authorized");

        // Every payout must land in the artist's own connected Stripe account —
        // never let an invoice go out (and get paid) with nowhere for the money to go.
        const connectAccountId = await getArtistStripeConnectAccount(user.id);
        if (!connectAccountId) {
          throw new Error("Connect your Stripe payout account before invoicing a studio. Go to Settings → Manage Payouts.");
        }

        // Fetch the client (studio) user
        const clientUser = booking.clientUserId ? await getUserById(booking.clientUserId) : null;

        const reimbList = await getReimbursementsByBookingId(input.bookingId);
        const totalReimb = reimbList.reduce((s: number, r: any) => s + (r.value ?? 0), 0);
        const artistRate = input.artistRate ?? 0;
        const processingFee = Math.round((artistRate + totalReimb) * 0.04);
        const totalDollars = artistRate + totalReimb + processingFee;
        const totalCents = Math.round(totalDollars * 100);

        // Generate a unique invoice payment token
        const { randomBytes } = await import("crypto");
        const invoicePaymentToken = randomBytes(24).toString("hex");

        // Determine origin for redirect URLs
        const origin = input.origin ?? APP_URL;  // was a hardcoded manus.space staging host
        const paymentPageUrl = `${origin}/invoice/${invoicePaymentToken}`;

        // Persist token + estimated total on the booking — no checkout URL yet,
        // that gets created when the studio approves.
        await markArtswrkInvoiceSubmitted(input.bookingId, user.id, {
          invoicePaymentToken,
          invoiceTotalCents: totalCents,
        });

        // Format date for email
        const bookingDate = booking.startDate
          ? new Date(booking.startDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
          : new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });

        const artistDisplayName = user.name ?? user.firstName ?? "Your artist";
        const studioName = clientUser?.clientCompanyName ?? clientUser?.firstName ?? "there";
        const reimbText = totalReimb > 0
          ? `$${totalReimb.toFixed(2)} (${reimbList.length} item${reimbList.length !== 1 ? "s" : ""})`
          : "No reimbursements added";

        // Build the studio payment email (matches the design in the screenshot)
        const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px">
  <!-- Header -->
  <tr><td style="padding:28px 40px 20px;border-bottom:1px solid #eee;text-align:center">
    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px">
      <span style="background:linear-gradient(90deg,#FFBC5D,#F25722);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">ARTS</span><span style="background:#111;color:#fff;padding:2px 8px;border-radius:4px;margin-left:2px;font-size:20px">WRK</span>
    </span>
  </td></tr>
  <!-- Title -->
  <tr><td style="padding:32px 40px 0">
    <h1 style="margin:0;font-size:24px;font-weight:700;color:#111">Payment Request for ${artistDisplayName} ${bookingDate}</h1>
  </td></tr>
  <!-- Divider -->
  <tr><td style="padding:20px 40px"><hr style="border:none;border-top:1px solid #eee;margin:0"></td></tr>
  <!-- Greeting -->
  <tr><td style="padding:0 40px 20px">
    <p style="margin:0 0 16px;font-size:16px;color:#444">Hi ${studioName},</p>
    <p style="margin:0;font-size:16px;color:#444">Your booking has been completed by ${artistDisplayName} and is ready for your review.</p>
  </td></tr>
  <!-- Booking details block -->
  <tr><td style="padding:0 40px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #ec008c;padding-left:16px">
      <tr><td style="padding-bottom:12px">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#999;letter-spacing:1px;text-transform:uppercase">YOUR BOOKING:</p>
        <p style="margin:0 0 4px;font-size:15px;color:#333"><strong>Date:</strong> ${bookingDate}</p>
        <p style="margin:0 0 4px;font-size:15px;color:#333"><strong>Total Base Rate:</strong> $${artistRate.toFixed(2)}</p>
        <p style="margin:0 0 4px;font-size:15px;color:#333"><strong>Reimbursements:</strong> ${reimbText}</p>
        <p style="margin:0;font-size:15px;color:#333"><strong>Total Payment Amount:</strong> $${totalDollars.toFixed(2)}</p>
      </td></tr>
    </table>
  </td></tr>
  <!-- Divider -->
  <tr><td style="padding:0 40px 24px"><hr style="border:none;border-top:1px solid #eee;margin:0"></td></tr>
  <!-- Payment details -->
  <tr><td style="padding:0 40px 24px">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#999;letter-spacing:1px;text-transform:uppercase">PAYMENT DETAILS</p>
    <p style="margin:0;font-size:16px;color:#444;line-height:1.6">If the hours need adjusting, you can update them on the review page below before paying. Once you approve, you'll be able to pay digitally with a card or Apple Pay, and will receive a receipt upon payment.</p>
  </td></tr>
  <!-- CTA Button -->
  <tr><td style="padding:0 40px 32px;text-align:center">
    <a href="${paymentPageUrl}" style="display:inline-block;background:#111;color:#fff;font-size:18px;font-weight:600;padding:18px 48px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Review Invoice →</a>
  </td></tr>
  <!-- Divider -->
  <tr><td style="padding:0 40px 24px"><hr style="border:none;border-top:1px solid #eee;margin:0"></td></tr>
  <!-- Footer -->
  <tr><td style="padding:0 40px 32px">
    <p style="margin:0 0 16px;font-size:15px;color:#444">As always, if you have any questions or concerns, don't hesitate to reach out to us.</p>
    <p style="margin:0;font-size:15px;color:#444">Best,<br>The Artswrk Team</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

        // Send to the studio (client) via the SendGrid "Client - Pay Artist" template + CC Artswrk internally
        const studioEmail = clientUser?.email;
        try {
          if (studioEmail) {
            await sendClientPayArtistEmail({
              to: studioEmail,
              artistName: artistDisplayName,
              clientRate: `$${artistRate.toFixed(2)}`,
              date: bookingDate,
              reimbursements: reimbText,
              startDate: bookingDate,
              totalClientRate: `$${totalDollars.toFixed(2)}`,
              payUrl: paymentPageUrl,
            });
          }
          // Always notify the internal Artswrk team with the full detail
          await sendSimpleEmail({
            to: "contact@artswrk.com",
            subject: `[Invoice] ${artistDisplayName} → ${studioName} — $${totalDollars.toFixed(2)} — Booking #${input.bookingId}`,
            html: emailHtml,
          });
        } catch (e) {
          console.error("[submitArtswrkInvoice] Email send failed:", e);
          // Don't throw — invoice is already saved
        }

        return { success: true, paymentPageUrl, invoicePaymentToken };
      }),

    /** Upload a reimbursement receipt file to S3 and return the URL. */
    uploadReimbursementReceipt: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.fileBase64, "base64");
        const suffix = Date.now().toString(36);
        const key = `reimbursements/${user.id}/${suffix}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url };
      }),

    /** Wallet: total earned, reimbursements, and transaction list from paid bookings. */
    walletData: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return getArtistWalletData(user.id);
      }),

    /** Generate a Stripe Express dashboard login link for the artist. */
    stripeLoginLink: protectedProcedure
      .mutation(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const accountId = await getArtistStripeConnectAccount(user.id);
        if (!accountId) throw new Error("No Stripe Connect account configured");
        const { getStripe } = await import("./stripe");
        const link = await getStripe().accounts.createLoginLink(accountId);
        return { url: link.url };
      }),

    /** Whether the artist has a connected Stripe payout account. */
    stripeConnectStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const accountId = await getArtistStripeConnectAccount(user.id);
        return { connected: !!accountId };
      }),

    /** Start (or resume) Stripe Express onboarding so an artist can link their payout account. */
    createStripeConnectUrl: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        if (!user.email) throw new Error("Account has no email on file");
        const { createArtistExpressAccount, createConnectOnboardingUrl } = await import("./stripe");
        const { saveArtistStripeConnectAccount } = await import("./db");

        let accountId = await getArtistStripeConnectAccount(user.id);
        if (!accountId) {
          accountId = await createArtistExpressAccount(user.email);
          await saveArtistStripeConnectAccount(user.id, accountId);
        }

        const url = await createConnectOnboardingUrl(user.id, accountId, input.origin);
        return { url };
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

    studioOnboard: publicProcedure
      .input(z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        password: passwordSchema,
        companyName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        const existing = await getUserByEmail(email);
        if (existing) {
          return { status: "existing" as const };
        }
        const parts = input.fullName.trim().split(/\s+/);
        const firstName = parts[0] ?? "";
        const lastName = parts.slice(1).join(" ") || firstName;
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
        const newUser = await createNewUser({
          email,
          firstName,
          lastName,
          passwordHash,
          clientCompanyName: input.companyName?.trim() || undefined,
        });
        const sessionToken = await sdk.createSessionToken(newUser.openId, {
          name: `${firstName} ${lastName}`,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { status: "created" as const };
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

      // Annual-only for both plans as of 2026-08-28 — monthly is no longer
      // offered to new signups, so it's intentionally not fetched here.
      const [basicAnnual, proAnnual] = await Promise.all([
        fetchPrice(STRIPE_PRODUCTS.ARTIST_BASIC.annual.priceId),
        fetchPrice(STRIPE_PRODUCTS.ARTIST_PRO.annual.priceId),
      ]);

      return {
        basic: {
          annual: basicAnnual,
        },
        pro: {
          annual: proAnnual,
          trialDays: STRIPE_PRODUCTS.ARTIST_PRO.annual.trialPeriodDays ?? 0,
        },
      };
    }),

    /**
     * Create a Stripe Checkout session for the artist Basic plan — annual-only ($30/yr).
     */
    createBasicCheckout: protectedProcedure
      .input(z.object({
        origin: z.string().url(),
        returnPath: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const info = await getArtistSubscriptionInfo(ctx.user.id);
        const { url, sessionId } = await createArtistBasicCheckoutSession({
          email: ctx.user.email ?? undefined,
          userId: ctx.user.id,
          origin: input.origin,
          stripeCustomerId: info?.stripeCustomerId ?? null,
          returnPath: input.returnPath,
        });
        return { url, sessionId };
      }),

    /**
     * Create a Stripe Checkout session for the artist PRO plan — annual-only,
     * includes the free trial (see STRIPE_PRODUCTS.ARTIST_PRO.annual.trialPeriodDays).
     */
    createProCheckout: protectedProcedure
      .input(z.object({
        origin: z.string().url(),
        returnPath: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const info = await getArtistSubscriptionInfo(ctx.user.id);
        const { url, sessionId } = await createArtistProCheckoutSession({
          email: ctx.user.email ?? undefined,
          userId: ctx.user.id,
          origin: input.origin,
          stripeCustomerId: info?.stripeCustomerId ?? null,
          returnPath: input.returnPath,
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

  // ── Account management ──────────────────────────────────────────────────────
  account: router({
    /**
     * Account deletion isn't self-serve — this just emails the team with the
     * user's reasons + message so a human follows up.
     */
    requestDeletion: protectedProcedure
      .input(z.object({
        reasons: z.array(z.string()).max(20).default([]),
        message: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");

        const reasonsHtml = input.reasons.length
          ? `<ul>${input.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>`
          : "<p>(no reasons selected)</p>";

        await sendSimpleEmail({
          to: "contact@artswrk.com",
          subject: `Account deletion request — ${user.name ?? user.email}`,
          html: `
            <p><strong>User:</strong> ${user.name ?? "—"} (${user.email ?? "—"}), user ID ${user.id}</p>
            <p><strong>Reasons:</strong></p>
            ${reasonsHtml}
            ${input.message ? `<p><strong>Message:</strong></p><p>${input.message.replace(/\n/g, "<br/>")}</p>` : ""}
          `,
        });

        return { success: true };
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
        const applicants = await getJobApplicantsWithDetails(input.jobId);
        return { ...job, unlocked, bookingCount: bookings.length, applicantCount: applicants.length };
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
        // Paywall is based on the job owner's unlock status (not admin role bypass)
        const ownerId = job.clientUserId;
        const unlocked = await isClientJobUnlocked(ownerId, input.jobId);
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
        const unlocked = await isClientJobUnlocked(job.clientUserId, applicant.jobId);
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
        // Don't charge for unlocking a job the client already archived.
        if (user.role !== "admin" && !isJobPubliclyLive(job.requestStatus)) {
          throw new Error("This job is no longer active — reactivate it before unlocking applicants.");
        }
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
      .input(z.object({
        jobId: z.number().optional(),
        origin: z.string(),
        interval: z.enum(["month", "year"]).optional(),
        // Must start with "/" — this is interpolated straight into the Stripe
        // success_url, so an absolute URL here would be an open redirect.
        returnPath: z.string().regex(/^\/[^\/\\]/).max(512).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { url } = await createClientSubscriptionCheckoutSession({
          userId: user.id,
          email: user.email ?? undefined,
          stripeCustomerId: user.clientStripeCustomerId ?? undefined,
          origin: input.origin,
          jobId: input.jobId,
          interval: input.interval,
          returnPath: input.returnPath,
        });
        return { url };
      }),
    /** Stripe Customer Portal session so a client can manage/cancel their Premium subscription. */
    createPortalSession: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user?.clientStripeCustomerId) {
          throw new Error("No Stripe customer found. Please subscribe first.");
        }
        const { url } = await createArtistPortalSession(
          user.clientStripeCustomerId,
          `${input.origin}/app/settings?tab=subscription`
        );
        return { url };
      }),
    /** Competition Job Unlock checkout — $100 one-time per job (for Dance Competition / Event Company clients). */
    createCompetitionJobUnlockCheckout: protectedProcedure
      .input(z.object({ jobId: z.number(), jobTitle: z.string().optional(), origin: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { url, sessionId } = await createEnterpriseJobUnlockCheckoutSession({
          email: user.email ?? undefined,
          userId: user.id,
          jobId: input.jobId,
          jobTitle: input.jobTitle,
          origin: input.origin,
          stripeCustomerId: user.clientStripeCustomerId ?? null,
        });
        return { url, sessionId };
      }),

    /** Competition Subscription checkout — $250/mo or $2500/yr (for Dance Competition / Event Company clients). */
    createCompetitionSubscriptionCheckout: protectedProcedure
      .input(z.object({ interval: z.enum(["month", "year"]), jobId: z.number().optional(), origin: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const returnJobPath = input.jobId ? `/app/jobs/${input.jobId}` : "/app/jobs";
        const { url } = await createEnterpriseSubscriptionCheckoutSession({
          email: user.email ?? undefined,
          userId: user.id,
          interval: input.interval,
          origin: input.origin,
          stripeCustomerId: user.clientStripeCustomerId ?? null,
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
          amountCents: session.amount_total ?? 4000,
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


    /**
     * Confirm an artist for a job — creates a booking record.
     */
    confirmArtist: protectedProcedure
      .input(z.object({
        applicantId: z.number(),
        paymentMethod: z.enum(["artswrk", "direct"]),
        rateType: z.enum(["flat", "hourly"]).default("flat"),
        artistRateCents: z.number().int().optional(),
        hours: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        locationAddress: z.string().optional(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const applicant = await getApplicantDetail(input.applicantId);
        if (!applicant) throw new Error("Applicant not found");
        const job = await getAdminJobById(applicant.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const unlocked = user.role === "admin" || await isClientJobUnlocked(user.id, applicant.jobId);
        if (!unlocked) throw new Error("Job must be unlocked to confirm artists");
        const existing = await getBookingByApplicantId(input.applicantId);
        if (existing) return { success: true, bookingId: existing.id, alreadyConfirmed: true };
        // Store the TOTAL, not the unit rate — see the enterprise confirm above.
        const unitRate = input.artistRateCents
          ? Math.round(input.artistRateCents / 100)
          : (applicant.artistHourlyRate ?? applicant.artistFlatRate ?? null);
        const bookingHours = input.hours ?? applicant.totalHours ?? null;
        const isHourly = input.rateType === "hourly" || (!input.artistRateCents && applicant.artistHourlyRate != null);
        const artistRateDollars = unitRate !== null && isHourly && bookingHours
          ? Math.round((unitRate as number) * bookingHours)
          : unitRate;
        const clientRateDollars = artistRateDollars !== null && input.paymentMethod === "artswrk"
          ? Math.round((artistRateDollars as number) * 1.05)
          : artistRateDollars;
        const bookingId = await createBookingFromApplicant({
          jobId: applicant.jobId,
          interestedArtistId: input.applicantId,
          clientUserId: user.id,
          artistUserId: applicant.artistId,
          paymentMethod: input.paymentMethod,
          artistRate: artistRateDollars,
          clientRate: clientRateDollars,
          startDate: input.startDate ? new Date(input.startDate) : (applicant.startDate ?? null),
          endDate: input.endDate ? new Date(input.endDate) : (applicant.endDate ?? null),
          ...(await resolveJobLocation({
            locationAddress: input.locationAddress ?? job.locationAddress,
            locationLat: input.locationAddress ? undefined : job.locationLat,
            locationLng: input.locationAddress ? undefined : job.locationLng,
            locationData: input.locationData,
          })),
          description: [job.description, input.notes].filter(Boolean).join("\n\n---\n\n") || null,
        });
        if (input.hours && bookingId) {
          const { bookings: bookingsTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const { getDb } = await import("./db");
          const db2 = await getDb();
          if (db2) await db2.update(bookingsTable).set({ hours: input.hours } as any).where(eq(bookingsTable.id, bookingId));
        }
        try {
          const studioName = (user as any).clientCompanyName ?? user.name ?? "A studio";
          const jobTitle = (job.description ?? "").split("\n")[0].slice(0, 60);
          const payMethodText = input.paymentMethod === "artswrk"
            ? "Pay via Artswrk (5% processing fee)"
            : "Direct payment from studio";
          const bookingStartDate = input.startDate ?? applicant.startDate ?? null;
          const dateDisplay = bookingStartDate
            ? new Date(bookingStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "TBD";
          const locationDisplay = input.locationAddress ?? job.locationAddress ?? "TBD";
          const rateDisplay = artistRateDollars != null
            ? `$${artistRateDollars}${input.rateType === "hourly" ? "/hr" : ""}`
            : "TBD";
          const bookingUrl = `https://artswrk.com/app/bookings/${bookingId}`;
          const artistDisplayName = applicant.artistName ?? applicant.artistFirstName ?? "Artist";

          if (applicant.artistEmail) {
            await sendArtistBookingConfirmedEmail({
              to: applicant.artistEmail,
              artistName: applicant.artistFirstName ?? artistDisplayName,
              artistType: applicant.artistDisciplines ?? "",
              clientName: studioName,
              date: dateDisplay,
              details: jobTitle,
              location: locationDisplay,
              rate: rateDisplay,
              serviceType: job.serviceType || jobTitle,
              bookingUrl,
              paymentMethod: input.paymentMethod,
            });
          }
          if (user.email) {
            await sendClientBookingConfirmedEmail({
              to: user.email,
              artistName: artistDisplayName,
              artistType: applicant.artistDisciplines ?? "",
              clientName: studioName,
              date: dateDisplay,
              details: jobTitle,
              location: locationDisplay,
              rate: rateDisplay,
              serviceType: job.serviceType || jobTitle,
              bookingUrl,
              paymentMethod: input.paymentMethod,
            });
          }
        } catch (e) {
          console.error("[confirmArtist] Email send failed (non-fatal):", e);
        }
        return { success: true, bookingId, alreadyConfirmed: false };
      }),

    /** Get all confirmed bookings for a job (client Confirmed Artists tab). */
    getConfirmedArtists: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        return getConfirmedBookingsForJob(input.jobId);
      }),

    /**
     * Client self-service status control — Active / Paused / Archived.
     * Writes the raw legacy requestStatus value the simplified status maps to
     * (see shared/jobStatus.ts) so every existing status-reading query keeps
     * working unchanged; the 3-way collapse happens only in how it's read.
     */
    updateStatus: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        status: z.enum(["Active", "Paused", "Archived"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");
        const { updateAdminJob } = await import("./db");
        const { SIMPLE_STATUS_TO_RAW } = await import("../shared/jobStatus");
        await updateAdminJob(input.jobId, { requestStatus: SIMPLE_STATUS_TO_RAW[input.status] });
        return { success: true };
      }),

    /** Client self-service job edit — the general-purpose fields a studio would need to fix a typo or update details after posting. */
    update: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        title: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        locationAddress: z.string().optional(),
        locationData: locationInputSchema,
        dateType: z.enum(["Single Date", "Weekly", "Multiple Dates", "Dates Flexible", "Ongoing", "Recurring"]).optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        isHourly: z.boolean().optional(),
        openRate: z.boolean().optional(),
        artistHourlyRate: z.number().nullable().optional(),
        clientHourlyRate: z.number().nullable().optional(),
        artistFlatRate: z.number().nullable().optional(),
        clientFlatRate: z.number().nullable().optional(),
        transportation: z.boolean().optional(),
        transportationDetails: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const job = await getAdminJobById(input.jobId);
        if (!job) throw new Error("Job not found");
        if (user.role !== "admin" && job.clientUserId !== user.id) throw new Error("Access denied");

        const { jobId, locationData, startDate, endDate, ...fields } = input;
        const location = fields.locationAddress !== undefined
          ? await resolveJobLocation({ locationAddress: fields.locationAddress, locationData })
          : {};
        // startDate/endDate arrive as "YYYY-MM-DD" strings but land in Drizzle
        // timestamp columns, which call .toISOString() on whatever they're
        // given — a string threw "value.toISOString is not a function" and
        // failed the whole save. The edit form always sends both fields, so
        // this broke EVERY edit of a job that has a date, even a title-only one.
        const dates: Record<string, Date | null> = {};
        if (startDate !== undefined) dates.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) dates.endDate = endDate ? new Date(endDate) : null;
        const { updateAdminJob, getAdminJobById: refetch } = await import("./db");
        await updateAdminJob(jobId, { ...fields, ...dates, ...location });
        return refetch(jobId);
      }),
  }),
  /** Public invoice payment page — fetches booking data by token for studio payment */
  invoice: router({
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        // Check regular booking first, then admin booking periods
        const booking = await getBookingByInvoiceToken(input.token);
        if (booking) return booking;
        const period = await getBookingPeriodByInvoiceToken(input.token);
        if (!period) throw new Error("Invoice not found");
        return period;
      }),

    /**
     * Studio reviews (and optionally adjusts hours) then approves an
     * invoice — THIS is what creates the Stripe Checkout session/payment
     * link, not the artist's original submission. Public + token-scoped,
     * same trust model as getByToken. Idempotent: re-approving an
     * already-approved invoice just returns the existing checkout link
     * instead of creating a second one.
     */
    approve: publicProcedure
      .input(z.object({ token: z.string(), hours: z.number().min(0).optional() }))
      .mutation(async ({ input }) => {
        const booking = await getBookingByInvoiceToken(input.token);
        if (booking) {
          if (booking.invoicePaidAt) throw new Error("This invoice has already been paid");
          if (booking.invoiceStripeCheckoutUrl) return { checkoutUrl: booking.invoiceStripeCheckoutUrl };
          if (!booking.artistUserId) throw new Error("Booking not found");

          const connectAccountId = await getArtistStripeConnectAccount(booking.artistUserId);
          if (!connectAccountId) {
            throw new Error("The artist's payout account isn't connected yet — contact Artswrk support.");
          }

          // resolveBookingBaseAmount owns both rules this used to get wrong:
          // the stored rate is a TOTAL (never multiply it), and hourly-vs-flat
          // comes from the applicant record's real flag (never inferred from
          // `hours` being set). This is the amount actually charged to the
          // studio's card, so it must not guess. Covered by
          // shared/bookingRates.test.ts.
          const finalHours = input.hours ?? booking.hours ?? 0;
          const baseAmount = resolveBookingBaseAmount(
            {
              isHourlyRate: booking.isHourlyRate,
              storedTotal: booking.artistRate,
              unitHourlyRate: booking.artistHourlyRate,
              storedHours: booking.hours,
            },
            input.hours
          );
          const totalReimb = booking.reimbursementsTotal ?? 0;
          const processingFee = Math.round((baseAmount + totalReimb) * 0.04);
          const totalDollars = baseAmount + totalReimb + processingFee;
          const totalCents = Math.round(totalDollars * 100);
          const applicationFeeCents = Math.round(processingFee * 100);
          if (totalCents < 50) throw new Error("Total is below Stripe's minimum charge amount");

          const clientUser = booking.clientUserId ? await getUserById(booking.clientUserId) : null;
          const artist = await getUserById(booking.artistUserId);
          const artistName = artist?.name ?? artist?.firstName ?? "Artist";
          const paymentPageUrl = `${APP_URL}/invoice/${booking.invoicePaymentToken}`;
          const jobTitle = (booking.jobDescription ?? "").split("\n")[0].slice(0, 80) || `Booking #${booking.id}`;

          const stripe = getStripe();
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{
              price_data: {
                currency: "usd",
                unit_amount: totalCents,
                product_data: { name: `Payment for ${artistName}`, description: jobTitle },
              },
              quantity: 1,
            }],
            customer_email: clientUser?.email ?? undefined,
            allow_promotion_codes: true,
            payment_intent_data: {
              application_fee_amount: applicationFeeCents,
              transfer_data: { destination: connectAccountId },
            },
            metadata: {
              booking_id: String(booking.id),
              invoice_payment_token: booking.invoicePaymentToken ?? "",
              artist_id: String(booking.artistUserId),
              client_id: String(booking.clientUserId ?? ""),
              type: "artswrk_invoice",
            },
            success_url: `${paymentPageUrl}?paid=1`,
            cancel_url: paymentPageUrl,
          });
          if (!session.url) throw new Error("Could not create payment link");

          await approveArtswrkInvoice(booking.id, {
            hours: isHourlyBooking({ isHourlyRate: booking.isHourlyRate }) ? finalHours : undefined,
            invoiceStripeCheckoutUrl: session.url,
            invoiceTotalCents: totalCents,
          });

          return { checkoutUrl: session.url };
        }

        const period = await getBookingPeriodByInvoiceToken(input.token);
        if (!period) throw new Error("Invoice not found");
        if ((period as any).invoicePaidAt) throw new Error("This invoice has already been paid");
        if ((period as any).invoiceStripeCheckoutUrl) return { checkoutUrl: (period as any).invoiceStripeCheckoutUrl };

        const parentBooking = await getBookingById((period as any).bookingId);
        if (!parentBooking?.artistUserId) throw new Error("Booking not found");
        const connectAccountId = await getArtistStripeConnectAccount(parentBooking.artistUserId);
        if (!connectAccountId) {
          throw new Error("The artist's payout account isn't connected yet — contact Artswrk support.");
        }

        const finalHours = input.hours ?? (period as any).actualHours ?? 0;
        const totalReimb = (period as any).reimbursementsTotal ?? 0;
        const artistTotal = ((period as any).artistRate ?? 0) * finalHours + totalReimb;
        const clientTotal = ((period as any).clientRate ?? 0) * finalHours + totalReimb;
        const totalCents = Math.round(clientTotal * 100);
        const applicationFeeCents = Math.max(0, totalCents - Math.round(artistTotal * 100));
        if (totalCents < 50) throw new Error("Total is below Stripe's minimum charge amount");

        const clientUser = parentBooking.clientUserId ? await getUserById(parentBooking.clientUserId) : null;
        const artistName = (period as any).artistName ?? (period as any).artistFirstName ?? "Artist";
        const periodLabel = new Date((period as any).periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const paymentPageUrl = `${APP_URL}/invoice/${(period as any).invoicePaymentToken}`;

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [{
            price_data: {
              currency: "usd",
              unit_amount: totalCents,
              product_data: {
                name: `Payment for ${artistName} — ${periodLabel}`,
                description: ((period as any).jobDescription ?? "").split("\n")[0].slice(0, 80) || `Booking #${parentBooking.id}`,
              },
            },
            quantity: 1,
          }],
          customer_email: clientUser?.email ?? undefined,
          allow_promotion_codes: true,
          payment_intent_data: {
            application_fee_amount: applicationFeeCents,
            transfer_data: { destination: connectAccountId },
          },
          metadata: {
            booking_period_id: String((period as any).id),
            invoice_payment_token: (period as any).invoicePaymentToken ?? "",
            artist_id: String(parentBooking.artistUserId),
            client_id: String(parentBooking.clientUserId ?? ""),
            type: "admin_booking_period",
          },
          success_url: `${paymentPageUrl}?paid=1`,
          cancel_url: paymentPageUrl,
        });
        if (!session.url) throw new Error("Could not create payment link");

        await approveBookingPeriodInvoice((period as any).id, {
          actualHours: finalHours,
          invoiceStripeCheckoutUrl: session.url,
          invoiceTotalCents: totalCents,
        });

        return { checkoutUrl: session.url };
      }),
  }),

  /** Admin Bookings — created directly by admin, not tied to job/applicant */
  adminBookings: router({
    create: protectedProcedure
      .input(z.object({
        artistUserId: z.number().int(),
        clientUserId: z.number().int(),
        artistRateDollars: z.number().min(0),
        clientRateDollars: z.number().min(0),
        startDate: z.string(),
        endDate: z.string(),
        isRecurring: z.boolean().default(false),
        recurringCadence: z.enum(["weekly", "biweekly", "monthly", "quarterly"]).optional(),
        locationAddress: z.string().optional(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden");
        const bookingId = await createAdminBooking({
          ...input,
          ...(await resolveJobLocation(input)),
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        });

        // Notify artist + client of new booking
        const artist = await getUserById(input.artistUserId);
        const client = await getUserById(input.clientUserId);
        const { sendSimpleEmail } = await import("./email");
        if (artist?.email) {
          await sendSimpleEmail({
            to: artist.email,
            subject: "New Artswrk Booking",
            html: `<p>Hi ${artist.firstName ?? "there"},</p><p>You have a new ${input.isRecurring ? "recurring" : "one-time"} booking${(client as any)?.clientCompanyName ? ` with ${(client as any).clientCompanyName}` : ""}.</p><p>Rate: $${input.artistRateDollars}/hr · Start: ${new Date(input.startDate).toLocaleDateString()}</p><p><a href="https://artswrk.com/app/bookings">View in your dashboard</a></p><p>Best,<br/>The Artswrk Team</p>`,
          }).catch(() => {});
        }
        return { bookingId };
      }),

    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden");
        return listAdminBookings(input);
      }),

    detail: protectedProcedure
      .input(z.object({ bookingId: z.number().int() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden");
        const detail = await getAdminBookingDetail(input.bookingId);
        if (!detail) throw new Error("Booking not found");
        return detail;
      }),

    triggerNotifications: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden");
        const due = await getDuePeriods();
        const { sendSimpleEmail: _sendPeriodNotif } = await import("./email");
        let sent = 0;
        for (const period of due) {
          try {
            const periodLabel = new Date(period.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" });
            if (period.artistEmail) {
              await _sendPeriodNotif({
                to: period.artistEmail,
                subject: `Time to submit your hours — ${periodLabel}`,
                html: `<p>Hi ${period.artistFirstName ?? "there"},</p><p>It's time to log your hours and submit reimbursements for <strong>${periodLabel}</strong>.</p><p>Rate: $${period.artistRate}/hr${period.clientCompanyName ? ` · Client: ${period.clientCompanyName}` : ""}</p><p><a href="https://artswrk.com/app/bookings" style="background:#F25722;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Submit Hours →</a></p><p>Best,<br/>The Artswrk Team</p>`,
              });
            }
            await markPeriodNotified(period.id);
            sent++;
          } catch (e) {
            console.error(`[triggerNotifications] Period ${period.id} failed:`, e);
          }
        }
        return { sent, total: due.length };
      }),
  }),

  /** Booking Periods — artist-facing submission flow */
  bookingPeriods: router({
    /** Artist submits hours for a period → generates client invoice */
    submit: protectedProcedure
      .input(z.object({
        periodId: z.number().int(),
        actualHours: z.number().min(0),
        artistNotes: z.string().optional(),
        origin: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user as any;
        const period = await getBookingPeriodById(input.periodId);
        if (!period) throw new Error("Period not found");

        const booking = await getBookingById(period.bookingId);
        if (!booking) throw new Error("Booking not found");
        if (booking.artistUserId !== user.id) throw new Error("Not authorized");

        // Every payout must land in the artist's own connected Stripe account —
        // never let an invoice go out (and get paid) with nowhere for the money to go.
        const connectAccountId = await getArtistStripeConnectAccount(user.id);
        if (!connectAccountId) {
          throw new Error("Connect your Stripe payout account before invoicing a studio. Go to Settings → Manage Payouts.");
        }

        const reimbList = await getReimbursementsByPeriodId(input.periodId);
        const totalReimb = reimbList.reduce((s: number, r: any) => s + (r.value ?? 0), 0);
        const artistRatePerHour = booking.artistRate ?? 0;
        const clientRatePerHour = booking.clientRate ?? 0;

        // No processing fee for admin bookings — client pays clientRate spread only.
        // The platform's cut is the rate spread itself (clientTotal - artistTotal).
        const artistTotal = artistRatePerHour * input.actualHours + totalReimb;
        const clientTotal = clientRatePerHour * input.actualHours + totalReimb;
        const totalCents = Math.round(clientTotal * 100);
        const applicationFeeCents = Math.max(0, totalCents - Math.round(artistTotal * 100));

        const { randomBytes } = await import("crypto");
        const invoicePaymentToken = randomBytes(24).toString("hex");

        const origin = input.origin ?? "https://artswrk.com";
        const paymentPageUrl = `${origin}/invoice/${invoicePaymentToken}`;

        // No checkout session yet — created once the studio reviews and
        // approves (invoice.approve), same as the regular booking flow above.
        await submitBookingPeriod(input.periodId, {
          actualHours: input.actualHours,
          artistNotes: input.artistNotes,
          invoicePaymentToken,
          invoiceTotalCents: totalCents,
        });

        // Email client to review
        const clientUser = booking.clientUserId ? await getUserById(booking.clientUserId) : null;
        if (clientUser?.email) {
          const periodLabel = new Date(period.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          const artistName = (user.name ?? (`${user.firstName ?? ""} ${(user as any).lastName ?? ""}`.trim())) || "Your artist";
          const { sendSimpleEmail: _sendClientInvoice } = await import("./email");
          await _sendClientInvoice({
            to: clientUser.email,
            cc: "support@artswrk.com",
            subject: `Invoice ready for review — ${artistName} (${periodLabel})`,
            html: `<p>Hi ${(clientUser as any).clientCompanyName ?? clientUser.firstName ?? "there"},</p><p>${artistName} has submitted their hours for <strong>${periodLabel}</strong> — ready for your review.</p><p><strong>Estimated total: $${(totalCents / 100).toFixed(2)}</strong>${totalReimb > 0 ? ` (incl. $${totalReimb.toFixed(2)} reimbursements)` : ""}</p><p>If the hours need adjusting, you can update them on the review page before paying.</p><p><a href="${paymentPageUrl}" style="background:#F25722;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Review Invoice →</a></p><p>Best,<br/>The Artswrk Team</p>`,
          }).catch(() => {});
        }

        return { invoicePaymentToken };
      }),

    /** Get periods for a booking (artist or admin can call) */
    getForBooking: protectedProcedure
      .input(z.object({ bookingId: z.number().int() }))
      .query(async ({ input, ctx }) => {
        const user = ctx.user as any;
        const booking = await getBookingById(input.bookingId);
        if (!booking) throw new Error("Booking not found");
        const isAdmin = user.openId === ENV.ownerOpenId || user.role === "admin";
        const isParty = booking.artistUserId === user.id || booking.clientUserId === user.id;
        if (!isAdmin && !isParty) throw new Error("Not authorized");
        return getBookingPeriodById(input.bookingId);
      }),

    /** Artist or client gets their admin bookings */
    myAdminBookings: protectedProcedure
      .query(async ({ ctx }) => {
        const user = ctx.user as any;
        const isArtist = (user.planTier ?? "").startsWith("artist_");
        if (isArtist) return getArtistAdminBookings(user.id);
        return getClientAdminBookings(user.id);
      }),
  }),

  /** Saved artists (client favorites) */
  savedArtists: router({
    mySaved: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) return [];
      return getSavedArtistsByClientId(user.id);
    }),
    toggle: protectedProcedure
      .input(z.object({ artistUserId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        return toggleSavedArtist(user.id, input.artistUserId);
      }),
  }),

  /** Company / Studio page — editable by client, viewable publicly */
  companies: router({
    /** Get the logged-in user's company data (for dashboard editor) */
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new Error("User not found");
      return getPublicCompanyPage(user.id);
    }),

    /** Save edits to the company record */
    update: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(256),
        description: z.string().max(2000).optional().nullable(),
        logo: z.string().max(1024).optional().nullable(),
        website: z.string().max(512).optional().nullable(),
        locationAddress: z.string().max(512).optional().nullable(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { locationData, ...rest } = input;
        // Only touch location columns when the form actually sent an address —
        // otherwise an unrelated edit would wipe the company's coordinates.
        const location = input.locationAddress !== undefined
          ? await resolveJobLocation({ locationAddress: input.locationAddress, locationData })
          : {};
        await upsertClientCompany(user.id, { ...rest, ...location });
        return { ok: true };
      }),

    /** List all companies owned by the logged-in user */
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new Error("User not found");
      const companies = await getClientCompaniesByUserId(user.id);
      return { companies };
    }),

    /** Upload a logo image for a specific company */
    uploadLogo: protectedProcedure
      .input(z.object({
        id: z.number(),
        base64: z.string(),
        contentType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const buf = Buffer.from(input.base64, "base64");
        const ext = input.contentType.split("/")[1] ?? "jpg";
        const { url } = await storagePut(
          `company-logos/${user.id}-${input.id}-${Date.now()}.${ext}`,
          buf,
          input.contentType
        );
        await updateClientCompanyById(input.id, user.id, { logo: url });
        return { url };
      }),

    /** Update a specific company by id (must be owned by logged-in user) */
    updateById: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(256),
        description: z.string().max(2000).optional().nullable(),
        logo: z.string().max(1024).optional().nullable(),
        website: z.string().max(512).optional().nullable(),
        locationAddress: z.string().max(512).optional().nullable(),
        transportReimbursed: z.boolean().optional().nullable(),
        transportDetails: z.string().max(500).optional().nullable(),
        /** Structured Google Places data for the address above. */
        locationData: locationInputSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        const { id, locationData, ...data } = input;
        const location = input.locationAddress !== undefined
          ? await resolveJobLocation({ locationAddress: input.locationAddress, locationData })
          : {};
        await updateClientCompanyById(id, user.id, { ...data, ...location });
        return { ok: true };
      }),

    /** Public page data — accessible without auth */
    getPublicPage: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getPublicCompanyPage(input.userId);
      }),

    /**
     * Browse Companies — artist-facing studio directory. PRO-only: gives PRO
     * artists visibility into the studios hiring on Artswrk (name, location,
     * description, transport info). Basic/free artists get a locked response
     * so the client can render an upgrade prompt instead of the real data.
     */
    browse: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(48),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        /** Location text from the Places field — city-matched. */
        locationQuery: z.string().optional(),
        /** Coordinates of the selected place — enables true radius search. */
        locationLat: z.number().optional(),
        locationLng: z.number().optional(),
        radiusMiles: z.number().min(1).max(1000).optional(),
      }))
      .query(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        if ((user as any).planTier !== "artist_pro") {
          return { locked: true as const, companies: [], total: 0 };
        }
        const result = await getClientCompaniesList({
          limit: input.limit,
          offset: input.offset,
          search: input.search || undefined,
          locationQuery: input.locationQuery || undefined,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          radiusMiles: input.radiusMiles,
        });
        return { locked: false as const, ...result };
      }),
  }),

  /** Benefits / Partner perks — filtered by audience type */
  benefits: router({
    list: protectedProcedure
      .input(z.object({ audienceType: z.enum(["Artist", "Client"]) }))
      .query(async ({ input, ctx }) => {
        const viewer = await getUserById(ctx.user.id);
        const planTier = (viewer as any)?.planTier as string | undefined;
        const isEnterprise = !!planTier?.startsWith("enterprise_");
        // Enterprise accounts never qualify for Client benefits — there
        // simply aren't any partner benefits for that tier today, regardless
        // of on-demand vs. subscription billing status. Full exclusion, no
        // teaser either: an enterprise account never sees this exists.
        if (isEnterprise) return { locked: true as const, enterprise: true as const, benefits: [] };

        const eligible = input.audienceType === "Artist"
          ? planTier === "artist_pro"
          : planTier === "client_premium";
        const rows = await getBenefits(input.audienceType);
        const mapped = rows.map((b) => ({
          id: b.id,
          companyName: b.companyName ?? "",
          logoUrl: b.logoUrl ?? null,
          url: b.url ?? null,
          businessDescription: b.businessDescription ?? null,
          discountOffering: b.discountOffering ?? null,
          categories: (() => { try { return JSON.parse(b.categories ?? "[]") as string[]; } catch { return [] as string[]; } })(),
          audienceTypes: (() => { try { return JSON.parse(b.audienceTypes ?? "[]") as string[]; } catch { return [] as string[]; } })(),
        }));

        if (!eligible) {
          // Teaser mode — the whole point is to make free/basic/on-demand
          // accounts want to upgrade. Show them exactly what they're missing
          // (who the partner is, what the offer is), but never the redemption
          // code — that's the one thing this endpoint must never leak to
          // someone who hasn't actually paid for it. No `url` either, so
          // there's no way to click through to a partner's redeem page and
          // fish the code out some other way.
          return {
            locked: true as const,
            enterprise: false as const,
            // howToRedeem and url are the only things withheld. That is enough
            // because the codes now live in howToRedeem where they belong —
            // four partners had them written into discountOffering, which is
            // the teaser copy every free account sees, and that data was fixed
            // rather than papered over at render time.
            benefits: mapped.map((b) => ({ ...b, url: null, howToRedeem: null })),
          };
        }

        return {
          locked: false as const,
          enterprise: false as const,
          benefits: mapped.map((b, i) => ({ ...b, howToRedeem: rows[i].howToRedeem ?? null })),
        };
      }),

    /** Admin: paginated, searchable list of every benefit (no audience filter). */
    adminList: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getBenefitsAdminList } = await import("./db");
        return getBenefitsAdminList({ limit: input.limit, offset: input.offset, search: input.search || undefined });
      }),

    adminGetById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { getBenefitById } = await import("./db");
        return getBenefitById(input.id);
      }),

    /**
     * Upload a benefit's logo and get back a hosted URL.
     *
     * Deliberately not tied to a benefit id: the admin form needs to accept a
     * logo while ADDING a benefit, before any row exists. The caller drops the
     * returned URL into the form and it saves with everything else.
     */
    adminUploadLogo: protectedProcedure
      .input(z.object({
        base64: z.string().max(8 * 1024 * 1024),
        contentType: z.string().default("image/png"),
        filename: z.string().max(200).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(input.contentType)) {
          throw new Error("Logos must be an image (png, jpg, gif, webp or svg).");
        }
        const { storagePut } = await import("./storage");
        const buf = Buffer.from(input.base64, "base64");
        const ext = (input.contentType.split("/")[1] ?? "png").replace("+xml", "");
        const safe = (input.filename ?? "logo").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60);
        const { url } = await storagePut(
          `benefit-logos/${Date.now()}-${safe}.${ext}`,
          buf,
          input.contentType
        );
        return { url };
      }),

    adminCreate: protectedProcedure
      .input(z.object({
        companyName: z.string().min(1).max(256),
        logoUrl: z.string().max(1024).optional().nullable(),
        url: z.string().max(1024).optional().nullable(),
        businessDescription: z.string().max(2000).optional().nullable(),
        discountOffering: z.string().max(500).optional().nullable(),
        howToRedeem: z.string().max(2000).optional().nullable(),
        contactName: z.string().max(256).optional().nullable(),
        contactEmail: z.string().max(320).optional().nullable(),
        audienceTypes: z.array(z.string()).optional(),
        businessTypes: z.array(z.string()).optional(),
        artistTypes: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { createBenefit } = await import("./db");
        const id = await createBenefit(input);
        return { id };
      }),

    adminUpdate: protectedProcedure
      .input(z.object({
        id: z.number(),
        companyName: z.string().min(1).max(256),
        logoUrl: z.string().max(1024).optional().nullable(),
        url: z.string().max(1024).optional().nullable(),
        businessDescription: z.string().max(2000).optional().nullable(),
        discountOffering: z.string().max(500).optional().nullable(),
        howToRedeem: z.string().max(2000).optional().nullable(),
        contactName: z.string().max(256).optional().nullable(),
        contactEmail: z.string().max(320).optional().nullable(),
        audienceTypes: z.array(z.string()).optional(),
        businessTypes: z.array(z.string()).optional(),
        artistTypes: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { updateBenefit } = await import("./db");
        const { id, ...data } = input;
        await updateBenefit(id, data);
        return { ok: true };
      }),

    adminDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new Error("Forbidden: admin only");
        const { deleteBenefit } = await import("./db");
        await deleteBenefit(input.id);
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
