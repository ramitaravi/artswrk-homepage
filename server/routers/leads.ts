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
import { getUserByEmail } from "../db";

// ── Admin guard ───────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
  }
  return next({ ctx });
});

/** Wrap Brevo errors with a friendly message */
function brevoError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Brevo API unavailable: ${msg}`,
  });
}

// ── Router ────────────────────────────────────────────────────────────────────
export const leadsRouter = router({
  // Overview KPIs
  getOverview: adminProcedure.query(async () => {
    try {
      return await getOverviewStats();
    } catch (e) {
      brevoError(e);
    }
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
      let brevoResult: Awaited<ReturnType<typeof getContacts>>;
      try {
        brevoResult = await getContacts(input);
      } catch (e) {
        brevoError(e);
      }
      // Cross-reference emails against Artswrk user DB (one at a time to avoid missing export)
      const enriched = await Promise.all(
        brevoResult.contacts.map(async (c: any) => {
          if (!c.email) return { ...c, artswrkUser: null };
          try {
            const artswrkUser = await getUserByEmail(c.email);
            return {
              ...c,
              artswrkUser: artswrkUser
                ? {
                    id: artswrkUser.id,
                    userRole: artswrkUser.userRole,
                    name: artswrkUser.name,
                    profilePicture: artswrkUser.profilePicture,
                    clientCompanyName: artswrkUser.clientCompanyName,
                    lastSignedIn: artswrkUser.lastSignedIn,
                    createdAt: artswrkUser.createdAt,
                  }
                : null,
            };
          } catch {
            return { ...c, artswrkUser: null };
          }
        })
      );
      return { ...brevoResult, contacts: enriched };
    }),

  // Single contact detail + email history
  getContact: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      try {
        const [contact, history] = await Promise.all([
          getContactByEmail(input.email),
          getContactEmailHistory(input.email, 30),
        ]);
        if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
        return { contact, history };
      } catch (e) {
        if (e instanceof TRPCError) throw e;
        brevoError(e);
      }
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
      try {
        return await getLists(input);
      } catch (e) {
        brevoError(e);
      }
    }),

  // Single list detail
  getList: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        return await getListById(input.id);
      } catch (e) {
        brevoError(e);
      }
    }),

  // Create a new list
  createList: adminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      try {
        return await createList(input.name);
      } catch (e) {
        brevoError(e);
      }
    }),

  // Delete a list
  deleteList: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await deleteList(input.id);
        return { success: true };
      } catch (e) {
        brevoError(e);
      }
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
      try {
        return await getCampaigns(input);
      } catch (e) {
        brevoError(e);
      }
    }),

  // Single campaign detail
  getCampaign: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        return await getCampaignById(input.id);
      } catch (e) {
        brevoError(e);
      }
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
      let result: Awaited<ReturnType<typeof getMergedUnsubscribes>>;
      try {
        result = await getMergedUnsubscribes(input.limit);
      } catch (e) {
        brevoError(e);
      }
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
      try {
        const [brevoOk, sgOk] = await Promise.all([
          addBrevoUnsubscribe(input.email),
          addSendGridUnsubscribe(input.email),
        ]);
        return { brevoOk, sgOk };
      } catch (e) {
        brevoError(e);
      }
    }),

  // Sync gaps: push Brevo-only emails to SendGrid and vice versa
  syncUnsubscribes: adminProcedure.mutation(async () => {
    try {
      return await syncSuppressionGaps();
    } catch (e) {
      brevoError(e);
    }
  }),
});
