/**
 * Leads Dashboard — tRPC router
 * All procedures are admin-only (adminProcedure).
 * Brevo API calls are proxied through server/brevo.ts.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getContacts,
  getContactByEmail,
  getContactEmailHistory,
  getLists,
  getListById,
  createList,
  deleteList,
  getCampaigns,
  getCampaignById,
  getOverviewStats,
} from "../brevo";

// ── Admin guard ───────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
  }
  return next({ ctx });
});

// ── Router ────────────────────────────────────────────────────────────────────
export const leadsRouter = router({
  // Overview KPIs
  getOverview: adminProcedure.query(async () => {
    return getOverviewStats();
  }),

  // Contacts list (paginated + optional email search + optional listId filter)
  getContacts: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
        email: z.string().optional(),
        listId: z.number().optional(),
        sort: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      return getContacts(input);
    }),

  // Single contact detail + email history
  getContact: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const [contact, history] = await Promise.all([
        getContactByEmail(input.email),
        getContactEmailHistory(input.email, 30),
      ]);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
      return { contact, history };
    }),

  // Lists (paginated)
  getLists: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        sort: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      return getLists(input);
    }),

  // Single list detail
  getList: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getListById(input.id);
    }),

  // Create a new list
  createList: adminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      return createList(input.name);
    }),

  // Delete a list
  deleteList: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteList(input.id);
      return { success: true };
    }),

  // Campaigns (paginated + optional status filter)
  getCampaigns: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
        status: z
          .enum(["sent", "draft", "queued", "archive", "inProcess"])
          .optional(),
        sort: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      return getCampaigns(input);
    }),

  // Single campaign detail
  getCampaign: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getCampaignById(input.id);
    }),
});
