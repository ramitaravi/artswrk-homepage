# **Artswrk Product - Source of Truth**

**Part 1: The New Site (app.artswrk.com / repo artswrk-homepage)**  
Audience: an incoming engineer or PM who needs to run, debug, and extend the Artswrk platform without tribal knowledge. Everything in Part 1 is grounded in the GitHub repo ramitaravi/artswrk-homepage, branch main @ commit 7bd48b4 (checkpoint 2026-08-30), plus the repo's own audit documents and the Aug 30 release review. Where this doc disagrees with an older in-repo doc, this doc reflects the code as it exists today.  
Part 2 (separate section, added after the Bubble audit) maps the old Bubble site against everything here so we can prove nothing critical is lost at cutover.  
**Owner:** Ramita Ravi (Product). **Build/host:** Manus. **Code:** public GitHub repo, owner ramitaravi. **Cutover:** artswrk.com DNS flips from the Bubble app to this app Monday night Aug 31, 2026 (~11pm–midnight ET). Until then the new site lives at app.artswrk.com and artswrk.com still serves Bubble.

## **1. Architecture Overview**

| Layer | Technology | Notes |
| :---- | :---- | :---- |
| Frontend | React 19 + Vite, Wouter routing, Tailwind v4, shadcn/Radix UI (59 primitives), Poppins | SPA; client routes in client/src/App.tsx |
| API | tRPC over Express, base path /api/trpc | All routers composed in server/routers.ts (~5,200 lines); a few routers in own files (acquisition, artistProfile, bubble, leads) |
| Server entry | server/_core/index.ts (Express) | Route registration order is load-bearing - see §11 |
| Database | TiDB Cloud (MySQL dialect), Drizzle ORM | Schema: drizzle/schema.ts (~40 tables). Migrations: drizzle/migrations/, run automatically by Manus on deploy |
| Build | vite build + esbuild server bundle → dist/ | pnpm build / pnpm start / pnpm dev / pnpm check / pnpm test / pnpm db:push |
| Hosting | Manus (watches GitHub, auto-deploys on merge to main) | Also provides platform services: OAuth, LLM (Forge), file storage, notifications, Heartbeat cron |
| Legacy backend | Bubble (old artswrk.com) | Still the live DB of record until cutover; stays running after cutover for live overlays + sync. See §9 |

**Request flow:** Browser → Express → (webhook/cron endpoints, storage proxy, OAuth callback) → tRPC /api/trpc → Drizzle → TiDB. Static SPA served for everything else after legacy-redirect handling.

## **2. Environments, Deployment, Cutover**

| Item | State |
| :---- | :---- |
| Production URL (pre-cutover) | app.artswrk.com (Manus deploy of main) |
| Production URL (post-cutover) | artswrk.com → this app; Marco owns DNS. app.artswrk.com behavior after cutover TBD |
| Old site | artswrk.com on Bubble until cutover; stays up afterward (live overlays + sync source). Test env: artswrk.com/version-test |
| Deploy model | Merge to main → Manus builds and deploys, drizzle migrations run automatically. Local dev DB restores from backups fall behind and break login with missing-column errors - prod is fine, local is the stale one |
| Env vars (production) | DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_CLIENT_ID, SENDGRID_API_KEY, BREVO_API_KEY, BUBBLE_API_KEY, GOOGLE_MAPS_SERVER_API_KEY (server-only geocoding), VITE_APP_ID, OAUTH_SERVER_URL, OWNER_OPEN_ID, BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY |
| Safety env vars | EMAIL_REDIRECT_TO (non-prod only: reroutes ALL outgoing email to one inbox), JOB_ALERTS_ENABLED, JOB_ALERTS_KILL, JOB_ALERTS_ALLOWLIST - see §8.4 |
| Tests | pnpm test (vitest): 27 files / 233 tests passing as of the Aug 30 release review. pnpm check: tsc clean |

## **3. Roles, Plans, and the Entitlement Model**

Three orthogonal flags on users: role (user/admin), userRole ("Client"/"Artist"), enterprise (account-type flag for competition/enterprise hirers). Payment entitlement is the planTier enum - the single source of truth since the Aug 30 release removed the legacy boolean bypasses:

| planTier | Who | What it unlocks | Price (current) |
| :---- | :---- | :---- | :---- |
| artist_free | Artist, no plan | Browse jobs only; apply is paywalled | - |
| artist_basic | Artist Basic | Apply to regular marketplace jobs | $30/yr, annual-only |
| artist_pro | Artist PRO | Apply to all jobs incl. PRO/enterprise | $110/yr, annual-only, 7-day trial (legacy monthly subscribers grandfathered) |
| client_on_demand | Client, per-job | Post jobs (free); $40/job unlock to view+message applicants | $40/job unlock |
| client_premium | Client Premium | Subscription-wide applicant access, no per-job unlocks | $65/mo or $650/yr |
| enterprise_on_demand | Enterprise client | Post PRO jobs; $100/job "view candidates" unlock | $100/job |
| enterprise_subscription | Enterprise subscriber | Full PRO job management + applicants | $500/mo or $5,000/yr live list price (existing customers grandfathered; discount via promo codes) |

**Legacy flags still on the row** (used in places, but gating now centralizes on planTier + the unlock helpers): artswrkBasic, artswrkPro, clientPremium, enterprisePlan. Per-job unlocks live in client_job_unlocks and enterprise_job_unlocks. Access rule of thumb: client_premium and enterprise_subscription get subscription-wide access; everyone else needs a per-job unlock (isClientJobUnlocked, canClientMessageArtist).  
**Caveat:** Stripe TEST-mode enterprise prices are still the old $250/mo / $2,500/yr - dev testing of that tier does not validate live amounts.

## **4. Complete Site Map (from App.tsx, current)**

Note: SITEMAP.md in the repo is partially stale - this table supersedes it (e.g. /signup now redirects to /join, /subscribe/\* routes to Settings, enterprise users land in /app).

### **4.1 Public - marketing / SEO**

| Route | Page | Notes |
| :---- | :---- | :---- |
| / | Home | Hero, features, social proof |
| /about, /enterprise | About, Enterprise landing |  |
| /dance-competitions, /dance-studios, /music-schools, /acrobatic-arts | For-hirers SEO landing pages |  |
| /dance-teachers, /dance-judges, /music-teachers, /production | For-artists SEO landing pages |  |
| /terms, /privacy-policy, /cancellation-policy | Legal | Ships with pre-acquisition terms unless Ensemble delivers new ones |
| /browse | BrowseArtists | Public artist directory |
| /book/:slug | PublicArtistProfile | Public artist profile; overlays live Bubble data (see §9.3) |
| /studio/:userId and /studio/:userId/:companyId | PublicCompanyPage | Public hiring page per client/company. Known issue: mashes a client's multiple companies into one "Locations" list |
| /invoice/:token | InvoicePayment | Public studio-facing invoice review + pay page |

### **4.2 Jobs (public browse, gated apply)**

| Route | Page | Notes |
| :---- | :---- | :---- |
| /jobs | Jobs | 3 tabs: Jobs Near Me / PRO Jobs / Applications. Public browse; Basic+ to apply. Route registration order matters: PRO routes before generic slugs |
| /pro | Jobs (pro mode) | Public PRO job board |
| /pro/:jobSlug | ProJobDetail | Public view; PRO to apply |
| /jobs/:jobSlug, /jobs/:locationSlug/:legacyJobSlug | JobDetail | JSON-LD SEO |
| /jobs/:jobSlug/apply (and legacy variant) | ApplyPage | Requires Basic+ |

### **4.3 Auth & onboarding**

| Route | Page | Notes |
| :---- | :---- | :---- |
| /login | Login → InlineAuth | Email-first: email → password, or set-password for Bubble-imported accounts. Respects ?next= and ?email=. Redirects: admin → /admin-dashboard, enterprise → /enterprise, else /app; unknown email → /join |
| /join | Join | Role-choice signup entry |
| /join/artist | ArtistJoin | 3-step artist signup: account → artist types → plan |
| /signup | - | 301 → /join (old hirer signup retired) |
| /client-onboarding, /artist-onboarding | Onboarding wizards |  |
| /forgot-password, /reset-password | Password reset | Token in password_reset_tokens, email via SendGrid |
| /subscribe/basic, /subscribe/pro | - | Redirect → /app/settings (real checkout lives in Settings → Subscription tab) |

### **4.4 /app/\* - unified logged-in area (artist + client)**

All wrapped in DashboardLayout; sidebar and content adapt to userRole. URL design mirrors the Bubble app (/app?tab=bookings → /app/bookings). Legacy /dashboard/\* and /artist-dashboard 301 here.

| Route | Artist sees | Client sees |
| :---- | :---- | :---- |
| /app | Artist overview (jobs feed, bookings, affiliations) | Overview (stats, applicants) |
| /app/jobs | Job feed + PRO jobs + applications | DashJobs (manage postings) |
| /app/jobs/:jobId | Job detail / applicant management (ATS-lite) |  |
| /app/enterprise/jobs/:jobId | Enterprise job deep link |  |
| /app/bookings, /app/bookings/:bookingId | Bookings (upcoming/complete/payment pending) | Confirmed bookings |
| /app/payments | Earnings + pending | Billing + wallet |
| /app/messages | Inbox (artist ↔ hirer) |  |
| /app/profile | Public profile view/edit | - |
| /app/pro-jobs | PRO/enterprise job board | - |
| /app/settings | Settings incl. Subscription tab (checkout + Stripe portal), Stripe Connect payout linking, notification preferences |  |
| /app/artists, /app/artists/:artistId | - | Browse/search artist directory, artist detail |
| /app/company | - | Edit company profile |
| /app/companies | Browse companies |  |
| /app/lists | - | Saved artist shortlists |
| /app/community, /app/benefits | Community; partner perks |  |

### **4.5 Post a job (hirer)**

| Route | Notes |
| :---- | :---- |
| /post-job | AI-assisted job posting → Stripe checkout ($0 for the post itself; boost is paid) |
| /post-job/success | Post-checkout confirmation |

### **4.6 Enterprise**

| Route | Notes |
| :---- | :---- |
| /enterprise, /enterprise/:jobId | Enterprise dashboard (PRO job listings, applicants). /enterprise/messages → /app/messages. Deep-link route registered before base route |

### **4.7 Internal (admin-only)**

| Route | Notes |
| :---- | :---- |
| /admin-dashboard | Admin panel: users, jobs, bookings, payments, overview, set-password, Run As (impersonation). /admin 301s here |
| /leads, /leads/facebook, /leads/contacts, /leads/lists, /leads/campaigns, /leads/unsubscribes, /leads/crm | Standalone CRM backed by Brevo + Facebook lead acquisition (AI-parsed) |

### **4.8 Legacy redirects (server/redirects.ts + redirect-map.csv)**

40+ server-side 301 rules keep old Bubble URLs alive: /book/\<bubbleId\> → slug profile, /app?tab=\* → /app/\*, /pro?uid= and /jobs?uid= (email CTAs) → slug URLs, root vanity handles (/ramitaravi → /book/slug), /reset_pw → /forgot-password, /universities/\* → / (67 pages, rebuild deferred), /null/\* bug URLs, /version-test/\* prefix stripping, plus typo fixes (/prro, /artists/\<slug\>). Unknown routes now return real HTTP 404 (was soft-404). **DNS note:** url3751.artswrk.com (SendGrid click-tracking CNAME) must keep resolving through the DNS migration or every link in every historical email dies. api.artswrk.com / shop.artswrk.com fates still undecided.

## **5. Core User Flows**

### **5.1 Artist signup → subscription → apply**

> 1. /join → artist path (/join/artist): account → artist types → plan picker.  
> 2. Plan checkout happens in /app/settings → Subscription tab (artistSubscription router: createBasicCheckout / createProCheckout / createPortalSession).  
> 3. Browse /jobs (public). Apply gated on planTier: no plan → paywall modal → /join or /app/settings; Basic+ → JobDetail → ApplyPage → row in interested_artists; application-confirmation email to artist, new-applicant email to client (cc support@artswrk.com).  
> 4. PRO jobs: /pro board public; apply requires artist_pro; rows in premium_job_interested_artists.

### **5.2 Client signup → post job → manage applicants → confirm**

> 1. /join → client path → /client-onboarding → company created in client_companies.  
> 2. /post-job: AI parses free-text description (Forge LLM via postJob.parseText) → createAndCheckout → Stripe checkout → webhook checkout.session.completed → activateJob → job live + "Your job is live" email + queued for job-alert matching + last-minute alert check if the job is near-term.  
> 3. Applicants: client sees applicants on /app/jobs/:jobId. Viewing/messaging requires client_premium or a $40 per-job unlock (clientJobs router + client_job_unlocks).  
> 4. Confirm artist → row in bookings (bookingStatus, rates, hours) → booking-confirmed emails to both sides. Confirm modal prefill/validation batch is flagged backlog, not yet built.  
> 5. Boost: paid promotion via boost router → isBoosted + boost window on the job; feeds genuinely sort active-boosted jobs first.

### **5.3 Enterprise client**

> 1. Enterprise account (enterprise=true) → /enterprise dashboard or unified /app.  
> 2. Posts PRO jobs (premium_jobs) via enterprise.postJob.  
> 3. Applicant access: enterprise_subscription, or $100/job "view candidates" unlock (enterprise_job_unlocks).

### **5.4 Booking → invoice → payment**

> 1. Booking exists in bookings with paymentMethod (Artswrk payroll vs direct pay). "Pay Directly" is gated behind Artswrk payroll onboarding.  
> 2. Artswrk-paid path: artist submits invoice (artistDashboard.submitArtswrkInvoice) → Stripe Checkout session → studio gets payment email → studio pays on public /invoice/:token → Stripe webhook marks booking paid (invoicePaidAt, invoiceStripePaymentIntentId) → confirmation emails both sides. New columns on bookings: invoicePaymentToken, invoiceStripeCheckoutUrl, invoiceTotalCents.  
> 3. Direct-pay path: artistDashboard.confirmDirectPayment.  
> 4. **Known gap (QA Round 11, paused):** no real booking detail page and no studio-side payment-processing flow yet; hours not confirmed at booking time breaks payment accuracy.

### **5.5 Payouts (artist)**

> 1. Artist links payout account: Settings → Stripe Connect OAuth → GET /stripe-connect/callback (state-verified) → artistStripeAccountId saved.  
> 2. Payout email "Your payment is on its way" (sendPayoutOnTheWayEmail). Wallet data via artistDashboard.walletData / stripeLoginLink / stripeConnectStatus.

### **5.6 Messaging**

conversations + messages; messages router (myConversations, byConversation, myStats). New message → email notification (sendNewMessageEmail, cc support). Client↔artist messaging gated by the same entitlement rules as applicant access.

### **5.7 Subscription lifecycle (webhook-driven)**

> * checkout.session.completed → applyCheckoutSessionCompleted (boost / job activation+emails / enterprise interval / booking-period invoice / booking payment).  
> * customer.subscription.deleted → revoke access by customer ID, product-disambiguated (artist PRO / Basic / enterprise / client Premium columns).  
> * customer.subscription.updated → non-destructive status mirror; past_due keeps access while Stripe retries.  
> * invoice.payment_failed with next_payment_attempt null (final failure) → revoke.  
> * Internal "Subscription Updated!" alert email to contact@artswrk.com.

### **5.8 Admin / Run As**

/admin-dashboard: platform stats, user/job/booking/payment tables, set any user's password, impersonate (Run As) + stopImpersonating with banner. Leads CRM under /leads/\* (admin-only): Brevo contacts/lists/campaigns/unsubscribes/CRM sync, plus Facebook lead acquisition with AI parsing and outreach generation (acquisitionRouter).

## **6. API Map (tRPC, base /api/trpc)**

| Router | Purpose / key procedures |
| :---- | :---- |
| auth | me, lookupEmail, passwordLogin, setInitialPassword, logout, forgotPassword, resetPassword. JWT cookie, 1-year expiry |
| signup | register, updateOnboarding |
| jobs | publicList, publicListEnriched, getDetail, myJobs, myStats, myResumes, submitApplication, myApplications |
| applicants | myApplicants, byJob, myStats |
| bookings | myBookings, byJob, byId, byApplicant, myStats |
| payments | myPayments, myStats, walletStats, pendingPayments |
| messages | myConversations, byConversation, myStats |
| artists | getById, getHistory, listMyArtists, browse, uploadResume |
| postJob | parseText (AI), createAndCheckout, verifyCheckout |
| checkout / boost | Stripe session creation + verify for boosts |
| artistDashboard | getJobsFeed, getProJobsFeed, getProApplications, getBookings, getPayments, applyToProJob, checkProJobApplication, myConfirmations, setPaymentMethod, confirmDirectPayment, reimbursements, submitArtswrkInvoice, walletData, stripeLoginLink, stripeConnectStatus, createStripeConnectUrl |
| enterprise | getJobs, getApplications, getJobDetail, getJobApplicants, getClientCompanies, postJob |
| clientJobs | getDetail, getApplicants, getApplicantDetail, getBookings, createUnlockCheckout, createSubscriptionCheckout, createPortalSession, competition variants, verifyUnlock, messageApplicant, confirmArtist, getConfirmedArtists |
| artistSubscription | getCurrentPlan, getPricing, createBasicCheckout, createProCheckout, createPortalSession |
| artswrkUsers | getById, getByEmail, getByBubbleId, studioOnboard |
| account | requestDeletion etc. |
| artistProfile | getMyProfile, getProfileBySlug (dedupes slug collisions preferring bubbleSourcePresent), getPublicProfile, getPublicReviews, getPublicServiceCategories, reviews, job-alert settings get/update, service categories get/update, uploadFile, updateMyProfile, getBySlug |
| admin | overview, artists, clients, jobs, bookings, payments, setPassword, impersonate, stopImpersonating |
| adminBookings / bookingPeriods | Admin booking ops; booking periods (submit, getForBooking) |
| invoice | getByToken (public /invoice/:token) |
| savedArtists / companies / benefits | Shortlists; company profiles + public pages; perks (admin CRUD included) |
| bubble | getArtist, getArtists, getLiveJobs, getLiveJob, bustCache - live Bubble Data API reads (see §9.3) |
| acquisition | Facebook leads: parsePosts (AI), listSessions, getSessionLeads, generateOutreach, markOutreachSent, updateLeadStatus, getStats, resolveMagicLink, getAllLeads |
| leads | Brevo CRM: overview, contacts, lists, campaigns, unsubscribes, CRM sync/stats |
| system | Platform internals (systemRouter) |

## **7. Data Schema (Drizzle / TiDB)**

Conventions: every migrated table carries bubbleId (canonical source identity) + bubbleSourcePresent + bubbleCreatedAt/bubbleModifiedAt. IDs are int autoincrement. Migrations are additive; destructive one-off cleanup scripts exist in scripts/ but are manual-only, never wired to build/start.

### **7.1 Core marketplace tables**

| Table | Bubble source | Purpose / key columns |
| :---- | :---- | :---- |
| users | user (~7.5k rows) | Everyone. Identity (openId, email, name, slug), role/userRole/enterprise, planTier + stripeSubscriptionId/stripePriceId, legacy plan booleans, three Stripe customer columns (artist/client/enterprise - one account can hold all three), artist profile (bio, disciplines, masterArtistTypes/masterStyles/masterServiceType, structured location city/state/country/lat/lng/placeId, portfolio/socials), passwordHash + passwordIsTemporary (Bubble imports set their first password at login), credits, lateCancelCount, ratingScore/reviewCount/bookingCount |
| jobs | request (~3.9k) | Regular job posts. clientUserId + clientCompanyId (company link added Aug 2026 - earlier jobs have no recoverable company), title/slug, status/requestStatus, dates, structured location, rates (hourly/flat, artist vs client), masterServiceTypeId, boost fields (isBoosted, window, budget), sentToNetwork, workFromAnywhere-equivalents |
| interested_artists | interested artists (~10.6k) | Applications to regular jobs |
| bubble_interested_artists_source | - | Preserved raw source rows for application reconciliation |
| premium_jobs | premium_jobs (~245) | PRO/enterprise job posts. createdByUserId, company, serviceType + masterServiceTypeId (nullable - drives alert ride-along logic), budget, workFromAnywhere, applyDirect/applyEmail/applyLink, featured |
| premium_job_interested_artists | InterestedArtists | PRO job applications |
| bookings | booking (~5.7k) | Confirmed engagements. jobId, artistUserId, clientUserId, bookingStatus/paymentStatus, clientRate/artistRate, grossProfit/stripeFee/postFeeRevenue, hours, paymentMethod, invoice columns (invoicePaymentToken, invoiceStripeCheckoutUrl, invoiceTotalCents, invoicePaidAt), directPayConfirmedAt, isAdminBooking, isRecurring |
| payments | payment (~18.2k) | Stripe payment records per booking: stripeId, stripeStatus, amounts, application fee, card metadata, receipt/refund URLs |
| conversations / messages | conversation / message (~5.3k / ~15.2k) | Messaging threads + messages |
| client_companies / client_company_memberships | client company (~1.2k) | Companies under clients; membership join |
| client_job_unlocks / enterprise_job_unlocks | - | Per-job paid unlock records |
| booking_periods | - | Per-period booking detail for invoicing |
| artist_reviews | Reviews (~1.1k) | Post-booking reviews |
| artist_service_categories / artist_experiences / artist_resumes | ArtistService / ArtistExperience / resume | Profile building blocks |
| saved_artists | - | Client shortlists |
| referrals | - | Normalized referrals (added Aug 2026) |
| affiliations / user_affiliations | Affiliations | Schools/programs/studios + artist join |
| benefits | benefits (28) | Partner perks |
| ads | ad | Banner/display ads |
| rate_conversions | rate conversion | Artist→client rate lookups |
| reimbursements | reimbursements (0) | Expense records - empty |
| eoy_email_snapshots | EOY email | Year-end earnings snapshots |

### **7.2 Platform / infrastructure tables**

| Table | Purpose |
| :---- | :---- |
| master_artist_types (8) / master_service_types (42) / master_style_types (34) | Lookup taxonomies, from Bubble option sets. Drive job-alert matching and profile filters |
| premium_service_type_map / premium_service_type_review | Mapping of premium job service types to master taxonomy + review queue |
| user_notification_settings | Per-user job alert prefs: jobEmailsEnabled, enabled serviceTypes |
| email_suppressions | Bounce/spam/unsubscribe suppression (scopes: global, job_alerts). Read before every send |
| email_send_log | Every job-alert send; the idempotency guarantee (an artist sees any job in at most one email, ever) |
| app_settings | Key-value app switches; holds job_alerts_enabled (the DB master switch) |
| password_reset_tokens | Password reset |
| sync_runs | Bubble sync run history |
| acquisition_sessions / acquisition_leads | Facebook lead capture + AI-parsed lead records |
| leads_contacts / leads_sync_log | Brevo CRM mirror + sync history |

### **7.3 Row-count drift vs Bubble (Aug 30 audit - destination is behind)**

Users 7,543 vs 7,573 in Bubble (30 missing); payments 18,221 vs 18,331 (110 missing); jobs 3,875 vs 3,880; premium jobs 243 vs 248; bookings 5,678 vs 5,681; conversations 5,250 vs 5,258; client companies 1,212 vs 1,225; interested artists 10,631 vs 10,646; messages 15,235 vs 15,244. Also: 12 company-membership refs without a resolved local user, 1 payment with unresolved booking. A final delta sync is required before launch sign-off. 127 Bubble users still have null role + null planTier (4 with legacy live-mode subscription IDs - classify manually); stripePriceId backfill script must be run once in a live-key environment.

## **8. Email System**

### **8.1 Architecture**

**All transactional email is inline HTML built in code.** server/emailTemplates.ts provides the master shell (renderEmailShell) + helpers (detailsCard, ctaButton, sanitizeUserText); server/email.ts has one exported sender per workflow (sendSimpleEmail → SendGrid REST). SendGrid is only the delivery pipe. The SENDGRID_TEMPLATES constants (7 old dynamic-template IDs: job posted, new applicant, enterprise applicant, message received, booking confirmations ×2, pay artist) remain in email.ts as historical reference - no code path calls sendTransactionalEmail anymore. Do not create new SendGrid dynamic templates; build emails in code.  
**Senders:** FROM contact@artswrk.com ("Artswrk"); SUPPORT_EMAIL support@artswrk.com is cc'd on most client-facing transactional mail. Internal alerts go to contact@artswrk.com. Sender is verified and domain authentication for artswrk.com is valid (one stale invalid whitelabel record exists - delete it in SendGrid → Sender Authentication, carefully).

### **8.2 Unsubscribe groups (the split is deliberate - do not merge)**

| Group | ID | Used for |
| :---- | :---- | :---- |
| Transactional emails (account default) | 24547 | Booking confirmations, messages, password resets, receipts |
| Job Alerts | 33079 | Job alert digest + last-minute alerts only |

Unsubscribing from job alerts must never silence booking confirmations. Job-alert sends stamp group 33079 and carry List-Unsubscribe + one-click headers.

### **8.3 Workflow inventory**

The full 28-workflow inventory (trigger, recipient, subject, copy, status) lives in the companion spreadsheet "Email Link Audit" tab: https://docs.google.com/spreadsheets/d/1mm7t0ue6EgpqnJjI4arXvTRNYtxkIRw2v7X7VQwwKuQ/edit - and the Claude-ready rebuild brief (EMAIL-REBUILD-BRIEF.md, in flight 2026-08-30) has cleaned copy per email. Seven emails the old site sends had no new-site equivalent and are being built inline before launch: Welcome PRO, artist payout ("on its way"), client payment receipt, payment reminder (also needs a new cron), Subscription Updated internal alert, and two small internal alerts (apply click-out, premium job submission).

### **8.4 Safety rails**

> * **EMAIL_REDIRECT_TO** - set only outside production; silently reroutes ALL outgoing email to one inbox. Required for local "Run As" testing so real users never get test mail.  
> * **Job alerts are OFF by default**, four independent gates: (1) DB switch app_settings.job_alerts_enabled (killable instantly, no deploy); (2) JOB_ALERTS_KILL=true env break-glass; (3) JOB_ALERTS_ENABLED env for CLI dry runs; (4) JOB_ALERTS_ALLOWLIST - when set, only those addresses can receive.  
> * **Suppressions**: SendGrid Event Webhook → POST /api/webhooks/sendgrid → email_suppressions (bounce, spam_report, unsubscribe, group_unsubscribe, dropped only - delivered/open/click stay OFF). Nightly Brevo blocked-list sync → same table. Webhook answers 200 immediately and processes async.  
> * **One-click unsubscribe**: GET/POST /unsubscribe with HMAC-signed token (user id + JWT secret, constant-time compare). Deliberately unauthenticated.

### **8.5 Job alerts subsystem (server/jobAlerts/)**

Daily digest, built and tested, OFF until the owner flips the DB switch. Rule: a digest is sent only when the artist has at least one **targeted** match (enabled service type AND within 50 miles of home base; remote/workFromAnywhere jobs skip the distance test; artist without coordinates never matches). Unmapped PRO jobs (no masterServiceTypeId) **ride along** in a digest but can never trigger one - this asymmetry is the core safety property (one unmapped PRO job would otherwise email ~5,700 artists). Eligibility floor (E1–E6): has email, alerts on, not suppressed, not the poster, hasn't applied, hasn't been sent it (email_send_log). Known consequence: the 2,006 artists with no service types set get nothing - parked decision.  
Scheduling: cron calls POST /api/scheduled/job-alerts **hourly**; the handler self-gates to the 1 PM hour in America/New_York (DST-proof). Last-minute alerts (lastMinute.ts) fire at job activation for near-term jobs, capped per artist per 24h. Dry-run tooling: scripts/who-would-get-this-job.mjs, who-would-get-recent-jobs.mjs, dry-run-job-alerts.mjs, preview-job-alert-emails.mjs. Matching math note: a longitude bug here once silently dropped ~24 matches per NYC job - unit tests for matching.ts are still an open task.

## **9. External Integrations**

### **9.1 Stripe**

> * Checkout sessions: job post ($0), job boost (default $10/day × 7 days), artist Basic/PRO (annual), client job unlock ($40), client Premium ($65/mo, $650/yr), enterprise unlock ($100) and subscription ($500/mo, $5k/yr). Products/prices centralized in server/stripe-products.ts with env-overridable price IDs; TEST fallbacks hardcoded.  
> * Webhook: POST /api/stripe/webhook (raw body, signature-verified, registered BEFORE express.json). See §5.7 for event handling. Test events (evt_test_\*) short-circuit 200.  
> * Connect: artist payouts via Express accounts; OAuth callback /stripe-connect/callback; marketplace application fees recorded on payments.  
> * Access note: Instinct holds a restricted API key (no Accounts-write); dashboard login is behind Nick's 2FA.

### **9.2 SendGrid**

Delivery pipe for all email (§8). Event Webhook → /api/webhooks/sendgrid. Click-tracking CNAME url3751.artswrk.com must survive DNS cutover. Being enabled with URL https://app.artswrk.com/api/webhooks/sendgrid pre-cutover; **must be repointed to artswrk.com after the Aug 31 DNS flip**.

### **9.3 Bubble (legacy backend - still live)**

> * **Read-only Data API** via BUBBLE_API_KEY (server/bubbleApi.ts, in-memory cache + bustCache). Powers the live overlay on public artist profiles (ArtistProfilePage merges trpc.bubble.getArtist) and live-jobs endpoints (getLiveJobs/getLiveJob exist server-side). Both sites share one database truth for users/plans.  
> * **Outbound profile writes**: pushProfileUpdateToBubble pushes profile edits back to Bubble.  
> * **Inbound webhook**: POST /api/webhooks/bubble (secret-verified) handles job.created/updated, booking.confirmed/completed, profile.updated. **Gaps:** does not cover client companies, premium jobs, applications, payments, conversations, messages, or benefits; returns 200 after processing errors (no retries).  
> * **Sync**: scripts/sync-all.mjs (frequent/daily modes) carries all ten core types Bubble → TiDB. Manual/unscheduled by default; the Manus cron bubble-sync-daily exists but is unreliable (81/87 recent callbacks failed 403; full sync takes 24–39 min vs a 2-min callback limit; handler spawns an unawaited child the platform may kill). Timestamp quirk: synced rows land ~3h45 in the future (ET wall-clock read as UTC) - fix at the sync, not the display. Recommended target architecture (docs/bubble-ongoing-sync-audit.md): 15-minute incremental API pull as the authoritative path + nightly chunked reconciliation; Bubble DB triggers later.

### **9.4 Brevo**

Marketing CRM behind /leads/\* (contacts, lists, campaigns, unsubscribes; server/brevo.ts, leadsSync.ts) and the nightly suppression feed into email_suppressions (POST /api/scheduled/brevo-suppressions, recommended 08:30 UTC). Live tests need the sandbox IP on Brevo's allowlist.

### **9.5 Google**

Places/Maps: browser key for the jobs map (Advanced Markers) via the Forge maps proxy; server-only GOOGLE_MAPS_SERVER_API_KEY for Geocoding (a referrer-restricted browser key is rejected by the REST API). Structured PlaceLocation columns (city/state/country/lat/lng/placeId) added across users, jobs, premium jobs, companies, bookings (Aug 2026).

### **9.6 Manus platform services**

> * **OAuth**: /api/oauth/callback (registerOAuthRoutes) + VITE_APP_ID/OAUTH_SERVER_URL.  
> * **Forge LLM**: job-post parsing, Facebook lead parsing, outreach generation (server/_core/llm.ts via BUILT_IN_FORGE_API_URL/KEY).  
> * **Storage**: file uploads via Forge presigned URLs, proxied at GET /manus-storage/\* (storageProxy).  
> * **Notifications**: owner notifications via webdevtoken.v1.WebDevService/SendNotification.  
> * **Heartbeat cron**: createHeartbeatJob (server/_core/heartbeat.ts), 6-field UTC cron, callback path must start /api/scheduled/. Cron endpoints authenticate via the x-manus-cron-task-uid header (403 otherwise; force:true body bypass for manual runs).

## **10. Scheduled Jobs (Cron)**

| Job | Endpoint | Schedule | Status |
| :---- | :---- | :---- | :---- |
| bubble-sync-daily | POST /api/scheduled/bubble-sync | Daily (Manus Heartbeat) | Configured but unreliable - last run Aug 24, mostly 403s. Replace per §9.3 recommendation |
| job-alerts-digest | POST /api/scheduled/job-alerts | **Hourly** (self-gates to 1pm ET) | Endpoint built; cron registration pending (docs/sendgrid-setup-handoff.md Task 3) |
| brevo-suppression-sync | POST /api/scheduled/brevo-suppressions | Nightly 08:30 UTC | Endpoint built; cron registration pending |
| payment reminder | - | - | Does not exist yet; required by the email rebuild (EMAIL-REBUILD-BRIEF.md) |

## **11. Server Boot Order (load-bearing)**

server/_core/index.ts registers in this order - do not reorder without reading why:

> 1. POST /api/stripe/webhook with express.raw (signature verification breaks if express.json runs first)  
> 2. POST /api/webhooks/bubble, /api/scheduled/bubble-sync, /api/webhooks/sendgrid, /api/scheduled/job-alerts, /api/scheduled/brevo-suppressions (own parsers)  
> 3. GET/POST /unsubscribe  
> 4. GET /stripe-connect/callback  
> 5. express.json (50mb) globally  
> 6. Storage proxy /manus-storage/\*  
> 7. OAuth /api/oauth/callback  
> 8. tRPC /api/trpc  
> 9. Legacy Bubble 301 redirects (must precede the SPA catch-all)  
> 10. Vite dev server or static SPA + real 404

## **12. Debugging & Operations Guide**

### **12.1 Where logs live**

Runtime logs are in the Manus project dashboard (deploy + runtime). Log prefixes to grep: \[Webhook\] (Stripe), \[email\], \[job-alerts\], \[brevo-sync\], \[ScheduledSync\], \[BubbleWebhook\], \[sendgrid-webhook\], \[StorageProxy\], \[StripeConnect\]. DB: query TiDB directly (connection string in DATABASE_URL) or via scripts/export-db-csv.mjs. Stripe: dashboard (Nick's 2FA) or restricted API key. SendGrid: dashboard (creds in vault, entry "SendGrid (artswrk)") or API. Bubble: Data API read-only (no editor access yet).

### **12.2 Common failure modes**

| Symptom | Likely cause | Fix |
| :---- | :---- | :---- |
| Localhost login breaks with missing-column errors | Local DB is a pre-migration backup restore | Expected local-only drift; prod is fine (Manus runs migrations on deploy). Re-restore or run pnpm db:push locally |
| Synced record timestamps ~3h45 in the future | Bubble sync reads ET wall-clock as UTC | Fix in sync-all.mjs, not the display layer |
| Job title shows first line of description | Known fallback when no real title stored | scripts/generate-job-titles.mjs backfill exists |
| Wrong artist profile loads on a shared slug | Duplicate Bubble-migrated rows share slugs | getProfileBySlug orders bubbleSourcePresent DESC, updatedAt DESC - keep that ordering |
| Nobody receives job alerts | Working as designed until the DB switch flips | app_settings.job_alerts_enabled = "true", and check the allowlist |
| Enterprise dev checkout shows wrong price | TEST price IDs still $250/$2,500 | Known; live prices are $500/$5,000 |
| Cron endpoint returns 403 | Missing x-manus-cron-task-uid header | Call via Heartbeat or POST {"force": true} |
| Emails go to one inbox in dev | EMAIL_REDIRECT_TO set | Intended. Never set it in production |
| Bubble sync "succeeds" but data stale | HTTP 200 ≠ sync ran (HTML responses recorded as success); 2-min callback limit kills 24–39 min sync | Check sync_runs table; move to 15-min incremental pulls |

### **12.3 Safe test accounts & rules**

Write-test ONLY as ramita@artswrk.com, FANCY FEET DEMO, or ramita+\*@gmail.com / ramitaravi.94+\*@gmail.com aliases. Never post or write as real users. Job-alert dry-run scripts (§8.5) are read-only unless JOB_ALERTS_ENABLED=true.

### **12.4 Open security items (reported, deferred by owner)**

> 1. **P0:** Bubble API key is hardcoded as a fallback in scripts/sync-all.mjs in the PUBLIC repo - full read/write to the live Bubble DB. Owner deferred rotation ("do that later"). Highest-severity outstanding item. Never copy the key value anywhere.  
> 2. **P1:** production login leaked raw SQL errors (incl. submitted email + users column list). Prod errors should render generic messages.

## **13. Known Issues & Launch Checklist (as of Aug 30, 2026)**

### **13.1 Must-do before/at cutover**

> 1. Run the final idempotent delta sync for the ten Bubble data types (§7.3 drift), then re-run reconciliation requiring zero missing IDs on launch-critical tables.  
> 2. Register the two crons: job-alerts-digest (hourly) and brevo-suppression-sync (nightly) - see §10.  
> 3. SendGrid Event Webhook: verify enabled against app.artswrk.com now; **repoint to artswrk.com after DNS flip**. Delete the stale invalid whitelabel domain record.  
> 4. Delete the 4 publicly visible test jobs: \#2490001, \#2430001 ("TESING POST JOB"), \#2400001, \#2280001.  
> 5. Classify the 4 legacy live-mode subscriptions on null-role users; run the stripePriceId backfill once with a live Stripe key (185 unified subscription IDs).  
> 6. DNS: keep url3751.artswrk.com resolving; decide api./shop.artswrk.com.  
> 7. Email rebuild: 7 old-site emails being rebuilt inline pre-launch (§8.3); origin-header localhost P0 (three call sites) folded into the rebuild brief.

### **13.2 Known product gaps (backlog, not launch-blocking)**

> * Booking detail page + studio-side payment-processing flow do not exist (QA Round 11 paused); hours not confirmed at booking time; ATS-style applicant redesign and confirm-modal prefill batch flagged.  
> * /universities (67 pages) redirects to homepage; rebuild deferred.  
> * Migrated artists' public pages show 0 bookings/empty stars (bookings exist in DB; counter never synced - 22/22 sampled). Resumes and media don't sync (13/13). PRO applications invisible to artists. TikTok links don't render.  
> * Studio public page merges a client's multiple companies into one Locations list (needs target-model decision).  
> * Payments admin shows "? Unknown Artist" rows.  
> * 2,006 artists with no service types get no job alerts (parked decision).  
> * Artist Settings → Notification Preferences page rewritten but never browser-tested.  
> * Ships with pre-acquisition Terms unless Ensemble delivers new ones.

## **14. Repo Layout & In-Repo Docs**

| Path | What it is |
| :---- | :---- |
| client/src/pages/ (+ admin/, artist/, dashboard/, leads/) | All pages |
| client/src/components/ (+ ui/) | Layout (DashboardLayout), features (Map, BoostJobModal, InlineAuth, ImpersonationBanner), 59 shadcn primitives |
| server/routers.ts | Most tRPC routers (~5,200 lines) |
| server/email.ts, emailTemplates.ts | All transactional email |
| server/jobAlerts/ | Digest, matching, last-minute, safety gates, templates, unsubscribe, webhook, Brevo sync |
| server/stripe.ts, stripe-products.ts, checkoutEffects.ts | Stripe sessions, product/price catalog, webhook effects |
| server/bubbleApi.ts, bubbleRouter.ts, bubbleWebhook.ts, scheduledSync.ts | Bubble reads, live-read router, inbound webhook, scheduled sync |
| server/redirects.ts + redirect-map.csv | Legacy URL 301 map |
| drizzle/schema.ts + migrations/ | DB schema + auto-applied migrations |
| scripts/ | ~70 operational scripts: sync-\*, backfill-\*, seed-\*, dry-run/preview for job alerts, one-off cleanups (manual only) |
| docs/job-alerts-spec.md | The job-alert matching/send spec - read §3 before touching matching or send-gate logic |
| docs/sendgrid-setup-handoff.md | SendGrid state + the only required SendGrid task (event webhook) + cron registration |
| docs/bubble-ongoing-sync-audit.md | Sync failure analysis + recommended architecture |
| docs/release-audits/latest-github-review-2026-08-30.md | Most recent release review (tests, migrations applied, drift table) |
| QA_SESSION_LOG.md / QA_CHECKLIST.md | 11 rounds of QA findings and fixes; 43 items tracked |
| SITEMAP.md / HANDOFF.md | Older docs - partially stale; §4 of this doc supersedes SITEMAP.md; HANDOFF.md is from April |

## **15. Sources**

> * Code: github.com/ramitaravi/artswrk-homepage @ main 7bd48b4 (2026-08-30)  
> * Email inventory + copy: Email Link Audit / Proposed Copy Rewrites tabs, https://docs.google.com/spreadsheets/d/1mm7t0ue6EgpqnJjI4arXvTRNYtxkIRw2v7X7VQwwKuQ/edit  
> * Email rebuild brief: EMAIL-REBUILD-BRIEF.md (produced 2026-08-30)  
> * Bubble sync sources: https://manual.bubble.io/help-guides/logic/workflows/events/backend-events/database-trigger-events and https://manual.bubble.io/help-guides/integrations/api/the-bubble-api/the-workflow-api

*Part 2 (old Bubble site audit + transition verification) follows in this document once Bubble dashboard access lands.*

# **Part 2: Bubble App Audit (app: artswrk-new)**

*Audit date: 2026-08-30. Audited the live Bubble editor (read-only; no changes made). This part is the full inventory of the legacy Bubble system that the new site replaces, plus a cutover cross-check against Part 1. App id: artswrk-new. Display name: Artswrk. Editor: https://bubble.io/page?id=artswrk-new\&name=index. Live domain: artswrk.com (TLS on, bubbleapps.io subdomain redirects to the domain).*

## **B1. App settings and plan**

* *Plan: Growth, web + native mobile, $209/mo billed annually, plus a 2.5M workload-unit add-on ($269/mo). Web app: LIVE. Native mobile app: LIVE (iOS and Android via Bubble native + legacy BDK wrapper plugin).*  
* *Usage (Aug 2026 cycle): 917K of 2.8M workload units (33%); storage 19GB of 100GB (19%); 46 plugins installed; 2 app editors on plan.*  
* *Email: SendGrid API key connected at app level; app emails send from @artswrk.com.*  
* *Public APIs: Workflow API and Data API both ENABLED. Every data type is exposed in the Data API. Workflow API root: /api/1.1/wf, Data API root: /api/1.1/obj (per-version under /version-test or live root).*  
* *Versions: live and development (version-test) both exist; the version-test site is reachable at artswrk.com/version-test.*  
* *Other services with keys in Settings: Google Geocode/Maps API keys (web, iOS, Android).*

## **B2. Security findings (critical - read first)**

*These were verified on 2026-08-30 against the live app. They are pre-existing conditions of the Bubble app, independent of the new site.*

| \# | Finding | Evidence | Severity |
| :---- | :---- | :---- | :---- |
| **1** | **The Bubble Data API returns data with NO authentication for almost every data type. Verified readable anonymously: User (full record incl. email address), Message (full message text), Conversation, Payment (Stripe amount, card brand/last4/name, receipt and refund URLs, Stripe IDs), Resume (file URLs), Request, Premium Jobs, Reviews, Affiliations, ARTIST EXPERIENCE, ARTIST SERVICE, Studio Leads, Backend Log. Only Booking and empty types refused anonymous reads.** | **GET https://artswrk.com/version-live/api/1.1/obj/user?limit=1 (and sibling types) returned full records with no auth header** | **P0 - live PII exposure of all 7,574 users, 15,244 private messages, 18,344 payment records** |
| **2** | **On the User type, the 'Everyone else' privacy rule has Find in searches, View files, and Create/Delete/Modify via API all enabled, with 244 of 246 permission boxes checked - i.e. essentially every user field is world-readable and the rule as configured also permits anonymous API writes (writes were NOT tested).** | **Bubble editor \> Data \> Privacy \> User** | **P0** |
| **3** | **Three live Stripe secret keys (sk_live_...) and one test key are stored as static Authorization headers inside API Connector connections, visible to anyone with editor access.** | **Bubble editor \> Plugins \> API Connector** | **P0 - rotate if editor access was ever broad** |
| **4** | **A Customer.io bearer token and a SheetDB token are likewise stored in API Connector.** | **Bubble editor \> Plugins \> API Connector** | **P1** |
| **5** | **The app's Data API token is committed in the public repo scripts/sync-all.mjs (known P0, rotation deferred). Note: finding 1 shows the token is not even needed for reads - the privacy rules themselves allow anonymous reads.** | **Repo scripts/sync-all.mjs + finding 1** | **P0 (known)** |
| **6** | **The Conversation data type (user messaging) is marked 'Publicly visible' in the editor - no privacy rule at all.** | **Bubble editor \> Data \> Data types** | **P0** |

## **B3. Privacy rules (User type, detail)**

*User has 4 rules: (1) 'View Admin Dashboard? = yes' - full access, all fields (admin). (2) Logged-in Clients - view, all fields. (3) 'Current User is This User' - all fields, auto-bind ~71 fields. (4) 'Everyone else' - the catch-all described in finding 2 above, which defeats the intent of rules 1-3 for reads. Per-field checkbox states are not extractable from the editor at scale; the effective behavior was verified directly via the anonymous API tests in B2.*

## **B4. Data types and live record counts**

*Counts pulled 2026-08-30 from the live Data API (read-only). 'Anon read' = returned data with no authentication.*

| Data type | Live records | Editor privacy label | Anon read |
| :---- | :---- | :---- | :---- |
| **User** | **7,574** | **Privacy rules applied** | **YES (incl. email)** |
| **Request** | **3,880** | **Privacy rules applied** | **YES** |
| **Booking** | **5,681** | **Privacy rules applied** | **No** |
| **Payment** | **18,344** | **Privacy rules applied** | **YES (card last4/name, receipt URLs)** |
| **Message** | **15,244** | **Privacy rules applied** | **YES (full text)** |
| **Conversation** | **5,258** | **Publicly visible** | **YES** |
| **Interested Artists** | **10,646** | **Privacy rules applied** | **not tested** |
| **ARTIST SERVICE** | **6,099** | **Privacy rules applied** | **YES** |
| **ARTIST EXPERIENCE** | **1,256** | **Privacy rules applied** | **YES** |
| **Client Company** | **1,225** | **Privacy rules applied** | **not tested** |
| **Reviews** | **1,130** | **Publicly visible** | **YES** |
| **Resume** | **332** | **Privacy rules applied** | **YES (file URLs)** |
| **Premium Jobs** | **248** | **Privacy rules applied** | **YES** |
| **End Of Year Email** | **144** | **Publicly visible** | **not tested** |
| **Lead-List** | **108** | **Publicly visible** | **not tested** |
| **Affiliations** | **70** | **Privacy rules applied** | **YES** |
| **Studio Leads** | **59,613** | **Privacy rules applied** | **YES** |
| **Backend Log** | **321,401** | **Publicly visible** | **YES** |
| **Log** | **23,687** | **Privacy rules applied** | **not tested** |
| **Benefits** | **28** | **Publicly visible** | **not tested** |
| **Ads** | **1** | **Publicly visible** | **not tested** |
| **Universities** | **1 via API (redirect map references 66 slugs - likely name mismatch)** | **Publicly visible** | **not tested** |
| **BlogPost** | **0** | **Privacy rules applied** | **empty** |
| **Business Type** | **0** | **Publicly visible** | **empty** |
| **Map** | **0** | **Publicly visible** | **empty** |
| **Notifications** | **0** | **Publicly visible** | **empty** |
| **MASTER_ARTIST_TYPE** | **8** | **Privacy rules applied** | **taxonomy** |
| **MASTER_SERVICE_TYPE** | **42** | **Privacy rules applied** | **taxonomy** |
| **MASTER_STYLE_TYPE** | **85** | **Privacy rules applied** | **taxonomy - MISMATCH: new DB master_style_types has 34 (see B10)** |
| **Artist To Client Rate Conversion** | **not fetched** | **Publicly visible** | **not tested** |
| **Client To Artist Rate Conversion** | **not fetched** | **Privacy rules applied** | **not tested** |
| **Device** | **API name not resolved** | **Privacy rules applied** | **not tested** |
| **Reimbursement** | **API name not resolved** | **Privacy rules applied** | **not tested** |

## **B5. Page inventory**

*68 pages plus ~30 reusable elements. Grouped below. 'Legacy' = part of the old client/artist app flows; 'Marketing' = public SEO pages.*

* *Core app (legacy, still live): app, app-new, dashboard-01-new, dashboard-03, dashboard-07, my-dashboard, admin-dashboard, client-dashboard, dance-educators-admin, dev, test, test_jatin, components, sou, one_time.*  
* *Auth and onboarding: auth, login, register, join, onboarding-new, client_onboarding, forgot-password, reset_pw, create-pw.*  
* *Booking and commerce: book, cart-page, invoice, shop, product-page, stripe-connect.*  
* *Discovery: browse, browse-companies, map, network, jobs, dance-teacher-jobs, music-teacher-jobs, side-jobs, side-jobs-pro, hiring.*  
* *Marketing/SEO: index, home, about, benefits, beta, blog, certifications, dance-competitions, dance-judges, dance-studios, dance-teacher-summit, dance-teachers, enterprise, faqs, masterclasses, music-schools, music-teachers, partners, privacy-policy, pro, production, school, terms, thewrkexperience, universities, 404.*  
* *Reusable elements: Header--Client, Header-Enterprise, Nav-Bar-Logged-Out-ADV, Footer, Auth, chat, tooltip_template, plus legacy flow reusables: artist-job-new-mohit, artist-profile-new, artist-to-client_rate_conversion, artist_bookings, artist_home, artist_jobs, artist_profile, client-to-artist_rate_conversion, client_artist_browser, client_booking_details, client_bookings, client_home, client_jobs, Company-Reusable, create_request, edit-job, join-new, join/login, login-new, post-job, post-job-new.*

## **B6. Backend workflows (32 total)**

*All server-side workflows by editor folder. DB trigger = database trigger event; Loop = scheduled/loop pattern; WF API = exposed as a Workflow API endpoint.*

| *Folder* | *Workflow* | *Notes* |
| :---- | :---- | :---- |
| *Uncategorized* | *002 job_slug / 002 set slug* | *slug backfill utilities* |
| *Uncategorized* | *04 send multiple email_inquiry* | *bulk inquiry email* |
| *Uncategorized* | *07 process payment* | *payment processing* |
| *Uncategorized* | *add-artist-manychat* | *ManyChat integration* |
| *Uncategorized* | *Artist Experience LINK NEW* | *DB trigger on ARTIST EXPERIENCE link change* |
| *Uncategorized* | *check_email* | *email verification* |
| *Uncategorized* | *convert-to-resume* | *builds Resume records* |
| *Uncategorized* | *createbookingloop* | *Loop* |
| *Uncategorized* | *get_structured_data_for_request* | *feeds structured request data (used by Manus bridge)* |
| *Uncategorized* | *Interested Artist link change* | *DB trigger* |
| *Uncategorized* | *notify_manus_job* | *BRIDGE: Bubble notifies the new system (Manus) of job events* |
| *Uncategorized* | *send-email / sms* | *generic notification sends* |
| *Uncategorized* | *stripe-subscription* | *Stripe subscription handling* |
| *Uncategorized* | *test-loop* | *test utility* |
| *Uncategorized* | *This creates recurring bookings from a Request* | *scheduled recurring booking generator* |
| *Uncategorized* | *Unnamed endpoint* | *WF API endpoint* |
| *App* | *convert_to_interested_artists* | *conversion utility* |
| *App* | *Request aggregate - Loop / - Search* | *request aggregation* |
| *Booking Related* | *04 send multiple email_cancelled (+ _copy)* | *cancellation emails* |
| *Booking Related* | *04 send multiple email_completed* | *completion emails* |
| *Booking Related* | *booking reminder to artist* | *scheduled reminder* |
| *Create Request Same Day Email* | *Same Day Request (Dance Adjudicators)* | *same-day request blast* |
| *Create Request Same Day Email* | *Same Day Request (Non-Dance Adjudicators)* | *same-day request blast* |
| *Create Request Same Day Email* | *This sends a same-day request to network - Loop* | *Loop* |
| *Manychat* | *save_request* | *ManyChat inbound* |
| *Stripe Webhooks* | *Stripe_webhook_payment_link* | *STRIPE WEBHOOK receiver - breaks at cutover unless repointed* |
| *Temp bulk operations* | *create_user_product / update_user_product* | *one-off data ops* |

*Note: live scheduled-workflow instances (recurring schedules per record) live under Logs \> Scheduler in the editor and were not enumerated individually; the workflow list above is the complete set of definitions.*

## **B7. API Connector connections (13)**

*Custom outbound API connections. Secret values are intentionally NOT reproduced here (see B2 finding 3). Call-to-connection mapping is best-effort where the editor rendering was ambiguous.*

| Connection | Observed calls / purpose |
| :---- | :---- |
| **Stripe (card data)** | **API Call for Card Data (GET customer card sources); auth = live Stripe secret key** |
| **Stripe (dev)** | **Create Product, Create Price, Delete Product, Create payment link, Create session, Get Checkout Session; auth = test key** |
| **Stripe (live)** | **Update Product and related; auth = live Stripe secret key (3rd live key present)** |
| **Backend Workflow** | **Check email, Get Artist Services, Create Booking, Convert job interest artist, Convert jobs to requests (calls this app's own Workflow API)** |
| **Bubble Data API** | **Data API calls; auth = app API token** |
| **SheetDB** | **Google Sheets sync** |
| **Customer IO (dev) / (live)** | **Create Lead and related; bearer token** |
| **OpenAI** | **OpenAI calls** |
| **TimezoneDB** | **timezone lookup** |
| **Google** | **Google API calls** |
| **Manus Webhook** | **outbound webhook to the new system (get_structured_data_for_request)** |

## **B8. Plugins (46 installed)**

*Key installed plugins by function. Payments: Stripe, Stripe Marketplace Express Pro, Stripe Customer Portal. Email/messaging: SendGrid, Brevo (Email, SMS, Whatsapp), QuickEmail Verification. Analytics/CRM: Segment, Intercom API, Google Tag Manager. Mobile: Native Apps (BDK), Ionic Elements. AI: OpenAI ChatGPT/4, Assistant, Vision. Calendar/time: Full Calendar, Better Calendar Time Slots, 1T - List Of Dates, Air Date Time Picker, Relative Time With Moment.Js. UI: Canvas UI Elements, Canvas Utilities, AirAlert, AOS - Animate On Scroll, Chart Element, Classify, Components, Croppie, Export Table CSV, Frames Utilites, Fuzzy Search and Autocomplete, Google Material Icons, Gradient Text, Instant Text, JSON Machine, Material Button Ripples, Multiselect Dropdown, Nocodable Components, Progress Bar, Reset Inputs, Reveal and Hide Password, Rich Text Editor, Slidebar Menu, Toolbox, URL Router For Navigation, 1T - CSV Uploader, Air Copy To Clipboard, Google (OAuth). Several show CAN UPGRADE - plugin updates pending.*

## **B9. Option sets (52)**

*Taxonomy/config option sets: _Option_Benefit_Categories, _Option_Dance Adjudicator_Services, _Option_Date_Type, _Option_Log_Type, _Option_Notification_Type, _Option_Payment_Result_Status, _Option_Payment_Status, _Option_Photographer_Services, _Option_Request_Status, _Option_Source, _Option_Status, _Option_Transaction_Fee, _Option_Transportation_Access, _Option_User_Role, _Option_Videographer_Services, _Option_WeekDays, _Option_Work_You_Offer, _Option_Years_Experience, _Option_Yes_No, _Raashi_Time_Slots, Appointment-Times, Artist Type, Business Type, Dance Studio OS, Is-Hourly?, Jill-Gittleman-Charge, Lead-List, Notifications, Option_RateType, Options_BookingStatus, Options_dateDetails, Options_UI Colors, Rate Type (Request), Stripe_Plans, Tab OS, TEMP - Dance Categories, TEMP - FAQ, TEMP - Hire Dance Teachers, TEMP - Instructors, TEMP - Testimonial, Thumbnails, App Pages, _Option_Admin_Page, _Option_Age_Range, _Option_Artists_Page, _Option_Availability, _Option_Client_Page, _Option_Client_Plan, _Option_Booking_Status, _Option_InterestedArtist. (Editor emoji prefixes omitted.)*

## **B10. Cutover cross-check (Bubble vs the new system from Part 1)**

*This is the proof-of-nothing-lost matrix. Row by row: what Bubble does today, where it lives in the new system, and what must happen before the Bubble app can be retired.*

| *Capability* | *Bubble today* | *New system (Part 1)* | *Cutover risk / action* |
| :---- | :---- | :---- | :---- |
| *User accounts* | *User type, 7,574 records, email+password and Google OAuth; legacy plan flags (Artswrk Basic/PRO, BASIC - LEGACY, Client Premium, Enterprise)* | *New DB users tables; migration workstream exists* | *MUST migrate all 7,574 users incl. auth mapping; verify plan/role flags map to new tiers* |
| *Requests* | *Request type, 3,880 records + same-day request email workflows* | *Requests in new schema* | *Migrate history; same-day email logic must exist in new email system* |
| *Bookings* | *Booking type, 5,681 records; recurring-booking generator; reminders; cancel/complete emails* | *Bookings in new schema* | *Migrate; recurring generator and reminder jobs need equivalents before Bubble scheduler is turned off* |
| *Payments* | *Payment type, 18,344 records; Stripe plugin suites + direct Stripe API Connector calls; Stripe_webhook_payment_link receiver* | *stripe.ts + stripe-products.ts in new backend* | *Stripe webhook endpoint must be repointed to the new backend BEFORE Bubble endpoints go dark; migrate payment history* |
| *Messaging* | *Conversation 5,258 + Message 15,244 (full chat)* | *Chat in new schema* | *Migrate or accept history loss - decide explicitly* |
| *Jobs / Premium Jobs* | *Premium Jobs 248; Interested Artists 10,646 (job interest pipeline); convert workflows* | *Jobs + jobAlerts in new repo* | *Migrate open jobs and interest state; notify_manus_job bridge indicates live two-way sync today* |
| *Artist profile data* | *ARTIST SERVICE 6,099, ARTIST EXPERIENCE 1,256, Affiliations 70, Resume 332, Reviews 1,130* | *New profile schema* | *Migrate; convert-to-resume and link-change DB triggers need equivalents* |
| *Taxonomy* | *MASTER_ARTIST_TYPE 8, MASTER_SERVICE_TYPE 42, MASTER_STYLE_TYPE 85* | *master_style_types has only 34 styles* | *GAP: 85 Bubble styles vs 34 in new DB - reconcile taxonomy before cutover or artist profiles lose style tags* |
| *Email* | *SendGrid (app-level key, @artswrk.com sender) + Brevo plugin + bulk email workflows* | *email.ts + emailTemplates.ts (inline templates verified on main)* | *Sender domain reputation: ensure new system sends via same authenticated domain; End Of Year Email 144 records = prior campaign log* |
| *Native mobile apps* | *Bubble native mobile LIVE + BDK wrapper plugin* | *Unknown - not covered in Part 1 repo* | *OPEN QUESTION: app-store apps point at Bubble today; cutover plan must address mobile before domain flip* |
| *Analytics/CRM* | *Segment, Intercom, Google Tag Manager, Customer.io (dev+live)* | *Not seen in Part 1 repo* | *Re-instrument on new site or lose tracking continuity* |
| *SEO/marketing pages* | *~40 marketing pages + Universities redirect slugs (66)* | *New site + redirect-map.csv* | *Redirect map exists in repo; verify all 66 university slugs and marketing URLs resolve* |
| *File storage* | *19GB on Bubble S3 (resumes, images)* | *New storage* | *Files referenced by URL will break; migrate or proxy* |
| *Admin ops* | *admin-dashboard page; Studio Leads 59,613; Lead-List 108; Backend Log 321,401; Log 23,687* | *Unknown in new system* | *Studio Leads (59,613 records) is the largest business dataset after logs - confirm it is migrated or exported* |

*Bottom line: nothing in the Bubble inventory is absent from the cross-check above, but five items are genuinely open before cutover: (1) user auth migration for 7,574 accounts, (2) Stripe webhook repointing, (3) the 85-vs-34 style taxonomy gap, (4) the native mobile apps, (5) Studio Leads + message history disposition. The security findings in B2 argue for doing this sooner rather than later: the legacy app is exposing live PII publicly today.*  
