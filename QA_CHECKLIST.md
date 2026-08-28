# QA Checklist — 4-Day Push

How this works: you browse the live site, screenshot anything broken/off, and paste it in chat.
**Just tell me the page name (or route) from the list below** — I'll find the file, fix it, and check
it off. No need to describe the bug in detail if the screenshot shows it clearly; a route + "this
looks wrong" is enough.

Status marks: `[ ]` not reviewed · `[~]` reviewed, issue(s) logged below · `[x]` reviewed, clean

---

## Lane 1 — Public / Marketing

- [ ] `/` — Home
- [ ] `/about` — About
- [ ] `/enterprise` — Enterprise landing
- [ ] `/dance-competitions` — DanceCompetitions
- [ ] `/dance-studios` — DanceStudios
- [ ] `/acrobatic-arts` — AcrobaticArts
- [ ] `/music-schools` — MusicSchools
- [ ] `/dance-teachers` — DanceTeachers
- [ ] `/dance-judges` — DanceJudges
- [ ] `/music-teachers` — MusicTeachers
- [ ] `/production` — Production
- [ ] `/terms` — Terms
- [ ] `/privacy-policy` — PrivacyPolicy
- [ ] `/cancellation-policy` — CancellationPolicy
- [ ] `/404` — NotFound

## Lane 2 — Jobs, Apply & Public Profiles

- [~] `/jobs` — Jobs board (Near Me / PRO / Applications tabs)
- [ ] `/jobs/:jobSlug` (+ legacy `/jobs/:locationSlug/:legacyJobSlug`) — JobDetail
- [~] `/jobs/:jobSlug/apply` — ApplyPage
- [ ] `/pro` — Public PRO jobs list
- [ ] `/pro/:jobSlug` — ProJobDetail
- [ ] `/browse` — BrowseArtists (public directory)
- [ ] `/book/:slug` — PublicArtistProfile
- [ ] `/studio/:userId` — PublicCompanyPage

## Lane 3 — Auth, Signup & Onboarding

- [ ] `/login` — Login
- [ ] `/forgot-password` — ForgotPassword
- [ ] `/reset-password` — ResetPassword
- [ ] `/join` — Join (role picker)
- [ ] `/join/artist` — ArtistJoin
- [ ] `/client-onboarding` — ClientOnboarding
- [ ] `/artist-onboarding` — ArtistOnboarding
- [ ] `/post-job` — PostJob (AI parse → Stripe checkout)
- [ ] `/post-job/success` — PostJob confirmation
- [ ] `/invoice/:token` — InvoicePayment

## Lane 4 — Artist Dashboard (`/app/*` logged in as artist)

- [~] `/app` — Artist overview (jobs feed, bookings, affiliations)
- [ ] `/app/jobs` + `/app/jobs/:jobId` — Job feed / detail
- [ ] `/app/pro-jobs` — PRO job board
- [ ] `/app/bookings` — Bookings
- [ ] `/app/payments` — Earnings / pending
- [ ] `/app/messages` — Inbox
- [ ] `/app/profile` — Artist public profile (view + edit)
- [ ] `/app/settings` — ArtistSettings / ArtistSettingsPlan
- [ ] `/app/community` — Community
- [ ] `/app/benefits` — Benefits

## Lane 5 — Client Dashboard (`/app/*` logged in as client) + Enterprise

- [ ] `/app` — Client overview (Overview.tsx — stats, applicants)
- [ ] `/app/jobs` + `/app/jobs/:jobId` — DashJobs / ClientJobDetail
- [ ] `/app/bookings` — Bookings (confirmed)
- [ ] `/app/payments` — Billing + wallet
- [ ] `/app/messages` — Client messages
- [ ] `/app/artists` + `/app/artists/:artistId` — Artist directory / profile
- [ ] `/app/company` — CompanyPage
- [ ] `/app/lists` — SubLists
- [ ] `/app/settings` — Settings
- [ ] `/enterprise` (logged in) + `/enterprise/:jobId` + `/enterprise/messages` — Enterprise dashboard

## Lane 6 — Admin & Leads (internal)

- [ ] `/admin-dashboard` (legacy `/admin`) — Admin: users, jobs, payments, overview
- [ ] Admin → Acquisition tab
- [ ] `/leads` — LeadsOverview
- [ ] `/leads/facebook` — LeadsFacebook
- [ ] `/leads/contacts` — LeadsContacts
- [ ] `/leads/lists` — LeadsLists
- [ ] `/leads/campaigns` — LeadsCampaigns
- [ ] `/leads/unsubscribes` — LeadsUnsubscribes
- [ ] `/leads/crm` — LeadsCRM

---

## Bugs Log

_Newest first. One row per screenshot/finding._

| # | Page | Issue | Status | Fix |
|---|------|-------|--------|-----|
| 91 | Artist dashboard | "Add a new tab with 'Browse Companies' as a PRO feature, almost exactly like Browse Artists — could even be a map of studios" | Fixed | Built `/app/companies`: search, grid of studio cards (logo/location/description/website/transport-reimbursement), and a map view plotting each studio's lat/lng with the existing `MapView` component. Gated PRO-only both server-side (`companies.browse` returns `locked: true` for non-PRO artists) and with a paywall UI client-side; clients are redirected away from the route entirely. Added to the sidebar's PRO nav section next to PRO Jobs and Benefits |
| 90 | Bubble data sync | "Pull the latest benefits from the Bubble API — I don't think these are fully up to date???" | Fixed | Ran the existing (never-yet-run) `sync-benefits-once.ts --apply` — all 28 benefits refreshed from live Bubble. Also fixed the script's hardcoded backup path (`/home/ubuntu/artswrk-backups`, only valid on the original server) so it can be re-run from any machine going forward |
| 89 | `/jobs` PRO Jobs tab | "For PRO jobs is there any other filtering we can do?" | Fixed | `premium_jobs.category` (e.g. "Dance Competition", "Acrobatic Arts") existed in the DB but was never surfaced on the artist side — added a Category dropdown + a Remote Only toggle, both derived from real data |
| 88 | `/jobs` PRO Jobs + Applications tabs | "Add fuzzy search for PRO jobs and applied jobs too on artist side" | Fixed | Added client-side substring search — PRO Jobs matches title/company/location/description; Applications matches across both regular and PRO applications by title/company/location |
| 87 | PRO jobs (artist apply flow) | "We have PRO jobs that just link to a URL — I don't think we have that functionality yet" | Fixed | Confirmed real gap: `applyDirect`/`applyLink`/`applyEmail` existed in the schema and were writable via Admin, but `ProJobDetail.tsx` never checked any of them — every PRO job always showed the in-platform apply form regardless of config. Wired the artist-facing display logic (external link/email replaces the in-platform form when configured) and gave Enterprise self-serve clients the same on/off toggle + URL field Admin already had |
| 86 | Admin tooling | "As admin I want to temporarily change someone's permissions to test subscriptions" + "I need a dev-mode version of every Stripe product/price" | Fixed | Added a plan-level dropdown (Basic/PRO/Premium/Enterprise) to the admin impersonation banner — writes the plan flags directly, no Stripe involved, so you can test any permission tier instantly. Separately found `.env`'s Stripe key was already test-mode, but every hardcoded product/price ID in `stripe-products.ts` was still live-mode (confirmed via direct API calls — checkout was silently broken in dev). Created matching test-mode Products/Prices via the Stripe API and made the code auto-detect test vs. live from the key prefix |
| 85 | Transactional emails | "Can you wire up to SendGrid?" | Fixed | Replaced hand-coded HTML with the real designed dynamic templates already sitting unused in the SendGrid account: job posted, new applicant (client + enterprise), new message, and — net new — a client-side booking-confirmation email (previously clients got *nothing* when confirming an artist). Also replaced the studio pay-artist invoice email with its matching template |
| 84 | Client emails | Every client-facing email needed to CC support@artswrk.com | Fixed | Added across the board: job-posted confirmation, new-applicant alert, PRO applicant alert, PRO submission confirmation, new-message notifications (only when the recipient is the client — the same function also emails artists), the invoice/payment-request emails (both the regular and admin booking-period flows) |
| 83 | Confirm Artist flow | Asked for honest feedback (not implementation) on switching to a save-card-on-file + approve-to-release payment model instead of a fresh Stripe Checkout link per invoice | Answered, not built | See chat — summary: yes, very doable with Stripe (SetupIntent + off-session charge), meaningfully smoother for studios, but a true "authorize before the gig, capture after" hold has a ~7-day expiry limit on most cards so it doesn't cleanly cover a hold-then-release window if there's a long gap between confirming and the gig. Recommended simpler version: save the card at confirmation time, auto-charge (or one-click "Approve") when the invoice is submitted, skip the long-hold pattern |
| 82 | Emails generally | "Make sure all the emails match the SendGrid templates more closely" | Blocked — needs your input | I don't have access to the actual SendGrid template designs to compare against. There's a `SENDGRID_TEMPLATES.JOB_POSTED` template ID in the codebase that's completely unused — every email is hand-coded HTML in `email.ts`, not a real dynamic template — so there's real drift risk. Need screenshots, exported HTML, or template IDs from you to do a real pass |
| 81 | Applicant detail (client view) | Once an artist is confirmed, the panel looked identical — stale "Interested" status, same buttons | Fixed | The `getApplicantDetail` query was never invalidated after confirming. Now invalidates it, and also returns you to the Confirmed tab automatically instead of leaving you on the same stale view |
| 80 | Confirmed tab | Confirmed-artist rows weren't clickable to the booking detail page; too many loud colored badges | Fixed | Rows now link to `/app/bookings/:bookingId`; dropped the colored "Confirmed"/"Pay via Artswrk" pills for plain text |
| 79 | Confirm Artist modal | Payment method was presented as an equal choice between two big buttons — should default to Artswrk with a toggle for direct pay | Fixed | Artswrk is now the assumed default with a single "Pay directly instead" opt-out link, not a binary picker |
| 78 | Confirm Artist modal | Overall felt like an overwhelming form rather than a confirmation | Fixed | Role/Company/Rate/Hours/Date/Location now collapse into a read-only summary with one "Edit details" toggle |
| 77 | Confirm Artist modal | End date was wrong for a Single Date job (showed next calendar day); hours never autopopulated from the job | Fixed | Root cause: the AI job parser only extracted start/end times and left hours implicit, and could compute an end time that crossed midnight. Added a real `hours` field the AI extracts directly (also now a visible "Estimated Hours" input on Post Job, and threaded through booking creation), and the modal now defaults a Single Date job's end date to the same day as the start rather than trusting a possibly-wrong stored value |
| 86 | `/jobs` and everywhere else JobListCard is used | Date/time label looked plain and hard to read | Fixed | Restyled from plain orange text to a pink pill badge, matching the existing PRO-badge treatment |
| 85 | `/jobs` job cards | No visible gap between cards despite `space-y-4` being set | Fixed | The card's wrapping `<Link>` rendered as a bare `<a>` tag — `display:inline` by default, so vertical margin has zero visual effect. Confirmed via computed styles (margin-bottom: 16px was set but produced 0px of actual gap). Added `className="block"` |
| 76 | Booking status | Submitting an invoice never changed the booking's status to "Pay Now" | Fixed | `markArtswrkInvoiceSubmitted` never touched `bookingStatus` — now sets it to "Pay Now" on submit and back to "Confirmed" once paid |
| 75 | Settings, My Jobs | Company records have never had a way to set transport reimbursement policy, despite the field existing and being read in several places | Fixed | Added transport-reimbursed checkbox + details field to the company editor (both places), and to the update mutation/DB function — previously write-nowhere |
| 74 | Post Job | "Autofill from previous job" only used the client's single most-recent job across ALL their companies, not the specific company being posted under | Fixed | `getLastJobDefaults` now takes a `companyId` and prefers that company's own last job (falling back to the user's most recent overall) — a client with multiple studios no longer gets one studio's rate/transport bleeding into another's |
| 73 | `/app/jobs` "My Jobs" | Full redesign per your spec: Active/Archived tabs, job cards matching the site-wide shared card, sidebar = account name + all companies (inline-editable) instead of one company's editor + a bare address list | Fixed | Rebuilt using `JobListCard` (same component used elsewhere) and the new shared `CompanyManager` |
| 72 | Settings → Profile | "Manage companies" did nothing — the edit pencil and "Add Another Company" both just navigated to `/app/jobs` with no actual edit UI anywhere | Fixed | Built `CompanyManager`, a shared inline-edit component now used identically on Settings and My Jobs |
| 71 | Post Job | Location-mismatch warning fired even when the location genuinely matched the company's address | Fixed | The check compared against the original AI-parsed snapshot instead of the form's current (possibly since-corrected) value |
| 70 | Dashboard quick-post widget | "AI fills in the form from your description" label — same AI-language issue from the earlier sitewide sweep, missed on this specific widget | Fixed | Reworded to describe the outcome, matching the rest of the site |
| 69 | Client job detail | Wanted the job's own overview (rate + description) more visible without switching to the Overview tab | Fixed | Added a compact summary directly in the hero card |
| 68 | Client job detail | Share button — asked whether it could also just copy the link, not only open the native share sheet | Fixed | Now always copies to clipboard (with a toast) and additionally opens the native share sheet where available |
| 67 | `/app/jobs/:jobId` Applicants tab | The enriched applicant card from the previous round was too dense — asked to revert to the simple version | Fixed | Reverted to name/PRO/status badges, location, message preview, rate, View Submission — kept the filter/sort bar since that wasn't the complaint |
| 66 | `/app/jobs/:jobId` Applicants tab | Stray "0" next to the status badges | Fixed | `{a.converted && <Booked badge>}` — `converted` comes back from SQL as a raw 0/1, not a real boolean, so `0 && (...)` rendered the literal "0". Removed along with the rest of the reverted card content |
| 65 | `/app/artists/:artistId` (client viewing an artist) | Same raw-ID badge bug again, in a component I hadn't checked — the page's top-level code already correctly used `workTypes`, but a nested `AboutTab` sub-component independently re-derived its own tag list straight from `masterArtistTypes` | Fixed | Same duplicate-bug-in-two-places pattern as the payment-math bug from earlier this session. Switched `AboutTab`'s tag list to `workTypes`, matching the parent component it's rendered inside |
| 64 | `/browse` filter pills | Filter pills (`getArtistTypeCounts`) showed raw Bubble IDs mixed in with real names — a filter click on a raw-ID pill also wasn't guaranteed to actually match anything, since the query filtered `masterArtistTypes` while pills were generated from it directly | Fixed | Regenerated the pill list from `workTypes` (the clean field) instead of `masterArtistTypes`, and added `workTypes` to the actual filter match so clicking a pill still works — verified live: clicking "Dance Educator" correctly narrowed 7,188 → 202 artists |
| 63 | `/browse`, `/app/artists`, admin artist list/detail | Explicitly flagged as a follow-up in item #19 but never done — same raw-Bubble-ID badge bug on 3 more pages | Fixed | Same fix pattern as #19/#45: switched artist "type" badges from `masterArtistTypes` (raw IDs) to `workTypes` (clean names) in `BrowseArtists.tsx`, `dashboard/Artists.tsx` (3 spots), and `Admin.tsx` (2 spots — left the actual edit-form's raw-field editing untouched, that one's supposed to read/write the raw field). Added `workTypes` to the underlying queries where it wasn't already selected. Verified live on `/browse` — cards no longer show raw IDs |
| 62 | `/studio/:userId` | Multiple companies under one owner were mashed into a single page's "Locations" dropdown, though they're actually separate businesses | Fixed | Added `/studio/:userId/:companyId` — each company now gets its own dedicated page (own hero, jobs, about, location). `/studio/:userId` alone now shows a chooser when the owner has 2+ companies, and each company page shows a "Sister Companies" list linking to the others. Single-company owners see no change |
| 61 | `/app/profile` vs `/book/:slug` | Booking count differed between the two — you flagged this shouldn't happen | Fixed | `/app/profile` was overlaying a live Bubble API value on top of the DB's cached count; `/book/:slug` only ever showed the DB value. Rather than add a live Bubble call to a public, high-traffic page, dropped the override — both now read the same cached column |
| 60 | Post Job flow | No way to share a job posting | Fixed | Added a Share button to the client job detail hero (native share sheet on mobile, copy-link + toast fallback on desktop) |
| 59 | `/app/jobs/:jobId` Applicants tab | Wanted an ATS-style pass and artist cards matching the richer style used elsewhere (MVP scope only) | Fixed | Added status filter tabs (All/New/Confirmed/Booked/Rejected, with live counts) and a Newest/Oldest sort. Enriched each applicant card with discipline tags, star rating, applied date, "Booked" badge, and Resume/Profile quick links — matching the richer card style already used in Admin's applicant view |
| 58 | `/app/bookings` (client) | Wanted a real booking detail page — "Details" was only an inline expand-in-place toggle | Fixed | Built `/app/bookings/:bookingId` — a full page with artist info, booking details, financials, and a "Pay Now" button when unpaid. The old inline expand panel is gone; "Details" now navigates here |
| 57 | `/app/bookings/:bookingId` (client) | No way to message a confirmed artist from the booking itself | Fixed | Added a "Message" button on the new booking detail page using the existing generic `messages.startConversation` endpoint (no new backend needed) — opens a compose modal, then deep-links into `/app/messages?conversationId=X`. Also added that deep-link support to the Messages page itself, which didn't exist before |
| 56 | `/app` artist dashboard, `/app/bookings` invoice flow | The "studio pays → artist gets paid out" flow existed in the UI but had **zero Stripe Connect wiring** — money went into Artswrk's own balance with no automated payout to the artist | Fixed | This was the critical item you flagged. Wired both invoice flows (`submitArtswrkInvoice` and the admin `bookingPeriods.submit`) as Stripe destination charges (`transfer_data.destination` = the artist's existing connected account, `application_fee_amount` = Artswrk's cut) — no re-onboarding, reuses accounts already connected via OAuth. Also hard-blocked invoice submission (server + UI) for artists with no connected account, added a "Payouts" status card to the main dashboard, and fixed the "Payment Received" email to show the artist's actual take-home instead of the studio's full charged total |
| 55 | Stripe invoice emails | The artist "Payment Received" email showed the full amount the studio paid, including Artswrk's fee — which artists aren't supposed to see anywhere else | Fixed | Now retrieves the PaymentIntent's `application_fee_amount` and shows the artist their actual take-home in both the regular invoice and admin booking-period payment-received emails |
| 54 | `/app/bookings` artist invoice flow | Couldn't invoice a studio without a connected Stripe payout account, but nothing said so — the form just let you try | Fixed | Hard server-side block (throws before creating a Stripe session) plus a client-side gate: the invoice form is replaced with a "Connect your payout account first" prompt when unconnected |
| 53 | `/app` artist dashboard | Connected-Stripe status was buried in Settings only | Fixed | Added a "Payouts" card to the main dashboard, always visible — shows connected/not, with a Connect button when not |
| 52 | `/invoice/:token`, Stripe Dashboard | You said the studio-side payment-processing flow "doesn't exist" | Already built — needs a live test, not code | It does exist end-to-end: `submitArtswrkInvoice` creates a real Stripe Checkout session and emails the studio a "Continue to Payment" link → public no-login `/invoice/:token` page → real `/api/stripe/webhook` handler (registered in `server/_core/index.ts`, verified via signature) marks the booking paid and emails the artist "Payment Received." This was built in an earlier commit (`515ab70`), before this QA session. The one thing I can't verify from code: whether a live webhook endpoint pointing at your production URL is actually configured in the Stripe Dashboard — if that's missing, Stripe would still charge the studio's card but the booking would never flip to "paid." Worth a real end-to-end test: submit an invoice as an artist, pay it as a logged-out studio, confirm the artist gets the "Payment Received" email |
| 51 | `/app/bookings` artist invoice-submitted state | After submitting an invoice, the artist saw only a bare one-line "Invoice submitted on [date]" — no summary of what was submitted, no payment status | Fixed | Replaced with a filled card: rate/hours breakdown, reimbursements, total the artist will receive, plus a live "Paid" / "Payment pending from the studio" status pulled from `booking.paymentStatus` |
| 50 | `/app/bookings` artist invoice flow | Artist saw the 4% processing fee in the invoice summary | Fixed | Fee is billed to the studio, not the artist — removed the fee line from both places it showed, replaced with a "You'll receive" total (excludes fee) and a one-line reassurance note |
| 49 | `/app/bookings` artist invoice + rate math | "Total Rate" and the invoice submission amount never multiplied the artist's rate by `booking.hours` — displayed "$50/hr × 5 hrs" but charged/paid out just $50 | Fixed | This exact bug was independently duplicated in two places in `ArtistDashboard.tsx` (the rate summary display and the invoice-submission mutation call). Fixed both — hourly bookings now correctly compute `rate × hours` before adding reimbursements/fee |
| 48 | `/app/bookings` artist payment-method display | "Paid via Artswrk" vs. "Paid directly" looked and behaved like a live, clickable toggle after the booking was already confirmed | Fixed | Now read-only once `booking.paymentMethod` is set (icon + label, no click handler); the interactive picker only appears for legacy bookings where it's still `null` |
| 47 | Client "Confirm Artist" modal | Confirming a booking never asked for hours — broke pay accuracy for every hourly booking | Fixed | The hours input was only rendered when the artist's rate type was "hourly"; since the modal defaults to "flat," hours were silently skipped almost every time. Now always shown and required. Also added real validation (rate, hours, start date, and description are now required before Confirm is enabled — previously only payment method was checked) |
| 46 | `/app` artist dashboard tasks | Confirmed upcoming bookings never showed up in the artist's task list | Fixed | Added an "Upcoming booking" task row (pulls the soonest confirmed future booking) above unread messages; booking-confirmation email to the artist was already working, no fix needed there |
| 45 | `/app/jobs/:jobId` | Applicant "artist type" badges showed raw Bubble IDs, same bug as #19 but a different query I hadn't found yet | Fixed | The applicant-detail query literally does `u.masterArtistTypes AS artistDisciplines` in SQL — aliasing the raw-ID column as if it were the clean one. Found and fixed in all 3 places this exact alias bug exists (client applicant detail, client applicant list, admin applicant list) |
| 44 | Regular job applications | Client never received the "new applicant" email | Fixed | Two bugs: (1) hardcoded to always send to the internal team inbox regardless of who the client was — a pre-launch guard that outlived its purpose; (2) used an older, plainer template instead of the polished one already built for PRO jobs (confirmed via your screenshot — exact match). Now sends to the real client email using the PRO template's design |
| 43 | `/app/jobs` "My Jobs" list | No applicant count shown anywhere — looked like new applications weren't registering at all | Fixed | Added a real per-job applicant count (subquery) and a badge on each card |
| 42 | `/app/bookings` | Most recent booking sorted to the bottom instead of the top | Fixed | Was ordering by the booking's scheduled event date, not when it was actually booked — switched to sort by booking creation time |
| 41 | `/app/jobs/:jobId` | Stray "0" under the job header, unexplained | Fixed (best-effort) | Traced to a boost-status check reading a raw SQL value that likely wasn't coming back as a real boolean. Coerced it explicitly — this resolves the most likely cause, though I couldn't 100% confirm the exact mechanism without live login access |
| 40 | `/app/jobs/:jobId` | "Job ID" row and message-box styling | Fixed | Removed the Job ID row from Details; application message box now has a grey background to stand out |
| 37 | `/jobs/:slug`, `/app/jobs`, `/studio/:userId`, everywhere a job shows its poster | **Root-cause fix**: job cards, applications, and the studio page all showed the poster's *personal* name instead of the company they actually posted as | Fixed | The `jobs` table had zero link to `client_companies` — only `clientUserId`. The company picker on Post Job already tracked a `selectedCompanyId` client-side but it was never sent to the server or stored anywhere. Added a real `jobs.clientCompanyId` column (migrated + backfilled 3,461 legacy rows from their Bubble company reference), wired both job-creation mutations to store it, and updated **all 6** places that resolve a job's poster (job detail, public browse, dashboard feed, applications list, admin) to join through it. Old test jobs created before this fix have no recoverable company data — can't be back-assigned, only fixed going forward |
| 36 | `/app/jobs` "My Jobs" | Every job card showed whichever company tab was currently selected, not its own — switching tabs looked like it was changing every job's company | Fixed | Direct consequence of #37 above — cards now render each job's own resolved company, and the company filter matches on the real `clientCompanyId` instead of a flaky fallback-to-everything heuristic |
| 35 | `/jobs/:slug` | "Dates Flexible" jobs showed a fake specific date instead of "Flexible" | Fixed | The date-label logic only special-cased Ongoing/Recurring; extended it (and the same bug in Jobs.tsx and ArtistDashboard.tsx) to handle Dates Flexible too |
| 34 | `/jobs/:slug` | Redundant "Applied" chip stayed at the top even with the full summary now below it | Fixed | Removed — the full summary section is the single source of truth once applied |
| 33 | `/studio/:userId` | Job cards touching, no visible gap | Fixed | `space-y-3` → `space-y-4`, matching the rest of the site |
| 32 | Sitewide | Copy explicitly named "AI" in several places (job posting flow, homepage, SEO landing pages) — flagged as a real risk for this AI-sensitive demographic | Fixed | Swept every user-facing mention (Home, AcrobaticArts, DanceStudios, StudioJobWizard ×3, and the exact "AI-parsed location" warning from your screenshot) — reworded to describe the outcome without naming the mechanism |
| 31 | Post Job → Sponsor step | "Ad Performance" showed fabricated precise numbers (`Est. artists reached: 5,320+`, `Est. applicants: 154+`) computed from an arbitrary multiplier, not real data | Fixed | Replaced with the same honest qualitative tier + signal bars already used correctly in `BoostJobModal.tsx` — no fake numbers. Also updated the bullet copy to your suggested wording and added a clear "🎉 Job Posted!" confirmation above the sponsor pitch. Dropped the "boosted across social media & email" claim — found no code implementing that, so not claiming it |
| 30 | Post Job → Sponsor step | Asked: does boosting/pinning actually work as claimed? | Verified accurate | Checked the real mechanism: Stripe payment confirmation correctly sets `isBoosted`/`boostEndDate`, and both `/jobs` and the dashboard feed genuinely sort active-boosted jobs to the top. The claim is true |
| 29 | `/jobs/:slug` job detail | "Applied" state was a dominant box at the top with no detail on what was submitted; date/location/rate were unlabeled inline chips | Fixed | Rebuilt against the same pattern already working on the PRO job page: a compact "Applied" chip near the top, full submitted summary (rate/resume/message) in a new section after the description. Added a `jobs.checkApplication` query (mirrors `checkProJobApplication`) to fetch it. Replaced the chip row with a labeled Date/Location/Rate card + a Google Maps link on Location. Verified the not-applied view live; the applied-summary view is built on the exact same working pattern as ProJobDetail but I couldn't log in to confirm visually — worth a quick check |
| 28 | `/app` "Jobs for You" | Dashboard feed wasn't personalized by the artist's own artist types / service types | Fixed | Verified against Bubble's "Jobs for You" list filter (Current User's Master Artist Types/Services contains the job's type). Implemented in `getArtistJobsFeed` — a job missing a type field isn't excluded on that dimension; an artist with no preferences set sees everything. Verified live: 214/241 jobs pass for a real account, 27 correctly excluded for type mismatch |
| 27 | `/jobs`, `/app/jobs` | Every job card (near-me, PRO, applications, PRO applications) had separate duplicate markup — hard to maintain | Fixed | Built one shared [JobListCard.tsx](client/src/components/JobListCard.tsx), all 4 lists now use it. Spacing bumped to `space-y-4` to match the Benefits page (per your call) |
| 26 | `/app/settings` | Stripe Connect ("Manage Payouts") | Checked, not broken | This feature already existed end-to-end and matches your Bubble reference closely — OAuth Standard/Individual, real callback, connect + manage-payouts states. Fixed one bug: the manage-payouts link used a Stripe SDK pinned to a stale 2023 API version — now uses the app's current one |
| 25 | `/app/profile` Edit → Resume tab | No way to preview an uploaded resume | Fixed | Added a preview icon that opens the file in a new tab |
| 24 | Job apply flow vs. Edit Profile | A resume uploaded during a job application never showed up on the profile's Resume tab, and vice versa | Fixed | Confirmed: two completely separate, unsynced storage locations (`artist_resumes` table vs. `users.resumeFiles` column) — the Edit Profile page's own copy ("will autosave to your profile") was not actually true. Both upload paths now write to both stores |
| 23 | `/app/profile` Edit → Services tab | Unchecking "List on Profile" for a sub-service didn't actually hide it from the public profile | Fixed | 3-part bug: (1) the public Services query never filtered by the flag at all, (2) the edit modal's load also never read back the saved flag — it silently reset every toggle to "on" every time you reopened the editor, (3) same for Job Emails going forward. All three fixed |
| 22 | `/app` "Jobs for You" cards | Bold black title and grey company subtitle could show the identical company name twice | Fixed | Was using a weaker local title-fallback that could fall through to the company name; now uses the shared `getJobTitle()` everywhere else already uses |
| 21 | `/book/:slug`, `/app/profile` reviews | Reviewer avatar fallback should be the client/hirer gradient, not grey | Fixed | Reviewers are studios/hirers — fallback now uses `hirer-grad-bg` (orange) + white initials, matching the artist-gradient convention used for artist avatars elsewhere |
| 20 | `/book/:slug`, `/app/profile`, `/app/artists/:id` | Reviews with a broken avatar URL showed a broken-image icon instead of falling back | Fixed | Added the same `onError` → initials fallback pattern used elsewhere in the app to both `ReviewsTab` components |
| 19 | `/book/:slug`, `/app/profile`, `/app/artists/:id` | "Weird string" badges (e.g. `1652795286947x398019932738813950`) mixed in with real specialty tags | Fixed | `masterArtistTypes` is stored as raw Bubble internal IDs, not names — it was being merged directly into the visible chip list alongside the already-clean `workTypes` field on **3 different pages**. Dropped the raw IDs, kept `workTypes`. Same raw-ID pattern also exists on Admin.tsx, BrowseArtists.tsx, and dashboard/Artists.tsx (not touched — different pages, flagged for a follow-up pass) |
| 18 | `/book/:slug` | Instagram showed/linked to `@https://www.instagram.com/ramita.ravi/` (broken) | Fixed | Some artists have a full pasted URL in the `instagram` field instead of a handle; old code just prepended "@" blindly. Added `normalizeInstagram()` to handle URL / @handle / plain-handle input — [lib/utils.ts](client/src/lib/utils.ts) |
| 17 | `/app/profile` | No website/IG/YouTube/portfolio section shown at all, even to the owner | Fixed | This page never rendered a social-links block (public page has one, this one didn't). Added it, with "+ Add X" placeholders for empty fields so the owner sees the fields exist |
| 16 | `/app/profile` | Affiliations section showed "No affiliations added yet" even when empty, instead of hiding | Fixed | Now hidden entirely when the artist has none |
| 15 | `/app/profile` | Too little space above the Share button | Fixed | `py-1.5` → `py-2.5` + `mt-2` |
| 14 | `/book/:slug` vs `/app/profile` | Booking count differs between the two pages | Explained, not changed | `/app/profile` fetches a **live** count directly from Bubble's API (`trpc.bubble.getArtist`); `/book/:slug` uses our DB's cached `bookingCount` column, which can lag. This is deliberate infra, not a bug — your call on which should be canonical everywhere (see chat) |
| 13 | `/jobs/:slug/apply` | Fixed-rate jobs still showed a "Your rate" pitch field | Fixed | Rate card now only renders when `job.openRate` — [ApplyPage.tsx:860](client/src/pages/ApplyPage.tsx:860) |
| 12 | `/jobs/:slug/apply` | Submit button was clickable with no resume/message/rate filled | Fixed | `disabled` now also requires rate when open-rate — [ApplyPage.tsx:917](client/src/pages/ApplyPage.tsx:917) |
| 11 | `/jobs`, `/app/jobs` Applications tab | Regular job application cards weren't clickable (PRO ones were) | Fixed | Wrapped `ApplicationCard` in `Link` to the job detail page — [Jobs.tsx:469](client/src/pages/Jobs.tsx:469) |
| 10 | `/jobs`, `/app/jobs` | Artist Type / Service Type filters barely worked — matched via crude description-text keyword guessing | Fixed | Verified against the live Bubble editor: real fields exist (`bubbleArtistTypeId`, `masterServiceTypeId`) for exact-ID matching. Switched filters (client dropdowns now send `bubbleId`; server does equality, not `LIKE`) — [server/db.ts:304](server/db.ts:304), [Jobs.tsx:825](client/src/pages/Jobs.tsx:825) |
| 9 | `/jobs`, `/app/jobs`, `/app` | Job count wrong (showed 200/512, live Bubble shows 206) and applied-to jobs vanished from the main feed | Fixed (partially) | Verified against Bubble: filter should be `requestStatus = 'Active'` only (not "Submissions Paused") + exclude `direct` jobs. Applied everywhere. Count now exactly matches true Active count (241) and previously-missing jobs (e.g. the Mount Pleasant "Ballet Teacher") now appear. Remaining ~35-job gap vs Bubble's 206 is very likely Bubble's extra "100mi from artist's saved profile location" radius, which we don't apply yet — see note below, needs your call |
| 8 | `/jobs`, `/app/jobs` | Job titles were full run-on sentences from Bubble's raw title field, not just missing titles | Fixed (display-layer) | Built one shared `getJobTitle()` used everywhere, replacing 4 separate duplicate implementations — now also cleans up a present-but-messy `title`, not just a missing one — [lib/utils.ts](client/src/lib/utils.ts). A DB-level cleanup sweep is a separate, bigger ask — see note below |
| 7 | `/jobs`, `/app/jobs` | Hard 200-job cap truncated the browse list | Fixed | Raised client + server limits — [Jobs.tsx:643](client/src/pages/Jobs.tsx:643), [routers.ts:1135](server/routers.ts:1135) |
| 6 | `/jobs/:slug/apply` | Full street address shown instead of "City, ST" | Fixed | Same `formatLocation()` fix as #3, applied here too |
| 5 | `/app` artist dashboard | Avatar fallback (no logo) used flat grey box instead of brand gradient | Fixed | `SquareAvatar` now uses `artist-grad-bg` + white text, matching `StudioAvatar` — [ArtistDashboard.tsx:134](client/src/pages/ArtistDashboard.tsx:134) |
| 4 | `/app` artist dashboard | Top "Jobs PRO" strip stayed visible even when PRO jobs were already shown as the primary feed (duplicate PRO jobs) | Fixed | Wrapped strip in `{!showProJobsAsPrimary && ...}` — [ArtistDashboard.tsx:323](client/src/pages/ArtistDashboard.tsx:323) |
| 3 | `/app` artist dashboard | Job locations showed raw full street addresses instead of "City, ST" | Fixed | Wired in existing `formatLocation()` helper (was already used on 6 other pages, just missing here) — [ArtistDashboard.tsx](client/src/pages/ArtistDashboard.tsx) 6 call sites |
| 2 | `/app`, `/app/jobs`, `/app/pro-jobs`, client PRO postings, admin PRO browse | PRO jobs listed in essentially random order, looked "unsynced" | Fixed | 3 queries ordered by `createdAt` (sync-insert time, frozen at first sync) instead of `bubbleCreatedAt` (true post date) — [server/db.ts:2740](server/db.ts:2740), [:2347](server/db.ts:2347), [:2391](server/db.ts:2391) |
| 1 | `/login` (all users) | Login failed site-wide: `Unknown column 'bubbleSourcePresent'` | Fixed | Local `.env` pointed at stale local MySQL missing recent migrations; reconnected to live Manus/TiDB DB | 
