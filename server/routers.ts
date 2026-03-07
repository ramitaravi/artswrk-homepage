import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAllUsers, getUserByBubbleId, getUserByEmail } from "./db";
import { sdk } from "./_core/sdk";
import { z } from "zod";

// Demo credentials — maps email → Bubble ID for seeded test accounts
const DEMO_ACCOUNTS: Record<string, { bubbleId: string; password: string }> = {
  "nick+ferrari@artswrk.com": {
    bubbleId: "1659533883431x527826980339748400",
    password: "ArtswrkDemo2024",
  },
};

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    /**
     * Demo login — creates a real JWT session for a seeded Bubble user.
     * Only works for accounts in DEMO_ACCOUNTS; safe to leave in for testing.
     */
    demoLogin: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const demo = DEMO_ACCOUNTS[input.email.toLowerCase()];
        if (!demo || demo.password !== input.password) {
          throw new Error("Invalid credentials");
        }

        const user = await getUserByBubbleId(demo.bubbleId);
        if (!user) {
          throw new Error("Demo user not found in database");
        }

        // Create a real JWT session token using the user's openId
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.firstName || "Demo User",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
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
