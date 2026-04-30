# Session Handoff — Apr 30, 2026

## What Was Completed This Session

### 1. Premium Client Bypass (checkpoint: 0a319973)
- All 5 server-side unlock checks now skip the paywall for premium clients
- Procedures: `getJob`, `getApplicants`, `getApplicantDetail`, `messageApplicant`, `confirmArtist`

### 2. Messaging Error Fix + Confirm Artist on Detail Page (checkpoint: 376fe7dc)
- Fixed crash in `getOrCreateConversation` — MySQL insertId fallback added
- Added "Confirm Artist" button directly on the applicant detail/profile view

### 3. Confirmed Jobs → Bookings Tab (checkpoint: d702d37f)
- Artist Bookings tab now shows real confirmed jobs (was sample data)
- Removed redundant "Confirmations" nav item from sidebar
- `/app/confirmations` redirects to `/app/bookings`

### 4. Invoice Payment Flow (checkpoint: 515ab703)
- Artist submits invoice → Stripe Checkout session created → studio gets payment email
- Email matches the Artswrk design: booking details + "Continue to Payment →" button
- Public `/invoice/:token` page for studios to review and pay
- Stripe webhook marks booking as paid + emails artist confirmation
- New DB columns: `invoicePaymentToken`, `invoiceStripeCheckoutUrl`, `invoiceTotalCents`, `invoicePaidAt`, `invoiceStripePaymentIntentId`

### 5. Facebook Leads Tab (checkpoint: c36ac8d3 → 3abd44b0)
- Moved Acquisition tab from Admin to Leads dashboard as "Facebook Leads"
- Fixed missing `studioName` column migration (was causing All Leads list to fail)
- Added `sourceGroup` dropdown and `funnelStage` tracking

### 6. Expanded Acquisition Leads Schema (checkpoint: dc6188e0)
- Added 17 new columns: `posterFacebookUrl`, `email`, `instagram`, `city`, `state`, `studioUrl`, `studioAddress`, `rateAmount`, `rateType`, `jobDate`, `jobDateType`, `jobSummary`, `jobDescription`, `sourceGroup`, `funnelStage`, `convertedJobId`, `notes`
- Updated AI parser prompt to extract all new fields
- Added `cleanFacebookText()` pre-processing step to strip Facebook UI noise before AI parsing

### 7. GitHub Sync (checkpoint: 15a0f753)
- All changes pushed to GitHub remote

---

## What Is IN PROGRESS (Not Yet Built)

### Facebook Leads Enrichment — the big one
The user wants a fully enriched internal lead tool. Here's exactly what needs to be built:

#### A. DB Schema Changes Needed
Add these columns to `acquisition_leads` in `drizzle/schema.ts`:
```ts
aiNote: text("ai_note"),                    // AI-generated note per lead
teamNotes: text("team_notes"),              // Free-text editable by team
matchedUserId: int("matched_user_id"),      // FK → users.id if email/name match found
matchConfidence: varchar("match_confidence", { length: 20 }), // "exact_email" | "possible_name" | null
```
Then run `pnpm db:push`.

#### B. AI Parser Updates (server/acquisitionRouter.ts)
The system prompt was already updated to handle commenter studio leads. Still needs:

1. **`aiNote` generation** — add a field to the JSON schema output:
   ```
   aiNote: A short internal note for the Artswrk team. Include:
   - Contact quality: does this lead have email? phone? Instagram?
   - Any notable highlights (e.g. "SYTYCD contestant", "full season hire", "has website")
   - Missing info callouts (e.g. "No email found — check comments or DM")
   - Source type (original post vs commenter lead)
   ```

2. **Commenter leads** — prompt was updated but not yet tested end-to-end. The key rule: if a commenter mentions their studio + contact info, create a SEPARATE job lead for them. Do NOT attribute their email to the original poster.

3. **Phone number extraction** — update `contactInfo` field description to explicitly say "include phone numbers like 443-226-3419"

4. **Tighten text cleaner** — the `cleanFacebookText()` function still lets through short scrambled strings like `mahi6`, `itg40`, `ctf144f`. Add this to the cleaner:
   ```ts
   // Remove Facebook's obfuscated timestamp/metadata tokens (alphanumeric, 4-8 chars, no spaces)
   .replace(/^[a-zA-Z]{1,4}\d{1,6}[a-zA-Z0-9]*$/gm, "")
   ```

#### C. User Match Check (server/acquisitionRouter.ts — parseAndSavePosts procedure)
After AI parsing, for each lead, run a match check against the `users` table:
```ts
// Exact email match
if (lead.email) {
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, lead.email) });
  if (existingUser) {
    matchedUserId = existingUser.id;
    matchConfidence = "exact_email";
  }
}
// Fuzzy name + state match (if no email match)
if (!matchedUserId && lead.name && lead.state) {
  const nameMatch = await db.query.users.findFirst({
    where: and(
      like(users.name, `%${lead.name.split(" ")[0]}%`), // first name match
      eq(users.state, lead.state) // same state
    )
  });
  if (nameMatch) {
    matchedUserId = nameMatch.id;
    matchConfidence = "possible_name";
  }
}
```

#### D. Backend: updateTeamNotes procedure
Add to `acquisitionRouter.ts`:
```ts
updateTeamNotes: adminProcedure
  .input(z.object({ leadId: z.number(), notes: z.string() }))
  .mutation(async ({ input }) => {
    await db.update(acquisitionLeads)
      .set({ teamNotes: input.notes })
      .where(eq(acquisitionLeads.id, input.leadId));
    return { success: true };
  }),
```

#### E. Frontend: Enriched Lead Card UI (client/src/pages/leads/Acquisition.tsx or a new component)
The All Leads list currently shows a basic table. Replace with **expandable lead cards** showing:

**Card header (always visible):**
- Lead type badge (JOB / ARTIST) with color
- Name (bold)
- 🟢 **EMAIL** — highlighted in green/orange, most prominent field. If no email: show "No email" in red
- Location (city, state)
- Funnel stage badge
- Match indicator: "✅ On Site" (exact email match) or "⚠️ Possible Match" (name match) with link to user profile

**Card expanded view (click to expand):**
- AI Note (styled as an internal callout box, light yellow background)
- Team Notes (editable textarea with save button)
- All extracted fields in a clean grid:
  - Studio Name + URL (clickable)
  - Instagram handle (clickable)
  - Phone/Contact Info
  - Rate + Rate Type
  - Job Date + Date Type
  - Disciplines (tags)
  - Job Summary
  - Job Description (full)
  - Raw Post Text (collapsed/expandable)
  - Source Group
  - Created At

**Match section (if matchedUserId exists):**
- Show matched user's name, profile photo, role, and a "View Profile" link to `/app/artist/:id` or `/app/client/:id`

---

## Key Files to Know

| File | What it does |
|---|---|
| `server/acquisitionRouter.ts` | All Facebook Leads backend logic — AI parser, save, update |
| `drizzle/schema.ts` | DB schema — `acquisitionLeads` table is around line 694 |
| `client/src/pages/leads/Acquisition.tsx` | The frontend paste + leads UI |
| `client/src/pages/leads/LeadsFacebook.tsx` | Thin wrapper that renders Acquisition in LeadsLayout |
| `client/src/components/LeadsLayout.tsx` | Leads dashboard sidebar nav |

---

## TypeScript Errors to Fix
The TSC watch shows ~34 errors related to invoice payment columns. These are from `server/db.ts` referencing `bookings.invoicePaidAt`, `bookings.artswrkInvoiceSubmittedAt`, and `bookings.invoicePaymentToken` which exist in the DB but may have a schema type mismatch. Run `npx tsc --noEmit` to get the exact list and fix them.

---

## How to Resume
1. Open this project in Manus
2. Say: "Resume the Facebook Leads enrichment work from the handoff notes"
3. The agent will read this file and pick up exactly where we left off

Last checkpoint: **dc6188e0** (GitHub synced at 15a0f753)
