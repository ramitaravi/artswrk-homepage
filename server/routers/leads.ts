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
import {
  getMergedUnsubscribes,
  addBrevoUnsubscribe,
  addSendGridUnsubscribe,
  syncSuppressionGaps,
} from "../suppressions";
import { getUsersByEmails } from "../db";

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
  // Cross-references each contact against the Artswrk user DB to show artist/client status.
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
      const brevoResult = await getContacts(input);
      // Cross-reference emails against Artswrk user DB
      const emails = brevoResult.contacts.map((c: any) => c.email).filter(Boolean);
      const userMap = await getUsersByEmails(emails);
      const enriched = brevoResult.contacts.map((c: any) => {
        const artswrkUser = c.email ? userMap.get(c.email.toLowerCase()) : undefined;
        return {
          ...c,
          artswrkUser: artswrkUser
            ? {
                id: artswrkUser.id,
                userRole: artswrkUser.userRole,   // "Artist" | "Client" | "Admin" | null
                name: artswrkUser.name,
                profilePicture: artswrkUser.profilePicture,
                clientCompanyName: artswrkUser.clientCompanyName,
                lastSignedIn: artswrkUser.lastSignedIn,
                createdAt: artswrkUser.createdAt,
              }
            : null,
        };
      });
      return { ...brevoResult, contacts: enriched };
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

  // ── Suppression / Unsubscribes ──────────────────────────────────────────────

  // Get merged unsubscribe list from Brevo + SendGrid
  getUnsubscribes: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(2000).default(500),
        search: z.string().optional(),
        filter: z.enum(["all", "both", "brevo_only", "sendgrid_only"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const result = await getMergedUnsubscribes(input.limit);
      let contacts = result.contacts;

      // Apply source filter
      if (input.filter === "both") {
        contacts = contacts.filter((c) => c.sources === "both");
      } else if (input.filter === "brevo_only") {
        contacts = contacts.filter((c) => c.sources === "brevo");
      } else if (input.filter === "sendgrid_only") {
        contacts = contacts.filter((c) => c.sources === "sendgrid");
      }

      // Apply search
      if (input.search) {
        const q = input.search.toLowerCase();
        contacts = contacts.filter((c) => c.email.includes(q));
      }

      return {
        contacts,
        total: contacts.length,
        brevoCount: result.brevoCount,
        sendgridCount: result.sendgridCount,
        bothCount: result.bothCount,
        onlyBrevoCount: result.onlyBrevoCount,
        onlySendGridCount: result.onlySendGridCount,
      };
    }),

  // Add a single email to both Brevo and SendGrid suppressions
  addUnsubscribe: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const [brevoOk, sgOk] = await Promise.all([
        addBrevoUnsubscribe(input.email),
        addSendGridUnsubscribe(input.email),
      ]);
      return { brevoOk, sgOk };
    }),

  // Sync gaps: push Brevo-only emails to SendGrid and vice versa
  syncUnsubscribes: adminProcedure.mutation(async () => {
    return syncSuppressionGaps();
  }),
});
