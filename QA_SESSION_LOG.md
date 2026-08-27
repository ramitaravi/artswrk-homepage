# Artswrk QA Session Log

A chronological record of this QA session — what was reported, what was found, and what was fixed. For the flat checkable bug list, see [QA_CHECKLIST.md](QA_CHECKLIST.md); this document preserves the actual back-and-forth.

---

## Round 0 — Setting up the process

Set up the QA workflow: a shared `QA_CHECKLIST.md` tracker in the repo (organized into lanes by app area, pulled from the real routes in `App.tsx` since `SITEMAP.md` was stale — it was missing ~25 pages), plus a running Bugs Log. Agreed approach: manual QA via screenshots pasted in chat, one continuous thread (not per-page agents) so shared-code fixes carry forward automatically instead of being rediscovered per page.

## Round 1 — Login broken sitewide

**Reported:** Login failing with a raw SQL error dump (`Failed query: select id, openId, bubbleId...`).

**Found:** `Unknown column 'bubbleSourcePresent'` — the local MySQL database was missing 14 recent migrations. Root cause: local dev was pointed at a stale local database instead of the live one.

**Fixed:** Reconnected local dev to the live Manus/TiDB database using the connection string from Manus's Database panel. Confirmed working via live login test.

## Round 2 — Artist dashboard (`/app`) first pass

**Reported:** Titles inconsistent, malformed locations, inconsistent avatars, "For You" fallback logic questions, and a real discrepancy — the PRO Jobs strip showed completely different jobs between the local build and the live site.

**Found & fixed:**
- PRO jobs listed in random order — 3 queries were sorting by `createdAt` (sync-insert timestamp, frozen at first sync) instead of `bubbleCreatedAt` (true post date). Fixed all 3, verified the corrected order now matches the live site exactly.
- Job locations showed raw street addresses instead of "City, ST" — a `formatLocation()` helper already existed and was used on 6 other pages, just missing on the dashboard. Wired in.
- Avatar fallback was flat grey instead of the brand gradient on one component (`SquareAvatar`) while a sibling component (`StudioAvatar`) had it right — unified.
- The "Jobs PRO" strip stayed visible even when PRO jobs were already shown as the primary feed below it (when there aren't 2+ nearby jobs) — now hides in that case.
- Titles that were full run-on sentences pulled straight from Bubble instead of short titles — built a shared `getJobTitle()` helper (pattern-matching fallback: "Tap Teacher", "Hip Hop Instructor", etc.) to replace duplicated, weaker logic across 4 files.

## Round 3 — Jobs page (`/jobs`, `/app/jobs`)

**Reported:** Job count wrong (200 shown vs. 512 vs. an expected ~206), Artist Type / Service Type filters not narrowing results, applications not clickable, apply-page issues.

**Found & fixed:**
- Hard 200-job pagination cap was silently truncating the browse list — raised both client and server limits.
- Filter status logic was wrong: querying `requestStatus IN ('Active', 'Submissions Paused')` when the real Bubble app only shows `Active` (verified directly against your Bubble editor screenshots), and wasn't excluding `direct` jobs. Fixed — count now matches the true Active count exactly (241), and a specific missing job (Mount Pleasant "Ballet Teacher") was confirmed to reappear.
- Artist Type / Service Type filters were doing fuzzy keyword-matching against job description text instead of using the real structured ID fields (`bubbleArtistTypeId`, `masterServiceTypeId`) — confirmed those fields exist and are populated for ~85% of jobs; switched to exact-ID matching.
- Regular application cards in the Applications tab weren't clickable (PRO ones were) — inconsistency, fixed.
- Apply page: submit button was clickable with nothing filled in; fixed-rate jobs incorrectly still asked artists to pitch their own rate. Both fixed.
- Consolidated all 4 job-card layouts (Near Me, PRO, Applications, PRO Applications) into one shared `JobListCard.tsx` component — spacing matched to the Benefits page per your call ("that spacing is perfect").
- Later: dashboard "Jobs for You" feed wasn't personalized by the artist's own declared artist/service types, unlike Bubble's real list filter. Implemented and verified live (214/241 jobs pass for a real account; the 27 excluded genuinely have a mismatched type).

## Round 4 — Artist profile pages (public + your own)

**Reported:** Raw ID strings appearing as badges, broken Instagram link, missing social-links section on your own profile, empty-state issues, review avatars broken, booking counts inconsistent between pages.

**Found & fixed:**
- The "weird string" badges (e.g. `1652795286947x398019932738813950`) were raw Bubble internal IDs from the `masterArtistTypes` field, being merged directly into the visible chip list next to the already-clean `workTypes` field — on 3 different pages. Dropped the raw IDs.
- Instagram field sometimes holds a full pasted URL instead of a handle (your own account included) — old code blindly prepended "@", producing a broken link. Built `normalizeInstagram()` to handle URL / @handle / plain-handle input correctly.
- Your own profile (`/app/profile`) never rendered a social-links section at all — added one, with "+ Add X" placeholders for empty fields.
- Affiliations section showed "No affiliations added yet" instead of just hiding when empty — fixed.
- Reviewer avatar fallback used generic grey instead of the client/hirer gradient (reviewers are studios, not artists) — fixed, and separately, a broken avatar image URL was rendering a broken-image icon instead of falling back gracefully — added the missing `onError` handler.
- Booking count differs between `/book/:slug` (cached DB column) and `/app/profile` (live Bubble API call) — explained as deliberate, not a bug; flagged as your call on which should be canonical.

## Round 5 — Edit Profile modal

**Reported:** Unchecking "List on Profile" for a service didn't seem to do anything; resume upload/preview questions.

**Found & fixed:**
- 3-part bug: the public Services query never actually filtered by the "List on Profile" flag at all; separately, the edit modal never read back your saved toggle state on reopen — it silently reset every toggle to "on" each time. Both fixed, plus the same gap for "Job Emails."
- Confirmed a real architecture bug: a resume uploaded during a job application and one uploaded via Edit Profile lived in two completely disconnected database tables. The editor's own copy ("will autosave to your profile") wasn't true. Wired both upload paths to write to both stores.
- Added resume preview (opens in a new tab) — didn't exist before.

## Round 6 — Stripe Connect

**Reported:** Need artist payout onboarding (Bubble screenshots of the Connect flow as reference).

**Found:** This already existed end-to-end and closely matched the Bubble reference — OAuth Standard/Individual flow, real callback route, and a "Manage Payouts" UI with both connect and already-connected states. Fixed one real bug found while verifying: the manage-payouts Stripe client was pinned to a stale 2023 API version.

## Round 7 — Job detail page redesign

**Reported (with Bubble screenshots as reference):** Applied state should move from a dominant top box to match the PRO job page's pattern; needed a full submitted-application summary; Date/Location/Rate needed a cleaner labeled breakdown with a map link.

**Built:**
- Compact "Applied" chip near the top; full summary (rate, resume link, message) in a new section after the description — mirroring the already-working PRO job page pattern. Added a `jobs.checkApplication` query to fetch it.
- Date/Location/Rate rebuilt as a labeled details card, with a working Google Maps link on Location.
- Follow-up requests: removed the (now redundant) top "Applied" chip, removed a leftover "team will be in touch" line, fixed "Dates Flexible" jobs showing a fake specific date, made "Back to Jobs" route to the Applications tab when the job you're viewing is one you've already applied to.

## Round 8 — Post Job flow (as a studio/client)

**Reported:** Needed a place for company profile pictures, wanted Google location autocomplete, explicit concern about "AI" language in copy given audience sensitivity, Sponsor Listing section needed honesty/copy fixes, and a direct question — does boosting actually work?

**Found & fixed:**
- Verified boosting is real and accurate: Stripe payment confirmation correctly sets `isBoosted`/`boostEndDate`, and both job feeds genuinely sort active-boosted jobs to the top.
- "Ad Performance" showed fabricated precise numbers (`Est. artists reached: 5,320+`, computed from an arbitrary ×38 multiplier) — replaced with the same honest qualitative tier indicator already correctly used elsewhere in the app. Updated bullet copy to your suggested wording, added a "🎉 Job Posted!" confirmation, dropped an unverifiable "boosted across social/email" claim since no code implements it.
- Swept every user-facing "AI" mention sitewide (homepage, SEO landing pages, the exact "AI-parsed location" warning from your screenshot) and reworded to describe the outcome without naming the mechanism.
- Studio page (`/studio/:userId`) card spacing fixed.
- Flagged but not built: the studio page mashes a client's multiple companies into one page's "Locations" list, which is conceptually wrong (they're different companies, not branches). Asked for direction on the target model — not yet resolved.

## Round 9 — The big one: company data was broken at the root

**Reported (URGENT):** "My Jobs" showed jobs that weren't for the same company, and switching company tabs appeared to change every job's company.

**Found:** The `jobs` table had **no link to companies at all** — only who posted it personally (`clientUserId`). The company picker on Post Job already tracked your selection client-side, it just silently never reached the server or got stored anywhere. Every card was displaying whichever company tab happened to be selected in the UI, not its own actual company.

**Fixed:** Added a real `jobs.clientCompanyId` column via migration, backfilled 3,461 existing jobs from their legacy Bubble company reference, wired both job-creation mutations to store it going forward, and updated **all 6** places across the app that resolve a job's poster (job detail, public browse, dashboard feed, applications list, admin, and the studio page) to join through it correctly. Old test jobs from before this fix have no recoverable company data — can't be back-assigned.

## Round 10 — Applicant management (as a client viewing an application)

**Reported:** Missing new-applicant email, applicant not appearing on My Jobs, cosmetic issues (stray "0", "Job ID" clutter), wanted a Share button, requested the applicant/job page feel more like an ATS, wanted artist cards to match the PRO applicant page style, noticed raw ID strings again on applicant tags, and a long list of confirm-modal requests (prefill everything from the job, hide the rate toggle when the rate is fixed, gate "Pay Directly" behind Artswrk payroll onboarding, friendlier processing-fee copy, block confirming with missing required fields, auto-land on the Confirmed tab when one exists).

**Found & fixed:**
- The new-applicant email had two bugs: hardcoded to always send to the internal team inbox regardless of who the client actually was (a pre-launch safety guard that outlived its purpose), and using an older, plainer template instead of the polished one already built for PRO jobs — which is exactly what your reference screenshot showed. Fixed both; now sends to the real client with the correct template.
- My Jobs had no applicant count anywhere, which is why a real new application looked like it "didn't show up" — added a real per-job count.
- The raw-ID bug showed up again in a different place: the applicant-detail SQL query literally does `u.masterArtistTypes AS artistDisciplines` — aliasing the raw-ID column as if it were the clean one. Found and fixed in all 3 places this exact alias bug existed.
- Removed the Job ID row, greyed the message box for visual separation, and applied a best-effort fix for the stray "0" (traced to a boost-status flag likely not coming back as a real boolean from a raw SQL query — couldn't 100% confirm without live login access).
- Bookings list was sorting by the event's scheduled date instead of when it was actually booked, so the most recent booking looked buried — fixed to sort by booking creation time.
- **Explicitly not yet built:** the full ATS-style redesign, artist-card style unification with the PRO applicant page, and the full confirm-modal prefill/validation batch (rate/date/location/description pulling from the job, payment method defaults, blocking incomplete confirmations) — flagged as a real backlog rather than rushed.

## Round 11 — Booking & payment flow (in progress / paused)

**Reported:** Bookings page needs a real detail page (none exists), booked artists should get an email + task notification, hours weren't being confirmed at booking time (which breaks payment accuracy), the paid-via-Artswrk/paid-directly toggle looks wrong and the artist-side flow is buggy ("arbitrary number of hours"), artists shouldn't see the processing fee, need an invoice-submitted summary view, studio needs an invoice email, and — a bigger admission — **there is no studio-side payment-processing flow built yet.**

**Status:** Started building a `getClientBookingDetail` query and a `bookings.clientDetail` tRPC endpoint for a real booking detail page (previously nonexistent — "Details" was just an inline expand toggle). Paused here: this list crosses from bug-fixing into building real money-handling infrastructure that doesn't exist yet, on top of an already large backlog from Round 10. Checked in rather than guessing at payment architecture — session ended before this was resumed.

---

*43 items tracked as fixed/verified in [QA_CHECKLIST.md](QA_CHECKLIST.md); the interactive checklist is at the punch-list artifact shared in chat.*
