import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAllUsers, getUserByBubbleId, getUserByEmail, setUserPassword, getUserById, getUserByOpenId, getJobsByUserId, getJobStatsByUserId, getPublicJobs, getInterestedArtistsByClientId, getApplicantStatsByClientId, getApplicantsByJobId, getBookingsByClientId, getBookingStatsByClientId, getBookingsByJobId, getBookingById, getBookingByInterestedArtistId, getPaymentsByClientId, getPaymentStatsByClientId, getWalletStatsByClientId, getPendingPaymentsByClientId, getConversationsByClientId, getMessagesByConversationId, getMessageStatsByClientId } from "./db";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { z } from "zod";

const SALT_ROUNDS = 12;

export const appRouter = router({
  system: systemRouter,

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
        // Only the owner can set passwords
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }

        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user) {
          throw new Error(`No user found with email: ${input.email}`);
        }

        const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
        await setUserPassword(user.id, hash, input.isTemporary);

        return {
          success: true,
          message: `Password set for ${user.email} (${user.firstName || user.name || "user"})`,
          isTemporary: input.isTemporary,
        };
      }),

    /**
     * List all users — admin only.
     */
    listUsers: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        return getAllUsers(input.limit, input.offset);
      }),

    /**
     * Get a single user by ID — admin only.
     */
    getUser: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
          throw new Error("Forbidden: admin only");
        }
        return getUserById(input.id);
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
  }),

  // ── Applicants (Interested Artists) ────────────────────────────────────────
  applicants: router({
    /**
     * Get all applicants for the currently logged-in client.
     */
    myApplicants: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
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

  // ── Artswrk user queries ────────────────────────────────────────────────────
  artswrkUsers: router({
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
