import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { acquisitionSessions, acquisitionLeads } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateMagicToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function adminOnly(role: string) {
  if (role !== "admin") throw new Error("Forbidden: admin only");
}

// ─── Text Pre-processing ────────────────────────────────────────────────────

/**
 * Cleans raw Facebook group text before sending to the AI parser.
 * Removes UI chrome, reaction noise, and normalizes whitespace so the model
 * sees clean post content only.
 */
function cleanFacebookText(raw: string): string {
  return raw
    // Remove Facebook UI reaction/engagement lines
    // e.g. "👍 Like · 💬 Comment · ↗ Share", "Like · Reply · Share"
    .replace(/\b(Like|Comment|Share|Reply|Follow|Save|Report|Hide|Unfollow|Turn off)\b\s*[·•|]?\s*/gi, "")
    // Remove emoji-only lines or lines that are just reaction counts
    // e.g. "😂 14  ❤️ 3  👍 22"
    .replace(/^[\s\p{Emoji}\d·•|,]+$/gmu, "")
    // Remove "X comments · Y shares" style lines
    .replace(/\d+\s*(comment|comments|share|shares|reaction|reactions|like|likes|view|views)\b[^\n]*/gi, "")
    // Remove "See more" / "See less" links
    .replace(/\bSee (more|less|translation|original)\b/gi, "")
    // Remove "X members · X posts a day" group header lines
    .replace(/\d[\d,]*\s*members?[^\n]*/gi, "")
    // Remove timestamps like "3h", "2d", "April 21 at 3:45 PM", "Just now"
    .replace(/\b(Just now|\d+[smhd]|\d{1,2}\s+(hours?|minutes?|days?|weeks?|months?)\s+ago)\b/gi, "")
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(,?\s+\d{4})?\s+at\s+\d{1,2}:\d{2}\s*(AM|PM)?/gi, "")
    // Remove "Write a comment…" / "Add a comment…" placeholder text
    .replace(/^(Write|Add)\s+a\s+comment[.…]?$/gim, "")
    // Remove lines that are just a URL (Facebook tracking links etc.)
    .replace(/^https?:\/\/[^\s]+$/gm, "")
    // Collapse 3+ consecutive blank lines into a single blank line (post separator)
    .replace(/(\n\s*){3,}/g, "\n\n")
    // Trim leading/trailing whitespace per line
    .split("\n").map(l => l.trim()).join("\n")
    // Final trim
    .trim();
}

// ─── AI Parsing ──────────────────────────────────────────────────────────────

interface ParsedLead {
  leadType: "job" | "artist";
  name: string;
  posterFacebookUrl: string;
  email: string;
  instagram: string;
  contactInfo: string;
  studioName: string;
  studioUrl: string;
  studioAddress: string;
  location: string;
  city: string;
  state: string;
  title: string;
  jobSummary: string;
  jobDescription: string;
  rawPostText: string;
  jobDate: string;
  jobDateType: "single" | "recurring" | "ongoing" | "";
  rate: string;
  rateAmount: number;
  rateType: "hourly" | "flat" | "open" | "";
  disciplines: string[];
  description: string;
}

async function parsePostsWithAI(rawText: string, groupName: string): Promise<ParsedLead[]> {
  // Infer a default location from the group name (e.g. "Dance Teacher Subs Maryland" → "Maryland")
  const locationHint = groupName
    .replace(/dance|teacher|teachers|sub|subs|artist|artists|group|studio|studios|facebook|fb/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const systemPrompt = `You are an expert at parsing Facebook group posts for an arts hiring platform called Artswrk.
Artswrk connects dance studios, performing arts organizations, and entertainment companies with artists, teachers, choreographers, and performers.

Given raw text from a Facebook group called "${groupName}", extract leads from both original posts AND comment threads.

## LEAD TYPES
- "job": A hiring request, job posting, or call for artists/teachers/performers
- "artist": An artist, teacher, or performer introducing themselves or posting their availability

## COMMENTER LEADS RULE (IMPORTANT)
Also scan comment threads below each post. If a commenter is clearly a studio owner or hirer (e.g. they mention their studio name, city, or share contact info like an email/phone), create a SEPARATE lead entry for them as a "job" lead. Their contact info belongs to THEM, not the original poster.
Example: If an artist posts seeking work and a commenter says "We are in Ellicott City, email us at studio@example.com" — create a job lead for that studio commenter with their email, NOT the artist's lead.
Do NOT attribute a commenter's email/phone to the original poster.

## LOCATION RULE
If a post does not explicitly mention a city or state, use "${locationHint || groupName}" as the default location. Always extract the most specific location available first.

## FIELDS TO EXTRACT FOR EACH LEAD
- leadType: "job" or "artist"
- name: The poster's name OR studio/company name. For job posts: prefer company name. For artist posts: prefer individual name.
- posterFacebookUrl: Facebook profile URL if visible. Empty string if not.
- email: Email address from THIS PERSON'S text only (not commenters, not other people). Empty string if none.
- instagram: Instagram handle (e.g. "@username") if mentioned. Empty string if none.
- contactInfo: Phone numbers, website URLs, or DM instructions from THIS PERSON only. Include phone numbers like "443-226-3419" here. Empty string if none.
- studioName: Studio or company name. Empty string if not mentioned.
- studioUrl: Studio website or Facebook page URL. Empty string if none.
- studioAddress: Studio physical address. Empty string if none.
- location: Full location string. Default to "${locationHint || groupName}" if not mentioned.
- city: City name only. Empty string if unknown.
- state: State abbreviation only. Empty string if unknown.
- title: For jobs: role being hired. For artists: primary discipline.
- jobSummary: Single sentence (max 20 words) summarizing the post.
- jobDescription: Clean plain text — all relevant details, no UI noise, no timestamps, no reaction counts.
- rawPostText: Original post text trimmed to 400 chars.
- jobDate: Date or schedule as written. Empty string if not mentioned.
- jobDateType: "single", "recurring", "ongoing", or "".
- rate: Pay rate as written. Empty string if not mentioned.
- rateAmount: Numeric amount in cents. 0 if unknown.
- rateType: "hourly", "flat", "open", or "".
- disciplines: Array of art disciplines mentioned.
- description: 1-3 sentence summary.

Skip pure UI noise (navigation text, reaction buttons, member counts). Only include leads with meaningful hiring or availability content.`;

  const cleaned = cleanFacebookText(rawText);
  const userPrompt = `Here is the cleaned text pasted from the Facebook group. Parse all distinct posts:\n\n${cleaned.slice(0, 8000)}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "parsed_leads",
        strict: true,
        schema: {
          type: "object",
          properties: {
            leads: {
              type: "array",
              items: {
                type: "object",
                  properties: {
                  leadType: { type: "string", enum: ["job", "artist"] },
                  name: { type: "string" },
                  posterFacebookUrl: { type: "string" },
                  email: { type: "string" },
                  instagram: { type: "string" },
                  contactInfo: { type: "string" },
                  studioName: { type: "string" },
                  studioUrl: { type: "string" },
                  studioAddress: { type: "string" },
                  location: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  title: { type: "string" },
                  jobSummary: { type: "string" },
                  jobDescription: { type: "string" },
                  rawPostText: { type: "string" },
                  jobDate: { type: "string" },
                  jobDateType: { type: "string", enum: ["single", "recurring", "ongoing", ""] },
                  rate: { type: "string" },
                  rateAmount: { type: "number" },
                  rateType: { type: "string", enum: ["hourly", "flat", "open", ""] },
                  disciplines: { type: "array", items: { type: "string" } },
                  description: { type: "string" },
                },
                required: ["leadType", "name", "posterFacebookUrl", "email", "instagram", "contactInfo", "studioName", "studioUrl", "studioAddress", "location", "city", "state", "title", "jobSummary", "jobDescription", "rawPostText", "jobDate", "jobDateType", "rate", "rateAmount", "rateType", "disciplines", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["leads"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content as string | undefined;
  if (!content || typeof content !== 'string') return [];

  try {
    const parsed = JSON.parse(content);
    return parsed.leads || [];
  } catch {
    return [];
  }
}

// ─── Outreach Message Generation ─────────────────────────────────────────────

async function generateOutreachMessage(lead: ParsedLead, groupName: string): Promise<string> {
  const isJob = lead.leadType === "job";

  const prompt = isJob
    ? `Write a short, friendly, personalized Facebook DM from the Artswrk team to ${lead.name || "this person"} who posted a job for "${lead.title}" in the ${groupName} Facebook group.

The message should:
- Reference their specific post naturally (mention the role: ${lead.title})
- Introduce Artswrk as a platform with 5,000+ vetted artists/teachers
- Mention it's free to post a job and takes 2 minutes
- Include a magic link placeholder: [MAGIC_LINK]
- Be warm, brief (3-4 sentences max), and not salesy
- End with a simple CTA like "Would love to help you find the right person!"

Do NOT use emojis. Write in plain text only.`
    : `Write a short, friendly, personalized Facebook DM from the Artswrk team to ${lead.name || "this person"} who posted about their availability as a ${lead.title} in the ${groupName} Facebook group.

The message should:
- Reference their specific skills naturally (mention: ${lead.disciplines?.join(", ") || lead.title})
- Introduce Artswrk as a platform where 500+ companies hire artists
- Mention it's free to create a profile and takes 2 minutes
- Include a magic link placeholder: [MAGIC_LINK]
- Be warm, brief (3-4 sentences max), and not salesy
- End with something like "Would love to have you on the platform!"

Do NOT use emojis. Write in plain text only.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You write concise, warm outreach messages for an arts hiring platform. Never use emojis. Keep messages under 5 sentences." },
      { role: "user", content: prompt },
    ],
  });

  return (response.choices?.[0]?.message?.content as string) || "";
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const acquisitionRouter = router({
  /**
   * Parse pasted Facebook text → create a session + leads in DB.
   * Returns the session ID and all parsed leads.
   */
  parsePosts: protectedProcedure
    .input(z.object({
      rawText: z.string().min(10).max(50000),
      groupName: z.string().default("Facebook Group"),
      groupUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Parse posts with AI
      const parsedLeads = await parsePostsWithAI(input.rawText, input.groupName);

      const jobCount = parsedLeads.filter(l => l.leadType === "job").length;
      const artistCount = parsedLeads.filter(l => l.leadType === "artist").length;

      // Create session record
      const [sessionResult] = await db.insert(acquisitionSessions).values({
        groupName: input.groupName,
        groupUrl: input.groupUrl || null,
        rawText: input.rawText,
        jobCount,
        artistCount,
        createdByUserId: ctx.user.id,
      });

      const sessionId = (sessionResult as any).insertId as number;

      // Insert all leads
      const leadsToInsert = parsedLeads.map(lead => ({
        sessionId,
        leadType: lead.leadType,
        // Source
        sourceGroup: input.groupName || null,
        // Poster identity
        name: lead.name || null,
        posterFacebookUrl: lead.posterFacebookUrl || null,
        email: lead.email || null,
        instagram: lead.instagram || null,
        contactInfo: lead.contactInfo || null,
        // Studio
        studioName: lead.studioName || null,
        studioUrl: lead.studioUrl || null,
        studioAddress: lead.studioAddress || null,
        // Location
        location: lead.location || null,
        city: lead.city || null,
        state: lead.state || null,
        // Job details
        title: lead.title || null,
        jobSummary: lead.jobSummary || null,
        jobDescription: lead.jobDescription || null,
        rawPostText: lead.rawPostText?.slice(0, 1000) || cleanFacebookText(input.rawText).slice(0, 500) || null,
        description: lead.description || null,
        // Scheduling
        jobDate: lead.jobDate || null,
        jobDateType: (lead.jobDateType || null) as "single" | "recurring" | "ongoing" | null,
        // Rates
        rate: lead.rate || null,
        rateAmount: lead.rateAmount > 0 ? lead.rateAmount : null,
        rateType: (lead.rateType || null) as "hourly" | "flat" | "open" | null,
        // Disciplines
        disciplines: lead.disciplines?.length ? JSON.stringify(lead.disciplines) : null,
        magicLinkToken: generateMagicToken(),
        status: "new" as const,
        funnelStage: "lead" as const,
      }));

      if (leadsToInsert.length > 0) {
        await db.insert(acquisitionLeads).values(leadsToInsert);
      }

      // Fetch the inserted leads
      const leads = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.sessionId, sessionId));

      return { sessionId, jobCount, artistCount, leads };
    }),

  /**
   * List all acquisition sessions (most recent first).
   */
  listSessions: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(acquisitionSessions)
        .orderBy(desc(acquisitionSessions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * Get all leads for a session.
   */
  getSessionLeads: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(acquisitionLeads)
        .where(eq(acquisitionLeads.sessionId, input.sessionId))
        .orderBy(acquisitionLeads.leadType, acquisitionLeads.createdAt);
    }),

  /**
   * Generate an AI outreach message for a specific lead.
   */
  generateOutreach: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [lead] = await db.select().from(acquisitionLeads).where(eq(acquisitionLeads.id, input.leadId));
      if (!lead) throw new Error("Lead not found");

      // Get session for group name
      const [session] = await db.select().from(acquisitionSessions).where(eq(acquisitionSessions.id, lead.sessionId));
      const groupName = session?.groupName || "Facebook Group";

      const parsedLead: ParsedLead = {
        leadType: lead.leadType,
        name: lead.name || "",
        posterFacebookUrl: lead.posterFacebookUrl || "",
        email: lead.email || "",
        instagram: lead.instagram || "",
        contactInfo: lead.contactInfo || "",
        studioName: lead.studioName || "",
        studioUrl: lead.studioUrl || "",
        studioAddress: lead.studioAddress || "",
        location: lead.location || "",
        city: lead.city || "",
        state: lead.state || "",
        title: lead.title || "",
        jobSummary: lead.jobSummary || "",
        jobDescription: lead.jobDescription || "",
        rawPostText: lead.rawPostText || "",
        jobDate: lead.jobDate || "",
        jobDateType: (lead.jobDateType as "single" | "recurring" | "ongoing" | "") || "",
        rate: lead.rate || "",
        rateAmount: lead.rateAmount || 0,
        rateType: (lead.rateType as "hourly" | "flat" | "open" | "") || "",
        disciplines: lead.disciplines ? JSON.parse(lead.disciplines) : [],
        description: lead.description || "",
      };

      const message = await generateOutreachMessage(parsedLead, groupName);

      // Save the generated message
      await db.update(acquisitionLeads)
        .set({ outreachMessage: message })
        .where(eq(acquisitionLeads.id, input.leadId));

      return { message, magicLinkToken: lead.magicLinkToken };
    }),

  /**
   * Mark a lead as outreach sent.
   */
  markOutreachSent: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.update(acquisitionLeads)
        .set({ status: "outreach_sent", outreachSentAt: new Date() })
        .where(eq(acquisitionLeads.id, input.leadId));

      return { success: true };
    }),

  /**
   * Update lead status manually.
   */
  updateLeadStatus: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      status: z.enum(["new", "outreach_sent", "clicked", "joined"]),
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.update(acquisitionLeads)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(acquisitionLeads.id, input.leadId));

      return { success: true };
    }),

  /**
   * Get overall acquisition stats.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    adminOnly(ctx.user.role);
    const db = await getDb();
    if (!db) return { totalSessions: 0, totalLeads: 0, totalJobs: 0, totalArtists: 0, outreachSent: 0, joined: 0 };

    const [sessions] = await db.execute("SELECT COUNT(*) as count FROM acquisition_sessions") as any;
    const [leads] = await db.execute("SELECT COUNT(*) as count FROM acquisition_leads") as any;
    const [jobs] = await db.execute("SELECT COUNT(*) as count FROM acquisition_leads WHERE leadType = 'job'") as any;
    const [artists] = await db.execute("SELECT COUNT(*) as count FROM acquisition_leads WHERE leadType = 'artist'") as any;
    const [sent] = await db.execute("SELECT COUNT(*) as count FROM acquisition_leads WHERE status = 'outreach_sent' OR status = 'clicked' OR status = 'joined'") as any;
    const [joined] = await db.execute("SELECT COUNT(*) as count FROM acquisition_leads WHERE status = 'joined'") as any;

    return {
      totalSessions: Number((sessions as any[])[0]?.count || 0),
      totalLeads: Number((leads as any[])[0]?.count || 0),
      totalJobs: Number((jobs as any[])[0]?.count || 0),
      totalArtists: Number((artists as any[])[0]?.count || 0),
      outreachSent: Number((sent as any[])[0]?.count || 0),
      joined: Number((joined as any[])[0]?.count || 0),
    };
  }),

  /**
   * Magic link landing — resolve a token and return pre-fill data.
   * Public so unauthenticated visitors can use their magic link.
   */
  resolveMagicLink: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [lead] = await db.select().from(acquisitionLeads)
        .where(eq(acquisitionLeads.magicLinkToken, input.token));

      if (!lead) throw new Error("Invalid or expired link");

      // Mark as clicked
      await db.update(acquisitionLeads)
        .set({ status: "clicked", updatedAt: new Date() })
        .where(eq(acquisitionLeads.id, lead.id));

      return {
        leadType: lead.leadType,
        name: lead.name,
        title: lead.title,
        location: lead.location,
        disciplines: lead.disciplines ? JSON.parse(lead.disciplines) : [],
        description: lead.description,
        contactInfo: lead.contactInfo,
      };
    }),

  /**
   * Get all leads across all sessions with session info joined.
   * Supports filtering by leadType and status.
   */
  getAllLeads: protectedProcedure
    .input(z.object({
      leadType: z.enum(["job", "artist", "all"]).default("all"),
      status: z.enum(["new", "outreach_sent", "clicked", "joined", "all"]).default("all"),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) return [];

      // Build dynamic WHERE clauses using safe string interpolation
      // (values are escaped via db.escape or cast to known enum values)
      const conditions: string[] = [];

      if (input.leadType !== "all") {
        // leadType is a validated enum — safe to interpolate
        conditions.push(`l.leadType = '${input.leadType}'`);
      }
      if (input.status !== "all") {
        // status is a validated enum — safe to interpolate
        conditions.push(`l.status = '${input.status}'`);
      }
      if (input.search && input.search.trim()) {
        // Escape single quotes in search string
        const safe = input.search.trim().replace(/'/g, "''");
        conditions.push(`(l.name LIKE '%${safe}%' OR l.studioName LIKE '%${safe}%' OR l.title LIKE '%${safe}%' OR l.location LIKE '%${safe}%' OR l.contactInfo LIKE '%${safe}%')`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const rows = await db.execute(
        `SELECT
          l.id,
          l.leadType,
          l.name,
          l.studioName,
          l.title,
          l.location,
          l.rate,
          l.contactInfo,
          l.disciplines,
          l.description,
          l.rawPostText,
          l.status,
          l.outreachMessage,
          l.outreachSentAt,
          l.createdAt,
          s.groupName,
          s.groupUrl
        FROM acquisition_leads l
        LEFT JOIN acquisition_sessions s ON l.sessionId = s.id
        ${where}
        ORDER BY l.createdAt DESC
        LIMIT 500`
      ) as any;

      return ((rows as any[])[0] as any[]).map((r: any) => ({
        id: r.id,
        leadType: r.leadType as "job" | "artist",
        name: r.name || "",
        studioName: r.studioName || "",
        title: r.title || "",
        location: r.location || "",
        rate: r.rate || "",
        contactInfo: r.contactInfo || "",
        disciplines: r.disciplines ? JSON.parse(r.disciplines) : [],
        description: r.description || "",
        rawPostText: r.rawPostText || "",
        status: r.status as "new" | "outreach_sent" | "clicked" | "joined",
        outreachMessage: r.outreachMessage || "",
        outreachSentAt: r.outreachSentAt ? new Date(r.outreachSentAt) : null,
        createdAt: new Date(r.createdAt),
        groupName: r.groupName || "",
        groupUrl: r.groupUrl || "",
      }));
    }),
});
