import bcrypt from "bcryptjs";
import { COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { acquisitionRouter } from "./acquisitionRouter";
import { artistProfileRouter } from "./artistProfileRouter";
import { bubbleRouter } from "./bubbleRouter";
import { getAllUsers, getUserByBubbleId, getUserByEmail, setUserPassword, getUserById, getUserByOpenId, getJobsByUserId, getJobStatsByUserId, getPublicJobs, getPublicJobsEnriched, getJobDetailById, getArtistJobApplications, getInterestedArtistsByClientId, getApplicantStatsByClientId, getApplicantsByJobId, getBookingsByClientId, getBookingStatsByClientId, getBookingsByJobId, getBookingById, getBookingByInterestedArtistId, getPaymentsByClientId, getPaymentStatsByClientId, getWalletStatsByClientId, getPendingPaymentsByClientId, getConversationsByClientId, getMessagesByConversationId, getMessageStatsByClientId, getArtistById, getArtistHistoryForClient, createJob, activateJob, saveClientStripeCustomerId, saveClientSubscriptionId, createNewUser, updateUserOnboarding, activateBoost, getJobById, getArtistsList, getAdminOverviewStats, getAdminArtists, getAdminClients, getAdminJobs, getAdminBookings, getAdminPayments, getPremiumJobsByUserId, getPremiumJobById, getAllPremiumJobs, getPremiumJobInterestedArtists, getPremiumInterestedArtistsByCreatorId, getEnterpriseClients, getClientCompaniesByUserId, createPremiumJob, getArtistJobsFeed, getArtistProJobsFeed, getArtistProApplications, getArtistBookings, getArtistPayments } from "./db";
import { invokeLLM } from "./_core/llm";
import { createJobPostCheckoutSession, createSubscriptionCheckoutSession, createBoostCheckoutSession, getStripe } from "./stripe";
import { calcBoostTotal } from "./stripe-products";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { z } from "zod";

const SALT_ROUNDS = 12;

export const appRouter = router({
  system: systemRouter,
  acquisition: acquisitionRouter,
  artistProfile: artistProfileRouter,
  bubble: bubbleRouter,

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

        return {
          success: true,
          isTemporary: user.passwordIsTemporary ?? true,
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

        // Clear the backup cookie
        ctx.res.clearCookie(ADMIN_SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

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
- dateType: "Single Date" | "Ongoing" | "Recurring" (infer from context)
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
                  dateType: { type: "string", enum: ["Single Date", "Ongoing", "Recurring"] },
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
     * Create a draft job and return the job ID + Stripe checkout URL.
     * Requires authentication.
     */
    createAndCheckout: protectedProcedure
      .input(z.object({
        description: z.string().min(10),
        locationAddress: z.string().optional(),
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        dateType: z.enum(["Single Date", "Ongoing", "Recurring"]).default("Single Date"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        isHourly: z.boolean().default(true),
        openRate: z.boolean().default(false),
        clientHourlyRate: z.number().optional(),
        clientFlatRate: z.number().optional(),
        transportation: z.boolean().default(false),
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
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await updateUserOnboarding(user.id, input);
        return { success: true };
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
    getJobApplicants: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
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
        return { applicants };
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
        return { success: true, jobId };
      }),
  }),
  // ── Artswrk user queries ─────────────────────────────────────────────────────────────────
  artistDashboard: router({
    /** Get public jobs feed for artist dashboard */
    getJobsFeed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(30), offset: z.number().min(0).default(0) }))
      .query(async ({ input }) => {
        return getArtistJobsFeed(input.limit, input.offset);
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
});

export type AppRouter = typeof appRouter;
